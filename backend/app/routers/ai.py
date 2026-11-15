import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool

from ..ai_service import SYSTEM_PROMPT, InvalidBoardUpdate, MalformedReply, call_groq, groq_settings, message_content, parse_chat_reply, raise_for_groq_error
from ..deps import get_repository
from ..models import AiChatRequest, AiChatResponse, UserResponse
from ..rate_limit import ai_user
from ..repository import KanbanRepository

# Both routes need a signed-in session and are rate-limited per account (see ai_user), so the
# app's single shared Groq key can't be drained by anonymous callers or one heavy user.
router = APIRouter(prefix="/api/ai")

HISTORY_LIMIT = 8
MAX_ATTEMPTS = 2


@router.get("/check")
async def ai_connectivity_check(user: UserResponse = Depends(ai_user)) -> dict[str, object]:
    settings = groq_settings()
    response = await call_groq(
        {
            "model": settings.model,
            "messages": [{"role": "user", "content": "Compute 2 + 2 and answer only with a single number."}],
            "reasoning_effort": "low",
            "include_reasoning": False,
            "max_tokens": 100,
        },
        settings,
    )
    raise_for_groq_error(response)
    try:
        answer = message_content(response)
    except ValueError:
        raise HTTPException(status_code=502, detail="Groq response was malformed.") from None
    return {"ok": True, "answer": answer}


@router.post("/chat", response_model=AiChatResponse)
async def ai_chat(
    payload: AiChatRequest,
    user: UserResponse = Depends(ai_user),
    repository: KanbanRepository = Depends(get_repository),
) -> AiChatResponse:
    settings = groq_settings()
    # The board must be one of the caller's own (404 otherwise, like every board route).
    # The client's copy is used as context because it may include edits still being saved.
    await run_in_threadpool(repository.get_board, user.id, payload.board.id)
    await run_in_threadpool(repository.log_ai_chat_message, user.id, payload.board.id, "user", payload.prompt)

    board_json = json.dumps(payload.board.model_dump(mode="json", include={"name", "columns"}), separators=(",", ":"))
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *[message.model_dump() for message in payload.history[-HISTORY_LIMIT:]],
        {"role": "user", "content": payload.prompt},
        {"role": "user", "content": f"Current board JSON: {board_json}"},
    ]

    # Small/fast models occasionally emit invalid JSON or claim a change without including
    # it; one retry resolves most of these transient generation failures.
    for attempt in range(1, MAX_ATTEMPTS + 1):
        response = await call_groq(
            {"model": settings.model, "messages": messages, "reasoning_effort": "medium", "include_reasoning": False, "max_tokens": 1500},
            settings,
        )
        raise_for_groq_error(response)
        is_last_attempt = attempt == MAX_ATTEMPTS
        try:
            reply = parse_chat_reply(message_content(response), payload.board)
        except InvalidBoardUpdate:
            if is_last_attempt:
                raise HTTPException(status_code=502, detail="Groq returned an invalid board update.") from None
            continue
        except (MalformedReply, ValueError):
            if is_last_attempt:
                raise HTTPException(status_code=502, detail="Groq response was malformed.") from None
            continue
        await run_in_threadpool(repository.log_ai_chat_message, user.id, payload.board.id, "assistant", reply.assistant_message)
        return reply

    raise AssertionError("unreachable")

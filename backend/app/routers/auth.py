import os

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response

from ..deps import SESSION_COOKIE_NAME, get_current_user, get_repository
from ..models import ForgotPasswordRequest, ForgotPasswordResponse, LoginRequest, ResetPasswordRequest, SignupRequest, UserResponse
from ..rate_limit import enforce_auth_rate_limit
from ..repository import KanbanRepository, UsernameTakenError

router = APIRouter(prefix="/api/auth")

SESSION_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60


def _session_cookie_secure() -> bool:
    # Render sets RENDER=true on every service it runs, which is the deployed, HTTPS-only
    # environment; local dev/Docker Compose serve plain HTTP, where a Secure cookie would
    # never be sent back by the browser at all.
    return bool(os.getenv("RENDER"))


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_COOKIE_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
        secure=_session_cookie_secure(),
        path="/",
    )


@router.post("/signup", response_model=UserResponse, status_code=201, dependencies=[Depends(enforce_auth_rate_limit)])
def signup(payload: SignupRequest, response: Response, repository: KanbanRepository = Depends(get_repository)) -> UserResponse:
    try:
        user = repository.create_user(payload.username, payload.password)
    except UsernameTakenError as error:
        raise HTTPException(status_code=409, detail="Username is already taken") from error
    _set_session_cookie(response, repository.create_session(user.id))
    return user


@router.post("/login", response_model=UserResponse, dependencies=[Depends(enforce_auth_rate_limit)])
def login(payload: LoginRequest, response: Response, repository: KanbanRepository = Depends(get_repository)) -> UserResponse:
    user = repository.authenticate_user(payload.username, payload.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    _set_session_cookie(response, repository.create_session(user.id))
    return user


@router.post("/logout")
def logout(
    response: Response,
    kanban_session: str | None = Cookie(default=None),
    repository: KanbanRepository = Depends(get_repository),
) -> dict[str, bool]:
    if kanban_session is not None:
        repository.delete_session(kanban_session)
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me", response_model=UserResponse)
def me(user: UserResponse = Depends(get_current_user)) -> UserResponse:
    return user


@router.post("/forgot-password", response_model=ForgotPasswordResponse, dependencies=[Depends(enforce_auth_rate_limit)])
def forgot_password(payload: ForgotPasswordRequest, repository: KanbanRepository = Depends(get_repository)) -> ForgotPasswordResponse:
    token = repository.create_password_reset(payload.username)
    return ForgotPasswordResponse(message="If that account exists, a reset link has been generated.", reset_token=token)


@router.post("/reset-password", dependencies=[Depends(enforce_auth_rate_limit)])
def reset_password(payload: ResetPasswordRequest, repository: KanbanRepository = Depends(get_repository)) -> dict[str, bool]:
    if not repository.reset_password(payload.token, payload.new_password):
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    return {"ok": True}

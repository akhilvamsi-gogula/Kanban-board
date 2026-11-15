from fastapi import Cookie, Depends, HTTPException, Request

from .models import UserResponse
from .repository import KanbanRepository

SESSION_COOKIE_NAME = "kanban_session"


def get_repository(request: Request) -> KanbanRepository:
    # Created in main.py's lifespan handler; tests set it directly.
    return request.app.state.repository


def get_current_user(
    kanban_session: str | None = Cookie(default=None),
    repository: KanbanRepository = Depends(get_repository),
) -> UserResponse:
    if kanban_session is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = repository.get_user_by_session(kanban_session)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

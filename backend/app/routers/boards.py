from fastapi import APIRouter, Depends, Response

from ..deps import get_current_user, get_repository
from ..models import BoardResponse, BoardSummary, BoardUpdate, CreateBoardRequest, UserResponse
from ..repository import KanbanRepository

# Every route is scoped to the signed-in user; a board id that exists but belongs to someone
# else is a 404, indistinguishable from one that doesn't exist.
router = APIRouter(prefix="/api/boards")


@router.get("", response_model=list[BoardSummary])
def list_boards(user: UserResponse = Depends(get_current_user), repository: KanbanRepository = Depends(get_repository)) -> list[BoardSummary]:
    return repository.list_boards(user.id)


@router.post("", response_model=BoardResponse, status_code=201)
def create_board(
    payload: CreateBoardRequest,
    user: UserResponse = Depends(get_current_user),
    repository: KanbanRepository = Depends(get_repository),
) -> BoardResponse:
    return repository.create_board(user.id, payload.name)


@router.get("/{board_id}", response_model=BoardResponse)
def get_board(board_id: str, user: UserResponse = Depends(get_current_user), repository: KanbanRepository = Depends(get_repository)) -> BoardResponse:
    return repository.get_board(user.id, board_id)


@router.put("/{board_id}", response_model=BoardResponse)
def update_board(
    board_id: str,
    board: BoardUpdate,
    user: UserResponse = Depends(get_current_user),
    repository: KanbanRepository = Depends(get_repository),
) -> BoardResponse:
    return repository.save_board(user.id, board_id, board)


@router.patch("/{board_id}", response_model=BoardResponse)
def rename_board(
    board_id: str,
    payload: CreateBoardRequest,
    user: UserResponse = Depends(get_current_user),
    repository: KanbanRepository = Depends(get_repository),
) -> BoardResponse:
    return repository.rename_board(user.id, board_id, payload.name)


@router.delete("/{board_id}", status_code=204)
def delete_board(board_id: str, user: UserResponse = Depends(get_current_user), repository: KanbanRepository = Depends(get_repository)) -> Response:
    repository.delete_board(user.id, board_id)
    return Response(status_code=204)

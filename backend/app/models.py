from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class CardModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=64, pattern=r"^[a-z][a-z0-9-]{0,63}$")
    title: str = Field(min_length=1, max_length=200)
    details: str = Field(default="", max_length=5000)
    position: int = Field(ge=0)

    @field_validator("title", "details")
    @classmethod
    def trim_text(cls, value: str) -> str:
        return value.strip()


class ColumnModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=64, pattern=r"^[a-z][a-z0-9-]{0,63}$")
    name: str = Field(min_length=1, max_length=80)
    accent: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    position: int = Field(ge=0)
    cards: list[CardModel] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def trim_name(cls, value: str) -> str:
        return value.strip()


class BoardUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    columns: list[ColumnModel] = Field(min_length=5, max_length=5)

    @field_validator("name")
    @classmethod
    def trim_board_name(cls, value: str) -> str:
        return value.strip()

    @model_validator(mode="after")
    def validate_structure(self) -> "BoardUpdate":
        columns = self.columns
        if {column.position for column in columns} != set(range(5)):
            raise ValueError("columns must have unique positions 0 through 4")
        if len({column.id for column in columns}) != 5:
            raise ValueError("column IDs must be unique")

        cards = [card for column in columns for card in column.cards]
        if len({card.id for card in cards}) != len(cards):
            raise ValueError("card IDs must be unique")
        for column in columns:
            positions = {card.position for card in column.cards}
            if positions != set(range(len(column.cards))):
                raise ValueError("card positions must be contiguous within each column")
        return self


class BoardResponse(BoardUpdate):
    id: str
    owner_id: str


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: str = Field(min_length=1, max_length=32)
    content: str = Field(min_length=1, max_length=10000)


class AiChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    prompt: str = Field(min_length=1, max_length=2000)
    board: BoardResponse | BoardUpdate | None = None
    history: list[ChatMessage] = Field(default_factory=list)

    @field_validator("prompt", mode="before")
    @classmethod
    def trim_prompt(cls, value: str) -> str:
        if not isinstance(value, str):
            return value
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("prompt cannot be empty")
        return trimmed


class AiChatResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assistant_message: str = Field(min_length=1, max_length=4000)
    board_update: dict[str, object] | None = None

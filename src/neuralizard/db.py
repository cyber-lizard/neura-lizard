from __future__ import annotations
from datetime import datetime, timezone
import time, logging, uuid
from typing import Iterator, Optional
from contextlib import contextmanager
from sqlalchemy import (
    create_engine, Integer, String, Text, DateTime, text,
    ForeignKey, UUID as SAUUID, CheckConstraint
)
from sqlalchemy.orm import (
    DeclarativeBase, Mapped, mapped_column, sessionmaker,
    Session, relationship
)
from sqlalchemy.exc import OperationalError
from .config import settings

class Base(DeclarativeBase):
    pass

class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[uuid.UUID] = mapped_column(SAUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False
    )
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    default_provider: Mapped[str] = mapped_column(String(50))
    default_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    messages: Mapped[list["Message"]] = relationship(back_populates="conversation", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        SAUUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(16))  # user | assistant | system | tool
    content: Mapped[str] = mapped_column(Text)
    provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    response_tokens: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    latency_ms: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    first_token_ms: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False
    )
    conversation: Mapped[Conversation] = relationship(back_populates="messages")
    ratings: Mapped[list["MessageRating"]] = relationship(back_populates="message", cascade="all, delete-orphan")

class MessageRating(Base):
    __tablename__ = "message_ratings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    message_id: Mapped[int] = mapped_column(ForeignKey("messages.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # quick signal: -1, 0, 1
    vote: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    # optional 1..5 score
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    label: Mapped[str | None] = mapped_column(String(32), nullable=True)  # helpful, incorrect, etc.
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False
    )

    __table_args__ = (
        CheckConstraint("vote IN (-1, 0, 1)", name="chk_msg_rating_vote"),
        CheckConstraint("(score IS NULL) OR (score BETWEEN 1 AND 5)", name="chk_msg_rating_score"),
    )

    message: Mapped["Message"] = relationship(back_populates="ratings")

DB_URL = settings.db_url

if DB_URL.startswith("sqlite://"):
    engine = create_engine(
        DB_URL,
        future=True,
        echo=getattr(settings, "db_echo", False),
        pool_pre_ping=True,
    )
else:
    engine = create_engine(
        DB_URL,
        future=True,
        echo=getattr(settings, "db_echo", False),
        pool_pre_ping=True,
        pool_size=getattr(settings, "db_pool_size", 5),
        pool_timeout=getattr(settings, "db_pool_timeout", 30),
    )

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)

def init_db(retries: int = 10, delay: float = 2.0):
    for attempt in range(1, retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            break
        except OperationalError as e:
            logging.warning(f"DB not ready ({attempt}/{retries}): {e}")
            if attempt == retries:
                raise
            time.sleep(delay)
    Base.metadata.create_all(engine)
    logging.info("DB initialized (conversations/messages).")

@contextmanager
def session() -> Iterator[Session]:
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()

def create_conversation(default_provider: str, default_model: Optional[str] = None,
                        user_id: Optional[str] = None, title: Optional[str] = None) -> Conversation:
    with session() as s:
        conv = Conversation(
            default_provider=default_provider,
            default_model=default_model,
            user_id=user_id,
            title=title
        )
        s.add(conv)
        s.commit()
        s.refresh(conv)
        return conv

def add_message(conversation_id: uuid.UUID, role: str, content: str,
                provider: Optional[str], model: Optional[str],
                latency_ms: int = 0, first_token_ms: int = 0,
                prompt_tokens: int = 0, response_tokens: int = 0,
                error: Optional[str] = None) -> Message:
    with session() as s:
        msg = Message(
            conversation_id=conversation_id,
            role=role,
            content=content,
            provider=provider,
            model=model,
            latency_ms=latency_ms,
            first_token_ms=first_token_ms,
            prompt_tokens=prompt_tokens,
            response_tokens=response_tokens,
            error=error
        )
        s.add(msg)
        s.commit()
        s.refresh(msg)
        return msg

def update_message_content(message_id: int, content: str,
                           latency_ms: int | None = None,
                           response_tokens: int | None = None,
                           error: str | None = None,
                           first_token_ms: int | None = None):
    with session() as s:
        msg = s.get(Message, message_id)
        if not msg:
            return
        msg.content = content
        if latency_ms is not None:
            msg.latency_ms = latency_ms
        if response_tokens is not None:
            msg.response_tokens = response_tokens
        if error is not None:
            msg.error = error
        if first_token_ms is not None:
            msg.first_token_ms = first_token_ms
        s.commit()

def add_message_rating(
    message_id: int,
    *,
    user_id: Optional[str] = None,
    vote: int = 0,
    score: Optional[int] = None,
    label: Optional[str] = None,
    comment: Optional[str] = None,
) -> MessageRating:
    with session() as s:
        r = MessageRating(
            message_id=message_id,
            user_id=user_id,
            vote=vote,
            score=score,
            label=label,
            comment=comment,
        )
        s.add(r)
        s.commit()
        s.refresh(r)
        return r
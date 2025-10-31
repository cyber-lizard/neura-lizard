# Set environment variables before any imports
import os
os.environ["db_url"] = "sqlite:///test.db"
os.environ["OPENAI_API_KEY"] = "test-openai-key"
os.environ["ANTHROPIC_API_KEY"] = "test-anthropic-key"
os.environ["GOOGLE_API_KEY"] = "test-google-key"
os.environ["MISTRAL_API_KEY"] = "test-mistral-key"
os.environ["COHERE_API_KEY"] = "test-cohere-key"
os.environ["XAI_API_KEY"] = "test-xai-key"
os.environ["DEEPSEEK_API_KEY"] = "test-deepseek-key"
os.environ["PERPLEXITY_API_KEY"] = "test-perplexity-key"

# Patch DB and provider logic before importing FastAPI app
import sys
import uuid
from unittest.mock import patch

import datetime
class DummyConv:
    def __init__(self, id=None, default_provider=None, title=None):
        self.id = id or str(uuid.uuid4())
        self.default_provider = default_provider or "test"
        self.title = title or "New chat"
        now = datetime.datetime.now()
        self.started_at = now
        self.updated_at = now

class DummyMsg:
    def __init__(self, id=None, role=None, content=None, provider=None, model=None):
        self.id = id or 1
        self.role = role or "user"
        self.content = content or ""
        self.provider = provider or "test"
        self.model = model or "test-model"
        self.created_at = datetime.datetime.now()
        self.latency_ms = 0
        self.first_token_ms = 0
        self.error = None
        self.prompt_tokens = 0
        self.response_tokens = 0

def dummy_create_conversation(default_provider=None):
    return DummyConv(default_provider=default_provider)

def dummy_add_message(conversation_id, role, content, provider, model, prompt_tokens=0):
    return DummyMsg(role=role, content=content, provider=provider, model=model)

def dummy_update_message_content(*args, **kwargs):
    return None

def dummy_add_message_rating(*args, **kwargs):
    class DummyRating:
        id = 1
        created_at = datetime.datetime.now()
        vote = 1
        score = 5
        label = "test"
        comment = "test"
    return DummyRating()

deleted_conversations = set()
class DummySession:
    def __enter__(self): return self
    def __exit__(self, exc_type, exc_val, exc_tb): pass
    def get(self, cls, id):
        if cls.__name__ == "Conversation":
            if id in deleted_conversations:
                return None
            return DummyConv(id=id)
        return None
    def query(self, *args, **kwargs): return self
    def order_by(self, *args, **kwargs): return self
    def offset(self, *args, **kwargs): return self
    def limit(self, *args, **kwargs): return self
    def all(self): return []
    def filter(self, *args, **kwargs):
        # Extract conversation_id for delete simulation
        for arg in args:
            if hasattr(arg, 'right') and isinstance(arg.right, str):
                self._cid = arg.right
        return self
    def delete(self, *args, **kwargs):
        # Simulate deletion and error on double delete
        cid = getattr(self, '_cid', None)
        if cid:
            if cid in deleted_conversations:
                raise Exception("Conversation not found")
            deleted_conversations.add(cid)
        return None
    def commit(self): return None
    def refresh(self, *args, **kwargs): return None

def dummy_session():
    return DummySession()
# Patch provider logic to always return a dummy result
from neuralizard.providers import get_provider
def dummy_get_provider(name: str):
    if name != "test":
        raise ValueError(f"Unknown provider: {name}")
    class DummyProvider:
        def complete(self, prompt, model=None, temperature=None):
            class Result:
                def __init__(self, prompt, model):
                    self.text = f"Echo: {prompt}"
                    self.provider = "test"
                    self.model = model or "test-model"
            return Result(prompt, model)
        def stream(self, prompt, model=None, temperature=None):
            yield f"Echo: {prompt}"
        def list_models(self):
            return ["test-model"]
    return DummyProvider()
patch_provider = patch("neuralizard.providers.get_provider", new=dummy_get_provider)
patch_provider.start()

patch_targets = [
    ("neuralizard.db.create_conversation", dummy_create_conversation),
    ("neuralizard.db.add_message", dummy_add_message),
    ("neuralizard.db.update_message_content", dummy_update_message_content),
    ("neuralizard.db.add_message_rating", dummy_add_message_rating),
    ("neuralizard.db.session", dummy_session),
]

patchers = [patch(target, new=func) for target, func in patch_targets]
for p in patchers:
    p.start()

import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI
from neuralizard.api.routes.chat import router, ChatRequest

app = FastAPI()
app.include_router(router)
client = TestClient(app)

import pytest
import uuid
from fastapi.testclient import TestClient
from fastapi import FastAPI

# Mock DB functions to avoid DB errors in tests
import sys
from unittest.mock import patch

class DummyConv:
    def __init__(self, id=None, default_provider=None, title=None):
        self.id = id or str(uuid.uuid4())
        self.default_provider = default_provider or "test"
        self.title = title or "New chat"
        self.started_at = self.updated_at = None

class DummyMsg:
    def __init__(self, id=None, role=None, content=None, provider=None, model=None):
        self.id = id or 1
        self.role = role or "user"
        self.content = content or ""
        self.provider = provider or "test"
        self.model = model or "test-model"
        self.created_at = None
        self.latency_ms = 0
        self.first_token_ms = 0
        self.error = None
        self.prompt_tokens = 0
        self.response_tokens = 0

def dummy_create_conversation(default_provider=None):
    return DummyConv(default_provider=default_provider)

def dummy_add_message(conversation_id, role, content, provider, model, prompt_tokens=0):
    return DummyMsg(role=role, content=content, provider=provider, model=model)

patch_targets = [
    ("neuralizard.db.create_conversation", dummy_create_conversation),
    ("neuralizard.db.add_message", dummy_add_message),
]

patchers = [patch(target, new=func) for target, func in patch_targets]
for p in patchers:
    p.start()

# Patch environment for tests
os.environ["db_url"] = "sqlite:///test.db"
os.environ["OPENAI_API_KEY"] = "test-openai-key"

from neuralizard.api.routes.chat import router, ChatRequest
from neuralizard.db import create_conversation, session, Conversation, Message

app = FastAPI()
app.include_router(router)
client = TestClient(app)

def test_ping():
    resp = client.get("/chat/ping")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}

def test_complete_valid():
    req = {"prompt": "Hello", "provider": "test"}
    resp = client.post("/chat/complete", json=req)
    assert resp.status_code == 200
    assert "text" in resp.json()
    assert resp.json()["provider"] == "test"

def test_complete_invalid_provider():
    req = {"prompt": "Hello", "provider": "not_a_provider"}
    resp = client.post("/chat/complete", json=req)
    assert resp.status_code == 500
    assert "Provider error" in resp.text

def test_stream_valid():
    req = {"prompt": "Hello", "provider": "test"}
    resp = client.post("/chat/stream", json=req)
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/plain")
    assert "Echo: Hello" in resp.text

def test_stream_invalid_provider():
    req = {"prompt": "Hello", "provider": "not_a_provider"}
    resp = client.post("/chat/stream", json=req)
    assert resp.status_code == 400
    assert "Unknown provider" in resp.text

def test_websocket_new_chat_and_rename():
    with client.websocket_connect("/chat/ws") as ws:
        # Consume initial info frame
        info = ws.receive_json()
        assert info["type"] == "info"
        ws.send_json({"type": "new_chat", "provider": "test"})
        msg = ws.receive_json()
        assert msg["type"] == "conversation_created"
        cid = msg["id"]
        # Rename conversation
        ws.send_json({"type": "rename_conversation", "id": cid, "title": "Renamed Chat"})
        msg2 = ws.receive_json()
        assert msg2["type"] == "conversation_title"
        assert msg2["title"] == "Renamed Chat"
        # Try renaming with empty title
        ws.send_json({"type": "rename_conversation", "id": cid, "title": ""})
        msg3 = ws.receive_json()
        assert msg3["type"] == "error"
        assert "Title must not be empty" in msg3["error"]
        # Try renaming with invalid id
        ws.send_json({"type": "rename_conversation", "id": "not-a-uuid", "title": "Test"})
        msg4 = ws.receive_json()
        assert msg4["type"] == "error"
        assert "Invalid conversation id" in msg4["error"]

def test_websocket_delete_conversation():
    with client.websocket_connect("/chat/ws") as ws:
        # Consume initial info frame
        info = ws.receive_json()
        assert info["type"] == "info"
        ws.send_json({"type": "new_chat", "provider": "test"})
        msg = ws.receive_json()
        cid = msg["id"]
        ws.send_json({"type": "delete_conversation", "id": cid})
        msg2 = ws.receive_json()
        assert msg2["type"] == "conversation_deleted"
        assert msg2["id"] == cid
        # Try deleting again (should error or return deleted)
        ws.send_json({"type": "delete_conversation", "id": cid})
        msg3 = ws.receive_json()
        assert msg3["type"] in ("error", "conversation_deleted")
        if msg3["type"] == "error":
            assert "Conversation not found" in msg3["error"] or "Delete failed" in msg3["error"]

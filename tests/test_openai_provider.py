import os
os.environ["OPENAI_API_KEY"] = "test-key"
os.environ["DB_URL"] = "sqlite:///:memory:"  # <-- Add this line

from neuralizard.providers.openai_provider import OpenAIProvider

class MockModel:
    def __init__(self, id, owned_by="openai", created=1):
        self.id = id
        self.owned_by = owned_by
        self.created = created

class MockClient:
    class models:
        @staticmethod
        def list():
            return type("Resp", (), {"data": [
                MockModel("gpt-4", "openai", 2),
                MockModel("gpt-4-mini", "openai", 3),
                MockModel("gpt-3.5", "openai", 1),
                MockModel("gpt-4-2024-01-01", "openai", 4),
                MockModel("gpt-4-codex", "openai", 5),
            ]})()

def test_openai_provider_init():
    provider = OpenAIProvider()
    assert provider.api_key == "test-key"
    assert provider.default_model

def test_list_models():
    provider = OpenAIProvider()
    provider.client = MockClient()
    models = provider.list_models()
    assert "gpt-4" in models
    assert all(m.startswith("gpt-") for m in models)

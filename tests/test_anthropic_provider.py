import os
os.environ["ANTHROPIC_API_KEY"] = "dummy"
os.environ["DB_URL"] = "sqlite:///:memory:"

from neuralizard.providers.anthropic_provider import AnthropicProvider

class MockModel:
    def __init__(self, id):
        self.id = id

class MockClient:
    class models:
        @staticmethod
        def list():
            return type("Resp", (), {"data": [
                MockModel("claude-3-opus-20240229"),
                MockModel("claude-3-sonnet-20240229"),
                MockModel("claude-3-haiku-20240307"),
            ]})()

def test_anthropic_provider_init():
    provider = AnthropicProvider()
    assert provider.api_key == "dummy"
    assert provider.default_model

def test_list_models():
    provider = AnthropicProvider()
    provider.client = MockClient()
    models = provider.list_models()
    assert any("claude" in m for m in models)
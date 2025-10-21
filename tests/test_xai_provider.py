import os
os.environ["XAI_API_KEY"] = "dummy"
os.environ["DB_URL"] = "sqlite:///:memory:"

from neuralizard.providers.xai_provider import XAIProvider

def test_xai_provider_init():
    provider = XAIProvider(api_key=None)
    assert provider.api_key == "dummy"
    assert provider.default_model

def test_list_models(monkeypatch, requests_mock):
    provider = XAIProvider(api_key=None)
    url = "https://api.x.ai/v1/models"
    requests_mock.get(url, json={"data": [{"id": "grok-4-latest"}, {"id": "grok-1-mini"}]})
    models = provider.list_models()
    assert "grok-4-latest" in models
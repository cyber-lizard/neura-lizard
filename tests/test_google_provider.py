import os
os.environ["GOOGLE_API_KEY"] = "dummy"
os.environ["DB_URL"] = "sqlite:///:memory:"

from neuralizard.providers.google_provider import GoogleProvider

class MockModel:
    def __init__(self, name, methods):
        self.name = name
        self.supported_generation_methods = methods

def test_google_provider_init():
    provider = GoogleProvider()
    assert provider.api_key == "dummy"
    assert provider.default_model

def test_list_models(monkeypatch):
    provider = GoogleProvider()
    provider.include_preview = False
    def mock_list_models():
        return [
            MockModel("models/gemini-2.5-pro-latest", ["generateContent"]),
            MockModel("models/gemini-1.5-flash", ["generateContent"]),
            MockModel("models/gemini-2.0-embed", ["embedContent"]),
        ]
    import google.generativeai as genai
    genai.list_models = mock_list_models
    models = provider.list_models()
    assert any("gemini" in m for m in models)
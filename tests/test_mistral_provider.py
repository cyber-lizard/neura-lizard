import os
os.environ["MISTRAL_API_KEY"] = "dummy"
os.environ["DB_URL"] = "sqlite:///:memory:"

from neuralizard.providers.mistral_provider import MistralProvider

class MockModel:
    def __init__(self, id):
        self.id = id

class MockClient:
    class models:
        @staticmethod
        def list():
            return type("Resp", (), {"data": [
                MockModel("mistral-large-latest"),
                MockModel("codestral-latest"),
                MockModel("mistral-small-2024"),
            ]})()

def test_mistral_provider_init():
    provider = MistralProvider()
    assert provider.api_key == "dummy"
    assert provider.default_model

def test_list_models():
    provider = MistralProvider()
    provider.client = MockClient()
    provider.include_code = True
    models = provider.list_models()
    assert any("mistral" in m for m in models)
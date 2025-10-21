import os
os.environ["PERPLEXITY_API_KEY"] = "dummy"
os.environ["DB_URL"] = "sqlite:///:memory:"

from neuralizard.providers.perplexity_provider import PerplexityProvider

class MockModel:
    def __init__(self, id):
        self.id = id

class MockClient:
    class models:
        @staticmethod
        def list():
            return type("Resp", (), {"data": [
                MockModel("pplx-7b-online"),
                MockModel("pplx-70b-chat"),
            ]})()

def test_perplexity_provider_init():
    provider = PerplexityProvider()
    assert provider.api_key == "dummy"
    assert provider.default_model

def test_list_models():
    provider = PerplexityProvider()
    provider.client = MockClient()
    models = provider.list_models()
    assert any("pplx" in m for m in models)
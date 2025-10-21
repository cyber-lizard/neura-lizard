import os
os.environ["DEEPSEEK_API_KEY"] = "dummy"
os.environ["DB_URL"] = "sqlite:///:memory:"

from neuralizard.providers.deepseek_provider import DeepSeekProvider

class MockModel:
    def __init__(self, id):
        self.id = id

class MockClient:
    class models:
        @staticmethod
        def list():
            return type("Resp", (), {"data": [
                MockModel("deepseek-chat"),
                MockModel("deepseek-coder"),
            ]})()

def test_deepseek_provider_init():
    provider = DeepSeekProvider()
    assert provider.api_key == "dummy"
    assert provider.default_model

def test_list_models():
    provider = DeepSeekProvider()
    provider.client = MockClient()
    models = provider.list_models()
    assert any("deepseek" in m for m in models)
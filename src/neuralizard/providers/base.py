from dataclasses import dataclass
from typing import Protocol

@dataclass
class LLMResult:
    text: str
    provider: str
    model: str
    prompt_tokens: int = 0
    response_tokens: int = 0
    latency_ms: int = 0

class Provider(Protocol):
    name: str
    def complete(self, prompt: str, model: str | None = None) -> LLMResult: ...

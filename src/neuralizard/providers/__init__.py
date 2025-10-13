from .openai_provider import OpenAIProvider
from .anthropic_provider import AnthropicProvider
from .google_provider import GoogleProvider
from .mistral_provider import MistralProvider
from .cohere_provider import CohereProvider
from .xai_provider import XAIProvider
from ..config import settings
from .base import Provider
import os

def get_provider(name: str) -> Provider:
    n = (name or "openai").lower()
    if n == "openai":
        return OpenAIProvider(api_key=settings.openai_api_key)
    if n == "anthropic":
        return AnthropicProvider(api_key=settings.anthropic_api_key)
    if n == "google":
        return GoogleProvider(api_key=settings.google_api_key)
    if n == "mistral":
        return MistralProvider(api_key=settings.mistral_api_key)
    if n == "cohere":
        return CohereProvider(api_key=settings.cohere_api_key)
    if n == "xai":
        return XAIProvider(api_key=settings.xai_api_key)
    raise ValueError(f"Unknown provider: {name}")

def get_available_providers() -> list[str]:
    mapping = {
        "openai": settings.openai_api_key,
        "anthropic": settings.anthropic_api_key,
        "google": settings.google_api_key,
        "mistral": settings.mistral_api_key,
        "cohere": settings.cohere_api_key,
        "xai": settings.xai_api_key,
    }
    return [name for name, key in mapping.items() if key and str(key).strip()]

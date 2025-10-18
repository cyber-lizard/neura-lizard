from .openai_provider import OpenAIProvider
from .anthropic_provider import AnthropicProvider
from .google_provider import GoogleProvider
from .mistral_provider import MistralProvider
from .cohere_provider import CohereProvider
from .xai_provider import XAIProvider
from .deepseek_provider import DeepSeekProvider
from .perplexity_provider import PerplexityProvider
from ..config import settings
from .base import Provider
import os
import time
from typing import Dict, List, Tuple

_DEFAULT_MODELS: dict[str, list[str]] = {
    "openai": ["gpt-4o", "gpt-4o-mini", "gpt-4.1-mini"],
    "anthropic": ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"],
    "google": ["gemini-1.5-pro-latest", "gemini-1.5-flash-latest"],
    "mistral": ["mistral-large-latest", "open-mistral-nemo"],
    "cohere": ["command-r", "command-r-plus"],
    "xai": ["grok-2", "grok-2-mini"],
    "deepseek": ["sfsfdeepseek-chat", "deepseek-reasoner"],
    "perplexity": ["sonar-pro", "sonar-medium-online", "sonar-small-online"],
}

# cache: name -> (timestamp, models)
_MODEL_CACHE: Dict[str, Tuple[float, List[str]]] = {}

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
    if n == "deepseek":
        return DeepSeekProvider(api_key=settings.deepseek_api_key)
    if n == "perplexity":
        return PerplexityProvider(api_key=settings.perplexity_api_key)
    raise ValueError(f"Unknown provider: {name}")

def get_available_providers() -> list[str]:
    mapping = {
        "openai": settings.openai_api_key,
        "anthropic": settings.anthropic_api_key,
        "google": settings.google_api_key,
        "mistral": settings.mistral_api_key,
        "cohere": settings.cohere_api_key,
        "xai": settings.xai_api_key,
        "deepseek": settings.deepseek_api_key,
        "perplexity": settings.perplexity_api_key,
    }
    return [name for name, key in mapping.items() if key and str(key).strip()]

def get_provider_models(name: str, use_cache: bool = True, ttl: float = 600.0) -> list[str]:
    """
    Return models for a provider by calling its list_models() if available.
    Falls back to a small default list and caches results for ttl seconds.
    """
    key = (name or "").lower()

    try:
        prov = get_provider(key)
        if hasattr(prov, "list_models"):
            models = list(prov.list_models() or [])
            return models
        else:
            models = _DEFAULT_MODELS.get(key, [])
            return models
    except Exception:
        models = _DEFAULT_MODELS.get(key, [])
        return models

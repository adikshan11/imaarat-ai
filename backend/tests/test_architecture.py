import ast
import inspect
from importlib import import_module
from pathlib import Path

import pytest
from app import config, providers
from app.providers.base import Provider

APP = Path(__file__).resolve().parents[1] / "app"
VENDOR_SDKS = ("google.genai", "google.generativeai", "openai", "anthropic", "boto3", "botocore", "sarvamai", "mistralai", "cohere")


def imported_modules(path: Path) -> set[str]:
    names = set()
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.Import):
            names.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            names.add(node.module)
            names.update(f"{node.module}.{alias.name}" for alias in node.names)
    return names


def app_files_outside_providers():
    return [path for path in APP.rglob("*.py") if "providers" not in path.relative_to(APP).parts]


def test_vendor_sdks_are_only_imported_by_provider_adapters():
    offenders = {str(path.relative_to(APP)): sorted(name for name in imported_modules(path) if name.startswith(VENDOR_SDKS)) for path in app_files_outside_providers()}
    assert {path: names for path, names in offenders.items() if names} == {}


def test_the_rest_of_the_app_uses_providers_only_through_the_package():
    adapters = {target.split(":")[0] for target in providers.ADAPTERS.values()}
    offenders = {str(path.relative_to(APP)): sorted(imported_modules(path) & adapters) for path in app_files_outside_providers()}
    assert {path: names for path, names in offenders.items() if names} == {}


@pytest.mark.parametrize("name", sorted(providers.ADAPTERS))
def test_every_adapter_follows_the_provider_contract(name):
    module, attribute = providers.ADAPTERS[name].split(":")
    adapter = getattr(import_module(module), attribute)
    assert adapter.name == name
    for method in ("generate", "count_tokens", "embed"):
        expected = list(inspect.signature(getattr(Provider, method)).parameters)
        assert list(inspect.signature(getattr(adapter, method)).parameters) == expected, method


def test_an_unknown_provider_fails_with_the_known_names(monkeypatch):
    monkeypatch.setattr(config, "AI_PROVIDER", "nope")
    with pytest.raises(providers.ProviderError, match="gemini"):
        providers.get_provider()

"""Config flow Millésime v6.3.4."""
from __future__ import annotations
from typing import Any

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.data_entry_flow import FlowResult

from . import DOMAIN

GEMINI_HELP = (
    "Optionnel mais recommandé. "
    "Obtenez votre clé gratuite ici (compte Google requis) : "
    "https://aistudio.google.com/app/apikey\n"
    "→ Cliquez 'Create API Key' → Copiez la clé → Collez-la ci-dessous.\n"
    "Limite gratuite : 1 500 requêtes/jour (gemini-1.5-flash).\n"
    "Sans clé, la recherche utilise Open Food Facts (150 000+ vins, sans notes de dégustation)."
)


def _clean_key(raw: str | None) -> str:
    """Nettoie une clé Gemini saisie (espaces, guillemets éventuels collés au copier-coller)."""
    key = (raw or "").strip()
    # Retire d'éventuels guillemets entourant la clé
    if len(key) >= 2 and key[0] in "\"'" and key[-1] in "\"'":
        key = key[1:-1].strip()
    return key


def _key_looks_invalid(key: str) -> bool:
    """Validation souple : la clé n'est rejetée que si elle est manifestement erronée.

    On ne se base plus sur un préfixe (« AI ») car les clés Google ne le partagent
    pas toutes. On vérifie seulement une longueur plausible et l'absence d'espaces
    internes. La vraie validation se fait à l'usage (le backend gère HTTP 400/401/403).
    """
    if not key:
        return False  # vide = pas de clé, autorisé (repli Open Food Facts)
    if any(c.isspace() for c in key):
        return True   # une clé ne contient jamais d'espace
    if len(key) < 20:
        return True   # bien trop courte pour être une clé valide
    return False


class MillesimeConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Config flow pour Millésime."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Étape de configuration initiale."""
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()

        errors: dict[str, str] = {}

        if user_input is not None:
            key = _clean_key(user_input.get("gemini_api_key"))
            if _key_looks_invalid(key):
                errors["gemini_api_key"] = "invalid_key"
            else:
                user_input["gemini_api_key"] = key
                return self.async_create_entry(
                    title=user_input.get("cellar_name", "Millésime"),
                    data=user_input,
                )

        return self.async_show_form(
            step_id="user",
            errors=errors,
            data_schema=vol.Schema({
                vol.Required("cellar_name", default="Millésime"): str,
                vol.Optional("gemini_api_key", default=""): str,
            }),
            description_placeholders={"gemini_help": GEMINI_HELP},
        )

    @staticmethod
    def async_get_options_flow(config_entry):
        """Retourne le flow d'options (modifier la clé après installation)."""
        return MillesimeOptionsFlow(config_entry)


class MillesimeOptionsFlow(config_entries.OptionsFlow):
    """Permet de modifier la clé Gemini après installation."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        self._config_entry = config_entry

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        errors: dict[str, str] = {}

        if user_input is not None:
            key = _clean_key(user_input.get("gemini_api_key"))
            if _key_looks_invalid(key):
                errors["gemini_api_key"] = "invalid_key"
            else:
                return self.async_create_entry(
                    title="",
                    data={"gemini_api_key": key},
                )

        current_key = self._config_entry.options.get(
            "gemini_api_key",
            self._config_entry.data.get("gemini_api_key", ""),
        )

        return self.async_show_form(
            step_id="init",
            errors=errors,
            data_schema=vol.Schema({
                vol.Optional("gemini_api_key", default=current_key): str,
            }),
            description_placeholders={"gemini_help": GEMINI_HELP},
        )

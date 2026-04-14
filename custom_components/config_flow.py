"""Config flow Millésime v3.1.0."""
from __future__ import annotations
from typing import Any

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.data_entry_flow import FlowResult

from . import DOMAIN

GEMINI_HELP = (
    "Optionnel — obtenez une clé gratuite sur "
    "https://aistudio.google.com/app/apikey "
    "(1 500 requêtes/jour avec gemini-1.5-flash)"
)


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
            # Valider la clé Gemini si fournie (format basique)
            key = (user_input.get("gemini_api_key") or "").strip()
            if key and not key.startswith("AI"):
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
            key = (user_input.get("gemini_api_key") or "").strip()
            if key and not key.startswith("AI"):
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

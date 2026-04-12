"""Millésime v3.0.1 — Cave à Vin pour Home Assistant."""
from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime

import voluptuous as vol

from homeassistant.components.websocket_api import (
    ActiveConnection,
    async_register_command,
    async_response,
    websocket_command,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall

_LOGGER = logging.getLogger(__name__)

DOMAIN = "millesime"
PLATFORMS = ["sensor"]
DATA_FILE = "millesime_data.json"

DEFAULT_DATA: dict = {
    "cellar": {"name": "Millésime", "floors": []},
    "bottles": [],
}


# ── Fichier JSON ──────────────────────────────────────────────────────────────

def _path(hass: HomeAssistant) -> str:
    return hass.config.path(DATA_FILE)


def _load(hass: HomeAssistant) -> dict:
    try:
        p = _path(hass)
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as exc:
        _LOGGER.error("Millésime — erreur lecture : %s", exc)
    return json.loads(json.dumps(DEFAULT_DATA))


def _save(hass: HomeAssistant, data: dict) -> None:
    try:
        with open(_path(hass), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as exc:
        _LOGGER.error("Millésime — erreur sauvegarde : %s", exc)


def _uid() -> str:
    return str(uuid.uuid4())[:8]


# ── Setup ─────────────────────────────────────────────────────────────────────

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Initialise l'intégration Millésime."""
    hass.data.setdefault(DOMAIN, {})

    # Charger les données depuis le fichier JSON
    data = await hass.async_add_executor_job(_load, hass)
    hass.data[DOMAIN][entry.entry_id] = {"data": data}

    # Démarrer les plateformes (sensor)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    # ── Commande WebSocket ────────────────────────────────────────────────────
    # Utilisée par la carte Lovelace — connexion déjà authentifiée, pas de token

    @websocket_command({vol.Required("type"): "millesime/get_data"})
    @async_response
    async def ws_get_data(
        hass: HomeAssistant, connection: ActiveConnection, msg: dict
    ) -> None:
        result = await hass.async_add_executor_job(_load, hass)
        connection.send_result(msg["id"], result)

    async_register_command(hass, ws_get_data)

    # ── Helpers internes ──────────────────────────────────────────────────────

    def get_data() -> dict:
        return hass.data[DOMAIN][entry.entry_id]["data"]

    async def persist(d: dict) -> None:
        hass.data[DOMAIN][entry.entry_id]["data"] = d
        await hass.async_add_executor_job(_save, hass, d)
        hass.bus.async_fire(f"{DOMAIN}_updated", {})

    # ── Services ──────────────────────────────────────────────────────────────

    async def add_floor(call: ServiceCall) -> None:
        d = get_data()
        cols = int(call.data.get("columns", 8))
        rows = int(call.data.get("rows", 2))
        d["cellar"]["floors"].append({
            "id": _uid(),
            "name": call.data.get("name", f"Étage {len(d['cellar']['floors']) + 1}"),
            "columns": cols,
            "rows": rows,
            "slots": cols * rows,
            "layout": call.data.get("layout", "side_by_side"),
        })
        await persist(d)

    async def update_floor(call: ServiceCall) -> None:
        d = get_data()
        for f in d["cellar"]["floors"]:
            if f["id"] == call.data["floor_id"]:
                for k in ["name", "columns", "rows", "layout"]:
                    if k in call.data:
                        f[k] = call.data[k]
                f["slots"] = f.get("columns", 8) * f.get("rows", 2)
                break
        await persist(d)

    async def remove_floor(call: ServiceCall) -> None:
        d = get_data()
        fid = call.data["floor_id"]
        d["cellar"]["floors"] = [f for f in d["cellar"]["floors"] if f["id"] != fid]
        d["bottles"] = [b for b in d["bottles"] if b.get("floor_id") != fid]
        await persist(d)

    async def add_bottle(call: ServiceCall) -> None:
        d = get_data()
        d["bottles"].append({
            "id": _uid(),
            "floor_id": call.data.get("floor_id", ""),
            "slot": int(call.data.get("slot", 0)),
            "name": call.data.get("name", ""),
            "vintage": call.data.get("vintage", ""),
            "type": call.data.get("type", "red"),
            "appellation": call.data.get("appellation", ""),
            "region": call.data.get("region", ""),
            "producer": call.data.get("producer", ""),
            "country": call.data.get("country", ""),
            "price": float(call.data.get("price", 0)),
            "quantity": int(call.data.get("quantity", 1)),
            "drink_from": call.data.get("drink_from", ""),
            "drink_until": call.data.get("drink_until", ""),
            "notes": call.data.get("notes", ""),
            "vivino_rating": float(call.data.get("vivino_rating", 0)),
            "image_url": call.data.get("image_url", ""),
            "vivino_url": call.data.get("vivino_url", ""),
            "added_date": datetime.now().strftime("%Y-%m-%d"),
        })
        await persist(d)

    async def remove_bottle(call: ServiceCall) -> None:
        d = get_data()
        d["bottles"] = [b for b in d["bottles"] if b["id"] != call.data["bottle_id"]]
        await persist(d)

    async def update_bottle(call: ServiceCall) -> None:
        d = get_data()
        for b in d["bottles"]:
            if b["id"] == call.data["bottle_id"]:
                for k in [
                    "name", "vintage", "type", "appellation", "region",
                    "producer", "country", "price", "quantity",
                    "drink_from", "drink_until", "notes",
                    "vivino_rating", "image_url", "vivino_url",
                ]:
                    if k in call.data:
                        b[k] = call.data[k]
                break
        await persist(d)

    async def rename_cellar(call: ServiceCall) -> None:
        d = get_data()
        d["cellar"]["name"] = call.data.get("name", "Millésime")
        await persist(d)

    # Enregistrement des services
    hass.services.async_register(DOMAIN, "add_floor", add_floor)
    hass.services.async_register(DOMAIN, "update_floor", update_floor)
    hass.services.async_register(DOMAIN, "remove_floor", remove_floor)
    hass.services.async_register(DOMAIN, "add_bottle", add_bottle)
    hass.services.async_register(DOMAIN, "remove_bottle", remove_bottle)
    hass.services.async_register(DOMAIN, "update_bottle", update_bottle)
    hass.services.async_register(DOMAIN, "rename_cellar", rename_cellar)

    _LOGGER.info("Millésime v3.0.1 démarré avec succès")
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Décharge l'intégration."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)
    return unload_ok

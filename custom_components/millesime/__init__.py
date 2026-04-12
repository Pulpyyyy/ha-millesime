"""Millésime v2 — Cave à Vin pour Home Assistant."""
from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers.json import save_json

_LOGGER = logging.getLogger(__name__)

DOMAIN = "millesime"
PLATFORMS = ["sensor"]
DATA_FILE = "millesime_data.json"

DEFAULT_DATA = {
    "cellar": {"name": "Millésime", "floors": []},
    "bottles": []
}


def _data_path(hass: HomeAssistant) -> str:
    return hass.config.path(DATA_FILE)


def _load(hass: HomeAssistant) -> dict:
    path = _data_path(hass)
    try:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        _LOGGER.error("Millésime: erreur lecture données: %s", e)
    return json.loads(json.dumps(DEFAULT_DATA))


def _save(hass: HomeAssistant, data: dict) -> None:
    path = _data_path(hass)
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        _LOGGER.error("Millésime: erreur sauvegarde: %s", e)


def _uid() -> str:
    return str(uuid.uuid4())[:8]


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data.setdefault(DOMAIN, {})

    # Charger les données depuis le fichier
    data = await hass.async_add_executor_job(_load, hass)
    hass.data[DOMAIN][entry.entry_id] = {"data": data}

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    # ── Helpers ─────────────────────────────────────────────────────────────

    def get_data():
        return hass.data[DOMAIN][entry.entry_id]["data"]

    async def persist(data):
        hass.data[DOMAIN][entry.entry_id]["data"] = data
        await hass.async_add_executor_job(_save, hass, data)
        hass.bus.async_fire(f"{DOMAIN}_updated", {})

    # ── Services ─────────────────────────────────────────────────────────────

    async def add_floor(call: ServiceCall):
        data = get_data()
        cols = int(call.data.get("columns", 6))
        rows = int(call.data.get("rows", 2))
        floor = {
            "id": _uid(),
            "name": call.data.get("name", f"Étage {len(data['cellar']['floors']) + 1}"),
            "columns": cols,
            "rows": rows,
            "slots": cols * rows,
            "layout": call.data.get("layout", "side_by_side"),
        }
        data["cellar"]["floors"].append(floor)
        await persist(data)

    async def update_floor(call: ServiceCall):
        data = get_data()
        fid = call.data["floor_id"]
        for f in data["cellar"]["floors"]:
            if f["id"] == fid:
                for k in ["name", "columns", "rows", "layout"]:
                    if k in call.data:
                        f[k] = call.data[k]
                if "columns" in call.data or "rows" in call.data:
                    f["slots"] = f.get("columns", 6) * f.get("rows", 2)
                break
        await persist(data)

    async def remove_floor(call: ServiceCall):
        data = get_data()
        fid = call.data["floor_id"]
        data["cellar"]["floors"] = [f for f in data["cellar"]["floors"] if f["id"] != fid]
        data["bottles"] = [b for b in data["bottles"] if b.get("floor_id") != fid]
        await persist(data)

    async def add_bottle(call: ServiceCall):
        data = get_data()
        bottle = {
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
            "aromas": call.data.get("aromas", []),
            "pairings": call.data.get("pairings", []),
            "grapes": call.data.get("grapes", []),
            "notes": call.data.get("notes", ""),
            "rating": float(call.data.get("rating", 0)),
            "vivino_rating": float(call.data.get("vivino_rating", 0)),
            "image_url": call.data.get("image_url", ""),
            "vivino_url": call.data.get("vivino_url", ""),
            "added_date": datetime.now().strftime("%Y-%m-%d"),
        }
        data["bottles"].append(bottle)
        await persist(data)

    async def remove_bottle(call: ServiceCall):
        data = get_data()
        data["bottles"] = [b for b in data["bottles"] if b["id"] != call.data["bottle_id"]]
        await persist(data)

    async def update_bottle(call: ServiceCall):
        data = get_data()
        bid = call.data["bottle_id"]
        fields = ["name","vintage","type","appellation","region","producer","country",
                  "price","quantity","drink_from","drink_until","aromas","pairings",
                  "grapes","notes","rating","vivino_rating","image_url","vivino_url",
                  "floor_id","slot"]
        for b in data["bottles"]:
            if b["id"] == bid:
                for f in fields:
                    if f in call.data:
                        b[f] = call.data[f]
                break
        await persist(data)

    async def get_data_svc(call: ServiceCall):
        data = get_data()
        hass.bus.async_fire(f"{DOMAIN}_data", data)

    async def rename_cellar(call: ServiceCall):
        data = get_data()
        data["cellar"]["name"] = call.data.get("name", "Millésime")
        await persist(data)

    hass.services.async_register(DOMAIN, "add_floor", add_floor)
    hass.services.async_register(DOMAIN, "update_floor", update_floor)
    hass.services.async_register(DOMAIN, "remove_floor", remove_floor)
    hass.services.async_register(DOMAIN, "add_bottle", add_bottle)
    hass.services.async_register(DOMAIN, "remove_bottle", remove_bottle)
    hass.services.async_register(DOMAIN, "update_bottle", update_bottle)
    hass.services.async_register(DOMAIN, "get_data", get_data_svc)
    hass.services.async_register(DOMAIN, "rename_cellar", rename_cellar)

    _LOGGER.info("Millésime v2 chargé avec succès")
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)
    return unload_ok

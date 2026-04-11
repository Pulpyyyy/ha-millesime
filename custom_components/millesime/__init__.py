"""Millésime — Cave à Vin pour Home Assistant."""
from __future__ import annotations

import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers.storage import Store

_LOGGER = logging.getLogger(__name__)

DOMAIN = "millesime"
STORAGE_VERSION = 1
STORAGE_KEY = "millesime_data"

PLATFORMS = ["sensor"]

DEFAULT_DATA = {
    "cellar": {
        "name": "Millésime",
        "floors": []
    },
    "bottles": []
}


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Millésime from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
    data = await store.async_load()

    if data is None:
        data = DEFAULT_DATA.copy()
        await store.async_save(data)

    hass.data[DOMAIN][entry.entry_id] = {
        "store": store,
        "data": data,
    }

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    # ── Services ────────────────────────────────────────────────────────────

    async def add_floor(call: ServiceCall) -> None:
        """Ajoute un étage à la cave."""
        entry_data = hass.data[DOMAIN][entry.entry_id]
        cellar_data = entry_data["data"]
        floor = {
            "id": _generate_id(),
            "name": call.data.get("name", f"Étage {len(cellar_data['cellar']['floors']) + 1}"),
            "slots": call.data.get("slots", 12),
            "layout": call.data.get("layout", "side_by_side"),
            "rows": call.data.get("rows", 2),
            "columns": call.data.get("columns", 6),
        }
        cellar_data["cellar"]["floors"].append(floor)
        await entry_data["store"].async_save(cellar_data)
        hass.bus.async_fire(f"{DOMAIN}_updated", {"action": "floor_added", "floor": floor})

    async def remove_floor(call: ServiceCall) -> None:
        """Supprime un étage et ses bouteilles."""
        entry_data = hass.data[DOMAIN][entry.entry_id]
        cellar_data = entry_data["data"]
        floor_id = call.data["floor_id"]
        cellar_data["cellar"]["floors"] = [
            f for f in cellar_data["cellar"]["floors"] if f["id"] != floor_id
        ]
        cellar_data["bottles"] = [
            b for b in cellar_data["bottles"] if b.get("floor_id") != floor_id
        ]
        await entry_data["store"].async_save(cellar_data)
        hass.bus.async_fire(f"{DOMAIN}_updated", {"action": "floor_removed", "floor_id": floor_id})

    async def add_bottle(call: ServiceCall) -> None:
        """Ajoute une bouteille à la cave."""
        entry_data = hass.data[DOMAIN][entry.entry_id]
        cellar_data = entry_data["data"]
        bottle = {
            "id": _generate_id(),
            "floor_id": call.data["floor_id"],
            "slot": call.data["slot"],
            "name": call.data.get("name", "Bouteille inconnue"),
            "vintage": call.data.get("vintage", ""),
            "type": call.data.get("type", "red"),
            "appellation": call.data.get("appellation", ""),
            "producer": call.data.get("producer", ""),
            "price": call.data.get("price", 0.0),
            "quantity": call.data.get("quantity", 1),
            "drink_from": call.data.get("drink_from", ""),
            "drink_until": call.data.get("drink_until", ""),
            "aromas": call.data.get("aromas", []),
            "pairings": call.data.get("pairings", []),
            "notes": call.data.get("notes", ""),
            "rating": call.data.get("rating", 0),
            "image_url": call.data.get("image_url", ""),
            "added_date": call.data.get("added_date", ""),
        }
        cellar_data["bottles"].append(bottle)
        await entry_data["store"].async_save(cellar_data)
        hass.bus.async_fire(f"{DOMAIN}_updated", {"action": "bottle_added", "bottle": bottle})

    async def remove_bottle(call: ServiceCall) -> None:
        """Retire une bouteille de la cave."""
        entry_data = hass.data[DOMAIN][entry.entry_id]
        cellar_data = entry_data["data"]
        bottle_id = call.data["bottle_id"]
        cellar_data["bottles"] = [
            b for b in cellar_data["bottles"] if b["id"] != bottle_id
        ]
        await entry_data["store"].async_save(cellar_data)
        hass.bus.async_fire(f"{DOMAIN}_updated", {"action": "bottle_removed", "bottle_id": bottle_id})

    async def update_bottle(call: ServiceCall) -> None:
        """Met à jour les infos d'une bouteille."""
        entry_data = hass.data[DOMAIN][entry.entry_id]
        cellar_data = entry_data["data"]
        bottle_id = call.data["bottle_id"]
        updatable = ["name", "vintage", "type", "appellation", "producer",
                     "price", "quantity", "drink_from", "drink_until",
                     "aromas", "pairings", "notes", "rating", "image_url"]
        for bottle in cellar_data["bottles"]:
            if bottle["id"] == bottle_id:
                for field in updatable:
                    if field in call.data:
                        bottle[field] = call.data[field]
                break
        await entry_data["store"].async_save(cellar_data)
        hass.bus.async_fire(f"{DOMAIN}_updated", {"action": "bottle_updated", "bottle_id": bottle_id})

    async def get_cellar_data(call: ServiceCall) -> None:
        """Envoie toutes les données de la cave via un événement."""
        entry_data = hass.data[DOMAIN][entry.entry_id]
        hass.bus.async_fire(f"{DOMAIN}_data", entry_data["data"])

    hass.services.async_register(DOMAIN, "add_floor", add_floor)
    hass.services.async_register(DOMAIN, "remove_floor", remove_floor)
    hass.services.async_register(DOMAIN, "add_bottle", add_bottle)
    hass.services.async_register(DOMAIN, "remove_bottle", remove_bottle)
    hass.services.async_register(DOMAIN, "update_bottle", update_bottle)
    hass.services.async_register(DOMAIN, "get_cellar_data", get_cellar_data)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Décharge l'intégration."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)
    return unload_ok


def _generate_id() -> str:
    """Génère un identifiant unique court."""
    import uuid
    return str(uuid.uuid4())[:8]

"""Capteurs Home Assistant pour Millésime."""
from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import DOMAIN


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Initialise les capteurs Millésime."""
    entry_data = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([
        MillesimeTotalBottlesSensor(hass, entry, entry_data),
        MillesimeFloorsSensor(hass, entry, entry_data),
        MillesimeValueSensor(hass, entry, entry_data),
    ], True)


class MillesimeBaseSensor(SensorEntity):
    """Capteur de base pour Millésime."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry, entry_data: dict) -> None:
        self.hass = hass
        self._entry = entry
        self._entry_data = entry_data
        self._attr_should_poll = False

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(
            self.hass.bus.async_listen(f"{DOMAIN}_updated", self._handle_update)
        )

    @callback
    def _handle_update(self, event) -> None:
        self._entry_data["data"] = self.hass.data[DOMAIN][self._entry.entry_id]["data"]
        self.async_write_ha_state()

    @property
    def data(self):
        return self._entry_data["data"]


class MillesimeTotalBottlesSensor(MillesimeBaseSensor):
    """Nombre total de bouteilles."""

    _attr_icon = "mdi:bottle-wine"
    _attr_native_unit_of_measurement = "bouteilles"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._attr_unique_id = f"{DOMAIN}_total_bottles"
        self._attr_name = "Millésime — Total Bouteilles"

    @property
    def native_value(self):
        return sum(b.get("quantity", 1) for b in self.data.get("bottles", []))

    @property
    def extra_state_attributes(self):
        bottles = self.data.get("bottles", [])
        by_type = {}
        for b in bottles:
            t = b.get("type", "unknown")
            by_type[t] = by_type.get(t, 0) + b.get("quantity", 1)
        return {"par_type": by_type, "références": len(bottles)}


class MillesimeFloorsSensor(MillesimeBaseSensor):
    """Nombre d'étages."""

    _attr_icon = "mdi:layers"
    _attr_native_unit_of_measurement = "étages"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._attr_unique_id = f"{DOMAIN}_floors"
        self._attr_name = "Millésime — Étages"

    @property
    def native_value(self):
        return len(self.data.get("cellar", {}).get("floors", []))

    @property
    def extra_state_attributes(self):
        floors = self.data.get("cellar", {}).get("floors", [])
        return {
            "étages": [
                {"id": f["id"], "nom": f["name"], "emplacements": f.get("slots", 0)}
                for f in floors
            ]
        }


class MillesimeValueSensor(MillesimeBaseSensor):
    """Valeur totale de la cave."""

    _attr_icon = "mdi:currency-eur"
    _attr_native_unit_of_measurement = "€"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._attr_unique_id = f"{DOMAIN}_total_value"
        self._attr_name = "Millésime — Valeur Totale"

    @property
    def native_value(self):
        return round(sum(
            b.get("price", 0) * b.get("quantity", 1)
            for b in self.data.get("bottles", [])
        ), 2)

"""Capteurs Millésime v2."""
from __future__ import annotations
import json, os
from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from . import DOMAIN


async def async_setup_entry(hass, entry, async_add_entities):
    entry_data = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([
        MillesimeBottlesSensor(hass, entry, entry_data),
        MillesimeValueSensor(hass, entry, entry_data),
        MillesimeFloorsSensor(hass, entry, entry_data),
    ], True)


class MillesimeBase(SensorEntity):
    def __init__(self, hass, entry, entry_data):
        self.hass = hass
        self._entry = entry
        self._ed = entry_data
        self._attr_should_poll = False

    async def async_added_to_hass(self):
        self.async_on_remove(
            self.hass.bus.async_listen(f"{DOMAIN}_updated", self._on_update)
        )

    @callback
    def _on_update(self, _):
        self._ed["data"] = self.hass.data[DOMAIN][self._entry.entry_id]["data"]
        self.async_write_ha_state()

    @property
    def d(self): return self._ed["data"]


class MillesimeBottlesSensor(MillesimeBase):
    _attr_icon = "mdi:bottle-wine"
    _attr_native_unit_of_measurement = "bouteilles"
    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self._attr_unique_id = f"{DOMAIN}_bottles"
        self._attr_name = "Millésime Bouteilles"
    @property
    def native_value(self):
        return sum(b.get("quantity", 1) for b in self.d.get("bottles", []))
    @property
    def extra_state_attributes(self):
        by_type = {}
        for b in self.d.get("bottles", []):
            t = b.get("type", "red")
            by_type[t] = by_type.get(t, 0) + b.get("quantity", 1)
        return {"par_type": by_type, "références": len(self.d.get("bottles", []))}


class MillesimeValueSensor(MillesimeBase):
    _attr_icon = "mdi:currency-eur"
    _attr_native_unit_of_measurement = "€"
    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self._attr_unique_id = f"{DOMAIN}_value"
        self._attr_name = "Millésime Valeur"
    @property
    def native_value(self):
        return round(sum(b.get("price", 0) * b.get("quantity", 1) for b in self.d.get("bottles", [])), 2)


class MillesimeFloorsSensor(MillesimeBase):
    _attr_icon = "mdi:layers"
    _attr_native_unit_of_measurement = "étages"
    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self._attr_unique_id = f"{DOMAIN}_floors"
        self._attr_name = "Millésime Étages"
    @property
    def native_value(self):
        return len(self.d.get("cellar", {}).get("floors", []))

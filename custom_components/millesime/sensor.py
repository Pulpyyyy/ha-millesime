"""Capteurs Millésime v6.9.2 — globaux + par cave.

Capteurs globaux (toutes caves confondues) :
  - millesime_bottles : nombre total de bouteilles
  - millesime_value   : valeur totale (€)
  - millesime_racks   : nombre total de casiers

Capteurs par cave (id de cave dans l'unique_id) :
  - millesime_<cave>_bottles / millesime_<cave>_value
Les capteurs des caves créées après le démarrage sont ajoutés dynamiquement
à la réception de l'événement millesime_updated.
"""
from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import DOMAIN


def _cellars(data: dict) -> list[dict]:
    return data.get("cellars", []) or []


def _cellar_rack_ids(cellar: dict) -> set[str]:
    return {r.get("id") for r in cellar.get("racks", [])}


def _count_bottles(data: dict, rack_ids: set[str] | None = None) -> int:
    """Nombre de bouteilles (emplacements occupés), éventuellement limité à une cave."""
    total = 0
    for w in data.get("wines", []):
        slots = w.get("slots", [])
        total += len(slots) if rack_ids is None else sum(
            1 for s in slots if s.get("rack_id") in rack_ids
        )
    return total


def _sum_value(data: dict, rack_ids: set[str] | None = None) -> float:
    """Valeur totale (prix × emplacements), éventuellement limitée à une cave."""
    total = 0.0
    for w in data.get("wines", []):
        slots = w.get("slots", [])
        n = len(slots) if rack_ids is None else sum(
            1 for s in slots if s.get("rack_id") in rack_ids
        )
        total += float(w.get("price", 0) or 0) * n
    return round(total, 2)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Initialise les capteurs globaux et un jeu de capteurs par cave."""
    entry_data = hass.data[DOMAIN][entry.entry_id]

    entities: list[SensorEntity] = [
        MillesimeBottlesSensor(hass, entry, entry_data),
        MillesimeValueSensor(hass, entry, entry_data),
        MillesimeRacksSensor(hass, entry, entry_data),
    ]
    known: set[str] = set()
    for cellar in _cellars(entry_data["data"]):
        cid = cellar.get("id")
        if not cid:
            continue
        known.add(cid)
        entities.append(MillesimeCellarBottlesSensor(hass, entry, entry_data, cid))
        entities.append(MillesimeCellarValueSensor(hass, entry, entry_data, cid))
    async_add_entities(entities, True)

    # Caves créées après le démarrage : ajout dynamique de leurs capteurs
    @callback
    def _maybe_add_cellars(_event) -> None:
        data = hass.data[DOMAIN][entry.entry_id]["data"]
        new: list[SensorEntity] = []
        for cellar in _cellars(data):
            cid = cellar.get("id")
            if cid and cid not in known:
                known.add(cid)
                new.append(MillesimeCellarBottlesSensor(hass, entry, entry_data, cid))
                new.append(MillesimeCellarValueSensor(hass, entry, entry_data, cid))
        if new:
            async_add_entities(new, True)

    entry.async_on_unload(
        hass.bus.async_listen(f"{DOMAIN}_updated", _maybe_add_cellars)
    )


class MillesimeBaseSensor(SensorEntity):
    """Capteur de base Millésime."""

    _attr_should_poll = False

    def __init__(
        self,
        hass: HomeAssistant,
        entry: ConfigEntry,
        entry_data: dict,
    ) -> None:
        self.hass = hass
        self._entry = entry
        self._ed = entry_data

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(
            self.hass.bus.async_listen(f"{DOMAIN}_updated", self._on_update)
        )

    @callback
    def _on_update(self, _event) -> None:
        self._ed["data"] = self.hass.data[DOMAIN][self._entry.entry_id]["data"]
        self.async_write_ha_state()

    @property
    def _data(self) -> dict:
        return self._ed["data"]


# ── Capteurs globaux ──────────────────────────────────────────────────────────

class MillesimeBottlesSensor(MillesimeBaseSensor):
    """Nombre total de bouteilles, toutes caves confondues."""

    _attr_icon = "mdi:bottle-wine"
    _attr_native_unit_of_measurement = "bouteilles"

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self._attr_unique_id = f"{DOMAIN}_bottles"
        self._attr_name = "Millésime Bouteilles"

    @property
    def native_value(self) -> int:
        return _count_bottles(self._data)

    @property
    def extra_state_attributes(self) -> dict:
        by_type: dict = {}
        for w in self._data.get("wines", []):
            t = w.get("type", "red")
            by_type[t] = by_type.get(t, 0) + len(w.get("slots", []))
        return {
            "par_type": by_type,
            "references": len(self._data.get("wines", [])),
            "par_cave": {
                c.get("name", c.get("id", "?")): _count_bottles(self._data, _cellar_rack_ids(c))
                for c in _cellars(self._data)
            },
        }


class MillesimeValueSensor(MillesimeBaseSensor):
    """Valeur totale, toutes caves confondues."""

    _attr_icon = "mdi:currency-eur"
    _attr_native_unit_of_measurement = "€"

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self._attr_unique_id = f"{DOMAIN}_value"
        self._attr_name = "Millésime Valeur"

    @property
    def native_value(self) -> float:
        return _sum_value(self._data)

    @property
    def extra_state_attributes(self) -> dict:
        return {
            "par_cave": {
                c.get("name", c.get("id", "?")): _sum_value(self._data, _cellar_rack_ids(c))
                for c in _cellars(self._data)
            },
        }


class MillesimeRacksSensor(MillesimeBaseSensor):
    """Nombre total de casiers, toutes caves confondues."""

    _attr_icon = "mdi:layers"
    _attr_native_unit_of_measurement = "casiers"

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        # unique_id historique conservé pour ne pas orphaniser l'entité existante
        self._attr_unique_id = f"{DOMAIN}_floors"
        self._attr_name = "Millésime Casiers"

    @property
    def native_value(self) -> int:
        return sum(len(c.get("racks", [])) for c in _cellars(self._data))


# ── Capteurs par cave ─────────────────────────────────────────────────────────

class MillesimeCellarSensor(MillesimeBaseSensor):
    """Capteur rattaché à une cave donnée (résolue par id à chaque lecture)."""

    def __init__(self, hass, entry, entry_data, cellar_id: str) -> None:
        super().__init__(hass, entry, entry_data)
        self._cellar_id = cellar_id

    @property
    def _cellar(self) -> dict | None:
        for c in _cellars(self._data):
            if c.get("id") == self._cellar_id:
                return c
        return None

    @property
    def available(self) -> bool:
        return self._cellar is not None

    def _cellar_name(self) -> str:
        c = self._cellar
        return c.get("name", self._cellar_id) if c else self._cellar_id


class MillesimeCellarBottlesSensor(MillesimeCellarSensor):
    """Nombre de bouteilles d'une cave."""

    _attr_icon = "mdi:bottle-wine"
    _attr_native_unit_of_measurement = "bouteilles"

    def __init__(self, hass, entry, entry_data, cellar_id: str) -> None:
        super().__init__(hass, entry, entry_data, cellar_id)
        self._attr_unique_id = f"{DOMAIN}_{cellar_id}_bottles"

    @property
    def name(self) -> str:
        return f"Millésime {self._cellar_name()} Bouteilles"

    @property
    def native_value(self) -> int:
        c = self._cellar
        return _count_bottles(self._data, _cellar_rack_ids(c)) if c else 0


class MillesimeCellarValueSensor(MillesimeCellarSensor):
    """Valeur d'une cave."""

    _attr_icon = "mdi:currency-eur"
    _attr_native_unit_of_measurement = "€"

    def __init__(self, hass, entry, entry_data, cellar_id: str) -> None:
        super().__init__(hass, entry, entry_data, cellar_id)
        self._attr_unique_id = f"{DOMAIN}_{cellar_id}_value"

    @property
    def name(self) -> str:
        return f"Millésime {self._cellar_name()} Valeur"

    @property
    def native_value(self) -> float:
        c = self._cellar
        return _sum_value(self._data, _cellar_rack_ids(c)) if c else 0.0

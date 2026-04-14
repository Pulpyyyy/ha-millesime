"""Millésime v3.2.0 — Cave à Vin pour Home Assistant.

Recherche texte : Gemini 1.5 Flash (1 500 req/jour gratuit par utilisateur)
Lecture photo   : Gemini Vision (même quota, même clé)
Fallback        : Open Food Facts (sans clé, illimité)
Erreurs         : codes structurés retournés au frontend
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import re
import time
import unicodedata
import uuid
from datetime import datetime

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers.aiohttp_client import async_get_clientsession

_LOGGER = logging.getLogger(__name__)

DOMAIN    = "millesime"
PLATFORMS = ["sensor"]
DATA_FILE = "millesime_data.json"
VERSION   = "3.1.1"

OFF_UA       = f"Millesime-HA/{VERSION} (github.com/yourusername/ha-millesime)"
GEMINI_MODEL = "gemini-1.5-flash"
GEMINI_URL   = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)

# ── Cache ─────────────────────────────────────────────────────────────────────
# Clé texte : évite de refrapper Gemini sur chaque frappe clavier
# Clé photo : une image = une requête, pas de cache utile
_SEARCH_CACHE: dict[str, tuple[float, list]] = {}
_CACHE_TTL = 300  # 5 minutes

# ── Codes d'erreur retournés au frontend ─────────────────────────────────────
# Le frontend affiche un message adapté à chaque code.
ERR_QUOTA_EXCEEDED = "quota_exceeded"   # HTTP 429
ERR_INVALID_KEY    = "invalid_key"      # HTTP 400/401/403
ERR_UNAVAILABLE    = "service_unavailable"  # HTTP 5xx / timeout
ERR_PARSE_ERROR    = "parse_error"      # JSON invalide dans la réponse

DEFAULT_DATA: dict = {
    "cellar": {"name": "Millésime", "floors": []},
    "bottles": [],
}


# ── Stockage JSON ─────────────────────────────────────────────────────────────

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


def _normalize(text: str) -> str:
    t = "".join(
        c for c in unicodedata.normalize("NFD", text.lower())
        if unicodedata.category(c) != "Mn"
    )
    t = re.sub(r"\b(19|20)\d{2}\b", "", t)
    return re.sub(r"\s+", " ", t).strip()


# ── Prompt Gemini (partagé texte + photo) ────────────────────────────────────

_GEMINI_SYSTEM = """\
Tu es un expert mondial en vins et sommelière.
Retourne UNIQUEMENT un tableau JSON valide [], sans markdown ni backticks.
Chaque objet doit avoir exactement ces champs (string, jamais null) :
  name, vintage, type, appellation, region, country, producer,
  tasting_notes, food_pairing, drink_from, drink_until, vivino_rating
Règles :
- type : "red" | "white" | "rose" | "sparkling" | "dessert" uniquement
- vintage / drink_from / drink_until : "YYYY" ou ""
- vivino_rating : décimal 0.0–5.0 (0 si inconnu)
- tasting_notes : 1–2 phrases en français (arômes, texture, finale)
- food_pairing : 2–3 accords en français séparés par des virgules
- Couvrir différents millésimes si possible
- Priorité : vins français > européens > mondiaux\
"""


def _parse_gemini_response(raw: str, source: str) -> tuple[list[dict], str | None]:
    """Parse la réponse JSON de Gemini.

    Retourne (résultats, code_erreur_ou_None).
    """
    if not raw:
        return [], ERR_PARSE_ERROR

    # Nettoyer les backticks résiduels
    raw = re.sub(r"^```(?:json)?\s*", "", raw.strip())
    raw = re.sub(r"\s*```$", "", raw)

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        _LOGGER.warning("Gemini — JSON invalide (%s) : %.200s", source, raw)
        return [], ERR_PARSE_ERROR

    if not isinstance(parsed, list):
        parsed = [parsed]

    results = []
    valid_types = {"red", "white", "rose", "sparkling", "dessert"}
    for w in parsed:
        if not isinstance(w, dict) or not str(w.get("name", "")).strip():
            continue
        results.append({
            "name":          str(w.get("name", "")).strip(),
            "vintage":       str(w.get("vintage", "") or ""),
            "type":          w.get("type") if w.get("type") in valid_types else "red",
            "appellation":   str(w.get("appellation", "") or ""),
            "region":        str(w.get("region", "") or ""),
            "country":       str(w.get("country", "") or ""),
            "producer":      str(w.get("producer", "") or ""),
            "tasting_notes": str(w.get("tasting_notes", "") or ""),
            "food_pairing":  str(w.get("food_pairing", "") or ""),
            "drink_from":    str(w.get("drink_from", "") or ""),
            "drink_until":   str(w.get("drink_until", "") or ""),
            "vivino_rating": round(float(w.get("vivino_rating") or 0), 1),
            "image_url":     "",
            "vivino_url":    "",
        })
    return results, None


def _gemini_error_code(status: int) -> str:
    """Convertit un code HTTP Gemini en code d'erreur Millésime."""
    if status == 429:
        return ERR_QUOTA_EXCEEDED
    if status in (400, 401, 403):
        return ERR_INVALID_KEY
    return ERR_UNAVAILABLE


# ── Recherche Gemini par texte ────────────────────────────────────────────────

async def _gemini_search_text(
    hass: HomeAssistant, query: str, api_key: str
) -> tuple[list[dict], str | None]:
    """Recherche Gemini via texte.

    Retourne (résultats, code_erreur_ou_None).
    """
    session = async_get_clientsession(hass)
    body = {
        "system_instruction": {"parts": [{"text": _GEMINI_SYSTEM}]},
        "contents": [{"parts": [{"text": (
            f'Recherche de vin : "{query}"\n'
            f"Retourne jusqu'à 6 vins correspondants."
        )}]}],
        "generationConfig": {
            "temperature":      0.2,
            "maxOutputTokens":  2048,
            "responseMimeType": "application/json",
        },
    }
    try:
        async with session.post(
            GEMINI_URL,
            params={"key": api_key},
            json=body,
            headers={"Content-Type": "application/json"},
            timeout=15,
        ) as resp:
            if resp.status != 200:
                code = _gemini_error_code(resp.status)
                _LOGGER.warning("Gemini texte HTTP %s ('%s') → %s", resp.status, query, code)
                return [], code
            data = await resp.json(content_type=None)

        raw = (
            data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
        )
        results, err = _parse_gemini_response(raw, f"texte:'{query}'")
        _LOGGER.info("Gemini texte: %d résultat(s) pour '%s'", len(results), query)
        return results, err

    except asyncio.TimeoutError:
        _LOGGER.warning("Gemini texte timeout pour '%s'", query)
        return [], ERR_UNAVAILABLE
    except Exception as exc:
        _LOGGER.warning("Gemini texte erreur pour '%s': %s", query, exc)
        return [], ERR_UNAVAILABLE


# ── Lecture d'étiquette par photo ─────────────────────────────────────────────

async def _gemini_analyze_photo(
    hass: HomeAssistant, image_b64: str, mime_type: str, api_key: str
) -> tuple[list[dict], str | None]:
    """Analyse une photo d'étiquette via Gemini Vision.

    image_b64 : image encodée en base64
    mime_type : "image/jpeg" | "image/png" | "image/webp"
    Retourne (résultats, code_erreur_ou_None).
    """
    session = async_get_clientsession(hass)

    photo_prompt = (
        "Analyse cette étiquette de bouteille de vin. "
        "Identifie le vin et retourne UN objet JSON avec les informations du vin. "
        "Si l'image n'est pas une étiquette de vin, retourne []."
    )

    body = {
        "system_instruction": {"parts": [{"text": _GEMINI_SYSTEM}]},
        "contents": [{
            "parts": [
                {"text": photo_prompt},
                {"inline_data": {"mime_type": mime_type, "data": image_b64}},
            ]
        }],
        "generationConfig": {
            "temperature":      0.1,
            "maxOutputTokens":  1024,
            "responseMimeType": "application/json",
        },
    }
    try:
        async with session.post(
            GEMINI_URL,
            params={"key": api_key},
            json=body,
            headers={"Content-Type": "application/json"},
            timeout=20,
        ) as resp:
            if resp.status != 200:
                code = _gemini_error_code(resp.status)
                _LOGGER.warning("Gemini photo HTTP %s → %s", resp.status, code)
                return [], code
            data = await resp.json(content_type=None)

        raw = (
            data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
        )
        results, err = _parse_gemini_response(raw, "photo")
        _LOGGER.info("Gemini photo: %d vin(s) identifié(s)", len(results))
        return results, err

    except asyncio.TimeoutError:
        _LOGGER.warning("Gemini photo timeout")
        return [], ERR_UNAVAILABLE
    except Exception as exc:
        _LOGGER.warning("Gemini photo erreur: %s", exc)
        return [], ERR_UNAVAILABLE


# ── Open Food Facts (fallback texte) ─────────────────────────────────────────

_WINE_TYPE_MAP: dict[str, str] = {
    "en:red-wines": "red",       "fr:vins-rouges": "red",
    "en:white-wines": "white",   "fr:vins-blancs": "white",
    "en:rose-wines": "rose",     "fr:vins-roses": "rose",
    "en:sparkling-wines": "sparkling", "en:champagnes": "sparkling",
    "fr:champagnes": "sparkling",      "fr:cremants": "sparkling",
    "en:dessert-wines": "dessert",     "fr:vins-liquoreux": "dessert",
}
_APPELLATION_MAP: dict[str, str] = {
    "bordeaux": "Bordeaux",       "bourgogne": "Bourgogne",
    "burgundy": "Bourgogne",      "champagne": "Champagne",
    "alsace": "Alsace",           "loire": "Vallée de la Loire",
    "rhone": "Vallée du Rhône",   "cotes-du-rhone": "Côtes du Rhône",
    "provence": "Provence",       "languedoc": "Languedoc",
    "beaujolais": "Beaujolais",   "saint-emilion": "Saint-Émilion",
    "pomerol": "Pomerol",         "medoc": "Médoc",
    "pauillac": "Pauillac",       "sauternes": "Sauternes",
    "chablis": "Chablis",         "roussillon": "Roussillon",
    "minervois": "Minervois",     "corbieres": "Corbières",
    "fitou": "Fitou",             "bergerac": "Bergerac",
    "cahors": "Cahors",           "madiran": "Madiran",
    "bandol": "Bandol",           "banyuls": "Banyuls",
    "gigondas": "Gigondas",       "chateauneuf": "Châteauneuf-du-Pape",
    "chinon": "Chinon",           "sancerre": "Sancerre",
    "vouvray": "Vouvray",         "muscadet": "Muscadet",
    "pouilly": "Pouilly-Fumé",
}
_COUNTRY_MAP: dict[str, str] = {
    "france": "France",       "fr": "France",
    "italy": "Italie",        "it": "Italie",
    "spain": "Espagne",       "es": "Espagne",
    "portugal": "Portugal",   "pt": "Portugal",
    "germany": "Allemagne",   "de": "Allemagne",
    "austria": "Autriche",    "argentina": "Argentine",
    "chile": "Chili",         "australia": "Australie",
    "united-states": "États-Unis", "us": "États-Unis",
    "south-africa": "Afrique du Sud", "new-zealand": "Nouvelle-Zélande",
}


def _parse_off_product(p: dict) -> dict | None:
    raw = (p.get("product_name") or "").strip()
    if not raw or len(raw) < 3:
        return None
    m = re.search(r"\b((19|20)\d{2})\b", raw)
    vintage = m.group(1) if m else ""
    name    = re.sub(r"\s*\b" + vintage + r"\b\s*", " ", raw).strip() if vintage else raw

    brands   = (p.get("brands") or "").split(",")
    producer = brands[0].strip() if brands else ""
    cats     = p.get("categories_tags") or []
    labels   = p.get("labels_tags") or []
    countries = p.get("countries_tags") or []
    origins  = (p.get("origins") or "").strip()
    image    = p.get("image_url") or p.get("image_front_url") or ""

    wine_type   = "red"
    appellation = ""
    for cat in cats:
        for k, v in _WINE_TYPE_MAP.items():
            if k in cat.lower():
                wine_type = v; break
    for src in labels + cats:
        s = src.lower()
        for k, v in _APPELLATION_MAP.items():
            if k in s and not appellation:
                appellation = v; break

    country = ""
    txt = " ".join(countries).lower() + " " + origins.lower()
    for k, v in _COUNTRY_MAP.items():
        if k in txt:
            country = v; break

    if producer.lower() == name.lower():
        producer = ""

    return {
        "name": name, "vintage": vintage, "type": wine_type,
        "appellation": appellation, "region": appellation,
        "country": country, "producer": producer,
        "tasting_notes": "", "food_pairing": "",
        "drink_from": "", "drink_until": "",
        "vivino_rating": 0, "image_url": image, "vivino_url": "",
    }


async def _off_get(session, params: dict) -> dict | None:
    for attempt in range(3):
        try:
            async with session.get(
                "https://world.openfoodfacts.org/cgi/search.pl",
                params=params,
                headers={"User-Agent": OFF_UA},
                timeout=14,
            ) as resp:
                if resp.status == 200:
                    return await resp.json(content_type=None)
                if resp.status == 503 and attempt < 2:
                    await asyncio.sleep(1.5 * (attempt + 1))
                    continue
                return None
        except asyncio.TimeoutError:
            if attempt < 2:
                await asyncio.sleep(1.0)
        except Exception:
            return None
    return None


async def _off_search(hass: HomeAssistant, query: str) -> list[dict]:
    session = async_get_clientsession(hass)
    results: list[dict] = []
    seen: set[str] = set()
    plain = "".join(
        c for c in unicodedata.normalize("NFD", query)
        if unicodedata.category(c) != "Mn"
    )
    fields = (
        "product_name,brands,categories_tags,labels_tags,"
        "image_url,image_front_url,origins,countries_tags"
    )
    for q in list(dict.fromkeys([query, plain])):
        if len(results) >= 8:
            break
        data = await _off_get(session, {
            "search_terms": q, "search_simple": "1",
            "action": "process", "json": "1",
            "tagtype_0": "categories", "tag_contains_0": "contains",
            "tag_0": "wines", "sort_by": "unique_scans_n",
            "fields": fields, "page_size": "20", "lc": "fr,en",
        })
        if not data:
            continue
        for p in (data.get("products") or []):
            item = _parse_off_product(p)
            if not item:
                continue
            key = _normalize(item["name"])
            if key not in seen:
                seen.add(key)
                results.append(item)
                if len(results) >= 8:
                    break
    _LOGGER.info("OFF: %d résultat(s) pour '%s'", len(results), query)
    return results


# ── Orchestrateur principal ───────────────────────────────────────────────────

async def _search_wines(
    hass: HomeAssistant, query: str, gemini_key: str = ""
) -> dict:
    """Orchestrer la recherche texte.

    Retourne {"results": [...], "error": null|code, "source": "gemini"|"off"}.
    """
    cache_key = _normalize(query) + ("_g" if gemini_key else "_o")
    if cache_key in _SEARCH_CACHE:
        ts, cached = _SEARCH_CACHE[cache_key]
        if time.time() - ts < _CACHE_TTL:
            _LOGGER.debug("Cache hit pour '%s'", query)
            return cached

    if gemini_key:
        results, err = await _gemini_search_text(hass, query, gemini_key)
        if err == ERR_QUOTA_EXCEEDED:
            # Quota dépassé → fallback OFF + signaler l'erreur
            _LOGGER.warning("Quota Gemini dépassé, fallback OFF")
            off_results = await _off_search(hass, query)
            response = {"results": off_results, "error": ERR_QUOTA_EXCEEDED, "source": "off"}
        elif err:
            # Autre erreur Gemini → fallback OFF silencieux
            off_results = await _off_search(hass, query)
            response = {"results": off_results, "error": err, "source": "off"}
        elif not results:
            # Gemini OK mais aucun résultat → fallback OFF
            off_results = await _off_search(hass, query)
            response = {"results": off_results, "error": None, "source": "off"}
        else:
            response = {"results": results, "error": None, "source": "gemini"}
    else:
        results = await _off_search(hass, query)
        response = {"results": results, "error": None, "source": "off"}

    _SEARCH_CACHE[cache_key] = (time.time(), response)
    if len(_SEARCH_CACHE) > 200:
        oldest = min(_SEARCH_CACHE, key=lambda k: _SEARCH_CACHE[k][0])
        del _SEARCH_CACHE[oldest]

    return response


# ── Setup ─────────────────────────────────────────────────────────────────────

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Initialise Millésime."""
    hass.data.setdefault(DOMAIN, {})
    data = await hass.async_add_executor_job(_load, hass)

    gemini_key = (
        entry.options.get("gemini_api_key")
        or entry.data.get("gemini_api_key")
        or ""
    ).strip()

    hass.data[DOMAIN][entry.entry_id] = {
        "data":       data,
        "gemini_key": gemini_key,
    }

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(_async_options_updated))

    # ── WebSocket : get_data ──────────────────────────────────────────────────

    @websocket_api.websocket_command({vol.Required("type"): "millesime/get_data"})
    @websocket_api.async_response
    async def ws_get_data(hass: HomeAssistant, connection, msg: dict) -> None:
        result = await hass.async_add_executor_job(_load, hass)
        connection.send_result(msg["id"], result)

    websocket_api.async_register_command(hass, ws_get_data)

    # ── WebSocket : search_wine (texte) ───────────────────────────────────────

    @websocket_api.websocket_command({
        vol.Required("type"):  "millesime/search_wine",
        vol.Required("query"): str,
    })
    @websocket_api.async_response
    async def ws_search_wine(hass: HomeAssistant, connection, msg: dict) -> None:
        gkey = hass.data[DOMAIN][entry.entry_id]["gemini_key"]
        response = await _search_wines(hass, msg["query"], gkey)
        connection.send_result(msg["id"], response)

    websocket_api.async_register_command(hass, ws_search_wine)

    # ── WebSocket : analyze_photo ─────────────────────────────────────────────

    @websocket_api.websocket_command({
        vol.Required("type"):      "millesime/analyze_photo",
        vol.Required("image_b64"): str,
        vol.Required("mime_type"): str,
    })
    @websocket_api.async_response
    async def ws_analyze_photo(hass: HomeAssistant, connection, msg: dict) -> None:
        gkey = hass.data[DOMAIN][entry.entry_id]["gemini_key"]
        if not gkey:
            connection.send_result(msg["id"], {
                "results": [],
                "error":   ERR_INVALID_KEY,
                "source":  "gemini",
            })
            return
        results, err = await _gemini_analyze_photo(
            hass, msg["image_b64"], msg["mime_type"], gkey
        )
        connection.send_result(msg["id"], {
            "results": results,
            "error":   err,
            "source":  "gemini",
        })

    websocket_api.async_register_command(hass, ws_analyze_photo)

    # ── Services ──────────────────────────────────────────────────────────────

    def _get() -> dict:
        return hass.data[DOMAIN][entry.entry_id]["data"]

    async def _persist(d: dict) -> None:
        hass.data[DOMAIN][entry.entry_id]["data"] = d
        await hass.async_add_executor_job(_save, hass, d)
        hass.bus.async_fire(f"{DOMAIN}_updated", {})

    async def svc_add_floor(call: ServiceCall) -> None:
        d = _get()
        cols = int(call.data.get("columns", 8))
        rows = int(call.data.get("rows", 2))
        d["cellar"]["floors"].append({
            "id":      _uid(),
            "name":    call.data.get("name", f"Étage {len(d['cellar']['floors']) + 1}"),
            "columns": cols, "rows": rows, "slots": cols * rows,
            "layout":  call.data.get("layout", "side_by_side"),
        })
        await _persist(d)

    async def svc_update_floor(call: ServiceCall) -> None:
        d = _get()
        for f in d["cellar"]["floors"]:
            if f["id"] == call.data["floor_id"]:
                for k in ["name", "columns", "rows", "layout"]:
                    if k in call.data:
                        f[k] = call.data[k]
                f["slots"] = f.get("columns", 8) * f.get("rows", 2)
                break
        await _persist(d)

    async def svc_remove_floor(call: ServiceCall) -> None:
        d = _get()
        fid = call.data["floor_id"]
        d["cellar"]["floors"] = [f for f in d["cellar"]["floors"] if f["id"] != fid]
        d["bottles"]          = [b for b in d["bottles"] if b.get("floor_id") != fid]
        await _persist(d)

    async def svc_add_bottle(call: ServiceCall) -> None:
        d = _get()
        d["bottles"].append({
            "id":           _uid(),
            "floor_id":     call.data.get("floor_id", ""),
            "slot":         int(call.data.get("slot", 0)),
            "name":         call.data.get("name", ""),
            "vintage":      call.data.get("vintage", ""),
            "type":         call.data.get("type", "red"),
            "appellation":  call.data.get("appellation", ""),
            "region":       call.data.get("region", ""),
            "producer":     call.data.get("producer", ""),
            "country":      call.data.get("country", ""),
            "price":        float(call.data.get("price", 0)),
            "quantity":     int(call.data.get("quantity", 1)),
            "drink_from":   call.data.get("drink_from", ""),
            "drink_until":  call.data.get("drink_until", ""),
            "notes":        call.data.get("notes", ""),
            "tasting_notes":call.data.get("tasting_notes", ""),
            "food_pairing": call.data.get("food_pairing", ""),
            "vivino_rating":float(call.data.get("vivino_rating", 0)),
            "image_url":    call.data.get("image_url", ""),
            "vivino_url":   call.data.get("vivino_url", ""),
            "added_date":   datetime.now().strftime("%Y-%m-%d"),
        })
        await _persist(d)

    async def svc_remove_bottle(call: ServiceCall) -> None:
        d = _get()
        d["bottles"] = [b for b in d["bottles"] if b["id"] != call.data["bottle_id"]]
        await _persist(d)

    async def svc_update_bottle(call: ServiceCall) -> None:
        d = _get()
        updatable = [
            "name", "vintage", "type", "appellation", "region", "producer",
            "country", "price", "quantity", "drink_from", "drink_until",
            "notes", "tasting_notes", "food_pairing",
            "vivino_rating", "image_url", "vivino_url",
        ]
        for b in d["bottles"]:
            if b["id"] == call.data["bottle_id"]:
                for k in updatable:
                    if k in call.data:
                        b[k] = call.data[k]
                break
        await _persist(d)

    async def svc_rename_cellar(call: ServiceCall) -> None:
        d = _get()
        d["cellar"]["name"] = call.data.get("name", "Millésime")
        await _persist(d)

    hass.services.async_register(DOMAIN, "add_floor",     svc_add_floor)
    hass.services.async_register(DOMAIN, "update_floor",  svc_update_floor)
    hass.services.async_register(DOMAIN, "remove_floor",  svc_remove_floor)
    hass.services.async_register(DOMAIN, "add_bottle",    svc_add_bottle)
    hass.services.async_register(DOMAIN, "remove_bottle", svc_remove_bottle)
    hass.services.async_register(DOMAIN, "update_bottle", svc_update_bottle)
    hass.services.async_register(DOMAIN, "rename_cellar", svc_rename_cellar)

    mode = "Gemini 1.5 Flash + photo" if gemini_key else "Open Food Facts"
    _LOGGER.info("Millésime v%s démarré — %s", VERSION, mode)
    return True


async def _async_options_updated(hass: HomeAssistant, entry: ConfigEntry) -> None:
    new_key = (entry.options.get("gemini_api_key") or "").strip()
    hass.data[DOMAIN][entry.entry_id]["gemini_key"] = new_key
    _SEARCH_CACHE.clear()
    _LOGGER.info("Millésime — clé Gemini mise à jour, cache vidé")


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if ok:
        hass.data[DOMAIN].pop(entry.entry_id)
    return ok

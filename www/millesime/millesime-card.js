/**
 * Millésime Card v2.0
 * Design inspiré Vinotag — cercles, clayette, luxe sombre
 * Auto-complétion via API Vivino
 * Stockage via fichier JSON (REST API HA)
 */

const DOMAIN = "millesime";

const WINE_COLORS = {
  red:       { dot: "#8B1A1A", bg: "#5C1010", label: "Rouge",        emoji: "🔴" },
  white:     { dot: "#C9A84C", bg: "#7A6020", label: "Blanc",        emoji: "🟡" },
  rose:      { dot: "#D4688A", bg: "#8C3050", label: "Rosé",         emoji: "🌸" },
  sparkling: { dot: "#A8D5BA", bg: "#3A7055", label: "Effervescent", emoji: "✨" },
  dessert:   { dot: "#D4A843", bg: "#7A5820", label: "Liquoreux",    emoji: "🍯" },
};

class MillesimeCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._data = null;
    this._filter = "all";
    this._view = "cellar"; // cellar | bottle
    this._selectedBottle = null;
    this._unsubs = [];
    this._modal = null;
    this._modalCSS = null;
    this._pendingSlot = null; // {floor_id, slot}
  }

  setConfig(config) { this._config = config || {}; this._render(); }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) { this._sub(); this._load(); }
  }

  getCardSize() { return 10; }

  // ── DATA ─────────────────────────────────────────────────────────────────

  _sub() {
    this._hass.connection.subscribeEvents(() => {
      if (!this._modal) this._load();
    }, `${DOMAIN}_updated`).then(u => this._unsubs.push(u));
  }

  async _load() {
    if (!this._hass) return;
    try {
      // Lire via API REST HA — beaucoup plus stable que callWS storage
      const token = this._hass.auth?.data?.access_token || "";
      const res = await fetch("/api/template", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ template: "{{ states }}" }),
      }).catch(() => null);

      // Fallback : lire depuis les attributs du capteur sensor.millesime_bottles
      const sensor = this._hass.states["sensor.millesime_bouteilles"] ||
                     this._hass.states["sensor.millesime_bottles"] ||
                     Object.values(this._hass.states).find(s => s.entity_id.startsWith("sensor.millesime"));

      // Appeler le service get_data pour recevoir l'event avec les données
      await this._hass.callService(DOMAIN, "get_data", {});
    } catch(e) {
      _log("load error", e);
    }
    // Écouter l'event de données en one-shot
    const unsub = await this._hass.connection.subscribeEvents((event) => {
      this._data = event.data;
      unsub();
      this._render();
    }, `${DOMAIN}_data`);
    setTimeout(() => { unsub(); if (!this._data) { this._data = { cellar: { name: "Millésime", floors: [] }, bottles: [] }; this._render(); } }, 3000);
  }

  async _svc(service, data) {
    try {
      await this._hass.callService(DOMAIN, service, data);
      this._closeModal();
      setTimeout(() => this._load(), 700);
      return true;
    } catch(e) {
      alert(`Erreur : ${e.message || JSON.stringify(e)}`);
      return false;
    }
  }

  // ── VIVINO SEARCH ────────────────────────────────────────────────────────

  async _vivinoSearch(query) {
    try {
      const url = `https://www.vivino.com/api/explore?q=${encodeURIComponent(query)}&language=fr&wine_type_ids[]=1&wine_type_ids[]=2&wine_type_ids[]=3&wine_type_ids[]=4`;
      // Via proxy CORS — Vivino bloque les appels directs depuis browser
      // On utilise un proxy public ou allorigins
      const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent("https://www.vivino.com/api/explore?q=" + encodeURIComponent(query) + "&language=fr&per_page=5")}`;
      const res = await fetch(proxy, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return [];
      const json = await res.json();
      const data = JSON.parse(json.contents || "{}");
      const wines = data?.explore_vintage?.matches || [];
      return wines.slice(0, 5).map(m => ({
        name: m.vintage?.wine?.name || "",
        vintage: String(m.vintage?.year || ""),
        type: _vivinoType(m.vintage?.wine?.type_id),
        appellation: m.vintage?.wine?.appellation?.name || "",
        region: m.vintage?.wine?.region?.name || "",
        country: m.vintage?.wine?.region?.country?.name || "",
        producer: m.vintage?.wine?.winery?.name || "",
        vivino_rating: m.vintage?.statistics?.ratings_average || 0,
        image_url: m.vintage?.image?.variations?.bottle_medium_url
                   ? "https:" + m.vintage.image.variations.bottle_medium_url
                   : "",
        vivino_url: m.vintage?.wine ? `https://www.vivino.com/wines/${m.vintage.wine.id}` : "",
        drink_from: m.vintage?.wine?.has_valid_ratings ? "" : "",
        grapes: (m.vintage?.wine?.taste?.structure ? [] : []),
      }));
    } catch(e) {
      return [];
    }
  }

  // ── MODAL ─────────────────────────────────────────────────────────────────

  _openModal(type, opts = {}) {
    this._closeModal();

    const css = document.createElement("style");
    css.textContent = MODAL_CSS;
    document.head.appendChild(css);
    this._modalCSS = css;

    const overlay = document.createElement("div");
    overlay.className = "mm-overlay";

    const box = document.createElement("div");
    box.className = "mm-box";

    if (type === "floor") box.innerHTML = this._floorFormHTML(opts.floor);
    else if (type === "bottle") box.innerHTML = this._bottleFormHTML(opts.bottle, opts.pendingSlot);
    else if (type === "bottle-detail") box.innerHTML = this._bottleDetailHTML(opts.bottle);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
    this._modal = overlay;

    overlay.addEventListener("click", e => { if (e.target === overlay) this._closeModal(); });
    box.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => this._closeModal()));

    if (type === "floor") this._bindFloorForm(box, opts.floor);
    else if (type === "bottle") this._bindBottleForm(box, opts.bottle, opts.pendingSlot);
  }

  _closeModal() {
    this._modal?.remove(); this._modal = null;
    this._modalCSS?.remove(); this._modalCSS = null;
  }

  // ── FLOOR FORM ──────────────────────────────────────────────────────────

  _floorFormHTML(floor) {
    const n = (this._data?.cellar?.floors?.length || 0) + 1;
    const isEdit = !!floor;
    return `
      <div class="mm-header">
        <span class="mm-title">${isEdit ? "Modifier l'étage" : "Nouvel étage"}</span>
        <button class="mm-x" data-close>✕</button>
      </div>
      <div class="mm-body">
        <div class="mm-fg"><label class="mm-lbl">Nom</label>
          <input class="mm-in" id="fl-name" value="${floor?.name || "Étage " + n}" placeholder="Bordeaux, Cave 1...">
        </div>
        <div class="mm-row">
          <div class="mm-fg"><label class="mm-lbl">Colonnes</label>
            <input class="mm-in" id="fl-cols" type="number" value="${floor?.columns || 8}" min="1" max="20">
          </div>
          <div class="mm-fg"><label class="mm-lbl">Rangées</label>
            <input class="mm-in" id="fl-rows" type="number" value="${floor?.rows || 2}" min="1" max="10">
          </div>
        </div>
        <div class="mm-fg"><label class="mm-lbl">Disposition</label>
          <select class="mm-in" id="fl-layout">
            <option value="side_by_side" ${(floor?.layout||"side_by_side")==="side_by_side"?"selected":""}>Côte à côte</option>
            <option value="alternating" ${floor?.layout==="alternating"?"selected":""}>Tête bêche</option>
          </select>
        </div>
      </div>
      <div class="mm-foot">
        <button class="mm-btn mm-btn-ghost" data-close>Annuler</button>
        <button class="mm-btn mm-btn-gold" id="fl-submit">${isEdit ? "Enregistrer" : "Créer"}</button>
      </div>`;
  }

  _bindFloorForm(box, floor) {
    box.querySelector("#fl-submit").addEventListener("click", async () => {
      const name   = box.querySelector("#fl-name").value.trim() || "Nouvel étage";
      const cols   = parseInt(box.querySelector("#fl-cols").value) || 8;
      const rows   = parseInt(box.querySelector("#fl-rows").value) || 2;
      const layout = box.querySelector("#fl-layout").value;
      if (floor) {
        await this._svc("update_floor", { floor_id: floor.id, name, columns: cols, rows, layout });
      } else {
        await this._svc("add_floor", { name, columns: cols, rows, layout, slots: cols * rows });
      }
    });
  }

  // ── BOTTLE FORM ──────────────────────────────────────────────────────────

  _bottleFormHTML(bottle, pendingSlot) {
    const isEdit = !!bottle;
    const floors = this._data?.cellar?.floors || [];
    return `
      <div class="mm-header">
        <span class="mm-title">${isEdit ? "Modifier" : "Ajouter une bouteille"}</span>
        <button class="mm-x" data-close>✕</button>
      </div>
      <div class="mm-body">

        <!-- Recherche Vivino -->
        <div class="mm-vivino-search">
          <div class="mm-search-wrap">
            <span class="mm-search-icon">🔍</span>
            <input class="mm-in mm-search-in" id="viv-q" 
              placeholder="Recherchez un vin (nom, château, domaine...)" 
              value="${bottle?.name || ""}">
          </div>
          <div id="viv-results" class="mm-viv-results"></div>
        </div>

        <div id="bottle-fields">
          <div class="mm-row">
            <div class="mm-fg">
              <label class="mm-lbl">Nom du vin *</label>
              <input class="mm-in" id="bt-name" value="${bottle?.name || ""}" placeholder="Château Margaux">
            </div>
            <div class="mm-fg">
              <label class="mm-lbl">Millésime</label>
              <input class="mm-in" id="bt-vintage" value="${bottle?.vintage || ""}" placeholder="2019" maxlength="4">
            </div>
          </div>
          <div class="mm-row">
            <div class="mm-fg">
              <label class="mm-lbl">Type</label>
              <select class="mm-in" id="bt-type">
                ${Object.entries(WINE_COLORS).map(([v,c]) =>
                  `<option value="${v}" ${(bottle?.type||"red")===v?"selected":""}>${c.emoji} ${c.label}</option>`
                ).join("")}
              </select>
            </div>
            <div class="mm-fg">
              <label class="mm-lbl">Prix (€)</label>
              <input class="mm-in" id="bt-price" type="number" step="0.5" min="0" value="${bottle?.price || ""}">
            </div>
          </div>
          <div class="mm-row">
            <div class="mm-fg">
              <label class="mm-lbl">Producteur</label>
              <input class="mm-in" id="bt-producer" value="${bottle?.producer || ""}" placeholder="Domaine...">
            </div>
            <div class="mm-fg">
              <label class="mm-lbl">Appellation</label>
              <input class="mm-in" id="bt-appellation" value="${bottle?.appellation || ""}" placeholder="Pomerol...">
            </div>
          </div>
          <div class="mm-row">
            <div class="mm-fg">
              <label class="mm-lbl">À boire à partir de</label>
              <input class="mm-in" id="bt-from" value="${bottle?.drink_from || ""}" placeholder="2024">
            </div>
            <div class="mm-fg">
              <label class="mm-lbl">À boire avant</label>
              <input class="mm-in" id="bt-until" value="${bottle?.drink_until || ""}" placeholder="2035">
            </div>
          </div>
          <div class="mm-row">
            <div class="mm-fg">
              <label class="mm-lbl">Quantité</label>
              <input class="mm-in" id="bt-qty" type="number" min="1" value="${bottle?.quantity || 1}">
            </div>
            <div class="mm-fg">
              <label class="mm-lbl">Note Vivino</label>
              <input class="mm-in" id="bt-vrating" type="number" step="0.1" min="0" max="5" value="${bottle?.vivino_rating || ""}">
            </div>
          </div>
          ${!isEdit ? `
          <div class="mm-row">
            <div class="mm-fg"><label class="mm-lbl">Étage</label>
              <select class="mm-in" id="bt-floor">
                ${floors.map(f => `<option value="${f.id}" ${pendingSlot?.floor_id===f.id?"selected":""}>${f.name}</option>`).join("")}
              </select>
            </div>
            <div class="mm-fg"><label class="mm-lbl">Emplacement</label>
              <input class="mm-in" id="bt-slot" type="number" min="0" value="${pendingSlot?.slot ?? 0}">
            </div>
          </div>` : ""}
          <div class="mm-fg">
            <label class="mm-lbl">Notes personnelles</label>
            <textarea class="mm-in mm-ta" id="bt-notes" placeholder="Impressions, occasion...">${bottle?.notes || ""}</textarea>
          </div>
          <input type="hidden" id="bt-image" value="${bottle?.image_url || ""}">
          <input type="hidden" id="bt-vivino-url" value="${bottle?.vivino_url || ""}">
          <input type="hidden" id="bt-region" value="${bottle?.region || ""}">
          <input type="hidden" id="bt-country" value="${bottle?.country || ""}">
        </div>
      </div>
      <div class="mm-foot">
        <button class="mm-btn mm-btn-ghost" data-close>Annuler</button>
        <button class="mm-btn mm-btn-gold" id="bt-submit">${isEdit ? "Enregistrer" : "Ajouter"}</button>
      </div>`;
  }

  _bindBottleForm(box, bottle, pendingSlot) {
    let searchTimeout;
    const qInput = box.querySelector("#viv-q");
    const results = box.querySelector("#viv-results");

    const fillFields = (w) => {
      const set = (id, val) => { const el = box.querySelector(`#${id}`); if (el && val) el.value = val; };
      set("bt-name", w.name);
      set("bt-vintage", w.vintage);
      set("bt-producer", w.producer);
      set("bt-appellation", w.appellation);
      set("bt-from", w.drink_from);
      set("bt-vrating", w.vivino_rating || "");
      set("bt-image", w.image_url);
      set("bt-vivino-url", w.vivino_url);
      set("bt-region", w.region);
      set("bt-country", w.country);
      if (w.type) { const sel = box.querySelector("#bt-type"); if (sel) sel.value = w.type; }
      results.innerHTML = "";
      results.style.display = "none";
      // Aperçu image
      if (w.image_url) {
        let preview = box.querySelector("#viv-preview");
        if (!preview) {
          preview = document.createElement("img");
          preview.id = "viv-preview";
          preview.style.cssText = "width:60px;height:auto;border-radius:8px;margin:8px auto;display:block;opacity:0.9;";
          box.querySelector("#bottle-fields").insertAdjacentElement("beforebegin", preview);
        }
        preview.src = w.image_url;
      }
    };

    qInput?.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      const q = qInput.value.trim();
      if (q.length < 3) { results.innerHTML = ""; results.style.display = "none"; return; }
      results.innerHTML = `<div class="mm-viv-loading">Recherche Vivino...</div>`;
      results.style.display = "block";
      searchTimeout = setTimeout(async () => {
        const wines = await this._vivinoSearch(q);
        if (!wines.length) {
          results.innerHTML = `<div class="mm-viv-loading">Aucun résultat — remplissez manuellement</div>`;
          return;
        }
        results.innerHTML = wines.map((w, i) => `
          <div class="mm-viv-item" data-idx="${i}">
            ${w.image_url ? `<img src="${w.image_url}" style="width:28px;border-radius:4px;flex-shrink:0">` : `<span style="font-size:20px">${WINE_COLORS[w.type||"red"]?.emoji||"🍷"}</span>`}
            <div style="flex:1;min-width:0">
              <div class="mm-viv-name">${w.name} ${w.vintage || ""}</div>
              <div class="mm-viv-sub">${w.appellation || w.region || ""} ${w.vivino_rating ? "⭐ "+w.vivino_rating : ""}</div>
            </div>
          </div>`).join("");
        results.querySelectorAll(".mm-viv-item").forEach(el =>
          el.addEventListener("click", () => fillFields(wines[parseInt(el.dataset.idx)]))
        );
        // Stocker les wines pour accès
        results._wines = wines;
      }, 600);
    });

    box.querySelector("#bt-submit")?.addEventListener("click", async () => {
      const v = id => box.querySelector(`#${id}`)?.value?.trim() || "";
      const n = id => parseFloat(box.querySelector(`#${id}`)?.value) || 0;
      const i = id => parseInt(box.querySelector(`#${id}`)?.value) || 0;
      const name = v("bt-name");
      if (!name) { alert("Le nom du vin est requis."); return; }
      const data = {
        name, vintage: v("bt-vintage"),
        type: box.querySelector("#bt-type")?.value || "red",
        producer: v("bt-producer"), appellation: v("bt-appellation"),
        region: v("bt-region"), country: v("bt-country"),
        price: n("bt-price"), quantity: i("bt-qty") || 1,
        drink_from: v("bt-from"), drink_until: v("bt-until"),
        notes: v("bt-notes"),
        vivino_rating: n("bt-vrating"),
        image_url: v("bt-image"), vivino_url: v("bt-vivino-url"),
      };
      if (bottle) {
        await this._svc("update_bottle", { bottle_id: bottle.id, ...data });
      } else {
        data.floor_id = box.querySelector("#bt-floor")?.value || "";
        data.slot = i("bt-slot");
        await this._svc("add_bottle", data);
      }
    });
  }

  // ── BOTTLE DETAIL ────────────────────────────────────────────────────────

  _bottleDetailHTML(b) {
    const c = WINE_COLORS[b.type] || WINE_COLORS.red;
    const vr = parseFloat(b.vivino_rating) || 0;
    const stars = vr > 0 ? "★".repeat(Math.round(vr)) + "☆".repeat(5 - Math.round(vr)) : "";
    return `
      <div class="mm-header" style="background:${c.bg}22;border-bottom:1px solid ${c.dot}33">
        <button class="mm-x" data-close>←</button>
        <span class="mm-title">${b.name}</span>
        <span style="color:${c.dot};font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px">${c.label}</span>
      </div>
      <div class="mm-body">
        ${b.image_url ? `<img src="${b.image_url}" style="width:80px;margin:0 auto 16px;display:block;border-radius:8px;opacity:0.95">` : ""}
        <div style="text-align:center;margin-bottom:20px">
          <div style="font-family:'Playfair Display',serif;font-size:22px;color:#F5EDD6">${b.name}</div>
          <div style="color:#A0856A;font-size:13px;margin-top:4px">${b.producer || ""}${b.producer && b.appellation ? " · " : ""}${b.appellation || ""}</div>
          ${vr > 0 ? `<div style="color:#C9A84C;font-size:18px;margin-top:8px">${stars} <small style="font-size:12px;color:#A0856A">${vr.toFixed(1)}/5 Vivino</small></div>` : ""}
          ${b.vivino_url ? `<a href="${b.vivino_url}" target="_blank" style="color:#C9A84C;font-size:12px;text-decoration:none">Voir sur Vivino →</a>` : ""}
        </div>

        <div class="mm-detail-grid">
          ${_drow("Millésime", b.vintage)}
          ${_drow("Type", c.label)}
          ${_drow("Région", [b.region, b.country].filter(Boolean).join(", "))}
          ${_drow("Prix", b.price ? b.price + " €" : "")}
          ${_drow("Quantité", b.quantity > 1 ? b.quantity + " bouteilles" : "")}
          ${_drow("À boire", b.drink_from || b.drink_until ? (b.drink_from || "?") + " — " + (b.drink_until || "?") : "")}
        </div>

        ${b.notes ? `<div class="mm-notes">"${b.notes}"</div>` : ""}
      </div>
      <div class="mm-foot">
        <button class="mm-btn mm-btn-danger" data-rm="${b.id}">Retirer</button>
        <button class="mm-btn mm-btn-ghost" data-edit="${b.id}">Modifier</button>
      </div>`;
  }

  // ── RENDER ───────────────────────────────────────────────────────────────

  _render() {
    const data    = this._data || { cellar: { name: "Millésime", floors: [] }, bottles: [] };
    const floors  = data.cellar?.floors || [];
    const bottles = data.bottles || [];

    this.shadowRoot.innerHTML = CARD_CSS + `
      <div class="card">
        ${this._hdr(data, bottles)}
        ${this._filters()}
        <div class="cellar">
          ${floors.length === 0
            ? `<div class="empty"><div class="empty-icon">🏚️</div><div class="empty-title">Cave vide</div><div class="empty-sub">Ajoutez un étage pour commencer</div></div>`
            : floors.map((f, i) => this._floorHTML(f, bottles, i)).join("")
          }
        </div>
      </div>`;

    this._bindCard(data, bottles);
  }

  _hdr(data, bottles) {
    const tot = bottles.reduce((s, b) => s + (b.quantity || 1), 0);
    const val = bottles.reduce((s, b) => s + (b.price || 0) * (b.quantity || 1), 0);
    const fl  = data.cellar?.floors?.length || 0;
    return `
      <div class="header">
        <div class="header-left">
          <span class="header-icon">🍷</span>
          <div>
            <div class="header-name">${data.cellar?.name || "Millésime"}</div>
            <div class="header-sub">Cave à vin</div>
          </div>
        </div>
        <div class="header-stats">
          <div class="hstat"><span class="hval">${tot}</span><span class="hlbl">Bouteilles</span></div>
          <div class="hstat"><span class="hval">${fl}</span><span class="hlbl">Étages</span></div>
          <div class="hstat"><span class="hval">${val > 0 ? Math.round(val) + "€" : "—"}</span><span class="hlbl">Valeur</span></div>
        </div>
        <div class="header-actions">
          <button class="hbtn" id="btn-floor">+ Étage</button>
          <button class="hbtn hbtn-gold" id="btn-bottle">+ Vin</button>
        </div>
      </div>`;
  }

  _filters() {
    const types = [
      { v: "all", l: "Tout", c: "#C9A84C" },
      ...Object.entries(WINE_COLORS).map(([v, c]) => ({ v, l: c.label, c: c.dot })),
    ];
    return `<div class="filters">
      ${types.map(t => `
        <button class="fbtn ${this._filter === t.v ? "fbtn-active" : ""}" data-f="${t.v}">
          <span class="fdot" style="background:${t.c}"></span>${t.l}
        </button>`).join("")}
    </div>`;
  }

  _floorHTML(floor, allBottles, idx) {
    const fb   = allBottles.filter(b => b.floor_id === floor.id);
    const cols = floor.columns || 8;
    const tot  = floor.slots || cols * (floor.rows || 2);
    const isAlt = floor.layout === "alternating";
    const pct  = Math.round((fb.length / tot) * 100);

    let dots = "";
    for (let i = 0; i < tot; i++) {
      const b = fb.find(b => b.slot === i);
      const filtered = this._filter !== "all" && b && b.type !== this._filter;
      const c = b ? WINE_COLORS[b.type] || WINE_COLORS.red : null;
      const isAltEven = isAlt && i % 2 === 1;
      dots += `<div class="dot ${b ? "dot-filled" : "dot-empty"} ${b && b.id === this._selectedBottle ? "dot-sel" : ""} ${isAltEven ? "dot-alt" : ""}"
        data-slot="${i}" data-floor="${floor.id}"
        style="${b ? `--dc:${c.dot};--dbg:${c.bg};opacity:${filtered ? 0.2 : 1}` : ""}"
        title="${b ? b.name + (b.vintage ? " " + b.vintage : "") : "Vide"}"
      ></div>`;
    }

    return `
      <div class="floor" style="animation-delay:${idx * 0.07}s">
        <div class="floor-bar">
          <div class="floor-bar-left">
            <span class="floor-counts">
              ${this._typeCountsHTML(fb)}
            </span>
          </div>
          <div class="floor-dots" style="grid-template-columns:repeat(${cols},1fr)">${dots}</div>
          <div class="floor-bar-right">
            <button class="floor-edit" data-edit-floor="${floor.id}" title="Modifier">⚙️</button>
            <button class="floor-del" data-del-floor="${floor.id}" title="Supprimer">✕</button>
          </div>
        </div>
        <div class="floor-label">${floor.name} <span class="floor-pct">${pct}%</span></div>
      </div>`;
  }

  _typeCountsHTML(bottles) {
    const by = {};
    bottles.forEach(b => { by[b.type] = (by[b.type] || 0) + (b.quantity || 1); });
    return Object.entries(by).map(([t, n]) => {
      const c = WINE_COLORS[t] || WINE_COLORS.red;
      return `<span class="tcount" style="--tc:${c.dot}">${n}x</span>`;
    }).join("");
  }

  _bindCard(data, bottles) {
    const s = this.shadowRoot;

    s.querySelectorAll("[data-f]").forEach(b =>
      b.addEventListener("click", () => { this._filter = b.dataset.f; this._render(); })
    );

    s.getElementById("btn-floor")?.addEventListener("click", () => this._openModal("floor"));
    s.getElementById("btn-bottle")?.addEventListener("click", () => {
      if (!data.cellar.floors.length) { alert("Créez d'abord un étage !"); return; }
      this._openModal("bottle");
    });

    s.querySelectorAll(".dot").forEach(dot =>
      dot.addEventListener("click", () => {
        const idx = parseInt(dot.dataset.slot);
        const fid = dot.dataset.floor;
        const b = bottles.find(x => x.floor_id === fid && x.slot === idx);
        if (b) {
          if (this._selectedBottle === b.id) {
            this._openModal("bottle-detail", { bottle: b });
            this._selectedBottle = null;
          } else {
            this._selectedBottle = b.id;
            this._render();
          }
        } else {
          this._openModal("bottle", { pendingSlot: { floor_id: fid, slot: idx } });
        }
      })
    );

    s.querySelectorAll("[data-edit-floor]").forEach(b =>
      b.addEventListener("click", e => {
        e.stopPropagation();
        const floor = data.cellar.floors.find(f => f.id === b.dataset.editFloor);
        this._openModal("floor", { floor });
      })
    );

    s.querySelectorAll("[data-del-floor]").forEach(b =>
      b.addEventListener("click", async e => {
        e.stopPropagation();
        const fid = b.dataset.delFloor;
        const fl  = data.cellar.floors.find(f => f.id === fid);
        const nb  = bottles.filter(x => x.floor_id === fid).length;
        if (confirm(`Supprimer "${fl?.name}"${nb ? ` et ses ${nb} bouteille(s)` : ""} ?`))
          await this._svc("remove_floor", { floor_id: fid });
      })
    );

    // Boutons dans modals ouverts
    document.querySelectorAll("[data-rm]").forEach(b =>
      b.addEventListener("click", async () => {
        if (confirm("Retirer cette bouteille ?"))
          await this._svc("remove_bottle", { bottle_id: b.dataset.rm });
      })
    );

    document.querySelectorAll("[data-edit]").forEach(b =>
      b.addEventListener("click", () => {
        const bot = bottles.find(x => x.id === b.dataset.edit);
        if (bot) { this._closeModal(); this._openModal("bottle", { bottle: bot }); }
      })
    );
  }

  disconnectedCallback() {
    this._unsubs.forEach(fn => fn());
    this._closeModal();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function _vivinoType(id) {
  if (!id) return "red";
  const map = { 1: "red", 2: "white", 3: "sparkling", 4: "rose", 7: "dessert" };
  return map[id] || "red";
}

function _drow(label, val) {
  if (!val) return "";
  return `<div class="drow"><span class="dlbl">${label}</span><span class="dval">${val}</span></div>`;
}

function _log(...a) { console.log("[Millésime]", ...a); }

// ── CSS ───────────────────────────────────────────────────────────────────

const CARD_CSS = `
<style>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;500;600&display=swap');
:host {
  display:block;
  --bg0:#0D0D0D;--bg1:#161616;--bg2:#1E1E1E;--bg3:#252525;
  --gold:#C9A84C;--gold2:#E8C86A;--gold3:#7A5C1E;
  --red:#8B1A1A;--cream:#F0E6D3;--muted:#6B6B6B;--border:#2A2A2A;
  font-family:'Inter',sans-serif;
}
*{box-sizing:border-box;margin:0;padding:0;}
.card{background:var(--bg0);border-radius:20px;overflow:hidden;min-height:300px;}

/* HEADER */
.header{
  background:linear-gradient(135deg,#111 0%,#1a1a1a 100%);
  padding:20px 20px 16px;
  display:flex;align-items:center;gap:12px;
  border-bottom:1px solid var(--border);
}
.header-icon{font-size:28px;filter:drop-shadow(0 0 10px var(--gold));animation:pulse 3s ease-in-out infinite;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.7}}
.header-name{font-family:'Playfair Display',serif;font-size:19px;color:var(--cream);letter-spacing:0.5px;}
.header-sub{font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:2px;margin-top:1px;}
.header-stats{display:flex;gap:10px;margin-left:auto;}
.hstat{text-align:center;padding:6px 10px;background:var(--bg2);border-radius:10px;border:1px solid var(--border);}
.hval{display:block;font-size:16px;font-weight:700;color:var(--gold);font-family:'Playfair Display',serif;}
.hlbl{display:block;font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-top:1px;}
.header-actions{display:flex;gap:8px;margin-left:8px;}
.hbtn{padding:7px 13px;border-radius:10px;border:1px solid var(--border);background:var(--bg2);
  color:var(--cream);font-size:12px;font-weight:500;cursor:pointer;transition:all 0.2s;white-space:nowrap;}
.hbtn:hover{background:var(--bg3);border-color:var(--gold3);}
.hbtn-gold{background:var(--gold);color:#0D0D0D;border-color:var(--gold);font-weight:600;}
.hbtn-gold:hover{background:var(--gold2);}

/* FILTERS */
.filters{display:flex;gap:6px;padding:12px 20px;overflow-x:auto;border-bottom:1px solid var(--border);
  scrollbar-width:none;background:var(--bg1);}
.filters::-webkit-scrollbar{display:none;}
.fbtn{padding:5px 12px;border-radius:20px;border:1px solid var(--border);background:transparent;
  color:var(--muted);font-size:11px;font-weight:500;cursor:pointer;transition:all 0.2s;
  display:flex;align-items:center;gap:5px;white-space:nowrap;}
.fbtn:hover,.fbtn-active{background:var(--bg3);border-color:var(--gold3);color:var(--cream);}
.fdot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}

/* CELLAR */
.cellar{padding:16px 20px;display:flex;flex-direction:column;gap:2px;}
.empty{text-align:center;padding:60px 20px;color:var(--muted);}
.empty-icon{font-size:48px;margin-bottom:12px;opacity:0.4;}
.empty-title{font-family:'Playfair Display',serif;color:var(--cream);font-size:16px;margin-bottom:6px;}
.empty-sub{font-size:13px;}

/* FLOOR — style clayette */
.floor{
  margin-bottom:10px;
  animation:si 0.4s ease-out both;
}
@keyframes si{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}

.floor-bar{
  display:flex;align-items:center;gap:8px;
  background:var(--bg1);
  border:1px solid var(--border);
  border-bottom:none;
  border-radius:10px 10px 0 0;
  padding:8px 12px;
  min-height:56px;
}
.floor-bar-left{display:flex;flex-direction:column;gap:3px;min-width:32px;align-items:flex-end;}
.floor-bar-right{display:flex;flex-direction:column;gap:4px;margin-left:4px;}

/* DOTS — les bouteilles comme dans Vinotag */
.floor-dots{
  display:grid;gap:5px;flex:1;align-items:center;
}
.dot{
  width:100%;aspect-ratio:1;border-radius:50%;cursor:pointer;
  transition:transform 0.15s, box-shadow 0.15s;
  position:relative;
}
.dot-empty{
  background:var(--bg3);border:1px solid var(--border);
  opacity:0.4;
}
.dot-empty:hover{opacity:0.7;transform:scale(1.1);}
.dot-filled{
  background:var(--dc,#8B1A1A);
  box-shadow:0 2px 8px var(--dbg,rgba(139,26,26,0.5));
}
.dot-filled:hover{transform:scale(1.15);box-shadow:0 4px 14px var(--dbg,rgba(139,26,26,0.7));}
.dot-sel{
  outline:2px solid var(--gold);outline-offset:2px;
  transform:scale(1.15);
}
/* Tête-bêche : les pairs sont plus petits/décalés */
.dot-alt{
  transform:translateY(4px) scale(0.88);
}
.dot-alt:hover{transform:translateY(4px) scale(1.0);}
.dot-alt.dot-sel{transform:translateY(4px) scale(1.0);}

/* Compteurs par type */
.tcount{font-size:10px;font-weight:600;color:var(--tc,#C9A84C);}

/* Floor label — style clayette bois */
.floor-label{
  background:linear-gradient(90deg,#2A1F0E,#3D2B12,#2A1F0E);
  border:1px solid #5C3D1A;border-top:none;
  border-radius:0 0 10px 10px;
  text-align:center;
  font-size:10px;font-weight:600;
  color:#C9A84C;
  letter-spacing:2px;text-transform:uppercase;
  padding:5px 0;
}
.floor-pct{color:#7A5C1E;font-size:9px;margin-left:6px;}
.floor-edit,.floor-del{background:none;border:none;cursor:pointer;font-size:13px;
  padding:2px;opacity:0.4;transition:opacity 0.2s;}
.floor-edit:hover,.floor-del:hover{opacity:1;}

/* DETAIL GRID */
.mm-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;}
.drow{background:var(--bg2);border-radius:8px;padding:10px 12px;border:1px solid var(--border);}
.dlbl{display:block;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:3px;}
.dval{font-size:13px;color:var(--cream);font-weight:500;}
.mm-notes{font-size:13px;color:var(--muted);font-style:italic;background:var(--bg2);
  padding:12px;border-radius:8px;border-left:2px solid var(--gold);line-height:1.5;}
</style>`;

const MODAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;500;600&display=swap');
@keyframes mfade{from{opacity:0}to{opacity:1}}
@keyframes mslide{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
.mm-overlay{
  position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:99999;
  display:flex;align-items:flex-end;justify-content:center;
  animation:mfade 0.2s ease;
  font-family:'Inter',sans-serif;
}
.mm-box{
  background:#161616;border:1px solid #2A2A2A;border-bottom:none;
  border-radius:20px 20px 0 0;
  width:100%;max-width:520px;max-height:92vh;overflow-y:auto;
  animation:mslide 0.28s ease-out;
  color:#F0E6D3;
}
.mm-header{
  display:flex;align-items:center;justify-content:space-between;
  padding:18px 20px 14px;
  border-bottom:1px solid #2A2A2A;
  position:sticky;top:0;background:#161616;z-index:2;
}
.mm-title{font-family:'Playfair Display',serif;font-size:17px;color:#F0E6D3;}
.mm-x{background:none;border:none;color:#6B6B6B;cursor:pointer;font-size:20px;padding:0 4px;transition:color 0.2s;}
.mm-x:hover{color:#F0E6D3;}
.mm-body{padding:18px 20px;}
.mm-foot{padding:14px 20px;border-top:1px solid #2A2A2A;display:flex;gap:10px;justify-content:flex-end;
  position:sticky;bottom:0;background:#161616;}
.mm-fg{margin-bottom:14px;}
.mm-lbl{display:block;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#C9A84C;margin-bottom:5px;}
.mm-in{
  width:100%;padding:10px 12px;background:#0D0D0D;
  border:1px solid #2A2A2A;border-radius:10px;
  color:#F0E6D3;font-family:'Inter',sans-serif;font-size:13px;
  outline:none;transition:border-color 0.2s;box-sizing:border-box;
}
.mm-in:focus{border-color:#C9A84C;box-shadow:0 0 0 2px rgba(201,168,76,0.1);}
.mm-in option{background:#161616;}
.mm-ta{min-height:72px;resize:vertical;}
.mm-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.mm-btn{padding:10px 20px;border-radius:10px;border:none;cursor:pointer;
  font-family:'Inter',sans-serif;font-size:13px;font-weight:600;transition:all 0.2s;}
.mm-btn-gold{background:#C9A84C;color:#0D0D0D;}
.mm-btn-gold:hover{background:#E8C86A;transform:translateY(-1px);}
.mm-btn-ghost{background:#1E1E1E;color:#F0E6D3;border:1px solid #2A2A2A;}
.mm-btn-ghost:hover{background:#252525;}
.mm-btn-danger{background:rgba(180,30,30,0.3);color:#ff6b6b;border:1px solid rgba(180,30,30,0.4);}
.mm-btn-danger:hover{background:rgba(180,30,30,0.6);}

/* Vivino search */
.mm-vivino-search{margin-bottom:18px;}
.mm-search-wrap{position:relative;display:flex;align-items:center;}
.mm-search-icon{position:absolute;left:12px;font-size:14px;pointer-events:none;}
.mm-search-in{padding-left:34px !important;}
.mm-viv-results{
  background:#0D0D0D;border:1px solid #2A2A2A;border-top:none;
  border-radius:0 0 10px 10px;overflow:hidden;display:none;max-height:220px;overflow-y:auto;
}
.mm-viv-item{
  display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;
  border-bottom:1px solid #1a1a1a;transition:background 0.15s;
}
.mm-viv-item:hover{background:#161616;}
.mm-viv-item:last-child{border-bottom:none;}
.mm-viv-name{font-size:13px;color:#F0E6D3;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.mm-viv-sub{font-size:11px;color:#6B6B6B;margin-top:2px;}
.mm-viv-loading{padding:12px 14px;font-size:13px;color:#6B6B6B;text-align:center;}
`;

customElements.define("millesime-card", MillesimeCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "millesime-card",
  name: "Millésime — Cave à Vin",
  description: "Visualisation cave style Vinotag avec auto-complétion Vivino",
  preview: true,
});

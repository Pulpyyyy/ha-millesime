/**
 * Millésime Card v5.0.0
 * Cave à vin pour Home Assistant
 * - Recherche texte avec suggestions temps réel
 * - Lecture d'étiquette par photo (Gemini Vision)
 * - Messages d'erreur pro : quota, clé invalide, indisponibilité
 */

const DOMAIN = "millesime";

const WINE_TYPES = {
  red:       { color: "#C0392B", glow: "rgba(192,57,43,0.6)",   label: "Rouge",        emoji: "🔴" },
  white:     { color: "#D4AC0D", glow: "rgba(212,172,13,0.5)",  label: "Blanc",        emoji: "🟡" },
  rose:      { color: "#E74C8B", glow: "rgba(231,76,139,0.5)",  label: "Rosé",         emoji: "🌸" },
  sparkling: { color: "#27AE8F", glow: "rgba(39,174,143,0.5)",  label: "Effervescent", emoji: "✨" },
  dessert:   { color: "#D68910", glow: "rgba(214,137,16,0.5)",  label: "Liquoreux",    emoji: "🍯" },
};

const EVENT_TYPES = [
  { v: "",              l: "— Non défini —",   emoji: "" },
  { v: "no_touch",      l: "Ne pas toucher",   emoji: "🚫" },
  { v: "keep",          l: "À garder",         emoji: "📦" },
  { v: "special",       l: "Grande occasion",  emoji: "🎉" },
  { v: "small_occasion",l: "Petite Occasion",   emoji: "🥂" },
  { v: "table",         l: "Vin de table",     emoji: "🍽️" },
];
const EVENT_LABEL = Object.fromEntries(EVENT_TYPES.map(e => [e.v, e]));

// Messages d'erreur affichés à l'utilisateur selon le code retourné par le backend
const ERROR_MESSAGES = {
  quota_exceeded:      "⚠️ Quota Gemini dépassé (1 500/jour). Les résultats viennent d'Open Food Facts — ajoutez votre clé demain ou vérifiez votre quota sur aistudio.google.com.",
  invalid_key:         "🔑 Clé Gemini invalide ou expirée. Allez dans Paramètres → Appareils → Millésime → ⚙️ pour la mettre à jour.",
  service_unavailable: "🔄 Gemini temporairement indisponible. Les résultats viennent d'Open Food Facts.",
  parse_error:         "⚠️ Réponse Gemini inattendue. Réessayez ou remplissez manuellement.",
  no_key:              "ℹ️ Résultats Open Food Facts. Configurez une clé Gemini pour obtenir notes de dégustation et accords mets-vins.",
  no_wine_found:       "📷 Aucune étiquette de vin reconnue. Assurez-vous que l'étiquette est nette et bien éclairée.",
};

const BOTTLE_MINI = (color, w = null) => `<svg viewBox="0 0 10 26" width="10" height="26" xmlns="http://www.w3.org/2000/svg" style="${w ? `width:${w}px;height:${Math.round(w*2.6)}px` : 'width:100%;height:auto'};display:block">
  <!-- Ombre au sol -->
  <ellipse cx="5" cy="25.3" rx="3.4" ry="0.65" fill="black" opacity="0.38"/>
  <!-- Capsule en étain -->
  <rect x="3.5" y="0.2" width="3" height="2.4" rx="0.9" fill="#5C3317"/>
  <rect x="3.5" y="0.2" width="1.1" height="2.4" rx="0.9" fill="white" opacity="0.18"/>
  <rect x="5.3" y="0.2" width="1.2" height="2.4" fill="black" opacity="0.15"/>
  <!-- Stries étain -->
  <line x1="3.6" y1="0.9" x2="6.4" y2="0.9" stroke="black" stroke-width="0.28" opacity="0.3"/>
  <line x1="3.6" y1="1.5" x2="6.4" y2="1.5" stroke="black" stroke-width="0.28" opacity="0.3"/>
  <line x1="3.6" y1="2.1" x2="6.4" y2="2.1" stroke="black" stroke-width="0.28" opacity="0.28"/>
  <!-- Col -->
  <rect x="3.8" y="2.4" width="2.4" height="4.3" fill="${color}"/>
  <rect x="3.8" y="2.4" width="0.9" height="4.3" fill="white" opacity="0.2"/>
  <rect x="5.5" y="2.4" width="0.7" height="4.3" fill="black" opacity="0.15"/>
  <line x1="4.3" y1="2.8" x2="4.3" y2="6.5" stroke="white" stroke-width="0.35" stroke-linecap="round" opacity="0.38"/>
  <!-- Épaule (courbe douce) -->
  <path d="M3.8,6.7 Q2.4,9.8 1.2,11.2 L8.8,11.2 Q7.6,9.8 6.2,6.7 Z" fill="${color}"/>
  <path d="M3.8,6.7 Q3,9.2 2.2,11.2 L3.1,11.2 Q3.9,9.2 4.5,6.7 Z" fill="white" opacity="0.18"/>
  <path d="M6.2,6.7 Q7,9.2 7.8,11.2 L8.8,11.2 Q7.6,9.8 6.9,7 Z" fill="black" opacity="0.15"/>
  <!-- Corps bombé (Bézier latéraux, effet cylindrique) -->
  <path d="M1.2,11.2 Q0.8,17 1.2,23 L8.8,23 Q9.2,17 8.8,11.2 Z" fill="${color}"/>
  <!-- Ombre droite -->
  <path d="M7.2,11.2 Q8.6,17 8.8,23 L7.6,23 Q7.3,17 7,11.2 Z" fill="black" opacity="0.22"/>
  <!-- Reflet gauche diffus -->
  <path d="M1.2,11.2 Q0.8,17 1.2,23 L2.8,23 Q2.4,17 2.4,11.2 Z" fill="white" opacity="0.14"/>
  <!-- Halo d'épaule -->
  <ellipse cx="3.2" cy="11.9" rx="1.2" ry="0.45" fill="white" opacity="0.22"/>
  <!-- Fond + piqûre (punt) -->
  <ellipse cx="5" cy="23" rx="3.8" ry="1.1" fill="${color}"/>
  <ellipse cx="5" cy="23" rx="3.8" ry="1.1" fill="black" opacity="0.28"/>
  <ellipse cx="5" cy="22.75" rx="1.6" ry="0.4" fill="white" opacity="0.2"/>
  <!-- Ombre portée étiquette -->
  <rect x="2.1" y="13.3" width="6.3" height="4.5" rx="0.5" fill="black" opacity="0.28"/>
  <!-- Étiquette -->
  <rect x="1.8" y="13" width="6.3" height="4.5" rx="0.5" fill="white" opacity="0.72"/>
  <!-- Ligne décorative étiquette -->
  <line x1="3" y1="15.25" x2="6.9" y2="15.25" stroke="#bbb" stroke-width="0.28" opacity="0.55"/>
  <!-- Reflet spéculaire en arc (suit la courbure du verre) -->
  <path d="M2.4,11.9 Q2.05,17 2.4,22.5" stroke="white" stroke-width="0.55" fill="none" stroke-linecap="round" opacity="0.6"/>
</svg>`;

// Bouteille fantôme pour les emplacements vides (mode bottle)
const BOTTLE_GHOST = (w = null) => `<svg viewBox="0 0 10 26" xmlns="http://www.w3.org/2000/svg" style="${w ? `width:${w}px;height:${Math.round(w*2.6)}px` : 'width:100%;height:auto'};display:block">
  <rect x="3.5" y="0.2" width="3" height="2.4" rx="0.9" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.2)" stroke-width="0.4" stroke-dasharray="1.2 0.7"/>
  <rect x="3.8" y="2.5" width="2.4" height="4.2" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.2)" stroke-width="0.4" stroke-dasharray="1.2 0.7"/>
  <path d="M3.8,6.7 Q2.4,9.8 1.2,11.2 Q0.8,17 1.2,23 L8.8,23 Q9.2,17 8.8,11.2 Q7.6,9.8 6.2,6.7 Z" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.2)" stroke-width="0.4" stroke-dasharray="1.2 0.7"/>
  <ellipse cx="5" cy="23" rx="3.8" ry="1" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="0.4"/>
</svg>`;

const GLASS_SVG = `<svg viewBox="0 0 40 56" xmlns="http://www.w3.org/2000/svg">
  <path d="M8 2 Q8 20 20 30 Q32 20 32 2 Z" fill="#C0392B" opacity="0.92"/>
  <path d="M11 6 Q11 19 20 28" fill="none" stroke="#E74C3C" stroke-width="1" opacity="0.35"/>
  <path d="M14 22 Q17 27 20 29 Q23 27 26 22" fill="#922B21" opacity="0.5"/>
  <rect x="18.5" y="30" width="3" height="17" rx="1.5" fill="#7B241C"/>
  <ellipse cx="20" cy="48" rx="8" ry="2.2" fill="#6E2118"/>
</svg>`;

// ── Classe principale ──────────────────────────────────────────────────────────

class MillesimeCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass       = null;
    this._data       = null;
    this._filter     = "all";
    this._filterEvent= "all";
    this._selected   = null;  // id bouteille sélectionnée
    this._modal      = null;
    this._modalStyle = null;
    this._unsubs     = [];
  }

  setConfig(config) { this._config = config || {}; this._applyConfigColors(); this._renderLoading(); }

  _applyConfigColors() {
    const cfg = this._config;
    const set = (prop, val) => val
      ? this.style.setProperty(prop, val)
      : this.style.removeProperty(prop);
    set('--accent',         cfg.accent_color);
    set('--accent-h',       cfg.accent_hover_color);
    set('--header-accent',  cfg.header_accent_color || cfg.accent_color);
    set('--wood-dk',        cfg.wood_dark);
    set('--wood-md',        cfg.wood_mid);
    set('--wood-lt',        cfg.wood_light);
    set('--gold',           cfg.gold_color);
  }

  set hass(hass) {
    const first = !this._hass;
    const themeChanged = this._hass?.themes !== hass.themes;
    this._hass = hass;
    if (first) { this._subscribeUpdates(); this._fetchData(); }
    if (first || themeChanged) this._applyTheme();
  }

  getCardSize() { return 8; }

  _applyTheme() {
    const themeVars = this._hass?.themes?.themes?.[this._hass?.themes?.theme] || {};
    const props = [
      'primary-background-color', 'secondary-background-color', 'card-background-color',
      'primary-text-color', 'secondary-text-color', 'divider-color',
      'primary-color', 'secondary-color', 'accent-color',
    ];
    props.forEach(p => {
      if (themeVars[p]) this.style.setProperty(`--${p}`, themeVars[p]);
      else this.style.removeProperty(`--${p}`);
    });
  }

  // ── WebSocket ────────────────────────────────────────────────────────────────

  async _fetchData() {
    if (!this._hass) return;
    try {
      this._data = await this._hass.connection.sendMessagePromise({ type: "millesime/get_data" });
    } catch (err) {
      console.error("[Millésime] fetchData:", err);
      this._data = this._data || DEFAULT_DATA();
    }
    if (!this._modal) this._render();
  }

  _subscribeUpdates() {
    this._hass.connection
      .subscribeEvents(() => { if (!this._modal) this._fetchData(); }, `${DOMAIN}_updated`)
      .then((u) => this._unsubs.push(u));
  }

  async _callService(service, data) {
    try {
      await this._hass.callService(DOMAIN, service, data);
      this._closeModal();
      setTimeout(() => this._fetchData(), 500);
      return true;
    } catch (err) {
      this._showToast("error", `Erreur : ${err.message || JSON.stringify(err)}`);
      return false;
    }
  }

  // ── Recherche texte ───────────────────────────────────────────────────────────

  async _searchWine(query) {
    try {
      return await this._hass.connection.sendMessagePromise({
        type: "millesime/search_wine",
        query,
      });
    } catch (err) {
      console.error("[Millésime] searchWine:", err);
      return { results: [], error: "service_unavailable", source: "off" };
    }
  }

  // ── Analyse photo ─────────────────────────────────────────────────────────────

  async _analyzePhoto(imageB64, mimeType) {
    try {
      return await this._hass.connection.sendMessagePromise({
        type:      "millesime/analyze_photo",
        image_b64: imageB64,
        mime_type: mimeType,
      });
    } catch (err) {
      console.error("[Millésime] analyzePhoto:", err);
      return { results: [], error: "service_unavailable", source: "gemini" };
    }
  }

  async _estimatePrice(query) {
    try {
      return await this._hass.connection.sendMessagePromise({
        type:  "millesime/estimate_price",
        query,
      });
    } catch (err) {
      return { price: 0, error: "service_unavailable" };
    }
  }

  // ── Toast notifications ───────────────────────────────────────────────────────

  _showToast(type, message) {
    const existing = document.querySelector(".mm-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = `mm-toast mm-toast--${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Injection CSS toast si pas déjà là
    if (!document.querySelector("#mm-toast-css")) {
      const s = document.createElement("style");
      s.id = "mm-toast-css";
      s.textContent = `
        .mm-toast {
          position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
          max-width: 420px; width: calc(100% - 32px);
          padding: 12px 16px; border-radius: 10px;
          font-family: Inter, sans-serif; font-size: 13px; line-height: 1.5;
          z-index: 999999; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
          animation: mm-toast-in 0.2s ease;
        }
        @keyframes mm-toast-in { from { opacity:0; transform:translateX(-50%) translateY(10px); } }
        .mm-toast--error   { background:#2A0A0A; color:#ff8f8f; border:1px solid #5A1010; }
        .mm-toast--warning { background:#2A1E00; color:#ffc85a; border:1px solid #5A3F00; }
        .mm-toast--info    { background:#0A1A2A; color:#7db8f7; border:1px solid #1A4070; }
        .mm-toast--success { background:#0A2A15; color:#6ee098; border:1px solid #1A5030; }
      `;
      document.head.appendChild(s);
    }

    setTimeout(() => toast.remove(), type === "error" ? 8000 : 5000);
  }

  // ── Gestion des erreurs de recherche ─────────────────────────────────────────

  _handleSearchError(error, source, resultsEl) {
    if (!error) return;
    const msg = ERROR_MESSAGES[error];
    if (!msg) return;

    // Quota dépassé = warning visible (mais résultats OFF disponibles)
    const level = error === "quota_exceeded" || error === "service_unavailable"
      ? "warning" : "error";

    // Afficher sous la barre de recherche si des résultats OFF existent
    const banner = document.createElement("div");
    banner.className = `mm-search-banner mm-search-banner--${level}`;
    banner.textContent = msg;
    if (resultsEl && resultsEl.parentNode) {
      resultsEl.parentNode.insertBefore(banner, resultsEl);
    }

    // Toast si c'est une erreur critique (pas de résultats)
    if (error === "invalid_key" || error === "parse_error") {
      this._showToast(level, msg);
    }
  }

  // ── Modal ─────────────────────────────────────────────────────────────────────

  _openModal(type, opts = {}) {
    this._closeModal();
    const style = document.createElement("style");
    style.textContent = MODAL_CSS;
    document.head.appendChild(style);
    this._modalStyle = style;

    const overlay = document.createElement("div");
    overlay.className = "mm-overlay";
    const themeVars = this._hass?.themes?.themes?.[this._hass?.themes?.theme] || {};
    ['primary-background-color','secondary-background-color','card-background-color',
     'primary-text-color','secondary-text-color','divider-color','primary-color','secondary-color','accent-color']
      .forEach(p => { if (themeVars[p]) overlay.style.setProperty(`--${p}`, themeVars[p]); });
    const box = document.createElement("div");
    box.className = "mm-box";

    if (type === "floor")     box.innerHTML = this._floorFormHTML(opts.floor);
    if (type === "bottle")    box.innerHTML = this._bottleFormHTML(opts.wine, opts.slot);
    if (type === "detail")    box.innerHTML = this._detailHTML(opts.wine);
    if (type === "duplicate") box.innerHTML = this._addSlotFormHTML(opts.wine);
    if (type === "history")   box.innerHTML = this._historyHTML();

    overlay.appendChild(box);
    document.body.appendChild(overlay);
    this._modal = overlay;

    overlay.addEventListener("click", (e) => { if (e.target === overlay) this._closeModal(); });
    box.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => this._closeModal()));

    if (type === "floor")     this._bindFloorForm(box, opts.floor);
    if (type === "bottle")    this._bindBottleForm(box, opts.wine, opts.slot);
    if (type === "detail")    this._bindDetailButtons(box, opts.wine);
    if (type === "duplicate") this._bindAddSlotForm(box, opts.wine);
    if (type === "history") {
      this._bindHistory(box);
    }
  }

  _closeModal() {
    this._modal?.remove();     this._modal      = null;
    this._modalStyle?.remove(); this._modalStyle = null;
  }

  // ── HTML formulaire étage ──────────────────────────────────────────────────────

  _floorFormHTML(floor) {
    const next  = (this._data?.cellar?.floors?.length || 0) + 1;
    const isEdit = !!floor;
    return `
      <div class="mm-header">
        <span class="mm-title">${isEdit ? "Modifier l'étage" : "Nouvel étage"}</span>
        <button class="mm-close" data-close>✕</button>
      </div>
      <div class="mm-body">
        <div class="mm-field">
          <label class="mm-label">Nom</label>
          <input class="mm-input" id="fl-name" type="text"
            value="${floor?.name || "Étage " + next}" placeholder="Bordeaux, Bourgogne...">
        </div>
        <div class="mm-row">
          <div class="mm-field">
            <label class="mm-label">Colonnes</label>
            <input class="mm-input" id="fl-cols" type="number" value="${floor?.columns || 8}" min="1" max="20">
          </div>
          <div class="mm-field">
            <label class="mm-label">Rangées</label>
            <input class="mm-input" id="fl-rows" type="number" value="${floor?.rows || 2}" min="1" max="10">
          </div>
        </div>
        <div class="mm-field">
          <label class="mm-label">Disposition</label>
          <select class="mm-input" id="fl-layout">
            <option value="side_by_side"   ${(floor?.layout || "side_by_side") === "side_by_side" ? "selected" : ""}>Côte à côte</option>
            <option value="alternating"    ${floor?.layout === "alternating"    ? "selected" : ""}>Tête-bêche</option>
            <option value="alternating_2d" ${floor?.layout === "alternating_2d" ? "selected" : ""}>Tête-bêche alterné</option>
            <option value="quinconce"      ${floor?.layout === "quinconce"      ? "selected" : ""}>Quinconce</option>
          </select>
        </div>
      </div>
      <div class="mm-footer">
        <button class="mm-btn mm-btn-ghost" data-close>Annuler</button>
        <button class="mm-btn mm-btn-primary" id="fl-submit">${isEdit ? "Enregistrer" : "Créer l'étage"}</button>
      </div>`;
  }

  _bindFloorForm(box, floor) {
    box.querySelector("#fl-submit").addEventListener("click", async () => {
      const name   = box.querySelector("#fl-name").value.trim() || "Nouvel étage";
      const cols   = parseInt(box.querySelector("#fl-cols").value) || 8;
      const rows   = parseInt(box.querySelector("#fl-rows").value) || 2;
      const layout = box.querySelector("#fl-layout").value;
      if (floor) {
        await this._callService("update_floor", { floor_id: floor.id, name, columns: cols, rows, layout });
      } else {
        await this._callService("add_floor", { name, columns: cols, rows, layout, slots: cols * rows });
      }
    });
  }

  // ── HTML formulaire bouteille ──────────────────────────────────────────────────

  _bottleFormHTML(wine, pendingSlot) {
    const floors = this._data?.cellar?.floors || [];
    const isEdit = !!wine;
    const b = wine || {};
    return `
      <div class="mm-header">
        <span class="mm-title">${isEdit ? "Modifier le vin" : "Ajouter un vin"}</span>
        <button class="mm-close" data-close>✕</button>
      </div>
      <div class="mm-body">

        <!-- Bloc recherche / photo -->
        <div class="mm-search-block">
          <div class="mm-search-row">
            <div class="mm-search-wrap">
              <span class="mm-search-icon">🔍</span>
              <input class="mm-input mm-search-input" id="viv-query"
                placeholder="Rechercher : château, domaine, appellation..."
                value="${b.name || ""}">
            </div>
            <button class="mm-btn-photo" id="btn-photo" title="Scanner l'étiquette">📷</button>
            <input type="file" id="photo-input" accept="image/*" style="display:none">
          </div>
          <div id="search-banner"></div>
          <div id="viv-results" class="mm-viv-results"></div>
        </div>

        <!-- Aperçu image -->
        <div id="viv-img-preview"></div>

        <!-- Champs principaux -->
        <div class="mm-row">
          <div class="mm-field">
            <label class="mm-label">Nom du vin *</label>
            <input class="mm-input" id="bt-name" value="${b.name || ""}" placeholder="Château Pétrus">
          </div>
          <div class="mm-field">
            <label class="mm-label">Millésime</label>
            <input class="mm-input" id="bt-vintage" value="${b.vintage || ""}" placeholder="2019" maxlength="4">
          </div>
        </div>
        <div class="mm-row">
          <div class="mm-field">
            <label class="mm-label">Type</label>
            <select class="mm-input" id="bt-type">
              ${Object.entries(WINE_TYPES).map(([v, t]) =>
                `<option value="${v}" ${(b.type || "red") === v ? "selected" : ""}>${t.emoji} ${t.label}</option>`
              ).join("")}
            </select>
          </div>
          <div class="mm-field">
            <label class="mm-label">Prix (€)</label>
            <input class="mm-input" id="bt-price" type="number" step="0.5" min="0" value="${b.price || ""}">
          </div>
        </div>
        <div class="mm-row">
          <div class="mm-field">
            <label class="mm-label">Producteur</label>
            <input class="mm-input" id="bt-producer" value="${b.producer || ""}" placeholder="Domaine...">
          </div>
          <div class="mm-field">
            <label class="mm-label">Appellation</label>
            <input class="mm-input" id="bt-appellation" value="${b.appellation || ""}" placeholder="Pomerol, Chablis...">
          </div>
        </div>
        <div class="mm-row">
          <div class="mm-field">
            <label class="mm-label">À boire à partir de</label>
            <input class="mm-input" id="bt-from" value="${b.drink_from || ""}" placeholder="2025">
          </div>
          <div class="mm-field">
            <label class="mm-label">À boire avant</label>
            <input class="mm-input" id="bt-until" value="${b.drink_until || ""}" placeholder="2035">
          </div>
        </div>
        <div class="mm-row">
          <div class="mm-field" style="grid-column:1/-1">
            <label class="mm-label">Note /5</label>
            <input class="mm-input" id="bt-vrating" type="number" step="0.1" min="0" max="5" value="${b.vivino_rating || ""}">
          </div>
        </div>

        ${!isEdit ? `
        <div class="mm-row">
          <div class="mm-field">
            <label class="mm-label">Étage *</label>
            <select class="mm-input" id="bt-floor">
              ${floors.map((f) =>
                `<option value="${f.id}" ${pendingSlot?.floor_id === f.id ? "selected" : ""}>${f.name}</option>`
              ).join("")}
            </select>
          </div>
          <div class="mm-field" style="grid-column:1/-1">
            <label class="mm-label">Emplacements (cliquer pour sélectionner)</label>
            <input type="hidden" id="bt-slots" value="${pendingSlot?.slot ?? 0}">
            <div id="bt-slot-picker" class="sp-picker"></div>
          </div>
        </div>` : ""}

        <div class="mm-row">
          <div class="mm-field" style="grid-column:1/-1">
            <label class="mm-label">Événement</label>
            <select class="mm-input" id="bt-event">
              ${EVENT_TYPES.map(e =>
                `<option value="${e.v}" ${(b.event || "") === e.v ? "selected" : ""}>${e.emoji ? e.emoji + " " : ""}${e.l}</option>`
              ).join("")}
            </select>
          </div>
        </div>

        <div class="mm-field">
          <label class="mm-label">Notes personnelles</label>
          <textarea class="mm-input mm-textarea" id="bt-notes"
            placeholder="Impressions, occasion...">${b.notes || ""}</textarea>
        </div>

        <!-- Champs cachés remplis par Gemini -->
        <input type="hidden" id="bt-image_url"   value="${b.image_url    || ""}">
        <input type="hidden" id="bt-vivino_url"  value="${b.vivino_url   || ""}">
        <input type="hidden" id="bt-region"      value="${b.region       || ""}">
        <input type="hidden" id="bt-country"     value="${b.country      || ""}">
        <input type="hidden" id="bt-tasting"     value="${b.tasting_notes|| ""}">
        <input type="hidden" id="bt-pairing"     value="${b.food_pairing || ""}">
      </div>
      <div class="mm-footer">
        <button class="mm-btn mm-btn-ghost" data-close>Annuler</button>
        <button class="mm-btn mm-btn-primary" id="bt-submit">
          ${isEdit ? "Enregistrer" : "Ajouter à la cave"}
        </button>
      </div>`;
  }

  _bindBottleForm(box, wine, pendingSlot) {
    let searchTimer;
    const qInput   = box.querySelector("#viv-query");
    const results  = box.querySelector("#viv-results");
    const imgWrap  = box.querySelector("#viv-img-preview");
    const banner   = box.querySelector("#search-banner");
    const btnPhoto = box.querySelector("#btn-photo");
    const fileInput= box.querySelector("#photo-input");

    // ── Auto-remplissage depuis un résultat ──────────────────────────────────
    const fillFrom = (wine) => {
      const set = (id, val) => {
        const el = box.querySelector(`#${id}`);
        if (el && val != null && val !== "" && val !== 0) el.value = val;
      };
      set("bt-name",        wine.name);
      set("bt-vintage",     wine.vintage);
      set("bt-producer",    wine.producer);
      set("bt-appellation", wine.appellation);
      set("bt-from",        wine.drink_from  || "");
      set("bt-until",       wine.drink_until || "");
      set("bt-vrating",     wine.vivino_rating || "");
      if (wine.price > 0) { const el = box.querySelector("#bt-price"); if (el) el.value = wine.price; }
      set("bt-image_url",   wine.image_url   || "");
      set("bt-vivino_url",  wine.vivino_url  || "");
      set("bt-region",      wine.region      || "");
      set("bt-country",     wine.country     || "");
      set("bt-tasting",     wine.tasting_notes || "");
      set("bt-pairing",     wine.food_pairing  || "");
      const typeEl = box.querySelector("#bt-type");
      if (typeEl && wine.type) typeEl.value = wine.type;
      results.innerHTML = "";
      results.style.display = "none";
      if (wine.image_url) {
        imgWrap.innerHTML = `<img src="${wine.image_url}"
          style="width:56px;display:block;margin:0 auto 10px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.5)">`;
      }
    };

    // ── Affichage des résultats ───────────────────────────────────────────────
    const showResults = (response) => {
      // Nettoyer les anciens banners
      banner.innerHTML = "";
      const { results: wines = [], error, source } = response;

      // Afficher le banner d'erreur si besoin
      if (error) {
        const msg = ERROR_MESSAGES[error] || error;
        const level = (error === "quota_exceeded" || error === "service_unavailable") ? "warning" : "error";
        banner.innerHTML = `<div class="mm-search-banner mm-search-banner--${level}">${msg}</div>`;
      } else if (source === "off" && box.querySelector("#viv-query").value.trim().length >= 3) {
        // Info discrète : résultats OFF sans erreur (pas de clé Gemini)
        // On ne l'affiche que si la recherche a produit des résultats
        if (wines.length > 0) {
          banner.innerHTML = `<div class="mm-search-banner mm-search-banner--info">
            ℹ️ Résultats Open Food Facts — ajoutez une clé Gemini pour les notes de dégustation.
          </div>`;
        }
      }

      if (!wines.length) {
        results.innerHTML = `<div class="mm-viv-loading">Aucun résultat — remplissez manuellement</div>`;
        results.style.display = "block";
        return;
      }

      results.style.display = "block";
      results.innerHTML = wines.map((w, i) => `
        <div class="mm-viv-item" data-idx="${i}">
          ${w.image_url
            ? `<img src="${w.image_url}" style="width:28px;border-radius:4px;flex-shrink:0">`
            : `<span style="font-size:18px;flex-shrink:0">${WINE_TYPES[w.type]?.emoji || "🍷"}</span>`}
          <div style="flex:1;min-width:0">
            <div class="mm-viv-name">${w.name}${w.vintage ? " " + w.vintage : ""}</div>
            <div class="mm-viv-sub">${[w.appellation, w.region, w.vivino_rating ? "⭐ " + w.vivino_rating : ""].filter(Boolean).join(" · ")}</div>
            ${w.tasting_notes ? `<div class="mm-viv-notes">${w.tasting_notes}</div>` : ""}
          </div>
        </div>`).join("");

      results.querySelectorAll(".mm-viv-item").forEach((el) =>
        el.addEventListener("click", () => fillFrom(wines[parseInt(el.dataset.idx)]))
      );
    };

    // ── Recherche texte avec debounce 600ms ───────────────────────────────────
    qInput?.addEventListener("input", () => {
      clearTimeout(searchTimer);
      const q = qInput.value.trim();
      if (q.length < 3) {
        results.innerHTML = "";
        results.style.display = "none";
        banner.innerHTML = "";
        return;
      }
      results.style.display = "block";
      results.innerHTML = `<div class="mm-viv-loading">
        <span class="mm-spinner"></span> Recherche en cours...
      </div>`;
      searchTimer = setTimeout(async () => {
        const response = await this._searchWine(q);
        showResults(response);
      }, 600);
    });

    // ── Scan photo de l'étiquette ─────────────────────────────────────────────
    btnPhoto?.addEventListener("click", () => fileInput?.click());

    fileInput?.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      // Aperçu immédiat
      const url = URL.createObjectURL(file);
      imgWrap.innerHTML = `<div class="mm-photo-loading">
        <img src="${url}" style="width:80px;border-radius:8px;opacity:0.6;display:block;margin:0 auto 6px">
        <div style="text-align:center;font-size:11px;color:var(--mm-muted,#888)">
          <span class="mm-spinner"></span> Analyse de l'étiquette...
        </div>
      </div>`;
      results.innerHTML = "";
      results.style.display = "none";
      banner.innerHTML = "";

      // Encoder en base64
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = () => rej(new Error("Lecture fichier impossible"));
        r.readAsDataURL(file);
      });

      const mimeType = file.type || "image/jpeg";
      const response = await this._analyzePhoto(b64, mimeType);
      URL.revokeObjectURL(url);

      const { results: wines = [], error } = response;

      // Nettoyer l'aperçu loading
      imgWrap.innerHTML = "";

      if (error === "invalid_key" || error === "no_key") {
        imgWrap.innerHTML = `<div class="mm-photo-error">${ERROR_MESSAGES.invalid_key}</div>`;
        return;
      }
      if (!wines.length) {
        imgWrap.innerHTML = `<div class="mm-photo-error">${ERROR_MESSAGES.no_wine_found}</div>`;
        return;
      }
      if (error) {
        banner.innerHTML = `<div class="mm-search-banner mm-search-banner--warning">${ERROR_MESSAGES[error] || error}</div>`;
      }

      if (wines.length === 1) {
        // Un seul vin identifié → remplissage direct
        fillFrom(wines[0]);
        this._showToast("success", `✅ Étiquette reconnue : ${wines[0].name}`);
      } else {
        // Plusieurs vins possibles → afficher les suggestions
        showResults({ results: wines, error: null, source: "gemini" });
        this._showToast("info", "📷 Plusieurs vins possibles — sélectionnez le bon");
      }
    });

    // ── Soumission du formulaire ──────────────────────────────────────────────
    box.querySelector("#bt-submit")?.addEventListener("click", async () => {
      const txt = (id) => box.querySelector(`#${id}`)?.value?.trim() || "";
      const num = (id) => parseFloat(box.querySelector(`#${id}`)?.value)  || 0;

      const name = txt("bt-name");
      if (!name) { this._showToast("error", "Le nom du vin est requis."); return; }

      const payload = {
        name,
        vintage:       txt("bt-vintage"),
        type:          box.querySelector("#bt-type")?.value || "red",
        producer:      txt("bt-producer"),
        appellation:   txt("bt-appellation"),
        region:        txt("bt-region"),
        country:       txt("bt-country"),
        price:         num("bt-price"),
        drink_from:    txt("bt-from"),
        drink_until:   txt("bt-until"),
        notes:         txt("bt-notes"),
        tasting_notes: txt("bt-tasting"),
        food_pairing:  txt("bt-pairing"),
        vivino_rating: num("bt-vrating"),
        event:         box.querySelector("#bt-event")?.value || "",
        image_url:     txt("bt-image_url"),
        vivino_url:    txt("bt-vivino_url"),
      };

      try {
        if (wine) {
          await this._hass.callService(DOMAIN, "update_wine", { wine_id: wine.id, ...payload });
        } else {
          const floorId = box.querySelector("#bt-floor")?.value || "";
          const slotsStr = box.querySelector("#bt-slots")?.value || "0";
          const slots = slotsStr.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n));
          if (!slots.length) slots.push(0);
          // Créer le vin au premier emplacement
          payload.floor_id = floorId;
          payload.slot     = slots[0];
          await this._hass.callService(DOMAIN, "add_wine", payload);
          // Ajouter les emplacements supplémentaires
          if (slots.length > 1) {
            await new Promise(r => setTimeout(r, 600));
            const freshData = await this._hass.connection.sendMessagePromise({ type: "millesime/get_data" });
            const added = (freshData.wines || []).find(w => w.name === name && w.slots?.some(s => s.floor_id === floorId && s.slot === slots[0]));
            if (added) {
              for (let k = 1; k < slots.length; k++) {
                await this._hass.callService(DOMAIN, "add_slot", { wine_id: added.id, floor_id: floorId, slot: slots[k] });
              }
            }
          }
        }
        this._closeModal();
        setTimeout(() => this._fetchData(), 500);
      } catch (err) {
        this._showToast("error", `Erreur : ${err.message || JSON.stringify(err)}`);
      }
    });

    const renderPicker = () => this._renderSlotPicker(box, "bt-floor", "bt-slot-picker", "bt-slots", null, true);
    box.querySelector("#bt-floor")?.addEventListener("change", renderPicker);
    if (!wine) renderPicker();
  }

  _renderSlotPicker(box, floorSelectId, pickerId, slotInputId, excludeWineId = null, multiSelect = false) {
    const floorId   = box.querySelector(`#${floorSelectId}`)?.value;
    const floor     = (this._data?.cellar?.floors || []).find(f => f.id === floorId);
    const picker    = box.querySelector(`#${pickerId}`);
    const slotInput = box.querySelector(`#${slotInputId}`);
    if (!picker || !floor) return;

    const cols  = floor.columns || 8;
    const total = floor.slots || cols * (floor.rows || 2);
    const occupied = {};
    (this._data?.wines || []).forEach(w => {
      if (w.id === excludeWineId) return;
      w.slots?.forEach(s => {
        if (s.floor_id === floorId) occupied[s.slot] = w;
      });
    });

    const selected = multiSelect
      ? new Set((slotInput.value || "").split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n)))
      : new Set([parseInt(slotInput.value) || 0]);

    let dots = "";
    for (let i = 0; i < total; i++) {
      const bt   = occupied[i];
      const wt   = bt ? (WINE_TYPES[bt.type] || WINE_TYPES.red) : null;
      const isSel = !bt && selected.has(i);
      dots += `<div class="sp-dot ${bt ? "sp-taken" : "sp-free"}${isSel ? " sp-sel" : ""}"
        data-s="${i}"
        style="${bt ? `--sp-c:${wt.color}` : isSel ? "--sp-c:#a78bfa" : ""}"
        title="${bt ? bt.name + (bt.vintage ? " " + bt.vintage : "") : "Emplacement " + i}"></div>`;
    }

    const selArr = [...selected].sort((a, b) => a - b);
    const label = multiSelect
      ? `${selArr.length} emplacement${selArr.length > 1 ? "s" : ""} sélectionné${selArr.length > 1 ? "s" : ""} : <strong>${selArr.join(", ")}</strong>`
      : `Emplacement sélectionné : <strong>${selArr[0]}</strong>`;
    picker.innerHTML = `
      <div class="sp-grid" style="grid-template-columns:repeat(${cols},1fr)">${dots}</div>
      <div class="sp-label">${label}</div>`;

    picker.querySelectorAll(".sp-free").forEach(dot => {
      dot.addEventListener("click", () => {
        const s = parseInt(dot.dataset.s);
        if (multiSelect) {
          if (selected.has(s)) selected.delete(s);
          else selected.add(s);
          slotInput.value = [...selected].sort((a, b) => a - b).join(",");
        } else {
          slotInput.value = s;
        }
        this._renderSlotPicker(box, floorSelectId, pickerId, slotInputId, excludeWineId, multiSelect);
      });
    });
  }

  // ── Fiche détail bouteille ─────────────────────────────────────────────────────

  _detailHTML(wine) {
    const b  = wine;
    const t  = WINE_TYPES[b.type] || WINE_TYPES.red;
    const vr = parseFloat(b.vivino_rating) || 0;
    const stars = vr > 0
      ? "★".repeat(Math.round(vr)) + "☆".repeat(5 - Math.round(vr)) : "";
    return `
      <div class="mm-header" style="background:linear-gradient(135deg,${t.color}18,transparent)">
        <button class="mm-close" data-close style="order:-1;font-size:20px">←</button>
        <span class="mm-title">${b.name}</span>
        <span style="color:${t.color};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px">${t.label}</span>
      </div>
      <div class="mm-body">
        ${b.image_url ? `<img src="${b.image_url}" style="width:64px;display:block;margin:0 auto 16px;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.6)">` : ""}
        <div class="mm-detail-hero">
          <div class="mm-detail-name">${b.name}</div>
          <div class="mm-detail-sub">${[b.producer, b.appellation].filter(Boolean).join(" · ")}</div>
          ${vr > 0 ? `
            <div style="color:${t.color};font-size:20px;margin-top:10px;letter-spacing:2px">${stars}</div>
            <div style="color:var(--mm-muted,#555);font-size:11px;margin-top:2px">${vr.toFixed(1)} / 5</div>` : ""}
          ${b.vivino_url ? `<a href="${b.vivino_url}" target="_blank" class="mm-vivino-link">Voir sur Vivino →</a>` : ""}
        </div>
        <div class="mm-detail-grid">
          ${_drow("Millésime",  b.vintage)}
          ${_drow("Région",     [b.region, b.country].filter(Boolean).join(", "))}
          ${b.price ? `<div class="mm-drow"><span class="mm-drow-label">Prix</span><span class="mm-drow-value det-price-display">${b.price} €</span></div>` : ""}
          ${(b.slots?.length > 0) ? `<div class="mm-drow" style="grid-column:1/-1">
            <span class="mm-drow-label">Emplacements</span>
            <span class="mm-drow-value" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:2px">
              ${b.slots.map(s => {
                const floor = (this._data?.cellar?.floors || []).find(f => f.id === s.floor_id);
                return `<span style="background:var(--mm-bg2);border:1px solid var(--mm-border);border-radius:6px;padding:2px 7px;font-size:10px;white-space:nowrap">${floor ? floor.name : s.floor_id} · #${s.slot}</span>`;
              }).join("")}
            </span>
          </div>` : ""}
          ${_drow("À boire",    (b.drink_from || b.drink_until)
                                ? (b.drink_from || "?") + " — " + (b.drink_until || "?") : "")}
          ${_drow("Ajouté le",  b.added_date || "")}
          ${b.event && EVENT_LABEL[b.event]?.l ? _drow("Événement", EVENT_LABEL[b.event].emoji + " " + EVENT_LABEL[b.event].l) : ""}
        </div>
        ${b.tasting_notes ? `<div class="mm-notes mm-tasting">🍷 ${b.tasting_notes}</div>` : ""}
        ${b.food_pairing  ? `<div class="mm-notes mm-pairing">🍽️ ${b.food_pairing}</div>`  : ""}
        ${b.notes         ? `<div class="mm-notes">"${b.notes}"</div>`                     : ""}
      </div>
      <div class="mm-footer">
        <button class="mm-btn mm-btn-danger" id="det-remove">🗑</button>
        <button class="mm-btn mm-btn-ghost"  id="det-price">💰 Prix</button>
        <button class="mm-btn mm-btn-ghost"  id="det-dup">+ Emplacement</button>
        <button class="mm-btn mm-btn-ghost"  id="det-edit">✏️ Modifier</button>
      </div>`;
  }

  // ── Formulaire ajout d'emplacement ──────────────────────────────────────────

  _addSlotFormHTML(wine) {
    const floors = this._data?.cellar?.floors || [];
    return `
      <div class="mm-header">
        <span class="mm-title">+ Ajouter un emplacement</span>
        <button class="mm-close" data-close>✕</button>
      </div>
      <div class="mm-body">
        <div class="mm-notes mm-tasting" style="margin-bottom:14px">
          Ajouter un emplacement pour <strong>${wine.name}${wine.vintage ? " " + wine.vintage : ""}</strong>
        </div>
        <div class="mm-row">
          <div class="mm-field">
            <label class="mm-label">Étage *</label>
            <select class="mm-input" id="dup-floor">
              ${floors.map(f => `<option value="${f.id}">${f.name}</option>`).join("")}
            </select>
          </div>
          <div class="mm-field" style="grid-column:1/-1">
            <label class="mm-label">Emplacement</label>
            <input type="hidden" id="dup-slot" value="">
            <div id="dup-slot-picker" class="sp-picker"></div>
          </div>
        </div>
      </div>
      <div class="mm-footer">
        <button class="mm-btn mm-btn-ghost" data-close>Annuler</button>
        <button class="mm-btn mm-btn-primary" id="dup-submit">Ajouter</button>
      </div>`;
  }

  _bindAddSlotForm(box, wine) {
    box.querySelector("#dup-submit")?.addEventListener("click", async () => {
      const btn     = box.querySelector("#dup-submit");
      const floorId = box.querySelector("#dup-floor")?.value;
      const slotRaw = box.querySelector("#dup-slot")?.value || "";
      const slots   = slotRaw.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      if (!floorId) { this._showToast("warning", "Sélectionnez un étage."); return; }
      if (slots.length === 0) { this._showToast("warning", "Sélectionnez au moins un emplacement."); return; }
      btn.textContent = "⏳ Ajout en cours...";
      btn.disabled = true;
      try {
        for (const slot of slots) {
          await this._hass.callService(DOMAIN, "add_slot", {
            wine_id:  wine.id,
            floor_id: floorId,
            slot,
          });
        }
        this._closeModal();
        setTimeout(() => this._fetchData(), 600);
        this._showToast("success", `${slots.length} emplacement${slots.length > 1 ? "s" : ""} ajouté${slots.length > 1 ? "s" : ""} ✓`);
      } catch(err) {
        btn.textContent = "Ajouter";
        btn.disabled = false;
        this._showToast("error", "Erreur : " + (err.message || err));
      }
    });

    const renderDupPicker = () => this._renderSlotPicker(box, "dup-floor", "dup-slot-picker", "dup-slot", null, true);
    box.querySelector("#dup-floor")?.addEventListener("change", renderDupPicker);
    renderDupPicker();
  }

  // ── Historique valeur cave ──────────────────────────────────────────────────

  _historyHTML() {
    const history = this._data?.cellar?.value_history || [];
    const last    = history[history.length - 1];
    return `
      <div class="mm-header">
        <span class="mm-title">📈 Valeur de la cave</span>
        <button class="mm-close" data-close>✕</button>
      </div>
      <div class="mm-body">
        ${history.length === 0 ? `
          <div style="text-align:center;padding:30px 0;color:var(--mm-muted,#555)">
            <div style="font-size:32px;margin-bottom:10px">📊</div>
            <div>Aucun historique enregistré.</div>
            <div style="font-size:11px;margin-top:6px">Utilisez "Enregistrer la valeur" pour commencer.</div>
          </div>` : `
          <div class="hist-summary">
            <div class="hist-stat">
              <span class="hist-val">${last?.value ?? 0} €</span>
              <span class="hist-lbl">Valeur actuelle</span>
            </div>
            <div class="hist-stat">
              <span class="hist-val">${last?.bottles ?? 0}</span>
              <span class="hist-lbl">Bouteilles</span>
            </div>
            <div class="hist-stat">
              <span class="hist-val">${history.length}</span>
              <span class="hist-lbl">Relevés</span>
            </div>
          </div>
          <div id="hist-chart-wrap" style="width:100%;height:180px;margin-top:12px;background:var(--mm-bg0,#0D0D0D);border-radius:8px;border:1px solid var(--mm-border,#222)"></div>
          <div class="hist-table">
            ${[...history].reverse().slice(0, 12).map(h => `
              <div class="hist-row">
                <span class="hist-date">${h.date}</span>
                <span class="hist-bottles">${h.bottles} 🍾</span>
                <span class="hist-price">${h.value} €</span>
              </div>`).join("")}
          </div>`}
      </div>
      <div class="mm-footer">
        <button class="mm-btn mm-btn-ghost" data-close>Fermer</button>
        <button class="mm-btn mm-btn-primary" id="hist-snapshot">📸 Enregistrer la valeur</button>
      </div>`;
  }

  _bindHistory(box) {
    // Dessiner le graphique immédiatement (DOM pur, pas de timing)
    const wrap = box.querySelector("#hist-chart-wrap");
    if (wrap) this._renderChart(wrap, this._data?.cellar?.value_history || []);

    box.querySelector("#hist-snapshot")?.addEventListener("click", async () => {
      const btn = box.querySelector("#hist-snapshot");
      btn.textContent = "⏳ Enregistrement...";
      btn.disabled = true;
      try {
        // Appel direct (sans fermer le modal)
        await this._hass.callService(DOMAIN, "value_snapshot", {});
        await new Promise(r => setTimeout(r, 600));
        await this._fetchData();
        // Rafraîchir le contenu du modal en place
        box.innerHTML = this._historyHTML();
        this._bindHistory(box);
        box.querySelectorAll("[data-close]").forEach(b =>
          b.addEventListener("click", () => this._closeModal()));
        this._showToast("success", "Valeur enregistrée ✓");
        // _bindHistory s'occupe déjà du chart via le wrap

      } catch(err) {
        btn.textContent = "📸 Enregistrer la valeur";
        btn.disabled = false;
        this._showToast("error", "Erreur : " + (err.message || err));
      }
    });

  }



  _renderChart(wrap, history) {
    wrap.innerHTML = "";

    const tv      = this._hass?.themes?.themes?.[this._hass?.themes?.theme] || {};
    const cBg     = tv['primary-background-color']  || '#0D0D0D';
    const cGrid   = tv['divider-color']              || '#222';
    const cMuted  = tv['secondary-text-color']       || '#555';
    const cText   = tv['primary-text-color']         || '#EDE0CC';
    const cAccent = tv['primary-color']              || '#C0392B';

    if (!history || history.length === 0) {
      wrap.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:${cMuted};font-size:12px;font-family:Inter,sans-serif">Aucun relevé</div>`;
      return;
    }

    if (history.length === 1) {
      const h = history[0];
      wrap.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:${cMuted};font-size:12px;font-family:Inter,sans-serif;gap:6px">
        <div style="font-size:22px;font-weight:700;color:${cText};font-family:Playfair Display,serif">${h.value} €</div>
        <div>${h.date} · ${h.bottles} bouteilles</div>
        <div style="color:${cMuted};font-size:11px;margin-top:4px">Ajoutez un 2ᵉ relevé pour voir l'évolution</div>
      </div>`;
      return;
    }

    // ── SVG créé en DOM (pas en innerHTML) ──────────────────
    const NS  = "http://www.w3.org/2000/svg";
    const W   = wrap.offsetWidth || wrap.parentElement?.offsetWidth || 340;
    const H   = 180;
    const pad = { t: 18, r: 14, b: 30, l: 48 };
    const cw  = W - pad.l - pad.r;
    const ch  = H - pad.t - pad.b;

    const vals = history.map(h => h.value);
    const lo   = Math.min(...vals) - (Math.max(...vals) - Math.min(...vals)) * 0.12 || 0;
    const hi   = Math.max(...vals) + (Math.max(...vals) - Math.min(...vals)) * 0.12 || 1;
    const span = hi - lo || 1;

    const px = i => pad.l + (i / (history.length - 1)) * cw;
    const py = v => pad.t + ch - ((v - lo) / span) * ch;

    const mk = tag => document.createElementNS(NS, tag);
    const at = (el, attrs) => { Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k,v)); return el; };

    const svg = at(mk("svg"), { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
    svg.style.cssText = "display:block;width:100%;height:100%";

    // Dégradé
    const defs = mk("defs");
    const grad = at(mk("linearGradient"), { id: "cg", x1:"0", y1:"0", x2:"0", y2:"1" });
    const s1   = at(mk("stop"), { offset:"0%",   "stop-color":cAccent, "stop-opacity":"0.4" });
    const s2   = at(mk("stop"), { offset:"100%", "stop-color":cAccent, "stop-opacity":"0.02" });
    grad.appendChild(s1); grad.appendChild(s2); defs.appendChild(grad); svg.appendChild(defs);

    // Fond
    svg.appendChild(at(mk("rect"), { x:0, y:0, width:W, height:H, fill:cBg }));

    // Grilles horizontales
    for (let g = 0; g <= 4; g++) {
      const v = hi - span * g / 4;
      const y = (pad.t + ch * g / 4).toFixed(1);
      svg.appendChild(at(mk("line"), { x1: pad.l, y1: y, x2: W - pad.r, y2: y, stroke:cGrid, "stroke-width":"1" }));
      const txt = at(mk("text"), { x: pad.l - 5, y: (parseFloat(y) + 4).toFixed(1), "text-anchor":"end", fill:cMuted, "font-size":"10", "font-family":"Inter,sans-serif" });
      txt.textContent = Math.round(v) + "€";
      svg.appendChild(txt);
    }

    // Axe gauche
    svg.appendChild(at(mk("line"), { x1: pad.l, y1: pad.t, x2: pad.l, y2: pad.t + ch, stroke:cGrid, "stroke-width":"1" }));

    // Aire
    const pts = history.map((h, i) => `${px(i).toFixed(1)},${py(h.value).toFixed(1)}`).join(" ");
    const areaD = `M ${px(0).toFixed(1)},${py(vals[0]).toFixed(1)} ` +
      history.slice(1).map((h,i) => `L ${px(i+1).toFixed(1)},${py(h.value).toFixed(1)}`).join(" ") +
      ` L ${px(history.length-1).toFixed(1)},${(pad.t+ch).toFixed(1)} L ${px(0).toFixed(1)},${(pad.t+ch).toFixed(1)} Z`;
    svg.appendChild(at(mk("path"), { d: areaD, fill:"url(#cg)" }));

    // Courbe
    const line = at(mk("polyline"), { points: pts, fill:"none", stroke:cAccent, "stroke-width":"2.5", "stroke-linejoin":"round", "stroke-linecap":"round" });
    svg.appendChild(line);

    // Points + dates X
    const step = Math.max(1, Math.floor(history.length / 5));
    history.forEach((h, i) => {
      // Point
      const dot = at(mk("circle"), { cx: px(i).toFixed(1), cy: py(h.value).toFixed(1), r:"3.5", fill:cAccent, stroke:cBg, "stroke-width":"1.5" });
      svg.appendChild(dot);
      // Label X
      if (i % step === 0 || i === history.length - 1) {
        const xt = at(mk("text"), { x: px(i).toFixed(1), y: H - 8, "text-anchor":"middle", fill:cMuted, "font-size":"9", "font-family":"Inter,sans-serif" });
        xt.textContent = h.date.slice(5);
        svg.appendChild(xt);
      }
    });

    // Valeur sur le dernier point
    const last = history[history.length - 1];
    const lx = px(history.length - 1);
    const ly = py(last.value);
    const balloon = at(mk("rect"), { x: lx - 28, y: ly - 22, width: 56, height: 18, rx: 5, fill:cAccent });
    svg.appendChild(balloon);
    const blt = at(mk("text"), { x: lx, y: ly - 9, "text-anchor":"middle", fill:"white", "font-size":"10", "font-weight":"700", "font-family":"Inter,sans-serif" });
    blt.textContent = last.value + " €";
    svg.appendChild(blt);

    wrap.appendChild(svg);
  }


  _bindDetailButtons(box, wine) {

    // Retirer tout le vin (toutes ses bouteilles)
    box.querySelector("#det-remove")?.addEventListener("click", async () => {
      const cnt = wine.slots?.length || 0;
      const msg = cnt > 1
        ? `Retirer "${wine.name}" et ses ${cnt} emplacements de la cave ?`
        : `Retirer "${wine.name}" de la cave ?`;
      if (confirm(msg)) {
        this._selected = null;
        await this._callService("remove_wine", { wine_id: wine.id });
      }
    });

    // Modifier les infos du vin
    box.querySelector("#det-edit")?.addEventListener("click", () => {
      this._closeModal();
      this._openModal("bottle", { wine });
    });

    // Ajouter un emplacement
    box.querySelector("#det-dup")?.addEventListener("click", () => {
      this._closeModal();
      this._openModal("duplicate", { wine });
    });

    // Estimer le prix
    box.querySelector("#det-price")?.addEventListener("click", async () => {
      const btn   = box.querySelector("#det-price");
      const query = [wine.name, wine.vintage, wine.appellation].filter(Boolean).join(" ");
      if (!query) { this._showToast("warning", "Nom du vin manquant."); return; }

      btn.textContent = "⏳ Recherche...";
      btn.disabled    = true;

      const resp = await this._estimatePrice(query);

      if (resp.error || !resp.price) {
        btn.textContent = "💰 Prix";
        btn.disabled    = false;
        this._showToast("warning",
          resp.error === "invalid_key"
            ? "🔑 Clé Gemini requise pour estimer le prix."
            : resp.price === 0
              ? "Prix introuvable pour ce vin."
              : "Estimation impossible, réessayez."
        );
        return;
      }

      btn.textContent = `✅ ${resp.price} €`;

      // Mettre à jour la fiche prix affiché
      const priceEl = box.querySelector(".det-price-display");
      if (priceEl) priceEl.textContent = resp.price + " €";

      // Enregistrer après 1.5s
      setTimeout(async () => {
        await this._callService("update_wine", { wine_id: wine.id, price: resp.price });
        btn.textContent = "💰 Prix";
        btn.disabled    = false;
        this._showToast("success", `Prix mis à jour : ${resp.price} €`);
      }, 1500);
    });
  }

  // ── Rendu principal ───────────────────────────────────────────────────────────

  _renderLoading() {
    this.shadowRoot.innerHTML = CARD_CSS + `
      <div class="card">
        <div class="loading-state"><div class="loading-glass">${GLASS_SVG}</div></div>
      </div>`;
  }

  _render() {
    const data   = this._data || DEFAULT_DATA();
    const floors = data.cellar?.floors || [];
    const wines  = data.wines || [];
    this.shadowRoot.innerHTML = CARD_CSS + `
      <div class="card">
        ${this._renderHeader(data, wines)}
        ${this._renderFilters()}
        <div class="cellar">
          ${floors.length === 0
            ? this._renderEmpty()
            : floors.map((f, i) => this._renderFloor(f, wines, i)).join("")}
        </div>
      </div>`;
    this._bindCardListeners(data, wines);
  }

  _renderHeader(data, wines) {
    const total  = wines.reduce((s, w) => s + (w.slots?.length || 0), 0);
    const value  = wines.reduce((s, w) => s + (w.price || 0) * (w.slots?.length || 0), 0);
    const nFloor = data.cellar?.floors?.length || 0;
    return `
      <div class="header">
        <div class="header-left">
          <div class="header-glass" id="btn-history" title="Historique de valeur" style="cursor:pointer">${GLASS_SVG}</div>
          <div class="header-meta">
            <div class="header-name">${data.cellar?.name || "Millésime"}</div>
            <div class="header-tagline">Cave à vin</div>
          </div>
        </div>
        <div class="header-right">
          <div class="header-stats">
            <div class="stat"><span class="stat-value">${total}</span><span class="stat-label">Bouteilles</span></div>
            <div class="stat"><span class="stat-value">${nFloor}</span><span class="stat-label">Étages</span></div>
            <div class="stat"><span class="stat-value">${value > 0 ? Math.round(value) + "€" : "—"}</span><span class="stat-label">Valeur</span></div>
          </div>
          <div class="header-actions">
            <button class="btn-secondary" id="btn-add-floor">+ Étage</button>
            <button class="btn-primary"   id="btn-add-bottle">+ Vin</button>
          </div>
        </div>
      </div>`;
  }

  _renderFilters() {
    return `
      <div class="filters">
        <div class="filter-group">
          <span class="filter-label">Type</span>
          <select class="filter-select" id="sel-type">
            <option value="all" ${this._filter === "all" ? "selected" : ""}>Tous les vins</option>
            ${Object.entries(WINE_TYPES).map(([v, t]) =>
              `<option value="${v}" ${this._filter === v ? "selected" : ""}>${t.emoji} ${t.label}</option>`
            ).join("")}
          </select>
        </div>
        <div class="filter-group">
          <span class="filter-label">Événement</span>
          <select class="filter-select" id="sel-event">
            <option value="all" ${this._filterEvent === "all" ? "selected" : ""}>Tous</option>
            ${EVENT_TYPES.filter(e => e.v).map(e =>
              `<option value="${e.v}" ${this._filterEvent === e.v ? "selected" : ""}>${e.emoji} ${e.l}</option>`
            ).join("")}
          </select>
        </div>
      </div>`;
  }

  _renderEmpty() {
    return `
      <div class="empty-state">
        <div class="empty-glass">${GLASS_SVG}</div>
        <div class="empty-title">Cave vide</div>
        <div class="empty-sub">Cliquez sur "+ Étage" pour commencer</div>
      </div>`;
  }

  _renderFloor(floor, allWines, index) {
    // Build a map: slotNumber → { wine, slotIdx }
    const slotMap = {};
    allWines.forEach(w => {
      w.slots?.forEach((s, si) => {
        if (s.floor_id === floor.id) slotMap[s.slot] = { wine: w, slotIdx: si };
      });
    });

    const cols  = floor.columns || 8;
    const total = floor.slots || cols * (floor.rows || 2);
    const isAlt  = floor.layout === "alternating";
    const isAlt2 = floor.layout === "alternating_2d";
    const isQc   = floor.layout === "quinconce";
    const isCircleMode = this._config?.bottle_style === "dot";
    const lm = this._config?.bottle_label || "none";
    // font-size:11px × line-height:1.3 = 14.3px + padding-top:1px → 16px par label
    const lblCount = (lm === "name_vintage" || lm === "vintage_name") ? 2 : lm === "none" ? 0 : 1;
    const labelExtraH = lblCount * 16;
    const rowH = (isCircleMode ? 40 : 80) + labelExtraH;
    const pct   = Math.round((Object.keys(slotMap).length / total) * 100);

    const byType = {};
    Object.values(slotMap).forEach(({ wine }) => {
      byType[wine.type] = (byType[wine.type] || 0) + 1;
    });
    const counters = Object.entries(byType)
      .map(([t, n]) => `<span class="type-count" style="color:${WINE_TYPES[t]?.color || "#C0392B"}">${n}x</span>`)
      .join("");

    const _dot = (i, extraStyle = "") => {
      const entry   = slotMap[i];
      const wine    = entry?.wine || null;
      const slotIdx = entry?.slotIdx ?? -1;
      const filteredType  = this._filter !== "all" && wine && wine.type !== this._filter;
      const filteredEvent = this._filterEvent !== "all" && wine && (wine.event || "") !== this._filterEvent;
      const filtered = filteredType || filteredEvent;
      const wt  = wine ? WINE_TYPES[wine.type] || WINE_TYPES.red : null;
      const sel = wine && wine.id === this._selected;
      const row2d = Math.floor(i / cols);
      const col2d = i % cols;
      const alt = (isAlt && i % 2 === 1) || (isAlt2 && (row2d + col2d) % 2 === 1);
      const dotStyle = wine ? `--dot-glow:${wt.glow};opacity:${filtered ? 0.15 : 1}` : "";
      const isCircle = (this._config?.bottle_style === "dot");

      let labelEls = "";
      if (lm !== "none") {
        const nm = wine ? (wine.name || "").trim() : "";
        const yr = wine ? (wine.vintage || "").trim() : "";
        const short = (s, n) => s.length > n ? s.slice(0, n - 1) + "…" : s;
        const nbsp = s => s.replace(/ /g, "\u00A0");
        // transparent pour les cases vides, coloré pour les vins
        const col = wine ? `color:${wt.color}` : `color:transparent`;
        const lbl = t => `<span class="dot-lbl" style="${col};display:flex;justify-content:center;align-items:center;width:100%">${t}</span>`;
        const ph = "\u00A0"; // placeholder invisible qui conserve la hauteur de ligne
        if      (lm === "vintage")      labelEls = lbl(yr || ph);
        else if (lm === "name")         labelEls = lbl(nm ? nbsp(short(nm, 15)) : ph);
        else if (lm === "name_vintage") labelEls = lbl(nm ? nbsp(short(nm, 12)) : ph) + lbl(yr || ph);
        else if (lm === "vintage_name") labelEls = lbl(yr || ph) + lbl(nm ? nbsp(short(nm, 12)) : ph);
      }

      // En mode cercle + tête-bêche : positions alternées = cercle plus petit (pas de rotation)
      const circleSize = isCircle ? (alt ? 28 : 40) : 40;
      const bottleContent = wine
        ? (isCircle
            ? `<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg" style="width:${circleSize}px;height:${circleSize}px;display:block"><circle cx="5" cy="5" r="5" fill="${wt.color}"/><circle cx="5" cy="5" r="5" fill="white" opacity="0.12"/><ellipse cx="3.5" cy="3.5" rx="1.5" ry="1" fill="white" opacity="0.2"/></svg>`
            : BOTTLE_MINI(wt.color, Math.round(80 * 10 / 26)))
        : (isCircle
            ? `<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg" style="width:${circleSize}px;height:${circleSize}px;display:block"><circle cx="5" cy="5" r="4.5" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="0.8" stroke-dasharray="1.8 1.2"/></svg>`
            : BOTTLE_GHOST(Math.round(80 * 10 / 26)));

      // mode dot : seule la hauteur est imposée inline (width:100% vient du CSS, le SVG est centré par justify-content:center)
      const sizeStyle = isCircle ? `height:${circleSize}px;` : ``;
      const dotEl = `<div
        class="dot ${wine ? "dot--filled" : "dot--empty"} ${sel ? "dot--selected" : ""} ${!isCircle && alt ? "dot--alt" : ""}"
        data-slot="${i}" data-floor-id="${floor.id}" data-wine-id="${wine?.id || ""}" data-slot-idx="${slotIdx}"
        style="${[dotStyle, sizeStyle].filter(Boolean).join(";")}"
        title="${wine ? wine.name + (wine.vintage ? " " + wine.vintage : "") : "Vide — cliquer pour ajouter"}"
      >${bottleContent}</div>`;

      const labelsHtml = labelEls ? `<div class="dot-labels" style="height:${labelExtraH}px">${labelEls}</div>` : "";
      const cellStyle = `height:${rowH}px;${extraStyle}`;
      return `<div class="dot-cell${lm !== "none" ? " dot-cell--labeled" : ""}" style="${cellStyle}">${dotEl}${labelsHtml}</div>`;
    };

    let dots = "";
    let dotsStyle = `grid-template-columns:repeat(${cols},1fr);grid-auto-rows:${rowH}px`;

    if (isQc) {
      // Grille double-colonne : chaque bouteille occupe 2 colonnes
      // Les rangées impaires sont décalées d'une colonne → quinconce parfait
      dotsStyle = `grid-template-columns:repeat(${cols * 2},1fr);grid-auto-columns:1fr;grid-auto-rows:${rowH}px;overflow-x:clip;overflow-y:visible;padding-top:2px`;
      const numRows = Math.ceil(total / cols);
      for (let row = 0; row < numRows; row++) {
        const odd = row % 2 === 1;
        for (let col = 0; col < cols; col++) {
          const i = row * cols + col;
          if (i >= total) break;
          const gc = odd ? col * 2 + 2 : col * 2 + 1;
          dots += _dot(i, `grid-column:${gc}/span 2`);
        }
      }
    } else {
      for (let i = 0; i < total; i++) dots += _dot(i);
    }

    return `
      <div class="floor" style="animation-delay:${index * 0.06}s">
        <div class="floor-rack">
          <div class="floor-counters">${counters}</div>
          <div class="floor-dots" style="${dotsStyle}">${dots}</div>
          <div class="floor-actions">
            <button class="icon-btn" data-edit-floor="${floor.id}" title="Modifier">⚙</button>
            <button class="icon-btn" data-del-floor="${floor.id}"  title="Supprimer">✕</button>
          </div>
        </div>
        <div class="floor-label">
          <span>${floor.name}</span><span class="floor-pct">${pct}%</span>
        </div>
      </div>`;
  }

  // ── Listeners carte ────────────────────────────────────────────────────────────

  _bindCardListeners(data, wines) {
    const s = this.shadowRoot;

    // Filtres par type et événement (selects)
    s.getElementById("sel-type")?.addEventListener("change", (e) => {
      this._filter = e.target.value;
      this._render();
    });
    s.getElementById("sel-event")?.addEventListener("change", (e) => {
      this._filterEvent = e.target.value;
      this._render();
    });

    s.getElementById("btn-history")?.addEventListener("click", () => this._openModal("history"));
    s.getElementById("btn-add-floor")?.addEventListener("click",   () => this._openModal("floor"));

    s.getElementById("btn-add-bottle")?.addEventListener("click", () => {
      if (!data.cellar.floors.length) {
        this._showToast("error", "Créez d'abord un étage !");
        return;
      }
      this._openModal("bottle");
    });

    s.querySelectorAll(".dot").forEach((dot) =>
      dot.addEventListener("click", () => {
        const slot    = parseInt(dot.dataset.slot);
        const floorId = dot.dataset.floorId;
        const wineId  = dot.dataset.wineId;
        const wine    = wineId ? wines.find(w => w.id === wineId) : null;
        if (wine) {
          if (this._selected === wine.id) {
            this._selected = null;
            this._openModal("detail", { wine });
          } else {
            this._selected = wine.id;
            this._render();
          }
        } else {
          this._openModal("bottle", { slot: { floor_id: floorId, slot } });
        }
      })
    );

    s.querySelectorAll("[data-edit-floor]").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const floor = data.cellar.floors.find((f) => f.id === btn.dataset.editFloor);
        this._openModal("floor", { floor });
      })
    );

    s.querySelectorAll("[data-del-floor]").forEach((btn) =>
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const fid   = btn.dataset.delFloor;
        const floor = data.cellar.floors.find((f) => f.id === fid);
        const cnt   = wines.reduce((s, w) => s + (w.slots?.filter(sl => sl.floor_id === fid).length || 0), 0);
        const msg   = cnt > 0
          ? `Supprimer "${floor?.name}" et ses ${cnt} bouteille(s) ?`
          : `Supprimer l'étage "${floor?.name}" ?`;
        if (confirm(msg)) await this._callService("remove_floor", { floor_id: fid });
      })
    );

    // ── Glisser-déposer ────────────────────────────────────────────────────────
    s.querySelectorAll(".dot--filled").forEach((dot) => {
      dot.setAttribute("draggable", "true");
      dot.addEventListener("dragstart", (e) => {
        const wineId  = dot.dataset.wineId;
        const slotIdx = dot.dataset.slotIdx;
        if (!wineId) return;
        e.dataTransfer.setData("text/plain", `${wineId}:${slotIdx}`);
        e.dataTransfer.effectAllowed = "move";
        setTimeout(() => dot.classList.add("dot--dragging"), 0);
      });
      dot.addEventListener("dragend", () => {
        dot.classList.remove("dot--dragging");
        s.querySelectorAll(".dot--drag-over").forEach(d => d.classList.remove("dot--drag-over"));
      });
    });

    s.querySelectorAll(".dot--empty").forEach((dot) => {
      dot.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        dot.classList.add("dot--drag-over");
      });
      dot.addEventListener("dragleave", () => dot.classList.remove("dot--drag-over"));
      dot.addEventListener("drop", async (e) => {
        e.preventDefault();
        dot.classList.remove("dot--drag-over");
        const [wineId, slotIdxStr] = (e.dataTransfer.getData("text/plain") || "").split(":");
        const slotIdx    = parseInt(slotIdxStr);
        const targetSlot = parseInt(dot.dataset.slot);
        const targetFloor = dot.dataset.floorId;
        if (!wineId || isNaN(slotIdx) || isNaN(targetSlot)) return;
        await this._callService("move_slot", { wine_id: wineId, slot_idx: slotIdx, floor_id: targetFloor, slot: targetSlot });
      });
    });
  }

  disconnectedCallback() {
    this._unsubs.forEach((f) => f());
    this._closeModal();
  }
}

// ── Utilitaires ────────────────────────────────────────────────────────────────

const DEFAULT_DATA = () => ({ cellar: { name: "Millésime", floors: [] }, wines: [] });

function _drow(label, value) {
  if (!value) return "";
  return `<div class="mm-drow">
    <span class="mm-drow-label">${label}</span>
    <span class="mm-drow-value">${value}</span>
  </div>`;
}

// ── CSS de la carte ────────────────────────────────────────────────────────────

const CARD_CSS = `<style>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;500;600&display=swap');

:host {
  display: block; font-family: 'Inter', sans-serif;
  --red:#C0392B; --red-h:#E74C3C; --gold:#C9A84C;
  --accent: var(--primary-color, #C0392B);
  --accent-h: var(--secondary-color, #E74C3C);
  --bg-0: var(--primary-background-color, #080808);
  --bg-1: var(--card-background-color, #111);
  --bg-2: var(--secondary-background-color, #181818);
  --bg-3: color-mix(in srgb, var(--card-background-color, #222) 70%, var(--primary-text-color, white) 30%);
  --bg-4: color-mix(in srgb, var(--card-background-color, #2A2A2A) 55%, var(--primary-text-color, white) 45%);
  --cream: var(--primary-text-color, #EDE0CC);
  --muted: var(--secondary-text-color, #5A5A5A);
  --border: var(--divider-color, #222);
  --wood-dk: color-mix(in srgb, #1C1208 65%, var(--card-background-color, #000) 35%);
  --wood-md: color-mix(in srgb, #3D2510 65%, var(--card-background-color, #000) 35%);
  --wood-lt: color-mix(in srgb, #6B3A15 65%, var(--card-background-color, #000) 35%);
  /* ── Surcharges configurables via YAML ── */
  --header-accent: var(--accent);
}
* { box-sizing:border-box; margin:0; padding:0; }

.card { background:var(--bg-0); border-radius:18px; overflow:hidden; border:1px solid var(--border); }

.loading-state { display:flex; align-items:center; justify-content:center; height:180px; }
.loading-glass { width:36px; opacity:0.5; animation:pulse-anim 1.4s ease-in-out infinite; }
@keyframes pulse-anim { 0%,100%{opacity:0.3} 50%{opacity:0.8} }

.header {
  display:flex; align-items:flex-start; gap:10px;
  padding:12px 14px 10px;
  background:linear-gradient(160deg,color-mix(in srgb,var(--card-background-color,#111) 75%,var(--header-accent,#C0392B) 25%) 0%,var(--card-background-color,#111) 100%);
  border-bottom:1px solid var(--border); position:relative;
}
.header::after {
  content:''; position:absolute; bottom:0; left:14px; right:14px; height:1px;
  background:linear-gradient(90deg,transparent,var(--header-accent,var(--red))44,transparent);
}
/* Logo + nom empilés à gauche */
.header-left { display:flex; flex-direction:column; align-items:center; gap:4px; flex-shrink:0; padding-top:2px; }
.header-glass {
  width:28px;
  filter:drop-shadow(0 0 8px rgba(192,57,43,0.7));
  animation:float-anim 3s ease-in-out infinite;
}
@keyframes float-anim { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
.header-meta { text-align:center; }
.header-name { font-family:'Playfair Display',serif; font-size:10px; color:var(--cream); line-height:1.2; }
.header-tagline { font-size:7px; color:var(--red); text-transform:uppercase; letter-spacing:1.5px; margin-top:1px; }
/* Colonne droite : stats en haut, boutons en dessous */
.header-right { display:flex; flex-direction:column; gap:7px; flex:1; min-width:0; }
.header-stats { display:flex; gap:5px; align-items:stretch; }
.stat { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:5px 6px; background:var(--bg-2); border-radius:8px; border:1px solid var(--border); flex:1; }
.stat-value { font-size:14px; font-weight:700; color:var(--cream); font-family:'Playfair Display',serif; line-height:1; }
.stat-label { font-size:7px; color:var(--muted); text-transform:uppercase; letter-spacing:1px; margin-top:2px; }
.header-actions { display:flex; gap:6px; }
.header-actions button { flex:1; }
.btn-primary, .btn-secondary {
  padding:7px 12px; border-radius:8px; border:none;
  font-family:'Inter',sans-serif; font-size:11px; font-weight:600;
  cursor:pointer; transition:all 0.15s; white-space:nowrap;
}
.btn-primary { background:var(--accent); color:#fff; }
.btn-primary:hover { background:var(--accent-h); transform:translateY(-1px); }
.btn-secondary { background:var(--bg-3); color:var(--cream); border:1px solid var(--border); }
.btn-secondary:hover { background:var(--bg-4); }

.filters {
  display:flex; gap:10px; padding:8px 14px;
  background:var(--bg-1); border-bottom:1px solid var(--border);
}
.filter-group { display:flex; flex-direction:column; gap:4px; flex:1; }
.filter-label {
  font-size:9px; color:var(--muted); text-transform:uppercase;
  letter-spacing:1.5px; text-align:center;
}
.filter-select {
  width:100%; padding:6px 28px 6px 10px; border-radius:8px;
  border:1px solid var(--border); background:var(--bg-2);
  color:var(--cream); font-family:'Inter',sans-serif; font-size:12px;
  cursor:pointer; outline:none; -webkit-appearance:none; appearance:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%235A5A5A'/%3E%3C/svg%3E");
  background-repeat:no-repeat; background-position:right 10px center;
  min-height:36px;
}
.filter-select:focus { border-color:var(--accent); }
.filter-select option { background:var(--bg-1); color:var(--cream); }

.cellar { padding:12px 14px; display:flex; flex-direction:column; gap:2px; }
.empty-state { text-align:center; padding:44px 20px; }
.empty-glass { width:36px; margin:0 auto 12px; opacity:0.4; }
.empty-title { font-family:'Playfair Display',serif; color:var(--cream); font-size:15px; margin-bottom:5px; }
.empty-sub { font-size:12px; color:var(--muted); }

.floor { margin-bottom:10px; animation:slide-in 0.3s ease-out both; }
@keyframes slide-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

.floor-rack {
  display:flex; align-items:center; gap:6px;
  background:var(--bg-1); border:1px solid var(--border); border-bottom:none;
  border-radius:10px 10px 0 0; padding:8px 9px; min-height:0;
}
.floor-counters { display:flex; flex-direction:column; align-items:flex-end; gap:1px; min-width:24px; }
.type-count { font-size:9px; font-weight:700; display:block; }
.floor-actions { display:flex; flex-direction:column; gap:3px; margin-left:2px; }
.icon-btn { background:none; border:none; cursor:pointer; font-size:11px; padding:2px; opacity:0.3; color:var(--cream); transition:opacity 0.15s; line-height:1; }
.icon-btn:hover { opacity:1; }

.floor-dots { display:grid; flex:1; gap:4px 3px; align-items:stretch; overflow:visible; }
.dot { height:80px; width:100%; cursor:pointer; transition:transform 0.12s, filter 0.12s; display:flex; align-items:center; justify-content:center; }
.dot--empty { opacity:0.3; }
.dot--empty:hover { opacity:0.55; transform:scale(1.08); }
.dot--filled { filter:drop-shadow(0 2px 4px var(--dot-glow,rgba(192,57,43,0.35))); }
.dot--filled:hover { transform:scale(1.12) translateY(-2px); filter:drop-shadow(0 4px 8px var(--dot-glow,rgba(192,57,43,0.6))); }
.dot--selected { filter:drop-shadow(0 0 5px var(--gold)) drop-shadow(0 2px 5px var(--dot-glow,rgba(192,57,43,0.4))); transform:scale(1.1); }
.dot--alt { transform:rotate(180deg); }
.dot--alt:hover { transform:rotate(180deg) scale(1.12) translateY(2px); }
.dot--alt.dot--selected { transform:rotate(180deg) scale(1.1); }
.dot--dragging { opacity:0.25 !important; cursor:grabbing !important; }
.dot--filled[draggable="true"] { cursor:grab; }
.dot--drag-over { filter:drop-shadow(0 0 6px var(--accent)) !important; transform:scale(1.18) translateY(-2px); opacity:1 !important; }

.floor-label {
  background:linear-gradient(90deg,var(--wood-dk),var(--wood-md),var(--wood-lt),var(--wood-md),var(--wood-dk));
  border:1px solid var(--wood-lt); border-top:none; border-radius:0 0 10px 10px;
  display:flex; align-items:center; justify-content:center; gap:8px; padding:4px 12px;
  font-size:9px; font-weight:600; color:var(--gold); letter-spacing:2px; text-transform:uppercase;
}
.floor-pct { color:var(--wood-lt); font-size:8px; }

/* ─── Footer détail : 4 boutons ─── */
.mm-footer-detail { gap:5px; flex-wrap:wrap; }
.mm-footer-detail .mm-btn { flex:1; min-width:0; font-size:10px; padding:7px 6px; }


/* ─── Historique valeur ─── */
.hist-summary { display:flex; gap:8px; margin-bottom:8px; }
.hist-stat { flex:1; display:flex; flex-direction:column; align-items:center;
  padding:8px; background:var(--bg-2); border-radius:8px; border:1px solid var(--border); }
.hist-val { font-size:16px; font-weight:700; color:var(--cream); font-family:'Playfair Display',serif; }
.hist-lbl { font-size:9px; color:var(--muted); text-transform:uppercase; letter-spacing:1px; margin-top:2px; }
.hist-table { margin-top:12px; display:flex; flex-direction:column; gap:4px; }
.hist-row { display:flex; align-items:center; padding:5px 8px; background:var(--bg-2);
  border-radius:6px; border:1px solid var(--border); font-size:11px; }
.hist-date { color:var(--muted); flex:1; }
.hist-bottles { color:var(--muted); margin-right:12px; }
.hist-price { color:var(--cream); font-weight:600; font-family:'Playfair Display',serif; }

/* ─── Cellule bouteille (dot-cell) ─── */
.dot-cell {
  display:flex; flex-direction:column; align-items:center;
  justify-content:flex-start; width:100%; overflow:hidden;
}
.dot-cell > .dot {
  flex-shrink:0;
}
.dot-labels {
  width:100%; overflow:hidden; flex-shrink:0;
  display:flex; flex-direction:column; align-items:stretch;
}
.dot-lbl {
  display:block; width:100%; box-sizing:border-box;
  font-size:11px; font-weight:700; text-align:center; line-height:1.3;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  text-transform:uppercase; letter-spacing:0.4px; opacity:0.9; padding-top:1px;
  flex-shrink:0;
}
</style>`;

// ── CSS du modal ────────────────────────────────────────────────────────────────

const MODAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;500;600&display=swap');

@keyframes mm-fade  { from{opacity:0} to{opacity:1} }
@keyframes mm-slide { from{opacity:0;transform:translateY(-18px)} to{opacity:1;transform:translateY(0)} }
@keyframes mm-spin  { to{transform:rotate(360deg)} }

.mm-overlay {
  position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:99999;
  display:flex; align-items:flex-start; justify-content:center; padding-top:12px;
  animation:mm-fade 0.15s ease; font-family:'Inter',sans-serif;
  --mm-bg0: var(--primary-background-color, #080808);
  --mm-bg1: var(--card-background-color, #111);
  --mm-bg2: var(--secondary-background-color, #181818);
  --mm-bg3: color-mix(in srgb, var(--card-background-color, #1A1A1A) 80%, var(--primary-text-color, white) 20%);
  --mm-text: var(--primary-text-color, #EDE0CC);
  --mm-muted: var(--secondary-text-color, #555);
  --mm-border: var(--divider-color, #222);
  --mm-red: var(--primary-color, #C0392B);
  --mm-red-h: var(--secondary-color, #E74C3C);
}
.mm-box {
  background:var(--mm-bg1); border:1px solid var(--mm-border); border-top:none;
  border-radius:0 0 20px 20px;
  width:100%; max-width:520px; max-height:92vh;
  display:flex; flex-direction:column;
  animation:mm-slide 0.22s ease-out; color:var(--mm-text);
  overflow:hidden;
}
.mm-header {
  display:flex; align-items:center; justify-content:space-between;
  padding:16px 20px 12px; border-bottom:1px solid var(--mm-border);
  flex-shrink:0; background:var(--mm-bg1); z-index:2;
}
.mm-title { font-family:'Playfair Display',serif; font-size:16px; color:var(--mm-text); }
.mm-close { background:none; border:none; color:var(--mm-muted); cursor:pointer; font-size:18px; padding:0 4px; transition:color 0.15s; }
.mm-close:hover { color:var(--mm-text); }
.mm-body  { padding:16px 20px; flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch; }
.mm-footer {
  padding:12px 20px; border-top:1px solid var(--mm-border);
  display:flex; gap:8px; justify-content:flex-end; align-items:center;
  flex-shrink:0; background:var(--mm-bg1);
}
.mm-sync-label {
  font-size:11px; color:var(--mm-muted); margin-right:auto;
  display:flex; align-items:center; gap:5px; cursor:pointer;
}
.mm-field  { margin-bottom:12px; }
.mm-label  { display:block; font-size:10px; text-transform:uppercase; letter-spacing:1px; color:var(--mm-red); margin-bottom:4px; }
.mm-input  {
  width:100%; padding:9px 11px;
  background:var(--mm-bg0); border:1px solid var(--mm-border); border-radius:8px;
  color:var(--mm-text); font-family:'Inter',sans-serif; font-size:13px;
  outline:none; transition:border-color 0.15s; box-sizing:border-box;
}
.mm-input:focus { border-color:var(--mm-red); box-shadow:0 0 0 2px rgba(192,57,43,0.1); }
.mm-input option { background:var(--mm-bg1); }
.mm-textarea { min-height:66px; resize:vertical; }
.mm-row { display:grid; grid-template-columns:1fr 1fr; gap:10px; }

.mm-btn { padding:10px 18px; border-radius:8px; border:none; font-family:'Inter',sans-serif; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.15s; }
.mm-btn-primary { background:var(--mm-red); color:#fff; }
.mm-btn-primary:hover { background:var(--mm-red-h); transform:translateY(-1px); }
.mm-btn-ghost { background:var(--mm-bg3); color:var(--mm-text); border:1px solid var(--mm-border); }
.mm-btn-ghost:hover { background:var(--mm-bg2); }
.mm-btn-danger { background:rgba(140,10,10,0.3); color:#ff6b6b; border:1px solid rgba(140,10,10,0.4); }
.mm-btn-danger:hover { background:rgba(140,10,10,0.55); }

/* Bloc recherche */
.mm-search-block { margin-bottom:14px; }
.mm-search-row   { display:flex; gap:8px; align-items:center; }
.mm-search-wrap  { position:relative; display:flex; align-items:center; flex:1; }
.mm-search-icon  { position:absolute; left:11px; font-size:13px; pointer-events:none; }
.mm-search-input { padding-left:32px !important; }

/* Bouton photo */
.mm-btn-photo {
  flex-shrink:0; width:40px; height:40px; border-radius:8px;
  background:var(--mm-bg3); border:1px solid var(--mm-border); cursor:pointer;
  font-size:18px; display:flex; align-items:center; justify-content:center;
  transition:all 0.15s;
}
.mm-btn-photo:hover { background:var(--mm-bg2); border-color:rgba(192,57,43,0.27); }

/* Spinner */
.mm-spinner {
  display:inline-block; width:12px; height:12px;
  border:2px solid var(--mm-border); border-top-color:var(--mm-red);
  border-radius:50%; animation:mm-spin 0.7s linear infinite;
  vertical-align:middle; margin-right:6px;
}

/* Résultats */
.mm-viv-results {
  background:var(--mm-bg0); border:1px solid var(--mm-border); border-top:none;
  border-radius:0 0 8px 8px;
  display:none; max-height:220px; overflow-y:auto;
}
.mm-viv-item {
  display:flex; align-items:flex-start; gap:9px;
  padding:10px 12px; cursor:pointer;
  border-bottom:1px solid var(--mm-bg2); transition:background 0.12s;
}
.mm-viv-item:hover { background:var(--mm-bg2); }
.mm-viv-item:last-child { border-bottom:none; }
.mm-viv-name { font-size:13px; color:var(--mm-text); font-weight:500; }
.mm-viv-sub  { font-size:10px; color:var(--mm-muted); margin-top:2px; }
.mm-viv-notes { font-size:10px; color:var(--mm-muted); margin-top:3px; font-style:italic; line-height:1.4; }
.mm-viv-loading { padding:12px; font-size:12px; color:var(--mm-muted); text-align:center; display:flex; align-items:center; justify-content:center; gap:6px; }

/* Bannière erreur/info sous la recherche */
.mm-search-banner {
  font-size:11px; line-height:1.5; border-radius:6px;
  padding:8px 10px; margin-top:6px;
}
.mm-search-banner--error   { background:#200808; color:#ff9090; border:1px solid #401010; }
.mm-search-banner--warning { background:#1E1400; color:#ffcc70; border:1px solid #402800; }
.mm-search-banner--info    { background:#080E18; color:#80b4e8; border:1px solid #102030; }

/* Photo */
.mm-photo-loading { text-align:center; padding:10px 0; }
.mm-photo-error {
  font-size:12px; color:#ff9090; background:#200808;
  border:1px solid #401010; border-radius:8px;
  padding:10px 12px; margin-bottom:10px; text-align:center;
}

/* Sélecteur de slot */
.sp-picker { margin-top:6px; }
.sp-grid {
  display:grid; gap:5px;
  margin-bottom:6px;
}
.sp-dot {
  aspect-ratio:1; border-radius:50%;
  background:var(--sp-c, var(--mm-bg3, #2a2a2a));
  border:1px solid var(--mm-border, #444);
  transition:transform .12s, box-shadow .12s;
}
.sp-free { cursor:pointer; }
.sp-free:hover { transform:scale(1.15); border-color:var(--mm-muted, #888); }
.sp-sel {
  background:var(--sp-c, #a78bfa) !important;
  border-color:#a78bfa;
  box-shadow:0 0 0 2px #a78bfa55;
}
.sp-taken {
  background:var(--sp-c, var(--mm-bg3, #555)) !important;
  opacity:0.75;
  cursor:not-allowed;
}
.sp-label { font-size:10px; color:var(--mm-muted); }

/* Détail */
.mm-detail-hero  { text-align:center; margin-bottom:18px; }
.mm-detail-name  { font-family:'Playfair Display',serif; font-size:20px; color:var(--mm-text); margin-bottom:4px; }
.mm-detail-sub   { font-size:12px; color:var(--mm-muted); }
.mm-vivino-link  { display:inline-block; margin-top:8px; color:var(--mm-red); font-size:11px; text-decoration:none; border:1px solid rgba(192,57,43,0.3); padding:3px 10px; border-radius:20px; }
.mm-detail-grid  { display:grid; grid-template-columns:1fr 1fr; gap:7px; margin-bottom:10px; }
.mm-drow         { background:var(--mm-bg2); border-radius:8px; padding:9px 11px; border:1px solid var(--mm-border); }
.mm-drow-label   { display:block; font-size:9px; text-transform:uppercase; letter-spacing:1px; color:var(--mm-muted); margin-bottom:2px; }
.mm-drow-value   { font-size:13px; color:var(--mm-text); font-weight:500; }
.mm-notes        { font-size:12px; color:var(--mm-muted); background:var(--mm-bg2); padding:10px 12px; border-radius:8px; border-left:2px solid var(--mm-red); line-height:1.55; margin-bottom:6px; }
.mm-tasting      { border-left-color:var(--mm-red); font-style:italic; }
.mm-pairing      { border-left-color:#27AE8F; font-style:normal; }

`;

// ── Enregistrement ─────────────────────────────────────────────────────────────

customElements.define("millesime-card", MillesimeCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type:        "millesime-card",
  name:        "Millésime — Cave à Vin",
  description: "Visualisation cave à vin avec Gemini AI (texte + photo)",
  preview:     true,
});
/**
 * Millésime Card v3.1.1
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

// Messages d'erreur affichés à l'utilisateur selon le code retourné par le backend
const ERROR_MESSAGES = {
  quota_exceeded:      "⚠️ Quota Gemini dépassé (1 500/jour). Les résultats viennent d'Open Food Facts — ajoutez votre clé demain ou vérifiez votre quota sur aistudio.google.com.",
  invalid_key:         "🔑 Clé Gemini invalide ou expirée. Allez dans Paramètres → Appareils → Millésime → ⚙️ pour la mettre à jour.",
  service_unavailable: "🔄 Gemini temporairement indisponible. Les résultats viennent d'Open Food Facts.",
  parse_error:         "⚠️ Réponse Gemini inattendue. Réessayez ou remplissez manuellement.",
  no_key:              "ℹ️ Résultats Open Food Facts. Configurez une clé Gemini pour obtenir notes de dégustation et accords mets-vins.",
  no_wine_found:       "📷 Aucune étiquette de vin reconnue. Assurez-vous que l'étiquette est nette et bien éclairée.",
};

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
    this._selected   = null;  // id bouteille sélectionnée
    this._modal      = null;
    this._modalStyle = null;
    this._unsubs     = [];
  }

  setConfig(config) { this._config = config || {}; this._renderLoading(); }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) { this._subscribeUpdates(); this._fetchData(); }
  }

  getCardSize() { return 8; }

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
    const box = document.createElement("div");
    box.className = "mm-box";

    if (type === "floor")  box.innerHTML = this._floorFormHTML(opts.floor);
    if (type === "bottle") box.innerHTML = this._bottleFormHTML(opts.bottle, opts.slot);
    if (type === "detail") box.innerHTML = this._detailHTML(opts.bottle);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
    this._modal = overlay;

    overlay.addEventListener("click", (e) => { if (e.target === overlay) this._closeModal(); });
    box.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => this._closeModal()));

    if (type === "floor")  this._bindFloorForm(box, opts.floor);
    if (type === "bottle") this._bindBottleForm(box, opts.bottle, opts.slot);
    if (type === "detail") this._bindDetailButtons(box, opts.bottle);
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
            <option value="side_by_side" ${(floor?.layout || "side_by_side") === "side_by_side" ? "selected" : ""}>Côte à côte</option>
            <option value="alternating" ${floor?.layout === "alternating" ? "selected" : ""}>Tête bêche</option>
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

  _bottleFormHTML(bottle, pendingSlot) {
    const floors = this._data?.cellar?.floors || [];
    const isEdit = !!bottle;
    const b = bottle || {};
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
          <div class="mm-field">
            <label class="mm-label">Quantité</label>
            <input class="mm-input" id="bt-quantity" type="number" min="1" value="${b.quantity || 1}">
          </div>
          <div class="mm-field">
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
          <div class="mm-field">
            <label class="mm-label">Emplacement n°</label>
            <input class="mm-input" id="bt-slot" type="number" min="0" value="${pendingSlot?.slot ?? 0}">
          </div>
        </div>` : ""}

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

  _bindBottleForm(box, bottle, pendingSlot) {
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
        <div style="text-align:center;font-size:11px;color:#888">
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
      const int = (id) => parseInt(box.querySelector(`#${id}`)?.value)    || 0;

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
        quantity:      int("bt-quantity") || 1,
        drink_from:    txt("bt-from"),
        drink_until:   txt("bt-until"),
        notes:         txt("bt-notes"),
        tasting_notes: txt("bt-tasting"),
        food_pairing:  txt("bt-pairing"),
        vivino_rating: num("bt-vrating"),
        image_url:     txt("bt-image_url"),
        vivino_url:    txt("bt-vivino_url"),
      };

      if (bottle) {
        await this._callService("update_bottle", { bottle_id: bottle.id, ...payload });
      } else {
        payload.floor_id = box.querySelector("#bt-floor")?.value || "";
        payload.slot     = int("bt-slot");
        await this._callService("add_bottle", payload);
      }
    });
  }

  // ── Fiche détail bouteille ─────────────────────────────────────────────────────

  _detailHTML(b) {
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
            <div style="color:#555;font-size:11px;margin-top:2px">${vr.toFixed(1)} / 5</div>` : ""}
          ${b.vivino_url ? `<a href="${b.vivino_url}" target="_blank" class="mm-vivino-link">Voir sur Vivino →</a>` : ""}
        </div>
        <div class="mm-detail-grid">
          ${_drow("Millésime",  b.vintage)}
          ${_drow("Région",     [b.region, b.country].filter(Boolean).join(", "))}
          ${_drow("Prix",       b.price ? b.price + " €" : "")}
          ${_drow("Quantité",   (b.quantity || 1) > 1 ? b.quantity + " bouteilles" : "")}
          ${_drow("À boire",    (b.drink_from || b.drink_until)
                                ? (b.drink_from || "?") + " — " + (b.drink_until || "?") : "")}
          ${_drow("Ajouté le",  b.added_date || "")}
        </div>
        ${b.tasting_notes ? `<div class="mm-notes mm-tasting">🍷 ${b.tasting_notes}</div>` : ""}
        ${b.food_pairing  ? `<div class="mm-notes mm-pairing">🍽️ ${b.food_pairing}</div>`  : ""}
        ${b.notes         ? `<div class="mm-notes">"${b.notes}"</div>`                     : ""}
      </div>
      <div class="mm-footer">
        <button class="mm-btn mm-btn-danger" id="det-remove">🗑 Retirer</button>
        <button class="mm-btn mm-btn-ghost"  id="det-edit">✏️ Modifier</button>
      </div>`;
  }

  _bindDetailButtons(box, bottle) {
    box.querySelector("#det-remove")?.addEventListener("click", async () => {
      if (confirm("Retirer cette bouteille de la cave ?")) {
        this._selected = null;
        await this._callService("remove_bottle", { bottle_id: bottle.id });
      }
    });
    box.querySelector("#det-edit")?.addEventListener("click", () => {
      this._closeModal();
      this._openModal("bottle", { bottle });
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
    const data    = this._data || DEFAULT_DATA();
    const floors  = data.cellar?.floors || [];
    const bottles = data.bottles || [];
    this.shadowRoot.innerHTML = CARD_CSS + `
      <div class="card">
        ${this._renderHeader(data, bottles)}
        ${this._renderFilters()}
        <div class="cellar">
          ${floors.length === 0
            ? this._renderEmpty()
            : floors.map((f, i) => this._renderFloor(f, bottles, i)).join("")}
        </div>
      </div>`;
    this._bindCardListeners(data, bottles);
  }

  _renderHeader(data, bottles) {
    const total  = bottles.reduce((s, b) => s + (b.quantity || 1), 0);
    const value  = bottles.reduce((s, b) => s + (b.price || 0) * (b.quantity || 1), 0);
    const nFloor = data.cellar?.floors?.length || 0;
    return `
      <div class="header">
        <div class="header-brand">
          <div class="header-glass">${GLASS_SVG}</div>
          <div>
            <div class="header-name">${data.cellar?.name || "Millésime"}</div>
            <div class="header-tagline">Cave à vin</div>
          </div>
        </div>
        <div class="header-stats">
          <div class="stat"><span class="stat-value">${total}</span><span class="stat-label">Bouteilles</span></div>
          <div class="stat"><span class="stat-value">${nFloor}</span><span class="stat-label">Étages</span></div>
          <div class="stat"><span class="stat-value">${value > 0 ? Math.round(value) + "€" : "—"}</span><span class="stat-label">Valeur</span></div>
        </div>
        <div class="header-actions">
          <button class="btn-secondary" id="btn-add-floor">+ Étage</button>
          <button class="btn-primary"   id="btn-add-bottle">+ Vin</button>
        </div>
      </div>`;
  }

  _renderFilters() {
    const filters = [
      { v: "all", l: "Tout", c: "#C0392B" },
      ...Object.entries(WINE_TYPES).map(([v, t]) => ({ v, l: t.label, c: t.color })),
    ];
    return `
      <div class="filters">
        ${filters.map((f) => `
          <button class="filter-btn ${this._filter === f.v ? "filter-btn--active" : ""}" data-filter="${f.v}">
            <span class="filter-dot" style="background:${f.c}"></span>${f.l}
          </button>`).join("")}
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

  _renderFloor(floor, allBottles, index) {
    const fb    = allBottles.filter((b) => b.floor_id === floor.id);
    const cols  = floor.columns || 8;
    const total = floor.slots || cols * (floor.rows || 2);
    const isAlt = floor.layout === "alternating";
    const pct   = Math.round((fb.length / total) * 100);

    const byType = {};
    fb.forEach((b) => { byType[b.type] = (byType[b.type] || 0) + (b.quantity || 1); });
    const counters = Object.entries(byType)
      .map(([t, n]) => `<span class="type-count" style="color:${WINE_TYPES[t]?.color || "#C0392B"}">${n}x</span>`)
      .join("");

    let dots = "";
    for (let i = 0; i < total; i++) {
      const bt  = fb.find((b) => b.slot === i);
      const filtered = this._filter !== "all" && bt && bt.type !== this._filter;
      const wt  = bt ? WINE_TYPES[bt.type] || WINE_TYPES.red : null;
      const sel = bt && bt.id === this._selected;
      const alt = isAlt && i % 2 === 1;
      dots += `<div
        class="dot ${bt ? "dot--filled" : "dot--empty"} ${sel ? "dot--selected" : ""} ${alt ? "dot--alt" : ""}"
        data-slot="${i}" data-floor-id="${floor.id}"
        style="${bt ? `--dot-color:${wt.color};--dot-glow:${wt.glow};opacity:${filtered ? 0.15 : 1}` : ""}"
        title="${bt ? bt.name + (bt.vintage ? " " + bt.vintage : "") : "Vide — cliquer pour ajouter"}"
      ></div>`;
    }

    return `
      <div class="floor" style="animation-delay:${index * 0.06}s">
        <div class="floor-rack">
          <div class="floor-counters">${counters}</div>
          <div class="floor-dots" style="grid-template-columns:repeat(${cols},1fr)">${dots}</div>
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

  _bindCardListeners(data, bottles) {
    const s = this.shadowRoot;

    s.querySelectorAll("[data-filter]").forEach((btn) =>
      btn.addEventListener("click", () => { this._filter = btn.dataset.filter; this._render(); })
    );

    s.getElementById("btn-add-floor")?.addEventListener("click", () => this._openModal("floor"));

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
        const bt      = bottles.find((b) => b.floor_id === floorId && b.slot === slot);
        if (bt) {
          if (this._selected === bt.id) {
            this._selected = null;
            this._openModal("detail", { bottle: bt });
          } else {
            this._selected = bt.id;
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
        const cnt   = bottles.filter((b) => b.floor_id === fid).length;
        const msg   = cnt > 0
          ? `Supprimer "${floor?.name}" et ses ${cnt} bouteille(s) ?`
          : `Supprimer l'étage "${floor?.name}" ?`;
        if (confirm(msg)) await this._callService("remove_floor", { floor_id: fid });
      })
    );
  }

  disconnectedCallback() {
    this._unsubs.forEach((f) => f());
    this._closeModal();
  }
}

// ── Utilitaires ────────────────────────────────────────────────────────────────

const DEFAULT_DATA = () => ({ cellar: { name: "Millésime", floors: [] }, bottles: [] });

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
  --bg-0:#080808; --bg-1:#111; --bg-2:#181818; --bg-3:#222; --bg-4:#2A2A2A;
  --cream:#EDE0CC; --muted:#5A5A5A; --border:#222;
  --wood-dk:#1C1208; --wood-md:#2A1A08; --wood-lt:#4A2A08;
}
* { box-sizing:border-box; margin:0; padding:0; }

.card { background:var(--bg-0); border-radius:18px; overflow:hidden; border:1px solid var(--border); }

.loading-state { display:flex; align-items:center; justify-content:center; height:180px; }
.loading-glass { width:36px; opacity:0.5; animation:pulse-anim 1.4s ease-in-out infinite; }
@keyframes pulse-anim { 0%,100%{opacity:0.3} 50%{opacity:0.8} }

.header {
  display:flex; align-items:center; gap:10px;
  padding:16px 18px 14px;
  background:linear-gradient(160deg,#180808 0%,#111 100%);
  border-bottom:1px solid var(--border); position:relative;
}
.header::after {
  content:''; position:absolute; bottom:0; left:18px; right:18px; height:1px;
  background:linear-gradient(90deg,transparent,var(--red)44,transparent);
}
.header-brand { display:flex; align-items:center; gap:10px; }
.header-glass {
  width:30px; flex-shrink:0;
  filter:drop-shadow(0 0 8px rgba(192,57,43,0.7));
  animation:float-anim 3s ease-in-out infinite;
}
@keyframes float-anim { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
.header-name { font-family:'Playfair Display',serif; font-size:18px; color:var(--cream); }
.header-tagline { font-size:9px; color:var(--red); text-transform:uppercase; letter-spacing:2.5px; margin-top:1px; }
.header-stats { display:flex; gap:7px; margin-left:auto; }
.stat { display:flex; flex-direction:column; align-items:center; padding:5px 9px; background:var(--bg-2); border-radius:8px; border:1px solid var(--border); min-width:50px; }
.stat-value { font-size:14px; font-weight:700; color:var(--cream); font-family:'Playfair Display',serif; }
.stat-label { font-size:8px; color:var(--muted); text-transform:uppercase; letter-spacing:1px; margin-top:1px; }
.header-actions { display:flex; gap:6px; margin-left:8px; }
.btn-primary, .btn-secondary {
  padding:7px 12px; border-radius:8px; border:none;
  font-family:'Inter',sans-serif; font-size:11px; font-weight:600;
  cursor:pointer; transition:all 0.15s; white-space:nowrap;
}
.btn-primary { background:var(--red); color:#fff; }
.btn-primary:hover { background:var(--red-h); transform:translateY(-1px); }
.btn-secondary { background:var(--bg-3); color:var(--cream); border:1px solid var(--border); }
.btn-secondary:hover { background:var(--bg-4); }

.filters { display:flex; gap:5px; padding:9px 16px; overflow-x:auto; scrollbar-width:none; background:var(--bg-1); border-bottom:1px solid var(--border); }
.filters::-webkit-scrollbar { display:none; }
.filter-btn { display:flex; align-items:center; gap:5px; padding:4px 10px; border-radius:20px; border:1px solid var(--border); background:transparent; color:var(--muted); font-size:10px; font-weight:500; cursor:pointer; transition:all 0.15s; white-space:nowrap; }
.filter-btn:hover, .filter-btn--active { background:var(--bg-3); border-color:var(--red)44; color:var(--cream); }
.filter-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }

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
  border-radius:10px 10px 0 0; padding:7px 9px; min-height:48px;
}
.floor-counters { display:flex; flex-direction:column; align-items:flex-end; gap:1px; min-width:24px; }
.type-count { font-size:9px; font-weight:700; display:block; }
.floor-actions { display:flex; flex-direction:column; gap:3px; margin-left:2px; }
.icon-btn { background:none; border:none; cursor:pointer; font-size:11px; padding:2px; opacity:0.3; color:var(--cream); transition:opacity 0.15s; line-height:1; }
.icon-btn:hover { opacity:1; }

.floor-dots { display:grid; flex:1; gap:4px; align-items:center; }
.dot { width:100%; aspect-ratio:1; border-radius:50%; cursor:pointer; transition:transform 0.12s,box-shadow 0.12s; }
.dot--empty { background:var(--bg-3); border:1px solid var(--bg-4); opacity:0.35; }
.dot--empty:hover { opacity:0.6; transform:scale(1.1); }
.dot--filled { background:var(--dot-color,#C0392B); box-shadow:0 2px 6px var(--dot-glow,rgba(192,57,43,0.4)); }
.dot--filled:hover { transform:scale(1.15); box-shadow:0 3px 12px var(--dot-glow,rgba(192,57,43,0.65)); }
.dot--selected { outline:2px solid var(--gold); outline-offset:2px; transform:scale(1.12); }
.dot--alt { transform:translateY(3px) scale(0.86); }
.dot--alt:hover { transform:translateY(3px) scale(1.02); }
.dot--alt.dot--selected { transform:translateY(3px) scale(1.0); }

.floor-label {
  background:linear-gradient(90deg,var(--wood-dk),var(--wood-md),var(--wood-lt),var(--wood-md),var(--wood-dk));
  border:1px solid var(--wood-lt); border-top:none; border-radius:0 0 10px 10px;
  display:flex; align-items:center; justify-content:center; gap:8px; padding:4px 12px;
  font-size:9px; font-weight:600; color:var(--gold); letter-spacing:2px; text-transform:uppercase;
}
.floor-pct { color:var(--wood-lt); font-size:8px; }
</style>`;

// ── CSS du modal ────────────────────────────────────────────────────────────────

const MODAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;500;600&display=swap');

@keyframes mm-fade  { from{opacity:0} to{opacity:1} }
@keyframes mm-slide { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
@keyframes mm-spin  { to{transform:rotate(360deg)} }

.mm-overlay {
  position:fixed; inset:0; background:rgba(0,0,0,0.88); z-index:99999;
  display:flex; align-items:flex-end; justify-content:center;
  animation:mm-fade 0.15s ease; font-family:'Inter',sans-serif;
}
.mm-box {
  background:#111; border:1px solid #222; border-bottom:none;
  border-radius:20px 20px 0 0;
  width:100%; max-width:520px; max-height:92vh;
  overflow-y:auto; animation:mm-slide 0.22s ease-out; color:#EDE0CC;
}
.mm-header {
  display:flex; align-items:center; justify-content:space-between;
  padding:16px 20px 12px; border-bottom:1px solid #222;
  position:sticky; top:0; background:#111; z-index:2;
}
.mm-title { font-family:'Playfair Display',serif; font-size:16px; color:#EDE0CC; }
.mm-close { background:none; border:none; color:#555; cursor:pointer; font-size:18px; padding:0 4px; transition:color 0.15s; }
.mm-close:hover { color:#EDE0CC; }
.mm-body  { padding:16px 20px; }
.mm-footer {
  padding:12px 20px; border-top:1px solid #222;
  display:flex; gap:8px; justify-content:flex-end;
  position:sticky; bottom:0; background:#111;
}
.mm-field  { margin-bottom:12px; }
.mm-label  { display:block; font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#C0392B; margin-bottom:4px; }
.mm-input  {
  width:100%; padding:9px 11px;
  background:#080808; border:1px solid #222; border-radius:8px;
  color:#EDE0CC; font-family:'Inter',sans-serif; font-size:13px;
  outline:none; transition:border-color 0.15s; box-sizing:border-box;
}
.mm-input:focus { border-color:#C0392B; box-shadow:0 0 0 2px rgba(192,57,43,0.1); }
.mm-input option { background:#111; }
.mm-textarea { min-height:66px; resize:vertical; }
.mm-row { display:grid; grid-template-columns:1fr 1fr; gap:10px; }

.mm-btn { padding:10px 18px; border-radius:8px; border:none; font-family:'Inter',sans-serif; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.15s; }
.mm-btn-primary { background:#C0392B; color:#fff; }
.mm-btn-primary:hover { background:#E74C3C; transform:translateY(-1px); }
.mm-btn-ghost { background:#1A1A1A; color:#EDE0CC; border:1px solid #222; }
.mm-btn-ghost:hover { background:#222; }
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
  background:#1A1A1A; border:1px solid #333; cursor:pointer;
  font-size:18px; display:flex; align-items:center; justify-content:center;
  transition:all 0.15s;
}
.mm-btn-photo:hover { background:#2A2A2A; border-color:#C0392B44; }

/* Spinner */
.mm-spinner {
  display:inline-block; width:12px; height:12px;
  border:2px solid #333; border-top-color:#C0392B;
  border-radius:50%; animation:mm-spin 0.7s linear infinite;
  vertical-align:middle; margin-right:6px;
}

/* Résultats */
.mm-viv-results {
  background:#080808; border:1px solid #222; border-top:none;
  border-radius:0 0 8px 8px;
  display:none; max-height:220px; overflow-y:auto;
}
.mm-viv-item {
  display:flex; align-items:flex-start; gap:9px;
  padding:10px 12px; cursor:pointer;
  border-bottom:1px solid #181818; transition:background 0.12s;
}
.mm-viv-item:hover { background:#141414; }
.mm-viv-item:last-child { border-bottom:none; }
.mm-viv-name { font-size:13px; color:#EDE0CC; font-weight:500; }
.mm-viv-sub  { font-size:10px; color:#555; margin-top:2px; }
.mm-viv-notes { font-size:10px; color:#888; margin-top:3px; font-style:italic; line-height:1.4; }
.mm-viv-loading { padding:12px; font-size:12px; color:#555; text-align:center; display:flex; align-items:center; justify-content:center; gap:6px; }

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

/* Détail */
.mm-detail-hero  { text-align:center; margin-bottom:18px; }
.mm-detail-name  { font-family:'Playfair Display',serif; font-size:20px; color:#EDE0CC; margin-bottom:4px; }
.mm-detail-sub   { font-size:12px; color:#666; }
.mm-vivino-link  { display:inline-block; margin-top:8px; color:#C0392B; font-size:11px; text-decoration:none; border:1px solid rgba(192,57,43,0.3); padding:3px 10px; border-radius:20px; }
.mm-detail-grid  { display:grid; grid-template-columns:1fr 1fr; gap:7px; margin-bottom:10px; }
.mm-drow         { background:#181818; border-radius:8px; padding:9px 11px; border:1px solid #222; }
.mm-drow-label   { display:block; font-size:9px; text-transform:uppercase; letter-spacing:1px; color:#555; margin-bottom:2px; }
.mm-drow-value   { font-size:13px; color:#EDE0CC; font-weight:500; }
.mm-notes        { font-size:12px; color:#888; background:#181818; padding:10px 12px; border-radius:8px; border-left:2px solid #C0392B; line-height:1.55; margin-bottom:6px; }
.mm-tasting      { border-left-color:#C0392B; font-style:italic; }
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

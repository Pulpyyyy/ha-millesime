/**
 * Millésime Card — Carte Lovelace pour Home Assistant
 * Visualisation animée de votre cave à vin
 * https://github.com/yourusername/ha-millesime
 */

class MillesimeCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = {};
    this._data = null;
    this._selectedBottle = null;
    this._showAddBottle = false;
    this._showAddFloor = false;
    this._editingBottle = null;
    this._filterType = "all";
    this._unsubscribe = [];
  }

  setConfig(config) {
    this._config = config || {};
    this._render();
  }

  set hass(hass) {
    const wasNull = !this._hass;
    this._hass = hass;
    if (wasNull) {
      this._subscribeEvents();
      this._loadData();
    }
  }

  _subscribeEvents() {
    if (!this._hass) return;
    this._hass.connection.subscribeEvents((event) => {
      this._loadData();
    }, "millesime_updated").then(unsub => this._unsubscribe.push(unsub));
    this._hass.connection.subscribeEvents((event) => {
      this._loadData();
    }, "millesime_data").then(unsub => this._unsubscribe.push(unsub));
  }

  async _loadData() {
    if (!this._hass) return;
    try {
      const stored = await this._hass.callWS({ type: "storage/load", key: "millesime_data" }).catch(() => null);
      if (stored) {
        this._data = stored;
      } else {
        await this._hass.callService("millesime", "get_cellar_data", {});
        this._data = this._data || { cellar: { name: "Millésime", floors: [] }, bottles: [] };
      }
    } catch (e) {
      this._data = this._data || { cellar: { name: "Millésime", floors: [] }, bottles: [] };
    }
    this._render();
  }

  async _callService(service, data) {
    if (!this._hass) return;
    await this._hass.callService("millesime", service, data);
    setTimeout(() => this._loadData(), 500);
  }

  getCardSize() { return 8; }

  _getWineColor(type) {
    const colors = {
      red:      { main: "#8B1A1A", light: "#C0392B", glow: "rgba(139,26,26,0.6)",   label: "Rouge" },
      white:    { main: "#D4A843", light: "#F5D76E", glow: "rgba(212,168,67,0.6)",  label: "Blanc" },
      rose:     { main: "#E8759A", light: "#F1948A", glow: "rgba(232,117,154,0.6)", label: "Rosé" },
      sparkling:{ main: "#A8D5BA", light: "#ABEBC6", glow: "rgba(168,213,186,0.6)", label: "Effervescent" },
      dessert:  { main: "#C9A84C", light: "#F0C040", glow: "rgba(201,168,76,0.6)",  label: "Liquoreux" },
    };
    return colors[type] || colors.red;
  }

  _render() {
    const shadow = this.shadowRoot;
    const data = this._data || { cellar: { name: "Millésime", floors: [] }, bottles: [] };
    const floors = data.cellar?.floors || [];
    const bottles = data.bottles || [];
    const selectedBottle = this._selectedBottle ? bottles.find(b => b.id === this._selectedBottle) : null;

    shadow.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Raleway:wght@300;400;500;600&display=swap');

        :host {
          display: block;
          font-family: 'Raleway', sans-serif;
          --m-deep:    #1a0a0a;
          --m-dark:    #2d1010;
          --m-mid:     #4a1c1c;
          --m-accent:  #8B1A1A;
          --m-gold:    #C9A84C;
          --m-gold-l:  #F5D76E;
          --m-cream:   #F5EDD6;
          --m-stone:   #8B7355;
          --w-dark:    #3D2B1F;
          --w-mid:     #5C3D2E;
          --w-light:   #7B5041;
          --tx-main:   #F5EDD6;
          --tx-muted:  #A0856A;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .card {
          background: var(--m-deep);
          border-radius: 16px;
          overflow: hidden;
          position: relative;
          min-height: 500px;
        }

        .card::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse at 20% 20%, rgba(74,28,28,0.3) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(26,10,10,0.5) 0%, transparent 50%);
          pointer-events: none;
          z-index: 0;
        }

        .content { position: relative; z-index: 1; }

        /* ── HEADER ── */
        .header {
          background: linear-gradient(135deg, var(--w-dark) 0%, var(--w-mid) 50%, var(--w-dark) 100%);
          padding: 20px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2px solid var(--m-gold);
          position: relative;
          overflow: hidden;
        }
        .header::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, var(--m-gold-l), transparent);
        }
        .header-title { display: flex; align-items: center; gap: 12px; }
        .header-icon {
          font-size: 32px;
          filter: drop-shadow(0 0 8px var(--m-gold));
          animation: float 3s ease-in-out infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-4px); }
        }
        .header h1 {
          font-family: 'Playfair Display', serif;
          font-size: 22px;
          color: var(--m-cream);
          letter-spacing: 1px;
          text-shadow: 0 2px 8px rgba(0,0,0,0.5);
        }
        .header-subtitle {
          font-size: 11px;
          color: var(--m-gold);
          letter-spacing: 3px;
          text-transform: uppercase;
          font-style: italic;
        }
        .header-stats { display: flex; gap: 16px; }
        .stat {
          text-align: center;
          padding: 8px 14px;
          background: rgba(0,0,0,0.3);
          border-radius: 8px;
          border: 1px solid rgba(201,168,76,0.2);
        }
        .stat-value {
          font-size: 20px; font-weight: 700;
          color: var(--m-gold);
          font-family: 'Playfair Display', serif;
        }
        .stat-label { font-size: 9px; color: var(--tx-muted); text-transform: uppercase; letter-spacing: 1px; }

        /* ── TOOLBAR ── */
        .toolbar {
          display: flex; align-items: center; gap: 8px;
          padding: 12px 24px;
          background: rgba(0,0,0,0.2);
          border-bottom: 1px solid rgba(201,168,76,0.1);
          flex-wrap: wrap;
        }
        .filter-btn {
          padding: 5px 12px; border-radius: 20px;
          border: 1px solid rgba(201,168,76,0.3);
          background: transparent; color: var(--tx-muted);
          font-family: 'Raleway', sans-serif; font-size: 11px;
          cursor: pointer; transition: all 0.2s; letter-spacing: 0.5px;
        }
        .filter-btn.active, .filter-btn:hover {
          background: var(--m-accent); border-color: var(--m-accent); color: var(--m-cream);
        }
        .filter-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 4px; }
        .spacer { flex: 1; }
        .btn {
          padding: 7px 16px; border-radius: 8px; border: none; cursor: pointer;
          font-family: 'Raleway', sans-serif; font-size: 12px; font-weight: 600;
          transition: all 0.2s; display: flex; align-items: center; gap: 6px; letter-spacing: 0.5px;
        }
        .btn-primary { background: var(--m-gold); color: var(--m-deep); }
        .btn-primary:hover { background: var(--m-gold-l); transform: translateY(-1px); }
        .btn-secondary { background: rgba(139,26,26,0.4); color: var(--m-cream); border: 1px solid var(--m-accent); }
        .btn-secondary:hover { background: var(--m-accent); }
        .btn-danger {
          background: rgba(180,50,50,0.3); color: #ff6b6b;
          border: 1px solid rgba(180,50,50,0.4); font-size: 11px; padding: 5px 12px;
        }
        .btn-danger:hover { background: rgba(180,50,50,0.6); }

        /* ── CELLAR ── */
        .cellar-container { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }
        .empty-state { text-align: center; padding: 60px 20px; color: var(--tx-muted); }
        .empty-state .empty-icon { font-size: 64px; margin-bottom: 16px; opacity: 0.5; }
        .empty-state h3 { font-family: 'Playfair Display', serif; color: var(--m-cream); margin-bottom: 8px; }
        .empty-state p { font-size: 13px; }

        /* ── FLOOR ── */
        .floor {
          background: linear-gradient(180deg, rgba(61,43,31,0.8) 0%, rgba(45,16,16,0.6) 100%);
          border-radius: 12px;
          border: 1px solid rgba(92,61,46,0.6);
          overflow: hidden;
          transition: all 0.3s;
          animation: slideIn 0.4s ease-out both;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .floor:hover { border-color: rgba(201,168,76,0.3); box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
        .floor-header {
          display: flex; align-items: center;
          padding: 10px 16px;
          background: linear-gradient(90deg, rgba(92,61,46,0.6), rgba(61,43,31,0.4));
          border-bottom: 1px solid rgba(92,61,46,0.4);
          gap: 10px; cursor: pointer; user-select: none;
        }
        .floor-header:hover { background: linear-gradient(90deg, rgba(92,61,46,0.8), rgba(61,43,31,0.6)); }
        .floor-name { font-family: 'Playfair Display', serif; font-size: 14px; color: var(--m-cream); flex: 1; }
        .floor-meta { font-size: 11px; color: var(--tx-muted); display: flex; gap: 8px; align-items: center; }
        .floor-meta span {
          background: rgba(0,0,0,0.3); padding: 2px 8px;
          border-radius: 10px; border: 1px solid rgba(201,168,76,0.1);
        }
        .layout-badge {
          font-size: 10px; padding: 2px 8px; border-radius: 10px;
          background: rgba(139,26,26,0.4); color: var(--m-gold);
          border: 1px solid rgba(139,26,26,0.6);
          text-transform: uppercase; letter-spacing: 0.5px;
        }
        .floor-delete {
          background: none; border: none; color: rgba(180,50,50,0.5);
          cursor: pointer; font-size: 14px; padding: 2px 6px;
          border-radius: 4px; transition: all 0.2s;
        }
        .floor-delete:hover { color: #ff6b6b; background: rgba(180,50,50,0.2); }

        /* ── BOTTLE GRID ── */
        .bottles-grid { padding: 12px 16px 16px; display: grid; gap: 8px; }

        .slot { position: relative; cursor: pointer; transition: transform 0.2s; }
        .slot:hover { transform: scale(1.05); z-index: 2; }
        .layout-side .slot { aspect-ratio: 1/3; }
        .layout-alt .slot:nth-child(even) { transform: rotate(180deg); }
        .layout-alt .slot:nth-child(even):hover { transform: rotate(180deg) scale(1.05); }
        .slot-empty .bottle-body { opacity: 0.15; }
        .slot-empty:hover .bottle-body { opacity: 0.3; }
        .bottle-svg { width: 100%; height: 100%; }

        @keyframes bottleGlow {
          0%, 100% { filter: drop-shadow(0 0 3px var(--glow-color)); }
          50%       { filter: drop-shadow(0 0 8px var(--glow-color)); }
        }
        .slot-filled .bottle-wrapper { animation: bottleGlow 2.5s ease-in-out infinite; }
        .slot-selected .bottle-wrapper { filter: drop-shadow(0 0 10px gold) brightness(1.3) !important; }

        /* ── DETAIL PANEL ── */
        .detail-panel {
          margin: 0 24px 20px;
          background: linear-gradient(135deg, rgba(45,16,16,0.95) 0%, rgba(26,10,10,0.98) 100%);
          border: 1px solid rgba(201,168,76,0.3);
          border-radius: 12px; overflow: hidden;
          animation: panelIn 0.3s ease-out;
        }
        @keyframes panelIn {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .detail-header {
          background: linear-gradient(90deg, var(--m-accent), rgba(139,26,26,0.4));
          padding: 16px 20px; display: flex; align-items: center; gap: 12px;
        }
        .detail-wine-type-badge {
          padding: 4px 12px; border-radius: 20px;
          font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;
        }
        .detail-title { font-family: 'Playfair Display', serif; font-size: 20px; color: var(--m-cream); }
        .detail-vintage { font-size: 13px; color: var(--m-gold); font-style: italic; }
        .detail-close {
          margin-left: auto; background: none; border: none;
          color: var(--tx-muted); cursor: pointer; font-size: 20px;
          line-height: 1; padding: 4px 8px; border-radius: 4px; transition: all 0.2s;
        }
        .detail-close:hover { color: var(--m-cream); background: rgba(255,255,255,0.1); }
        .detail-body { padding: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .detail-section h4 {
          font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px;
          color: var(--m-gold); margin-bottom: 8px;
          display: flex; align-items: center; gap: 6px;
        }
        .detail-section h4::after {
          content: ''; flex: 1; height: 1px; background: rgba(201,168,76,0.2);
        }
        .info-grid { display: flex; flex-direction: column; gap: 6px; }
        .info-row { display: flex; align-items: center; gap: 8px; font-size: 13px; }
        .info-label { color: var(--tx-muted); font-size: 11px; min-width: 60px; }
        .info-value { color: var(--m-cream); font-weight: 500; }
        .price-tag { font-family: 'Playfair Display', serif; font-size: 22px; color: var(--m-gold); font-weight: 700; }
        .tags-list { display: flex; flex-wrap: wrap; gap: 6px; }
        .tag {
          padding: 3px 10px; border-radius: 12px; font-size: 11px;
          background: rgba(139,26,26,0.3); border: 1px solid rgba(139,26,26,0.5); color: var(--m-cream);
        }
        .tag-aroma { background: rgba(74,28,28,0.5); border-color: rgba(201,168,76,0.2); color: var(--m-gold); }
        .drink-window {
          background: rgba(0,0,0,0.3); border-radius: 8px; padding: 10px 14px;
          border: 1px solid rgba(201,168,76,0.1);
        }
        .drink-window-label { font-size: 10px; color: var(--tx-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
        .drink-window-value { font-size: 15px; color: var(--m-cream); font-family: 'Playfair Display', serif; }
        .rating-stars { display: flex; gap: 3px; font-size: 16px; margin-top: 4px; }
        .notes-text {
          font-size: 13px; color: var(--tx-muted); font-style: italic; line-height: 1.5;
          background: rgba(0,0,0,0.2); padding: 10px 12px; border-radius: 8px;
          border-left: 2px solid var(--m-accent);
        }
        .detail-actions {
          padding: 12px 20px; display: flex; gap: 8px; justify-content: flex-end;
          border-top: 1px solid rgba(201,168,76,0.1); background: rgba(0,0,0,0.2);
        }

        /* ── MODAL ── */
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.8);
          z-index: 1000; display: flex; align-items: center; justify-content: center;
          padding: 20px; animation: fadeIn 0.2s;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .modal {
          background: var(--m-dark); border: 1px solid rgba(201,168,76,0.3);
          border-radius: 16px; width: 100%; max-width: 480px;
          max-height: 85vh; overflow-y: auto;
          animation: modalIn 0.3s ease-out;
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(20px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .modal-header {
          padding: 20px 24px 16px; border-bottom: 1px solid rgba(201,168,76,0.2);
          display: flex; align-items: center; justify-content: space-between;
          position: sticky; top: 0; background: var(--m-dark); z-index: 1;
        }
        .modal-title { font-family: 'Playfair Display', serif; font-size: 18px; color: var(--m-cream); }
        .modal-close {
          background: none; border: none; color: var(--tx-muted);
          cursor: pointer; font-size: 22px; line-height: 1; padding: 0 4px; transition: color 0.2s;
        }
        .modal-close:hover { color: var(--m-cream); }
        .modal-body { padding: 20px 24px; }
        .form-group { margin-bottom: 16px; }
        .form-label {
          display: block; font-size: 11px; text-transform: uppercase;
          letter-spacing: 1px; color: var(--m-gold); margin-bottom: 6px;
        }
        .form-input, .form-select, .form-textarea {
          width: 100%; padding: 9px 12px;
          background: rgba(0,0,0,0.4); border: 1px solid rgba(201,168,76,0.2);
          border-radius: 8px; color: var(--m-cream);
          font-family: 'Raleway', sans-serif; font-size: 13px;
          outline: none; transition: border-color 0.2s;
        }
        .form-input:focus, .form-select:focus, .form-textarea:focus {
          border-color: var(--m-gold); box-shadow: 0 0 0 2px rgba(201,168,76,0.1);
        }
        .form-select option { background: var(--m-dark); }
        .form-textarea { min-height: 80px; resize: vertical; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .modal-footer {
          padding: 16px 24px; border-top: 1px solid rgba(201,168,76,0.2);
          display: flex; gap: 10px; justify-content: flex-end;
        }
        .tags-input {
          display: flex; flex-wrap: wrap; gap: 6px; padding: 8px;
          background: rgba(0,0,0,0.4); border: 1px solid rgba(201,168,76,0.2);
          border-radius: 8px; min-height: 40px; cursor: text;
        }
        .tag-input-item {
          display: flex; align-items: center; gap: 4px;
          padding: 2px 8px; background: rgba(139,26,26,0.5);
          border-radius: 10px; font-size: 12px; color: var(--m-cream);
        }
        .tag-remove {
          background: none; border: none; color: var(--tx-muted);
          cursor: pointer; font-size: 14px; line-height: 1; padding: 0;
        }
        .tag-remove:hover { color: #ff6b6b; }
        .tag-text-input {
          background: none; border: none; outline: none;
          color: var(--m-cream); font-family: 'Raleway', sans-serif;
          font-size: 12px; min-width: 80px; flex: 1;
        }
      </style>

      <div class="card">
        <div class="content">
          ${this._renderHeader(data, bottles)}
          ${this._renderToolbar()}
          ${this._renderCellar(data, bottles)}
          ${selectedBottle ? this._renderDetailPanel(selectedBottle) : ''}
        </div>
      </div>

      ${this._showAddFloor  ? this._renderAddFloorModal()         : ''}
      ${this._showAddBottle ? this._renderAddBottleModal(floors)  : ''}
    `;

    this._attachListeners(data, bottles);
  }

  _renderHeader(data, bottles) {
    const totalBottles = bottles.reduce((s, b) => s + (b.quantity || 1), 0);
    const totalValue   = bottles.reduce((s, b) => s + (b.price || 0) * (b.quantity || 1), 0);
    const floors       = data.cellar?.floors || [];

    return `
      <div class="header">
        <div class="header-title">
          <div class="header-icon">🍷</div>
          <div>
            <h1>${data.cellar?.name || 'Millésime'}</h1>
            <div class="header-subtitle">Cave à Vin</div>
          </div>
        </div>
        <div class="header-stats">
          <div class="stat">
            <div class="stat-value">${totalBottles}</div>
            <div class="stat-label">Bouteilles</div>
          </div>
          <div class="stat">
            <div class="stat-value">${floors.length}</div>
            <div class="stat-label">Étages</div>
          </div>
          <div class="stat">
            <div class="stat-value">${totalValue > 0 ? Math.round(totalValue) + ' €' : '—'}</div>
            <div class="stat-label">Valeur</div>
          </div>
        </div>
      </div>
    `;
  }

  _renderToolbar() {
    const types = [
      { value: 'all',      label: 'Tout',         color: '#C9A84C' },
      { value: 'red',      label: 'Rouge',        color: '#8B1A1A' },
      { value: 'white',    label: 'Blanc',        color: '#D4A843' },
      { value: 'rose',     label: 'Rosé',         color: '#E8759A' },
      { value: 'sparkling',label: 'Effervescent', color: '#A8D5BA' },
      { value: 'dessert',  label: 'Liquoreux',    color: '#C9A84C' },
    ];
    return `
      <div class="toolbar">
        ${types.map(t => `
          <button class="filter-btn ${this._filterType === t.value ? 'active' : ''}" data-filter="${t.value}">
            <span class="filter-dot" style="background:${t.color}"></span>${t.label}
          </button>
        `).join('')}
        <div class="spacer"></div>
        <button class="btn btn-secondary" id="btn-add-floor">+ Étage</button>
        <button class="btn btn-primary" id="btn-add-bottle">🍾 Ajouter</button>
      </div>
    `;
  }

  _renderCellar(data, bottles) {
    const floors = data.cellar?.floors || [];
    if (floors.length === 0) {
      return `
        <div class="cellar-container">
          <div class="empty-state">
            <div class="empty-icon">🏚️</div>
            <h3>Cave vide</h3>
            <p>Ajoutez un premier étage pour commencer à organiser votre cave</p>
          </div>
        </div>
      `;
    }
    return `
      <div class="cellar-container">
        ${floors.map((floor, fi) => this._renderFloor(floor, bottles, fi)).join('')}
      </div>
    `;
  }

  _renderFloor(floor, allBottles, floorIndex) {
    const floorBottles = allBottles.filter(b => b.floor_id === floor.id);
    const total  = floor.slots || 12;
    const cols   = floor.columns || 6;
    const isAlt  = floor.layout === 'alternating';
    const pct    = Math.round((floorBottles.length / total) * 100);
    let slotsHTML = '';
    for (let i = 0; i < total; i++) {
      const bottle = floorBottles.find(b => b.slot === i);
      slotsHTML += this._renderSlot(i, bottle, floor.id);
    }
    return `
      <div class="floor" style="animation-delay:${floorIndex * 0.1}s">
        <div class="floor-header" data-floor-toggle="${floor.id}">
          <span style="font-size:16px">🗄️</span>
          <span class="floor-name">${floor.name}</span>
          <div class="floor-meta">
            <span>${floorBottles.length}/${total} bouteilles</span>
            <span>${pct}% plein</span>
          </div>
          <span class="layout-badge">${isAlt ? 'Tête-bêche' : 'Côte à côte'}</span>
          <button class="floor-delete" data-delete-floor="${floor.id}" title="Supprimer cet étage">✕</button>
        </div>
        <div class="bottles-grid layout-${isAlt ? 'alt' : 'side'}"
          style="grid-template-columns: repeat(${cols}, 1fr)">
          ${slotsHTML}
        </div>
      </div>
    `;
  }

  _renderSlot(index, bottle, floorId) {
    const isEmpty    = !bottle;
    const isSelected = bottle && bottle.id === this._selectedBottle;
    const color      = bottle ? this._getWineColor(bottle.type) : { main: '#3D2B1F', light: '#5C3D2E', glow: 'rgba(61,43,31,0.4)' };
    const isFiltered = this._filterType !== 'all' && bottle && bottle.type !== this._filterType;

    return `
      <div class="slot ${isEmpty ? 'slot-empty' : 'slot-filled'} ${isSelected ? 'slot-selected' : ''}"
        data-slot="${index}" data-floor="${floorId}"
        style="opacity:${isFiltered ? 0.2 : 1}; --glow-color:${color.glow}"
        title="${bottle ? `${bottle.name} ${bottle.vintage || ''}` : `Emplacement ${index + 1} — vide`}">
        <div class="bottle-wrapper">
          <svg class="bottle-svg" viewBox="0 0 30 80" xmlns="http://www.w3.org/2000/svg">
            <rect x="11" y="2" width="8" height="10" rx="2"
              fill="${isEmpty ? '#2a2a2a' : color.main}" opacity="${isEmpty ? 0.3 : 0.9}"/>
            <path d="M11 10 Q10 18 8 22" fill="none" stroke="${isEmpty ? '#333' : color.main}"
              stroke-width="3" opacity="${isEmpty ? 0.3 : 0.9}"/>
            <path d="M19 10 Q20 18 22 22" fill="none" stroke="${isEmpty ? '#333' : color.main}"
              stroke-width="3" opacity="${isEmpty ? 0.3 : 0.9}"/>
            <path d="M8 22 Q6 30 6 45 Q6 60 7 70 Q8 76 15 76 Q22 76 23 70 Q24 60 24 45 Q24 30 22 22 Z"
              fill="${isEmpty ? '#1a1a1a' : color.main}" opacity="${isEmpty ? 0.3 : 0.85}"/>
            ${!isEmpty ? `
              <path d="M10 28 Q9 40 9 52" stroke="${color.light}" stroke-width="1.5"
                stroke-linecap="round" fill="none" opacity="0.4"/>
              <rect x="8" y="38" width="14" height="18" rx="2" fill="rgba(245,237,214,0.15)" opacity="0.8"/>
            ` : `
              <path d="M13 30 L13 68" stroke="#333" stroke-width="1" stroke-dasharray="2,4" opacity="0.4"/>
            `}
            <ellipse cx="15" cy="74" rx="8" ry="2.5"
              fill="${isEmpty ? '#111' : color.main}" opacity="${isEmpty ? 0.3 : 0.7}"/>
          </svg>
        </div>
      </div>
    `;
  }

  _renderDetailPanel(bottle) {
    const color    = this._getWineColor(bottle.type);
    const aromas   = bottle.aromas || [];
    const pairings = bottle.pairings || [];
    const rating   = bottle.rating || 0;
    const stars    = '★'.repeat(Math.round(rating / 20)) + '☆'.repeat(5 - Math.round(rating / 20));

    return `
      <div class="detail-panel">
        <div class="detail-header">
          <span class="detail-wine-type-badge"
            style="background:${color.main}22; color:${color.light}; border:1px solid ${color.main}66">
            ${color.label}
          </span>
          <div>
            <div class="detail-title">${bottle.name}</div>
            <div class="detail-vintage">${bottle.producer ? bottle.producer + ' · ' : ''}${bottle.vintage || 'Millésime inconnu'}</div>
          </div>
          <button class="detail-close" data-close-detail>✕</button>
        </div>
        <div class="detail-body">
          <div class="detail-section">
            <h4>Informations</h4>
            <div class="info-grid">
              ${bottle.appellation ? `<div class="info-row"><span class="info-label">Appellation</span><span class="info-value">${bottle.appellation}</span></div>` : ''}
              <div class="info-row">
                <span class="info-label">Prix</span>
                <span class="price-tag">${bottle.price ? bottle.price + ' €' : '—'}</span>
              </div>
              ${(bottle.quantity || 1) > 1 ? `<div class="info-row"><span class="info-label">Quantité</span><span class="info-value">${bottle.quantity} bouteilles</span></div>` : ''}
              ${rating > 0 ? `<div class="info-row"><span class="info-label">Note</span><div class="rating-stars" style="color:${color.main}">${stars} <span style="color:var(--tx-muted);font-size:11px;margin-left:4px">${rating}/100</span></div></div>` : ''}
            </div>
          </div>
          <div class="detail-section">
            <h4>Fenêtre de dégustation</h4>
            <div class="drink-window">
              <div class="drink-window-label">Idéal entre</div>
              <div class="drink-window-value">${bottle.drink_from || '?'} — ${bottle.drink_until || '?'}</div>
            </div>
          </div>
          ${aromas.length > 0 ? `
            <div class="detail-section">
              <h4>Arômes</h4>
              <div class="tags-list">${aromas.map(a => `<span class="tag tag-aroma">🌸 ${a}</span>`).join('')}</div>
            </div>
          ` : ''}
          ${pairings.length > 0 ? `
            <div class="detail-section">
              <h4>Accords</h4>
              <div class="tags-list">${pairings.map(p => `<span class="tag">🍽️ ${p}</span>`).join('')}</div>
            </div>
          ` : ''}
          ${bottle.notes ? `
            <div class="detail-section" style="grid-column: 1 / -1">
              <h4>Notes de dégustation</h4>
              <div class="notes-text">"${bottle.notes}"</div>
            </div>
          ` : ''}
        </div>
        <div class="detail-actions">
          <button class="btn btn-danger" data-remove-bottle="${bottle.id}">🗑 Retirer</button>
          <button class="btn btn-secondary" data-edit-bottle="${bottle.id}">✏️ Modifier</button>
        </div>
      </div>
    `;
  }

  _renderAddFloorModal() {
    const nextNum = (this._data?.cellar?.floors?.length || 0) + 1;
    return `
      <div class="modal-overlay" id="modal-floor">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title">🗄️ Ajouter un étage</div>
            <button class="modal-close" data-close-modal="floor">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Nom de l'étage</label>
              <input class="form-input" id="fl-name" type="text"
                placeholder="ex: Bordeaux, Étage 1..." value="Étage ${nextNum}">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Colonnes</label>
                <input class="form-input" id="fl-cols" type="number" value="6" min="1" max="20">
              </div>
              <div class="form-group">
                <label class="form-label">Rangées</label>
                <input class="form-input" id="fl-rows" type="number" value="2" min="1" max="10">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Disposition</label>
              <select class="form-select" id="fl-layout">
                <option value="side_by_side">Côte à côte</option>
                <option value="alternating">Tête bêche</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-close-modal="floor">Annuler</button>
            <button class="btn btn-primary" id="submit-floor">Créer l'étage</button>
          </div>
        </div>
      </div>
    `;
  }

  _renderAddBottleModal(floors) {
    const eb      = this._editingBottle;
    const isEdit  = !!eb;
    const aromas  = eb?.aromas || [];
    const pairings= eb?.pairings || [];

    return `
      <div class="modal-overlay" id="modal-bottle">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title">${isEdit ? '✏️ Modifier la bouteille' : '🍾 Ajouter une bouteille'}</div>
            <button class="modal-close" data-close-modal="bottle">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Nom du vin *</label>
              <input class="form-input" id="bt-name" type="text"
                placeholder="ex: Château Margaux" value="${eb?.name || ''}">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Millésime</label>
                <input class="form-input" id="bt-vintage" type="text"
                  placeholder="2019" value="${eb?.vintage || ''}">
              </div>
              <div class="form-group">
                <label class="form-label">Type</label>
                <select class="form-select" id="bt-type">
                  <option value="red"      ${eb?.type==='red'?'selected':''}>🔴 Rouge</option>
                  <option value="white"    ${eb?.type==='white'?'selected':''}>🟡 Blanc</option>
                  <option value="rose"     ${eb?.type==='rose'?'selected':''}>🌸 Rosé</option>
                  <option value="sparkling"${eb?.type==='sparkling'?'selected':''}>✨ Effervescent</option>
                  <option value="dessert"  ${eb?.type==='dessert'?'selected':''}>🍯 Liquoreux</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Appellation</label>
                <input class="form-input" id="bt-appellation" type="text"
                  placeholder="Pomerol, Chablis..." value="${eb?.appellation || ''}">
              </div>
              <div class="form-group">
                <label class="form-label">Producteur</label>
                <input class="form-input" id="bt-producer" type="text"
                  placeholder="Domaine..." value="${eb?.producer || ''}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Prix (€)</label>
                <input class="form-input" id="bt-price" type="number" step="0.5" min="0" value="${eb?.price || ''}">
              </div>
              <div class="form-group">
                <label class="form-label">Quantité</label>
                <input class="form-input" id="bt-quantity" type="number" min="1" value="${eb?.quantity || 1}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">À boire à partir de</label>
                <input class="form-input" id="bt-from" type="text" placeholder="2024" value="${eb?.drink_from || ''}">
              </div>
              <div class="form-group">
                <label class="form-label">À boire avant</label>
                <input class="form-input" id="bt-until" type="text" placeholder="2035" value="${eb?.drink_until || ''}">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Arômes (Entrée pour ajouter)</label>
              <div class="tags-input" id="aromas-container">
                ${aromas.map(a => `
                  <span class="tag-input-item" data-tag="${a}">
                    ${a} <button class="tag-remove">×</button>
                  </span>`).join('')}
                <input class="tag-text-input" id="aroma-input" placeholder="Fruits rouges, Vanille...">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Accords mets-vins (Entrée pour ajouter)</label>
              <div class="tags-input" id="pairings-container">
                ${pairings.map(p => `
                  <span class="tag-input-item" data-tag="${p}">
                    ${p} <button class="tag-remove">×</button>
                  </span>`).join('')}
                <input class="tag-text-input" id="pairing-input" placeholder="Viande rouge, Fromage...">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Note (0-100)</label>
              <input class="form-input" id="bt-rating" type="number" min="0" max="100" value="${eb?.rating || ''}">
            </div>
            ${!isEdit ? `
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Étage *</label>
                  <select class="form-select" id="bt-floor">
                    ${floors.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Emplacement</label>
                  <input class="form-input" id="bt-slot" type="number" min="0" value="0">
                </div>
              </div>
            ` : ''}
            <div class="form-group">
              <label class="form-label">Notes de dégustation</label>
              <textarea class="form-textarea" id="bt-notes"
                placeholder="Vos impressions personnelles...">${eb?.notes || ''}</textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-close-modal="bottle">Annuler</button>
            <button class="btn btn-primary" id="submit-bottle">
              ${isEdit ? 'Enregistrer' : 'Ajouter à la cave'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _attachListeners(data, bottles) {
    const s = this.shadowRoot;

    // Filters
    s.querySelectorAll('[data-filter]').forEach(btn =>
      btn.addEventListener('click', () => { this._filterType = btn.dataset.filter; this._render(); })
    );

    // Toolbar buttons
    s.getElementById('btn-add-floor')?.addEventListener('click', () => { this._showAddFloor = true; this._render(); });
    s.getElementById('btn-add-bottle')?.addEventListener('click', () => {
      this._editingBottle = null; this._showAddBottle = true; this._render();
    });

    // Close modals
    s.querySelectorAll('[data-close-modal]').forEach(btn =>
      btn.addEventListener('click', () => {
        this._showAddFloor = this._showAddBottle = false;
        this._editingBottle = null; this._render();
      })
    );
    ['modal-floor', 'modal-bottle'].forEach(id => {
      s.getElementById(id)?.addEventListener('click', e => {
        if (e.target.id === id) {
          this._showAddFloor = this._showAddBottle = false;
          this._editingBottle = null; this._render();
        }
      });
    });

    // Tag inputs
    const setupTagInput = (inputId, containerId) => {
      const input = s.getElementById(inputId);
      if (!input) return;
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && input.value.trim()) {
          e.preventDefault();
          const tag = input.value.trim();
          const container = s.getElementById(containerId);
          const span = document.createElement('span');
          span.className = 'tag-input-item';
          span.dataset.tag = tag;
          span.innerHTML = `${tag} <button class="tag-remove">×</button>`;
          span.querySelector('.tag-remove').addEventListener('click', () => span.remove());
          container.insertBefore(span, input);
          input.value = '';
        }
      });
    };
    setupTagInput('aroma-input', 'aromas-container');
    setupTagInput('pairing-input', 'pairings-container');
    s.querySelectorAll('.tag-remove').forEach(btn => btn.addEventListener('click', () => btn.parentElement.remove()));

    // Submit floor
    s.getElementById('submit-floor')?.addEventListener('click', async () => {
      const cols = parseInt(s.getElementById('fl-cols')?.value || 6);
      const rows = parseInt(s.getElementById('fl-rows')?.value || 2);
      await this._callService('add_floor', {
        name:    s.getElementById('fl-name')?.value?.trim() || 'Nouvel étage',
        columns: cols, rows,
        slots:   cols * rows,
        layout:  s.getElementById('fl-layout')?.value || 'side_by_side',
      });
      this._showAddFloor = false; this._render();
    });

    // Submit bottle
    s.getElementById('submit-bottle')?.addEventListener('click', async () => {
      const aromas   = Array.from(s.querySelectorAll('#aromas-container [data-tag]')).map(e => e.dataset.tag);
      const pairings = Array.from(s.querySelectorAll('#pairings-container [data-tag]')).map(e => e.dataset.tag);
      const bd = {
        name:        s.getElementById('bt-name')?.value?.trim() || '',
        vintage:     s.getElementById('bt-vintage')?.value?.trim() || '',
        type:        s.getElementById('bt-type')?.value || 'red',
        appellation: s.getElementById('bt-appellation')?.value?.trim() || '',
        producer:    s.getElementById('bt-producer')?.value?.trim() || '',
        price:       parseFloat(s.getElementById('bt-price')?.value || 0),
        quantity:    parseInt(s.getElementById('bt-quantity')?.value || 1),
        drink_from:  s.getElementById('bt-from')?.value?.trim() || '',
        drink_until: s.getElementById('bt-until')?.value?.trim() || '',
        aromas, pairings,
        rating:      parseInt(s.getElementById('bt-rating')?.value || 0),
        notes:       s.getElementById('bt-notes')?.value?.trim() || '',
        added_date:  new Date().toISOString().split('T')[0],
      };
      if (!bd.name) return;
      if (this._editingBottle) {
        await this._callService('update_bottle', { bottle_id: this._editingBottle.id, ...bd });
      } else {
        bd.floor_id = s.getElementById('bt-floor')?.value || '';
        bd.slot     = parseInt(s.getElementById('bt-slot')?.value || 0);
        await this._callService('add_bottle', bd);
      }
      this._showAddBottle = false; this._editingBottle = null; this._render();
    });

    // Slot click
    s.querySelectorAll('.slot').forEach(slot => {
      slot.addEventListener('click', () => {
        const idx     = parseInt(slot.dataset.slot);
        const floorId = slot.dataset.floor;
        const bottle  = bottles.find(b => b.floor_id === floorId && b.slot === idx);
        if (bottle) {
          this._selectedBottle = this._selectedBottle === bottle.id ? null : bottle.id;
          this._render();
        } else {
          this._editingBottle = null; this._showAddBottle = true; this._render();
          setTimeout(() => {
            const fs = s.getElementById('bt-floor');
            const si = s.getElementById('bt-slot');
            if (fs) fs.value = floorId;
            if (si) si.value = idx;
          }, 50);
        }
      });
    });

    // Close detail
    s.querySelector('[data-close-detail]')?.addEventListener('click', () => {
      this._selectedBottle = null; this._render();
    });

    // Remove bottle
    s.querySelectorAll('[data-remove-bottle]').forEach(btn =>
      btn.addEventListener('click', async () => {
        if (confirm('Retirer cette bouteille de la cave ?')) {
          await this._callService('remove_bottle', { bottle_id: btn.dataset.removeBottle });
          this._selectedBottle = null; this._render();
        }
      })
    );

    // Edit bottle
    s.querySelectorAll('[data-edit-bottle]').forEach(btn =>
      btn.addEventListener('click', () => {
        const bottle = bottles.find(b => b.id === btn.dataset.editBottle);
        if (bottle) {
          this._editingBottle = bottle; this._showAddBottle = true;
          this._selectedBottle = null; this._render();
        }
      })
    );

    // Delete floor
    s.querySelectorAll('[data-delete-floor]').forEach(btn =>
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const floorId      = btn.dataset.deleteFloor;
        const floor        = data.cellar?.floors?.find(f => f.id === floorId);
        const floorBottles = bottles.filter(b => b.floor_id === floorId);
        const msg = floorBottles.length > 0
          ? `Supprimer l'étage "${floor?.name}" et ses ${floorBottles.length} bouteille(s) ?`
          : `Supprimer l'étage "${floor?.name}" ?`;
        if (confirm(msg)) await this._callService('remove_floor', { floor_id: floorId });
      })
    );
  }

  disconnectedCallback() {
    this._unsubscribe.forEach(fn => fn());
    this._unsubscribe = [];
  }
}

customElements.define("millesime-card", MillesimeCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "millesime-card",
  name: "Millésime — Cave à Vin",
  description: "Visualisation animée et gestion complète de votre cave à vin",
  preview: true,
  documentationURL: "https://github.com/yourusername/ha-millesime",
});

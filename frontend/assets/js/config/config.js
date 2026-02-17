/**
 * ═══════════════════════════════════════════════════════
 *  Config Module - Configuración del Sistema
 * ═══════════════════════════════════════════════════════
 */

const Config = {
    config: {},
    tables: [],
    zones: [],
    container: null,
    selectedZone: null,
    selectedTool: null,

    GRID_COLS: 12,
    GRID_ROWS: 8,

    ZONE_PRESETS: {
        dining:   { icon: '🍽️', label: 'Salón',    color: '#10b981' },
        kitchen:  { icon: '👨‍🍳', label: 'Cocina',   color: '#f97316' },
        private:  { icon: '🔒', label: 'Privado',  color: '#8b5cf6' },
        outdoor:  { icon: '☀️', label: 'Exterior', color: '#06b6d4' },
        bar:      { icon: '🍺', label: 'Barra',    color: '#ec4899' },
        entrance: { icon: '🚪', label: 'Entrada',  color: '#eab308' },
        bathroom: { icon: '🚻', label: 'Baño',     color: '#6b7280' },
        storage:  { icon: '📦', label: 'Bodega',   color: '#78716c' },
        plants:   { icon: '🌿', label: 'Plantas',  color: '#22c55e' },
        wall:     { icon: '🧱', label: 'Muro',     color: '#525252' },
    },

    async init(container) {
        this.container = container;
        this.selectedZone = null;
        this.selectedTool = null;
        await Promise.all([this.loadConfig(), this.loadTables(), this.loadZones()]);
        this.render(container);
    },

    async loadConfig() {
        try {
            const res = await API.get('/config');
            this.config = res.data?.grouped || {};
        } catch (err) {
            Toast.error('Error cargando configuración');
        }
    },

    async loadTables() {
        try {
            const res = await API.get('/tables');
            this.tables = res.data || [];
        } catch (err) {
            console.error('Error cargando mesas:', err);
        }
    },

    async loadZones() {
        try {
            const res = await API.get('/zones');
            this.zones = res.data || [];
        } catch (err) {
            console.error('Error cargando zonas:', err);
            this.zones = [];
        }
    },

    render(container) {
        const g = this.config.general || {};
        const pos = this.config.pos || {};
        const p = this.config.printing || {};
        const k = this.config.kitchen || {};
        const s = this.config.sri || {};

        container.innerHTML = `
      <div class="page-content">
        <div class="page-header">
          <div>
            <h2 class="page-title">⚙️ Configuración</h2>
            <p class="page-description">Ajustes generales del sistema</p>
          </div>
          <button class="btn btn-primary" onclick="Config.saveAll()">💾 Guardar Cambios</button>
        </div>

        <!-- General -->
        <div class="card mb-lg">
          <div class="card-header"><h3 class="card-title">🏪 General</h3></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
            <div class="form-group">
              <label class="form-label">Nombre del Restaurante</label>
              <input type="text" class="form-input config-input" data-key="restaurant_name" value="${g.restaurant_name || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">RUC</label>
              <input type="text" class="form-input config-input" data-key="restaurant_ruc" value="${g.restaurant_ruc || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Dirección</label>
              <input type="text" class="form-input config-input" data-key="restaurant_address" value="${g.restaurant_address || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Teléfono</label>
              <input type="text" class="form-input config-input" data-key="restaurant_phone" value="${g.restaurant_phone || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">IVA por defecto (%)</label>
              <select class="form-select config-input" data-key="default_tax_rate">
                <option value="0" ${g.default_tax_rate === '0' ? 'selected' : ''}>0%</option>
                <option value="12" ${g.default_tax_rate === '12' ? 'selected' : ''}>12%</option>
                <option value="15" ${g.default_tax_rate === '15' ? 'selected' : ''}>15%</option>
              </select>
            </div>
          </div>
        </div>

        <!-- POS Mode -->
        <div class="card mb-lg">
          <div class="card-header"><h3 class="card-title">🍽️ Modo del POS</h3></div>
          <div class="form-group" style="padding:0 var(--space-lg) var(--space-md)">
            <label class="form-label">Modo POS</label>
            <select class="form-select config-input" data-key="pos_mode">
              <option value="fast_food" ${pos.pos_mode === 'fast_food' ? 'selected' : ''}>🍔 Fast Food (Venta inmediata)</option>
              <option value="full_service" ${pos.pos_mode === 'full_service' ? 'selected' : ''}>🍽️ Full Service (Solo mesas)</option>
              <option value="hybrid" ${pos.pos_mode === 'hybrid' || !pos.pos_mode ? 'selected' : ''}>🌟 Híbrido (Mesas + Para Llevar)</option>
            </select>
          </div>
        </div>

        <!-- Período / Jornada de Caja -->
        <div class="card mb-lg">
          <div class="card-header"><h3 class="card-title">🕐 Período de Ventas (Jornada)</h3></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
            <div class="form-group">
              <label class="form-label">Hora de Inicio</label>
              <select class="form-select config-input" data-key="period_start_hour">
                ${Array.from({length:24}, (_,i) => {
                  const val = i.toString().padStart(2,'0');
                  const sel = (pos.period_start_hour || '06') === val ? 'selected' : '';
                  return '<option value="' + val + '" ' + sel + '>' + val + ':00</option>';
                }).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Hora de Cierre</label>
              <select class="form-select config-input" data-key="period_end_hour">
                ${Array.from({length:24}, (_,i) => {
                  const val = i.toString().padStart(2,'0');
                  const sel = (pos.period_end_hour || '22') === val ? 'selected' : '';
                  return '<option value="' + val + '" ' + sel + '>' + val + ':00</option>';
                }).join('')}
              </select>
            </div>
          </div>
          <p style="margin:0;padding:0 var(--space-lg) var(--space-md);font-size:0.78rem;color:var(--text-muted)">
            📌 El POS pedirá abrir caja al inicio del período y cerrar caja al final. Cada período separa las ventas del día.
          </p>
        </div>

        <!-- ═══ MAP EDITOR ═══ -->
        <div class="card mb-lg" id="map-editor-card">
          <div class="card-header" style="flex-direction:column;align-items:flex-start;gap:4px">
            <h3 class="card-title">📐 Plano del Restaurante</h3>
            <p style="margin:0;font-size:0.8rem;color:var(--text-muted)">Selecciona una herramienta y haz clic en el mapa para agregar zonas. Clic en zona existente para editar.</p>
          </div>
          ${this.renderMapEditor()}
        </div>

        <!-- Impresión -->
        <div class="card mb-lg">
          <div class="card-header"><h3 class="card-title">🖨️ Impresión</h3></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
            <div class="form-group">
              <label class="form-label">Impresión Habilitada</label>
              <select class="form-select config-input" data-key="print_enabled">
                <option value="false" ${p.print_enabled === 'false' ? 'selected' : ''}>❌ Deshabilitada</option>
                <option value="true" ${p.print_enabled === 'true' ? 'selected' : ''}>✅ Habilitada</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">URL Servicio de Impresión</label>
              <input type="text" class="form-input config-input" data-key="print_service_url" value="${p.print_service_url || 'http://localhost:3001'}">
            </div>
            <div class="form-group">
              <label class="form-label">Imprimir Ticket Cocina</label>
              <select class="form-select config-input" data-key="print_kitchen_ticket">
                <option value="true" ${p.print_kitchen_ticket === 'true' ? 'selected' : ''}>✅ Sí</option>
                <option value="false" ${p.print_kitchen_ticket === 'false' ? 'selected' : ''}>❌ No</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Imprimir Recibo</label>
              <select class="form-select config-input" data-key="print_receipt">
                <option value="true" ${p.print_receipt === 'true' ? 'selected' : ''}>✅ Sí</option>
                <option value="false" ${p.print_receipt === 'false' ? 'selected' : ''}>❌ No</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Comandera -->
        <div class="card mb-lg">
          <div class="card-header"><h3 class="card-title">👨‍🍳 Comandera Digital</h3></div>
          <div class="form-group">
            <label class="form-label">Comandera Digital Habilitada</label>
            <select class="form-select config-input" data-key="kitchen_display_enabled">
              <option value="true" ${k.kitchen_display_enabled === 'true' ? 'selected' : ''}>✅ Habilitada</option>
              <option value="false" ${k.kitchen_display_enabled === 'false' ? 'selected' : ''}>❌ Deshabilitada</option>
            </select>
          </div>
        </div>

        <!-- SRI -->
        <div class="card mb-lg">
          <div class="card-header"><h3 class="card-title">🏛️ SRI Ecuador</h3></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
            <div class="form-group">
              <label class="form-label">Modo SRI</label>
              <select class="form-select config-input" data-key="sri_mode">
                <option value="offline" ${s.sri_mode === 'offline' ? 'selected' : ''}>📴 Offline (Notas de Venta)</option>
                <option value="online" ${s.sri_mode === 'online' ? 'selected' : ''}>📡 Online (Facturación Electrónica)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Ambiente SRI</label>
              <select class="form-select config-input" data-key="sri_environment">
                <option value="test" ${s.sri_environment === 'test' ? 'selected' : ''}>🧪 Pruebas</option>
                <option value="production" ${s.sri_environment === 'production' ? 'selected' : ''}>🏭 Producción</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">RUC SRI</label>
              <input type="text" class="form-input config-input" data-key="sri_ruc" value="${s.sri_ruc || ''}">
            </div>
          </div>
        </div>
      </div>
    `;
    },

    async saveAll() {
        const inputs = document.querySelectorAll('.config-input');
        const configs = [];

        inputs.forEach((input) => {
            configs.push({
                key: input.dataset.key,
                value: input.value,
            });
        });

        try {
            await API.put('/config', { configs });
            Toast.success('Configuración guardada exitosamente');
        } catch (err) {
            Toast.error(err.message);
        }
    },

    // ═══════════════════════════════════════════════════
    //  MAP EDITOR - Renderizado
    // ═══════════════════════════════════════════════════

    renderMapEditor() {
        const cells = [];
        for (let r = 0; r < this.GRID_ROWS; r++) {
            for (let c = 0; c < this.GRID_COLS; c++) {
                cells.push(`<div class="me-cell" data-col="${c}" data-row="${r}" onclick="Config.handleCellClick(${c},${r})"></div>`);
            }
        }

        return `
          <!-- Palette -->
          <div class="me-palette" id="me-palette">
            <button class="me-tool ${!this.selectedTool ? 'active' : ''}" data-tool="" onclick="Config.selectTool(null)" title="Seleccionar">
              <span>👆</span><span>Seleccionar</span>
            </button>
            ${Object.entries(this.ZONE_PRESETS).map(([type, p]) => `
              <button class="me-tool ${this.selectedTool === type ? 'active' : ''}"
                      data-tool="${type}" onclick="Config.selectTool('${type}')"
                      style="--tool-color:${p.color}" title="${p.label}">
                <span>${p.icon}</span><span>${p.label}</span>
              </button>
            `).join('')}
          </div>

          <!-- Grid Canvas -->
          <div class="me-canvas-wrap">
            <div class="me-canvas" id="me-canvas"
                 style="grid-template-columns:repeat(${this.GRID_COLS},1fr);grid-template-rows:repeat(${this.GRID_ROWS},1fr);">
              ${cells.join('')}
              ${this.zones.map(z => this.renderZoneOnGrid(z)).join('')}
            </div>
          </div>

          <!-- Properties Panel -->
          <div class="me-props" id="me-props">
            ${this.selectedZone ? this.renderZoneProps() : '<div class="me-props-empty">👆 Selecciona una zona del mapa para editar, o elige una herramienta para crear</div>'}
          </div>
        `;
    },

    renderZoneOnGrid(z) {
        const isSelected = this.selectedZone?.id === z.id;
        const tablesInZone = this.tables.filter(t => t.zone_id === z.id || (!t.zone_id && t.zone === z.name));
        const isDecor = z.zone_type === 'wall' || z.zone_type === 'entrance';

        return `
          <div class="me-zone ${isSelected ? 'selected' : ''} me-type-${z.zone_type}"
               style="grid-column:${z.grid_col + 1}/span ${z.grid_w};grid-row:${z.grid_row + 1}/span ${z.grid_h};--zone-color:${z.color};"
               onclick="event.stopPropagation();Config.selectZone(${z.id})" title="${z.name}">
            <div class="me-zone-header">
              <span class="me-zone-icon">${z.icon}</span>
              <span class="me-zone-name">${z.name}</span>
            </div>
            ${!isDecor && tablesInZone.length > 0 ? `
            <div class="me-zone-tables">
              ${tablesInZone.map(t => `
                <span class="me-zone-table" title="${t.name} · ${t.capacity} pers.">
                  ${t.shape === 'round' ? '⬤' : '⬜'} ${t.name}
                </span>
              `).join('')}
            </div>
            ` : ''}
          </div>`;
    },

    renderZoneProps() {
        const z = this.selectedZone;
        if (!z) return '';
        const tablesInZone = this.tables.filter(t => t.zone_id === z.id || (!t.zone_id && t.zone === z.name));

        return `
          <div class="me-props-card">
            <div class="me-props-header">
              <span>${z.icon} ${z.name}</span>
              <button class="btn btn-sm btn-danger" onclick="Config.deleteZone(${z.id})">🗑️ Eliminar zona</button>
            </div>
            <div class="me-props-grid">
              <div class="form-group">
                <label class="form-label">Nombre</label>
                <input type="text" class="form-input" value="${z.name}" onchange="Config.updateZoneProp(${z.id},'name',this.value)">
              </div>
              <div class="form-group">
                <label class="form-label">Tipo</label>
                <select class="form-select" onchange="Config.updateZoneProp(${z.id},'zoneType',this.value)">
                  ${Object.entries(this.ZONE_PRESETS).map(([type, p]) =>
                    `<option value="${type}" ${z.zone_type === type ? 'selected' : ''}>${p.icon} ${p.label}</option>`
                  ).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Columna (X)</label>
                <input type="number" class="form-input" value="${z.grid_col}" min="0" max="${this.GRID_COLS - 1}"
                       onchange="Config.updateZoneProp(${z.id},'gridCol',parseInt(this.value))">
              </div>
              <div class="form-group">
                <label class="form-label">Fila (Y)</label>
                <input type="number" class="form-input" value="${z.grid_row}" min="0" max="${this.GRID_ROWS - 1}"
                       onchange="Config.updateZoneProp(${z.id},'gridRow',parseInt(this.value))">
              </div>
              <div class="form-group">
                <label class="form-label">Ancho</label>
                <input type="number" class="form-input" value="${z.grid_w}" min="1" max="${this.GRID_COLS}"
                       onchange="Config.updateZoneProp(${z.id},'gridW',parseInt(this.value))">
              </div>
              <div class="form-group">
                <label class="form-label">Alto</label>
                <input type="number" class="form-input" value="${z.grid_h}" min="1" max="${this.GRID_ROWS}"
                       onchange="Config.updateZoneProp(${z.id},'gridH',parseInt(this.value))">
              </div>
            </div>

            <!-- Mesas de esta zona -->
            <div style="margin-top:var(--space-md);border-top:1px solid var(--border-color);padding-top:var(--space-md)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-sm)">
                <strong style="font-size:0.9rem">🪑 Mesas en ${z.name} (${tablesInZone.length})</strong>
                <button class="btn btn-sm btn-primary" onclick="Config.openTableModal(null,${z.id})">➕ Mesa</button>
              </div>
              ${tablesInZone.length > 0 ? tablesInZone.map(t => `
                <div class="me-table-row">
                  <span>${t.shape === 'round' ? '⬤' : t.shape === 'rect' ? '▬' : '⬜'} ${t.name} · 👥${t.capacity}</span>
                  <div style="display:flex;gap:4px">
                    <button class="btn btn-sm btn-secondary" onclick="Config.editTable(${t.id})">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="Config.deleteTable(${t.id})">🗑️</button>
                  </div>
                </div>
              `).join('') : '<div style="font-size:0.85rem;color:var(--text-muted);padding:8px 0">Sin mesas — agrega una con el botón ➕</div>'}
            </div>
          </div>`;
    },

    // ═══════════════════════════════════════════════════
    //  MAP EDITOR - Interacción
    // ═══════════════════════════════════════════════════

    selectTool(type) {
        this.selectedTool = type;
        this.selectedZone = null;
        this.refreshMap();
    },

    selectZone(zoneId) {
        this.selectedTool = null;
        this.selectedZone = this.zones.find(z => z.id === zoneId) || null;
        this.refreshMap();
    },

    async handleCellClick(col, row) {
        // Si clic adentro de una zona existente, seleccionarla
        const zone = this.zones.find(z =>
            col >= z.grid_col && col < z.grid_col + z.grid_w &&
            row >= z.grid_row && row < z.grid_row + z.grid_h
        );
        if (zone) {
            this.selectZone(zone.id);
            return;
        }

        // Si hay herramienta seleccionada, crear zona
        if (!this.selectedTool) return;
        const preset = this.ZONE_PRESETS[this.selectedTool];
        if (!preset) return;

        await this.createZone({
            name: preset.label,
            zoneType: this.selectedTool,
            icon: preset.icon,
            gridCol: col,
            gridRow: row,
            gridW: Math.min(2, this.GRID_COLS - col),
            gridH: Math.min(2, this.GRID_ROWS - row),
            color: preset.color,
        });
    },

    refreshMap() {
        const canvasWrap = document.querySelector('.me-canvas-wrap');
        const propsEl = document.getElementById('me-props');
        const paletteEl = document.getElementById('me-palette');

        if (canvasWrap) {
            const cells = [];
            for (let r = 0; r < this.GRID_ROWS; r++) {
                for (let c = 0; c < this.GRID_COLS; c++) {
                    cells.push(`<div class="me-cell" data-col="${c}" data-row="${r}" onclick="Config.handleCellClick(${c},${r})"></div>`);
                }
            }
            canvasWrap.innerHTML = `
              <div class="me-canvas" id="me-canvas"
                   style="grid-template-columns:repeat(${this.GRID_COLS},1fr);grid-template-rows:repeat(${this.GRID_ROWS},1fr);">
                ${cells.join('')}
                ${this.zones.map(z => this.renderZoneOnGrid(z)).join('')}
              </div>`;
        }

        if (propsEl) {
            propsEl.innerHTML = this.selectedZone
                ? this.renderZoneProps()
                : '<div class="me-props-empty">👆 Selecciona una zona del mapa para editar, o elige una herramienta para crear</div>';
        }

        if (paletteEl) {
            paletteEl.querySelectorAll('.me-tool').forEach(btn => {
                const tool = btn.dataset.tool;
                btn.classList.toggle('active', tool === (this.selectedTool || ''));
            });
        }
    },

    // ═══════════════════════════════════════════════════
    //  ZONE CRUD
    // ═══════════════════════════════════════════════════

    async createZone(data) {
        try {
            const res = await API.post('/zones', data);
            if (res.data) {
                this.zones.push(res.data);
                this.selectedZone = res.data;
                this.selectedTool = null;
                this.refreshMap();
                Toast.success(`Zona "${res.data.name}" creada`);
            }
        } catch (err) {
            Toast.error(err.message || 'Error al crear zona');
        }
    },

    async updateZoneProp(zoneId, prop, value) {
        const zone = this.zones.find(z => z.id === zoneId);
        if (!zone) return;

        // Mapa: JS prop → DB column name
        const dbMap = { gridCol: 'grid_col', gridRow: 'grid_row', gridW: 'grid_w', gridH: 'grid_h', name: 'name', zoneType: 'zone_type' };
        zone[dbMap[prop] || prop] = value;

        // Si cambió tipo, actualizar icono y color
        if (prop === 'zoneType') {
            const preset = this.ZONE_PRESETS[value];
            if (preset) {
                zone.icon = preset.icon;
                zone.color = preset.color;
                zone.zone_type = value;
            }
        }

        this.selectedZone = zone;
        this.refreshMap();

        try {
            await API.put(`/zones/${zoneId}`, {
                name: zone.name,
                zoneType: zone.zone_type,
                icon: zone.icon,
                gridCol: zone.grid_col,
                gridRow: zone.grid_row,
                gridW: zone.grid_w,
                gridH: zone.grid_h,
                color: zone.color,
                displayOrder: zone.display_order ?? 0,
            });
        } catch (err) {
            Toast.error('Error guardando zona');
        }
    },

    async deleteZone(zoneId) {
        if (!confirm('¿Eliminar esta zona? Las mesas dentro deberán reasignarse.')) return;
        try {
            await API.delete(`/zones/${zoneId}`);
            this.zones = this.zones.filter(z => z.id !== zoneId);
            this.selectedZone = null;
            this.refreshMap();
            Toast.success('Zona eliminada');
        } catch (err) {
            Toast.error(err.message || 'Error al eliminar zona');
        }
    },

    // ═══════════════════════════════════════════════════
    //  TABLE MANAGEMENT
    // ═══════════════════════════════════════════════════

    openTableModal(tableId = null, preselectedZoneId = null) {
        const table = tableId ? this.tables.find(t => t.id === tableId) : null;
        const isEdit = !!table;
        const zoneIdVal = table?.zone_id || preselectedZoneId || '';

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
          <div class="modal-content" style="max-width:480px">
            <div class="modal-header">
              <h3 class="modal-title">${isEdit ? '✏️ Editar Mesa' : '➕ Nueva Mesa'}</h3>
              <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            <form onsubmit="Config.saveTable(event, ${tableId || 'null'})" style="padding:var(--space-lg)">
              <div class="form-group">
                <label class="form-label">Nombre</label>
                <input type="text" class="form-input" id="table-name" value="${table?.name || ''}" required placeholder="Ej: Mesa 1">
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
                <div class="form-group">
                  <label class="form-label">Capacidad</label>
                  <input type="number" class="form-input" id="table-capacity" value="${table?.capacity || 4}" min="1" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Forma</label>
                  <select class="form-select" id="table-shape">
                    <option value="square" ${table?.shape === 'square' ? 'selected' : ''}>◼️ Cuadrada</option>
                    <option value="round" ${table?.shape === 'round' ? 'selected' : ''}>⚫ Redonda</option>
                    <option value="rect" ${table?.shape === 'rect' ? 'selected' : ''}>▬ Rectangular</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Zona</label>
                <select class="form-select" id="table-zone-id">
                  <option value="">— Sin zona —</option>
                  ${this.zones.map(z => `<option value="${z.id}" ${Number(zoneIdVal) === z.id ? 'selected' : ''}>${z.icon} ${z.name}</option>`).join('')}
                </select>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                <button type="submit" class="btn btn-primary">${isEdit ? '💾 Guardar' : '➕ Crear'}</button>
              </div>
            </form>
          </div>
        `;
        document.body.appendChild(modal);
    },

    editTable(tableId) {
        this.openTableModal(tableId);
    },

    async saveTable(event, tableId) {
        event.preventDefault();

        const zoneIdEl = document.getElementById('table-zone-id');
        const zoneId = zoneIdEl.value ? parseInt(zoneIdEl.value) : null;
        const zone = zoneId ? this.zones.find(z => z.id === zoneId) : null;

        const data = {
            name: document.getElementById('table-name').value,
            capacity: parseInt(document.getElementById('table-capacity').value),
            shape: document.getElementById('table-shape').value,
            zoneId: zoneId,
            zone: zone?.name || 'Sin zona',
            positionX: 0,
            positionY: 0,
        };

        try {
            if (tableId) {
                await API.put(`/tables/${tableId}`, data);
                Toast.success('Mesa actualizada');
            } else {
                await API.post('/tables', data);
                Toast.success('Mesa creada');
            }
            await this.loadTables();
            document.querySelector('.modal-overlay')?.remove();
            this.refreshMap();
        } catch (err) {
            Toast.error(err.message || 'Error al guardar mesa');
        }
    },

    async deleteTable(tableId) {
        if (!confirm('¿Eliminar esta mesa?')) return;
        try {
            await API.delete(`/tables/${tableId}`);
            Toast.success('Mesa eliminada');
            await this.loadTables();
            this.refreshMap();
        } catch (err) {
            Toast.error(err.message || 'Error al eliminar mesa');
        }
    },
};

window.Config = Config;

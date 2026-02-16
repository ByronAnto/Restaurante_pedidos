/**
 * ═══════════════════════════════════════════════════════
 *  Config Module - Configuración del Sistema
 * ═══════════════════════════════════════════════════════
 */

const Config = {
    config: {},
    tables: [],

    async init(container) {
        await this.loadConfig();
        await this.loadTables();
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

        <!-- POS Mode & Tables -->
        <div class="card mb-lg">
          <div class="card-header">
            <h3 class="card-title">🍽️ Servicio & Mesas</h3>
          </div>
          <div class="form-group">
            <label class="form-label">Modo POS</label>
            <select class="form-select config-input" data-key="pos_mode">
              <option value="fast_food" ${pos.pos_mode === 'fast_food' ? 'selected' : ''}>🍔 Fast Food (Venta inmediata)</option>
              <option value="full_service" ${pos.pos_mode === 'full_service' ? 'selected' : ''}>🍽️ Full Service (Solo mesas)</option>
              <option value="hybrid" ${pos.pos_mode === 'hybrid' || !pos.pos_mode ? 'selected' : ''}>🌟 Híbrido (Mesas + Para Llevar)</option>
            </select>
          </div>
          <div style="margin-top:var(--space-lg)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md)">
              <h4 style="margin:0;font-size:1.1rem">Mesas del Local</h4>
              <button class="btn btn-primary btn-sm" onclick="Config.openTableModal()">➕ Nueva Mesa</button>
            </div>
            <div class="tables-list" id="tables-list">
              ${this.renderTablesList()}
            </div>
          </div>
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

    renderTablesList() {
        if (this.tables.length === 0) {
            return '<div class="empty-state" style="padding:var(--space-lg)"><div class="empty-state-text">No hay mesas configuradas</div></div>';
        }

        const zones = [...new Set(this.tables.map(t => t.zone))];

        return zones.map(zone => `
            <div style="margin-bottom:var(--space-lg)">
                <h5 style="margin-bottom:var(--space-sm);color:var(--color-text-secondary)">${zone}</h5>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--space-sm)">
                    ${this.tables.filter(t => t.zone === zone).map(table => `
                        <div class="table-item" style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-md)">
                            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:var(--space-sm)">
                                <div>
                                    <div style="font-weight:700">${table.name}</div>
                                    <div style="font-size:0.85rem;color:var(--color-text-secondary)">👥 ${table.capacity} personas</div>
                                </div>
                                <div style="display:flex;gap:4px">
                                    <button class="btn btn-sm btn-secondary" onclick="Config.editTable(${table.id})" title="Editar">✏️</button>
                                    <button class="btn btn-sm btn-danger" onclick="Config.deleteTable(${table.id})" title="Eliminar">🗑️</button>
                                </div>
                            </div>
                            <div style="font-size:0.8rem;color:var(--color-text-secondary)">
                                Forma: ${table.shape} · Pos: (${table.position_x}, ${table.position_y})
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    },

    openTableModal(tableId = null) {
        const table = tableId ? this.tables.find(t => t.id === tableId) : null;
        const isEdit = !!table;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:500px">
                <div class="modal-header">
                    <h3 class="modal-title">${isEdit ? '✏️ Editar Mesa' : '➕ Nueva Mesa'}</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
                </div>
                <form onsubmit="Config.saveTable(event, ${tableId || 'null'})" style="padding:var(--space-lg)">
                    <div class="form-group">
                        <label class="form-label">Nombre de la Mesa</label>
                        <input type="text" class="form-input" id="table-name" value="${table?.name || ''}" required placeholder="Ej: Mesa 1">
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
                        <div class="form-group">
                            <label class="form-label">Capacidad</label>
                            <input type="number" class="form-input" id="table-capacity" value="${table?.capacity || 4}" min="1" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Zona</label>
                            <input type="text" class="form-input" id="table-zone" value="${table?.zone || 'Salón'}" required placeholder="Ej: Salón, Terraza">
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
                        <div class="form-group">
                            <label class="form-label">Posición X</label>
                            <input type="number" class="form-input" id="table-pos-x" value="${table?.position_x || 0}" min="0">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Posición Y</label>
                            <input type="number" class="form-input" id="table-pos-y" value="${table?.position_y || 0}" min="0">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Forma</label>
                        <select class="form-select" id="table-shape">
                            <option value="square" ${table?.shape === 'square' ? 'selected' : ''}>◼️ Cuadrada</option>
                            <option value="round" ${table?.shape === 'round' ? 'selected' : ''}>⚫ Redonda</option>
                            <option value="rect" ${table?.shape === 'rect' ? 'selected' : ''}>▬ Rectangular</option>
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
        
        const data = {
            name: document.getElementById('table-name').value,
            capacity: parseInt(document.getElementById('table-capacity').value),
            zone: document.getElementById('table-zone').value,
            positionX: parseInt(document.getElementById('table-pos-x').value),
            positionY: parseInt(document.getElementById('table-pos-y').value),
            shape: document.getElementById('table-shape').value,
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
            document.querySelector('.modal-overlay').remove();
            document.getElementById('tables-list').innerHTML = this.renderTablesList();
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
            document.getElementById('tables-list').innerHTML = this.renderTablesList();
        } catch (err) {
            Toast.error(err.message || 'Error al eliminar mesa');
        }
    },
};

window.Config = Config;

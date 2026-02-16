/**
 * ═══════════════════════════════════════════════════════
 *  Inventory Module - Control de Insumos
 * ═══════════════════════════════════════════════════════
 */

const Inventory = {
  items: [],
  purchases: [],
  analysis: null,

  async init(container) {
    await this.loadData();
    this.render(container);
  },

  async loadData() {
    try {
      const [itemsRes, analysisRes] = await Promise.all([
        API.get('/inventory/items'),
        API.get('/inventory/analysis'),
      ]);
      this.items = itemsRes.data || [];
      this.analysis = analysisRes.data || { items: [], summary: {} };
    } catch (err) {
      Toast.error('Error cargando inventario');
    }
  },

  render(container) {
    const s = this.analysis?.summary || {};
    const lowStockItems = this.items.filter((i) => parseFloat(i.current_stock) <= parseFloat(i.min_stock) && parseFloat(i.min_stock) > 0);

    container.innerHTML = `
      <div class="page-content">
        <div class="page-header">
          <div>
            <h2 class="page-title">🏪 Inventario de Insumos</h2>
            <p class="page-description">Control de ingredientes, costos y stock</p>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-primary" onclick="Inventory.showItemModal()">➕ Nuevo Insumo</button>
            <button class="btn btn-outline" onclick="Inventory.showPurchaseModal()">🛒 Registrar Compra</button>
          </div>
        </div>

        <!-- Stats -->
        <div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
          <div class="stat-card">
            <div class="stat-icon info">📦</div>
            <div>
              <div class="stat-value">${s.total_items || 0}</div>
              <div class="stat-label">Insumos Registrados</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon success">💰</div>
            <div>
              <div class="stat-value">$${parseFloat(s.total_invested || 0).toFixed(2)}</div>
              <div class="stat-label">Total Invertido</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon ${parseInt(s.low_stock_count) > 0 ? 'danger' : 'success'}">⚠️</div>
            <div>
              <div class="stat-value">${s.low_stock_count || 0}</div>
              <div class="stat-label">Stock Bajo</div>
            </div>
          </div>
        </div>

        ${lowStockItems.length > 0 ? `
        <div class="card" style="border-left:3px solid #ef4444;margin-bottom:var(--space-lg)">
          <div class="card-header"><h3 class="card-title" style="color:#ef4444">🔴 Alertas de Stock Bajo</h3></div>
          <div style="padding:var(--space-md);display:flex;gap:8px;flex-wrap:wrap">
            ${lowStockItems.map((i) => `<span class="badge" style="background:rgba(239,68,68,0.15);color:#ef4444;padding:6px 12px;border-radius:6px">${i.name}: ${parseFloat(i.current_stock).toFixed(2)} ${i.unit} (mín: ${parseFloat(i.min_stock).toFixed(2)})</span>`).join('')}
          </div>
        </div>` : ''}

        <!-- Tabla de Insumos -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">📋 Insumos</h3>
            <input type="text" class="form-input" placeholder="🔍 Buscar..." style="max-width:250px" oninput="Inventory.filter(this.value)">
          </div>
          <div class="table-wrapper">
            <table class="data-table" id="inventory-table">
              <thead>
                <tr>
                  <th>Nombre</th><th>Unidad</th><th>Stock</th><th>Stock Mín</th>
                  <th>Costo Unit.</th><th>Valor Stock</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${this.items.map((i) => {
      const stockValue = parseFloat(i.current_stock) * parseFloat(i.last_cost_per_unit);
      const isLow = parseFloat(i.current_stock) <= parseFloat(i.min_stock) && parseFloat(i.min_stock) > 0;
      return `
                  <tr class="inv-row" data-name="${i.name.toLowerCase()}">
                    <td><strong>${i.name}</strong>${i.category ? `<br><span class="text-muted fs-xs">${i.category}</span>` : ''}</td>
                    <td>${i.unit}</td>
                    <td class="${isLow ? 'text-danger fw-bold' : ''}">${parseFloat(i.current_stock).toFixed(2)}</td>
                    <td>${parseFloat(i.min_stock).toFixed(2)}</td>
                    <td>$${parseFloat(i.last_cost_per_unit).toFixed(4)}</td>
                    <td class="fw-bold">$${stockValue.toFixed(2)}</td>
                    <td>
                      <button class="btn btn-sm btn-outline" onclick="Inventory.showItemModal(${i.id})">✏️</button>
                      <button class="btn btn-sm btn-outline" onclick="Inventory.deleteItem(${i.id})" style="color:#ef4444">🗑️</button>
                    </td>
                  </tr>`;
    }).join('')}
                ${this.items.length === 0 ? '<tr><td colspan="7" class="text-center text-muted" style="padding:40px">No hay insumos registrados</td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Análisis MIX -->
        <div class="card" style="margin-top:var(--space-lg)">
          <div class="card-header">
            <h3 class="card-title">📊 Análisis MIX - Inversión por Insumo</h3>
          </div>
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr><th>Insumo</th><th>Total Comprado</th><th>Total Invertido</th><th># Compras</th><th>Visual</th></tr>
              </thead>
              <tbody>
                ${(this.analysis?.items || []).filter((a) => parseFloat(a.total_invested) > 0).map((a) => {
      const maxInv = Math.max(...(this.analysis?.items || []).map((x) => parseFloat(x.total_invested)));
      const pct = maxInv > 0 ? (parseFloat(a.total_invested) / maxInv * 100) : 0;
      return `
                  <tr>
                    <td><strong>${a.name}</strong></td>
                    <td>${parseFloat(a.total_purchased).toFixed(2)} ${a.unit}</td>
                    <td class="fw-bold text-accent">$${parseFloat(a.total_invested).toFixed(2)}</td>
                    <td>${a.purchase_count}</td>
                    <td style="width:120px">
                      <div style="background:var(--bg-primary);border-radius:4px;height:18px;overflow:hidden">
                        <div style="background:linear-gradient(90deg,var(--accent-primary),#d97706);height:100%;width:${pct}%;border-radius:4px"></div>
                      </div>
                    </td>
                  </tr>`;
    }).join('')}
                ${(this.analysis?.items || []).filter((a) => parseFloat(a.total_invested) > 0).length === 0 ? '<tr><td colspan="5" class="text-center text-muted" style="padding:30px">Sin datos de compras aún</td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Modal Insumo -->
      <div class="modal-overlay" id="item-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title" id="item-modal-title">Nuevo Insumo</h3>
            <button class="modal-close" onclick="Inventory.closeModal('item-modal')">✕</button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="item-id">
            <div class="form-group"><label class="form-label">Nombre *</label><input type="text" class="form-input" id="item-name" placeholder="Ej: Tomate"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div class="form-group"><label class="form-label">Unidad</label>
                <select class="form-input" id="item-unit">
                  <option value="kg">Kilogramo (kg)</option><option value="lb">Libra (lb)</option>
                  <option value="litro">Litro</option><option value="unidad">Unidad</option>
                  <option value="gramo">Gramo</option><option value="onza">Onza</option>
                </select>
              </div>
              <div class="form-group"><label class="form-label">Categoría</label>
                <select class="form-input" id="item-category">
                  <option value="ingredientes">Ingredientes</option><option value="carnes">Carnes</option>
                  <option value="verduras">Verduras</option><option value="lácteos">Lácteos</option>
                  <option value="bebidas">Bebidas</option><option value="limpieza">Limpieza</option>
                  <option value="otros">Otros</option>
                </select>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
              <div class="form-group"><label class="form-label">Stock Actual</label><input type="number" class="form-input" id="item-stock" step="0.01" value="0"></div>
              <div class="form-group"><label class="form-label">Stock Mínimo</label><input type="number" class="form-input" id="item-min-stock" step="0.01" value="0"></div>
              <div class="form-group"><label class="form-label">Costo Unitario $</label><input type="number" class="form-input" id="item-cost" step="0.0001" value="0"></div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="Inventory.closeModal('item-modal')">Cancelar</button>
            <button class="btn btn-primary" onclick="Inventory.saveItem()">💾 Guardar</button>
          </div>
        </div>
      </div>

      <!-- Modal Compra -->
      <div class="modal-overlay" id="purchase-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">🛒 Registrar Compra</h3>
            <button class="modal-close" onclick="Inventory.closeModal('purchase-modal')">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group"><label class="form-label">Insumo *</label>
              <select class="form-input" id="purchase-item">
                <option value="">Seleccionar insumo...</option>
                ${this.items.map((i) => `<option value="${i.id}" data-unit="${i.unit}">${i.name} (${i.unit})</option>`).join('')}
              </select>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div class="form-group"><label class="form-label">Cantidad *</label><input type="number" class="form-input" id="purchase-qty" step="0.01" placeholder="Ej: 5"></div>
              <div class="form-group"><label class="form-label">Costo Unitario $ *</label><input type="number" class="form-input" id="purchase-cost" step="0.01" placeholder="Ej: 1.20"></div>
            </div>
            <div class="form-group">
              <label class="form-label">Total: <strong id="purchase-total" style="color:var(--accent-primary)">$0.00</strong></label>
            </div>
            <div class="form-group"><label class="form-label">Proveedor</label><input type="text" class="form-input" id="purchase-supplier" placeholder="Nombre del proveedor"></div>
            <div class="form-group"><label class="form-label">Notas</label><input type="text" class="form-input" id="purchase-notes" placeholder="Notas adicionales"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="Inventory.closeModal('purchase-modal')">Cancelar</button>
            <button class="btn btn-primary" onclick="Inventory.savePurchase()">💾 Registrar</button>
          </div>
        </div>
      </div>
    `;

    // Auto-calcular total de compra
    const qtyEl = document.getElementById('purchase-qty');
    const costEl = document.getElementById('purchase-cost');
    const calcTotal = () => {
      const total = (parseFloat(qtyEl?.value || 0) * parseFloat(costEl?.value || 0)).toFixed(2);
      const el = document.getElementById('purchase-total');
      if (el) el.textContent = `$${total}`;
    };
    qtyEl?.addEventListener('input', calcTotal);
    costEl?.addEventListener('input', calcTotal);
  },

  filter(term) {
    const rows = document.querySelectorAll('.inv-row');
    rows.forEach((r) => {
      r.style.display = r.dataset.name.includes(term.toLowerCase()) ? '' : 'none';
    });
  },

  closeModal(id) {
    document.getElementById(id)?.classList.remove('active');
  },

  showItemModal(id = null) {
    const item = id ? this.items.find((i) => i.id === id) : null;
    document.getElementById('item-modal-title').textContent = item ? 'Editar Insumo' : 'Nuevo Insumo';
    document.getElementById('item-id').value = item?.id || '';
    document.getElementById('item-name').value = item?.name || '';
    document.getElementById('item-unit').value = item?.unit || 'kg';
    document.getElementById('item-category').value = item?.category || 'ingredientes';
    document.getElementById('item-stock').value = item ? parseFloat(item.current_stock) : 0;
    document.getElementById('item-min-stock').value = item ? parseFloat(item.min_stock) : 0;
    document.getElementById('item-cost').value = item ? parseFloat(item.last_cost_per_unit) : 0;
    document.getElementById('item-modal').classList.add('active');
  },

  showPurchaseModal() {
    document.getElementById('purchase-item').value = '';
    document.getElementById('purchase-qty').value = '';
    document.getElementById('purchase-cost').value = '';
    document.getElementById('purchase-supplier').value = '';
    document.getElementById('purchase-notes').value = '';
    document.getElementById('purchase-total').textContent = '$0.00';
    document.getElementById('purchase-modal').classList.add('active');
  },

  async saveItem() {
    const id = document.getElementById('item-id').value;
    const data = {
      name: document.getElementById('item-name').value,
      unit: document.getElementById('item-unit').value,
      category: document.getElementById('item-category').value,
      currentStock: parseFloat(document.getElementById('item-stock').value) || 0,
      minStock: parseFloat(document.getElementById('item-min-stock').value) || 0,
      lastCostPerUnit: parseFloat(document.getElementById('item-cost').value) || 0,
    };

    if (!data.name) return Toast.error('El nombre es requerido');

    try {
      if (id) {
        await API.put(`/inventory/items/${id}`, data);
        Toast.success('Insumo actualizado');
      } else {
        await API.post('/inventory/items', data);
        Toast.success('Insumo creado');
      }
      this.closeModal('item-modal');
      await this.loadData();
      this.render(document.getElementById('page-container'));
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async savePurchase() {
    const data = {
      inventoryItemId: parseInt(document.getElementById('purchase-item').value),
      quantity: parseFloat(document.getElementById('purchase-qty').value),
      costPerUnit: parseFloat(document.getElementById('purchase-cost').value),
      supplier: document.getElementById('purchase-supplier').value,
      notes: document.getElementById('purchase-notes').value,
    };

    if (!data.inventoryItemId) return Toast.error('Selecciona un insumo');
    if (!data.quantity || !data.costPerUnit) return Toast.error('Cantidad y costo son requeridos');

    try {
      await API.post('/inventory/purchases', data);
      Toast.success('Compra registrada');
      this.closeModal('purchase-modal');
      await this.loadData();
      this.render(document.getElementById('page-container'));
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async deleteItem(id) {
    if (!confirm('¿Eliminar este insumo?')) return;
    try {
      await API.delete(`/inventory/items/${id}`);
      Toast.success('Insumo eliminado');
      await this.loadData();
      this.render(document.getElementById('page-container'));
    } catch (err) {
      Toast.error(err.message);
    }
  },
};

window.Inventory = Inventory;

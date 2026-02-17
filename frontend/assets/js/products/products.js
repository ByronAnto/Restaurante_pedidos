/**
 * ═══════════════════════════════════════════════════════
 *  Products Module - Gestión de Productos y Categorías
 * ═══════════════════════════════════════════════════════
 */

const Products = {
  products: [],
  categories: [],

  async init(container) {
    await this.loadData();
    this.render(container);
  },

  async loadData() {
    const [prodRes, catRes] = await Promise.all([
      API.get('/products'),
      API.get('/products/categories'),
    ]);
    this.products = prodRes.data || [];
    this.categories = catRes.data || [];
  },

  render(container) {
    container.innerHTML = `
      <div class="page-content">
        <div class="page-header">
          <div>
            <h2 class="page-title">📦 Productos</h2>
            <p class="page-description">Gestiona tu catálogo de productos y categorías</p>
          </div>
          <div class="d-flex gap-md">
            <button class="btn btn-secondary" onclick="Products.openCategoryModal()">📂 Categorías</button>
            <button class="btn btn-primary" onclick="Products.openProductModal()">➕ Nuevo Producto</button>
          </div>
        </div>

        <!-- Stats -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon success">📦</div>
            <div>
              <div class="stat-value">${this.products.length}</div>
              <div class="stat-label">Total Productos</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon info">✅</div>
            <div>
              <div class="stat-value">${this.products.filter((p) => p.available).length}</div>
              <div class="stat-label">Disponibles</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon warning">📂</div>
            <div>
              <div class="stat-value">${this.categories.length}</div>
              <div class="stat-label">Categorías</div>
            </div>
          </div>
        </div>

        <!-- Tabla -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Lista de Productos</h3>
            <input type="text" class="form-input" style="max-width:250px" placeholder="🔍 Buscar..."
                   oninput="Products.filterTable(this.value)">
          </div>
          <div class="table-wrapper">
            <table class="data-table" id="products-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>PVP</th>
                  <th>Base</th>
                  <th>IVA</th>
                  <th>Costo</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody id="products-tbody">
                ${this.renderRows(this.products)}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Modal Producto -->
        <div class="modal-overlay" id="product-modal">
          <div class="modal-content">
            <div class="modal-header">
              <h3 class="modal-title" id="product-modal-title">Nuevo Producto</h3>
              <button class="modal-close" onclick="Products.closeModal('product-modal')">✕</button>
            </div>
            <form id="product-form" onsubmit="Products.saveProduct(event)">
              <input type="hidden" id="product-id">
              <div class="form-group">
                <label class="form-label">Nombre *</label>
                <input type="text" class="form-input" id="product-name" required>
              </div>
              <div class="form-group">
                <label class="form-label">Categoría</label>
                <select class="form-select" id="product-category">
                  <option value="">Sin categoría</option>
                  ${this.categories.map((c) => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">IVA (%)</label>
                <select class="form-select" id="product-tax" onchange="Products.updateIvaBreakdown()">
                  <option value="0">0% — Sin IVA</option>
                  <option value="12">12%</option>
                  <option value="15" selected>15%</option>
                </select>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
                <div class="form-group">
                  <label class="form-label">💰 PVP (Precio al cliente) *</label>
                  <input type="number" class="form-input" id="product-pvp" step="0.01" min="0" required
                         oninput="Products.updateIvaBreakdown()"
                         style="font-size:1.1rem;font-weight:700">
                </div>
                <div class="form-group">
                  <label class="form-label">Costo</label>
                  <input type="number" class="form-input" id="product-cost" step="0.01" min="0" value="0">
                </div>
              </div>

              <!-- Desglose IVA -->
              <div id="iva-breakdown" style="background:var(--bg-primary);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:12px 16px;margin-bottom:var(--space-md);display:none">
                <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                  <span style="color:var(--text-secondary);font-size:0.85rem">Base (sin IVA)</span>
                  <span style="font-weight:600" id="iva-base">$0.00</span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                  <span style="color:var(--text-secondary);font-size:0.85rem">IVA (<span id="iva-pct">15</span>%)</span>
                  <span style="font-weight:600;color:var(--accent-primary)" id="iva-amount">$0.00</span>
                </div>
                <div style="display:flex;justify-content:space-between;border-top:1px solid var(--border-color);padding-top:6px">
                  <span style="font-weight:700;font-size:0.95rem">PVP Total</span>
                  <span style="font-weight:700;font-size:0.95rem;color:var(--color-success)" id="iva-total">$0.00</span>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Descripción</label>
                <input type="text" class="form-input" id="product-description">
              </div>
              <div class="form-group" style="display:flex;align-items:center;gap:var(--space-sm);padding:8px 12px;background:var(--bg-primary);border-radius:var(--radius-md);border:1px solid var(--border-color)">
                <input type="checkbox" id="product-show-all" style="width:18px;height:18px;accent-color:var(--accent-primary);cursor:pointer">
                <label for="product-show-all" style="cursor:pointer;font-size:0.9rem;color:var(--text-secondary)">🌐 Mostrar en todas las categorías</label>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="Products.closeModal('product-modal')">Cancelar</button>
                <button type="submit" class="btn btn-primary">💾 Guardar</button>
              </div>
            </form>
          </div>
        </div>

        <!-- Modal Categorías -->
        <div class="modal-overlay" id="category-modal">
          <div class="modal-content">
            <div class="modal-header">
              <h3 class="modal-title">📂 Categorías</h3>
              <button class="modal-close" onclick="Products.closeModal('category-modal')">✕</button>
            </div>
            <form onsubmit="Products.saveCategory(event)" style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-md)">
              <input type="text" class="form-input" id="category-name" placeholder="Nombre categoría" required>
              <input type="text" class="form-input" id="category-icon" placeholder="🍕" style="max-width:60px">
              <button type="submit" class="btn btn-primary btn-sm">➕</button>
            </form>
            <div id="categories-list">
              ${this.categories.map((c) => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-color)">
                  <span>${c.icon} ${c.name}</span>
                  <button class="btn btn-sm btn-danger" onclick="Products.deleteCategory(${c.id})">🗑️</button>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  renderRows(products) {
    return products.map((p) => {
      const pvp = parseFloat(p.price);
      const taxRate = parseFloat(p.tax_rate);
      const base = taxRate > 0 ? pvp / (1 + taxRate / 100) : pvp;
      const ivaAmount = pvp - base;
      return `
      <tr data-name="${p.name.toLowerCase()}">
        <td><strong>${p.name}</strong></td>
        <td>${p.category_icon || ''} ${p.category_name || '—'}${p.show_in_all_categories ? ' <span title="Visible en todas las categorías" style="font-size:0.75rem">🌐</span>' : ''}</td>
        <td class="fw-bold text-accent">$${pvp.toFixed(2)}</td>
        <td style="color:var(--text-secondary)">$${base.toFixed(2)}</td>
        <td>${taxRate > 0 ? `<span style="color:var(--accent-primary)">$${ivaAmount.toFixed(2)}</span> (${taxRate}%)` : '<span class="text-muted">0%</span>'}</td>
        <td>$${parseFloat(p.cost).toFixed(2)}</td>
        <td>${p.available ? '<span class="badge badge-success">Disponible</span>' : '<span class="badge badge-danger">No disp.</span>'}</td>
        <td>
          <div class="d-flex gap-sm">
            <button class="btn btn-sm btn-secondary" onclick="Products.editProduct(${p.id})">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="Products.deleteProduct(${p.id})">🗑️</button>
          </div>
        </td>
      </tr>
    `;
    }).join('');
  },

  filterTable(term) {
    const rows = document.querySelectorAll('#products-tbody tr');
    rows.forEach((row) => {
      row.style.display = row.dataset.name.includes(term.toLowerCase()) ? '' : 'none';
    });
  },

  /**
   * Actualiza el desglose de IVA en tiempo real
   */
  updateIvaBreakdown() {
    const pvp = parseFloat(document.getElementById('product-pvp')?.value) || 0;
    const taxRate = parseFloat(document.getElementById('product-tax')?.value) || 0;
    const breakdown = document.getElementById('iva-breakdown');

    if (pvp > 0) {
      const basePrice = pvp / (1 + taxRate / 100);
      const ivaAmount = pvp - basePrice;

      document.getElementById('iva-base').textContent = `$${basePrice.toFixed(2)}`;
      document.getElementById('iva-pct').textContent = taxRate;
      document.getElementById('iva-amount').textContent = `$${ivaAmount.toFixed(2)}`;
      document.getElementById('iva-total').textContent = `$${pvp.toFixed(2)}`;
      breakdown.style.display = '';
    } else {
      breakdown.style.display = 'none';
    }
  },

  openProductModal(product = null) {
    document.getElementById('product-modal-title').textContent = product ? 'Editar Producto' : 'Nuevo Producto';
    document.getElementById('product-id').value = product ? product.id : '';
    document.getElementById('product-name').value = product ? product.name : '';
    document.getElementById('product-category').value = product ? product.category_id || '' : '';
    document.getElementById('product-tax').value = product ? product.tax_rate : '15';
    document.getElementById('product-cost').value = product ? product.cost : '0';
    document.getElementById('product-description').value = product ? product.description || '' : '';
    document.getElementById('product-show-all').checked = product ? product.show_in_all_categories : false;

    // price = PVP (precio final al cliente, IVA incluido)
    if (product) {
      document.getElementById('product-pvp').value = parseFloat(product.price).toFixed(2);
    } else {
      document.getElementById('product-pvp').value = '';
    }

    document.getElementById('product-modal').classList.add('active');

    // Update breakdown
    setTimeout(() => this.updateIvaBreakdown(), 50);
  },

  openCategoryModal() {
    document.getElementById('category-modal').classList.add('active');
  },

  closeModal(id) {
    document.getElementById(id).classList.remove('active');
  },

  async editProduct(id) {
    const product = this.products.find((p) => p.id === id);
    if (product) this.openProductModal(product);
  },

  async saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('product-id').value;
    const pvp = parseFloat(document.getElementById('product-pvp').value);
    const taxRate = parseFloat(document.getElementById('product-tax').value);

    // Guardar PVP directamente (precio final al cliente, IVA incluido)
    const data = {
      name: document.getElementById('product-name').value,
      categoryId: document.getElementById('product-category').value || null,
      price: pvp,
      cost: parseFloat(document.getElementById('product-cost').value),
      taxRate: taxRate,
      description: document.getElementById('product-description').value,
      showInAllCategories: document.getElementById('product-show-all').checked,
    };

    try {
      if (id) {
        await API.put(`/products/${id}`, data);
        Toast.success('Producto actualizado');
      } else {
        await API.post('/products', data);
        Toast.success('Producto creado');
      }
      this.closeModal('product-modal');
      await this.loadData();
      const container = document.getElementById('page-container');
      this.render(container);
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async deleteProduct(id) {
    if (!confirm('¿Eliminar este producto?')) return;
    try {
      await API.delete(`/products/${id}`);
      Toast.success('Producto eliminado');
      await this.loadData();
      this.render(document.getElementById('page-container'));
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async saveCategory(e) {
    e.preventDefault();
    try {
      await API.post('/products/categories', {
        name: document.getElementById('category-name').value,
        icon: document.getElementById('category-icon').value || '🍽️',
      });
      Toast.success('Categoría creada');
      await this.loadData();
      this.render(document.getElementById('page-container'));
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async deleteCategory(id) {
    if (!confirm('¿Eliminar esta categoría?')) return;
    try {
      await API.delete(`/products/categories/${id}`);
      Toast.success('Categoría eliminada');
      await this.loadData();
      this.render(document.getElementById('page-container'));
    } catch (err) {
      Toast.error(err.message);
    }
  },
};

window.Products = Products;

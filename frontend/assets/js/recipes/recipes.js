/**
 * ═══════════════════════════════════════════════════════
 *  Recipes Module - Recetas y Costo por Plato
 * ═══════════════════════════════════════════════════════
 */

const Recipes = {
    products: [],
    inventoryItems: [],
    analysis: [],
    selectedProduct: null,
    currentRecipe: null,

    async init(container) {
        await this.loadData();
        this.render(container);
    },

    async loadData() {
        try {
            const [productsRes, inventoryRes, analysisRes] = await Promise.all([
                API.get('/products?available=true'),
                API.get('/inventory/items'),
                API.get('/recipes/analysis'),
            ]);
            this.products = productsRes.data || [];
            this.inventoryItems = inventoryRes.data || [];
            this.analysis = analysisRes.data || [];
        } catch (err) {
            Toast.error('Error cargando datos');
        }
    },

    render(container) {
        const withRecipe = this.analysis.filter((p) => parseInt(p.ingredient_count) > 0);
        const withoutRecipe = this.analysis.filter((p) => parseInt(p.ingredient_count) === 0);

        container.innerHTML = `
      <div class="page-content">
        <div class="page-header">
          <div>
            <h2 class="page-title">📋 Recetas</h2>
            <p class="page-description">Define ingredientes por plato y analiza el costo real vs precio de venta</p>
          </div>
        </div>

        <!-- Stats -->
        <div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
          <div class="stat-card">
            <div class="stat-icon success">📋</div>
            <div>
              <div class="stat-value">${withRecipe.length}</div>
              <div class="stat-label">Con Receta</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon warning">⚠️</div>
            <div>
              <div class="stat-value">${withoutRecipe.length}</div>
              <div class="stat-label">Sin Receta</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon info">📦</div>
            <div>
              <div class="stat-value">${this.inventoryItems.length}</div>
              <div class="stat-label">Insumos Disponibles</div>
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-lg)">
          <!-- Análisis de Margen -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">📊 Análisis de Margen</h3>
            </div>
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr><th>Producto</th><th>Precio</th><th>Costo</th><th>Margen</th><th>%</th><th></th></tr>
                </thead>
                <tbody>
                  ${this.analysis.map((p) => {
            const marginColor = p.margin_pct > 50 ? '#10b981' : p.margin_pct > 30 ? '#f59e0b' : '#ef4444';
            return `
                    <tr>
                      <td><strong>${p.name}</strong><br><span class="text-muted fs-xs">${p.ingredient_count} ingredientes</span></td>
                      <td>$${parseFloat(p.price).toFixed(2)}</td>
                      <td>$${p.recipe_cost.toFixed(2)}</td>
                      <td class="fw-bold" style="color:${marginColor}">$${p.margin.toFixed(2)}</td>
                      <td><span class="badge" style="background:${marginColor}22;color:${marginColor}">${p.margin_pct.toFixed(0)}%</span></td>
                      <td><button class="btn btn-sm btn-outline" onclick="Recipes.editRecipe(${p.id})">📝</button></td>
                    </tr>`;
        }).join('')}
                  ${this.analysis.length === 0 ? '<tr><td colspan="6" class="text-center text-muted" style="padding:30px">No hay productos</td></tr>' : ''}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Editor de Receta -->
          <div class="card" id="recipe-editor">
            <div class="card-header">
              <h3 class="card-title">🍳 Editor de Receta</h3>
            </div>
            <div class="empty-state" style="padding:40px">
              <div class="empty-state-icon">👈</div>
              <p>Selecciona un producto para editar su receta</p>
            </div>
          </div>
        </div>
      </div>
    `;
    },

    async editRecipe(productId) {
        this.selectedProduct = this.products.find((p) => p.id === productId) || this.analysis.find((p) => p.id === productId);
        try {
            const res = await API.get(`/recipes/${productId}`);
            this.currentRecipe = res.data;
        } catch (err) {
            this.currentRecipe = { ingredients: [], totalCost: 0 };
        }
        this.renderEditor();
    },

    renderEditor() {
        const editor = document.getElementById('recipe-editor');
        if (!editor || !this.selectedProduct) return;

        const p = this.selectedProduct;
        const r = this.currentRecipe;
        const margin = parseFloat(p.price) - r.totalCost;
        const marginPct = parseFloat(p.price) > 0 ? (margin / parseFloat(p.price) * 100) : 0;

        editor.innerHTML = `
      <div class="card-header">
        <h3 class="card-title">🍳 ${p.name}</h3>
      </div>
      <div style="padding:var(--space-md)">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:var(--space-md)">
          <div style="text-align:center;padding:12px;background:var(--bg-primary);border-radius:8px">
            <div class="text-muted fs-xs">Precio Venta</div>
            <div class="fw-bold fs-lg">$${parseFloat(p.price).toFixed(2)}</div>
          </div>
          <div style="text-align:center;padding:12px;background:var(--bg-primary);border-radius:8px">
            <div class="text-muted fs-xs">Costo Receta</div>
            <div class="fw-bold fs-lg" style="color:var(--accent-primary)">$${r.totalCost.toFixed(2)}</div>
          </div>
          <div style="text-align:center;padding:12px;background:var(--bg-primary);border-radius:8px">
            <div class="text-muted fs-xs">Margen</div>
            <div class="fw-bold fs-lg" style="color:${marginPct > 50 ? '#10b981' : marginPct > 30 ? '#f59e0b' : '#ef4444'}">$${margin.toFixed(2)} (${marginPct.toFixed(0)}%)</div>
          </div>
        </div>

        <!-- Agregar ingrediente -->
        <div style="display:grid;grid-template-columns:2fr 1fr auto;gap:8px;margin-bottom:var(--space-md)">
          <select class="form-input" id="recipe-ingredient">
            <option value="">Seleccionar insumo...</option>
            ${this.inventoryItems.map((i) => `<option value="${i.id}">${i.name} (${i.unit} - $${parseFloat(i.last_cost_per_unit).toFixed(4)})</option>`).join('')}
          </select>
          <input type="number" class="form-input" id="recipe-qty" step="0.001" placeholder="Cantidad">
          <button class="btn btn-primary" onclick="Recipes.addIngredient()">➕</button>
        </div>

        <!-- Lista de ingredientes -->
        <table class="data-table">
          <thead><tr><th>Ingrediente</th><th>Cantidad</th><th>Costo</th><th></th></tr></thead>
          <tbody>
            ${r.ingredients.map((ing) => `
              <tr>
                <td>${ing.ingredient_name}</td>
                <td>${parseFloat(ing.quantity_needed).toFixed(3)} ${ing.unit}</td>
                <td class="fw-bold">$${parseFloat(ing.ingredient_cost).toFixed(4)}</td>
                <td><button class="btn btn-sm btn-outline" onclick="Recipes.removeIngredient(${ing.id})" style="color:#ef4444">✕</button></td>
              </tr>
            `).join('')}
            ${r.ingredients.length === 0 ? '<tr><td colspan="4" class="text-center text-muted" style="padding:20px">Sin ingredientes</td></tr>' : ''}
          </tbody>
        </table>
      </div>
    `;
    },

    async addIngredient() {
        const inventoryItemId = parseInt(document.getElementById('recipe-ingredient').value);
        const quantityNeeded = parseFloat(document.getElementById('recipe-qty').value);

        if (!inventoryItemId) return Toast.error('Selecciona un insumo');
        if (!quantityNeeded || quantityNeeded <= 0) return Toast.error('Ingresa una cantidad válida');

        try {
            await API.post('/recipes', {
                productId: this.selectedProduct.id,
                inventoryItemId,
                quantityNeeded,
            });
            Toast.success('Ingrediente agregado');
            await this.editRecipe(this.selectedProduct.id);
            // Refresh analysis
            const analysisRes = await API.get('/recipes/analysis');
            this.analysis = analysisRes.data || [];
        } catch (err) {
            Toast.error(err.message);
        }
    },

    async removeIngredient(recipeId) {
        try {
            await API.delete(`/recipes/${recipeId}`);
            Toast.success('Ingrediente removido');
            await this.editRecipe(this.selectedProduct.id);
            const analysisRes = await API.get('/recipes/analysis');
            this.analysis = analysisRes.data || [];
        } catch (err) {
            Toast.error(err.message);
        }
    },
};

window.Recipes = Recipes;

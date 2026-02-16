/**
 * ═══════════════════════════════════════════════════════
 *  Investments Module - Registro de Inversiones/Compras
 * ═══════════════════════════════════════════════════════
 */

const Investments = {
    data: { investments: [], summary: [] },

    async init(container) {
        await this.loadData();
        this.render(container);
    },

    async loadData() {
        try {
            const res = await API.get('/investments');
            this.data = res.data || { investments: [], summary: [] };
        } catch (err) {
            Toast.error('Error cargando inversiones');
        }
    },

    render(container) {
        const totalInvested = this.data.summary.reduce((sum, s) => sum + parseFloat(s.total || 0), 0);

        container.innerHTML = `
      <div class="page-content">
        <div class="page-header">
          <div>
            <h2 class="page-title">💰 Inversiones y Compras</h2>
            <p class="page-description">Registro de compras, insumos y gastos del negocio</p>
          </div>
          <button class="btn btn-primary" onclick="Investments.openModal()">➕ Nueva Inversión</button>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon warning">💰</div>
            <div>
              <div class="stat-value">$${totalInvested.toFixed(2)}</div>
              <div class="stat-label">Total Invertido</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon info">📋</div>
            <div>
              <div class="stat-value">${this.data.total || 0}</div>
              <div class="stat-label">Registros</div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Proveedor</th><th>Monto</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                ${(this.data.investments || []).map((inv) => `
                  <tr>
                    <td>${new Date(inv.purchase_date).toLocaleDateString('es-EC')}</td>
                    <td><strong>${inv.description}</strong></td>
                    <td><span class="badge badge-info">${inv.category}</span></td>
                    <td>${inv.supplier || '—'}</td>
                    <td class="fw-bold text-accent">$${parseFloat(inv.amount).toFixed(2)}</td>
                    <td><button class="btn btn-sm btn-danger" onclick="Investments.delete(${inv.id})">🗑️</button></td>
                  </tr>
                `).join('')}
                ${(this.data.investments || []).length === 0 ? '<tr><td colspan="6" class="text-center text-muted" style="padding:40px">Sin registros</td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </div>

        <div class="modal-overlay" id="investment-modal">
          <div class="modal-content">
            <div class="modal-header">
              <h3 class="modal-title">➕ Nueva Inversión</h3>
              <button class="modal-close" onclick="Investments.closeModal()">✕</button>
            </div>
            <form onsubmit="Investments.save(event)">
              <div class="form-group">
                <label class="form-label">Descripción *</label>
                <input type="text" class="form-input" id="inv-description" required>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
                <div class="form-group">
                  <label class="form-label">Monto *</label>
                  <input type="number" class="form-input" id="inv-amount" step="0.01" min="0" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Categoría</label>
                  <select class="form-select" id="inv-category">
                    <option value="supplies">Insumos</option>
                    <option value="ingredients">Ingredientes</option>
                    <option value="equipment">Equipos</option>
                    <option value="maintenance">Mantenimiento</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Proveedor</label>
                <input type="text" class="form-input" id="inv-supplier">
              </div>
              <div class="form-group">
                <label class="form-label">Fecha</label>
                <input type="date" class="form-input" id="inv-date" value="${new Date().toISOString().split('T')[0]}">
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="Investments.closeModal()">Cancelar</button>
                <button type="submit" class="btn btn-primary">💾 Guardar</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
    },

    openModal() { document.getElementById('investment-modal').classList.add('active'); },
    closeModal() { document.getElementById('investment-modal').classList.remove('active'); },

    async save(e) {
        e.preventDefault();
        try {
            await API.post('/investments', {
                description: document.getElementById('inv-description').value,
                amount: parseFloat(document.getElementById('inv-amount').value),
                category: document.getElementById('inv-category').value,
                supplier: document.getElementById('inv-supplier').value,
                purchaseDate: document.getElementById('inv-date').value,
            });
            Toast.success('Inversión registrada');
            this.closeModal();
            await this.loadData();
            this.render(document.getElementById('page-container'));
        } catch (err) {
            Toast.error(err.message);
        }
    },

    async delete(id) {
        if (!confirm('¿Eliminar esta inversión?')) return;
        try {
            await API.delete(`/investments/${id}`);
            Toast.success('Inversión eliminada');
            await this.loadData();
            this.render(document.getElementById('page-container'));
        } catch (err) {
            Toast.error(err.message);
        }
    },
};

window.Investments = Investments;

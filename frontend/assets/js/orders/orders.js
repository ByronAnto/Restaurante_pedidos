/**
 * ═══════════════════════════════════════════════════════
 *  Orders Module - Pedidos Abiertos, Cerrados y Anulados
 *  Vista y gestión de todos los pedidos del sistema
 * ═══════════════════════════════════════════════════════
 */

const Orders = {
  orders: [],
  currentFilter: 'all',
  currentPage: 1,
  totalPages: 1,
  searchTimeout: null,

  async init(container) {
    container.innerHTML = `<div class="page-content">${this.renderHTML()}</div>`;
    this.bindEvents();
    await this.loadOrders();
  },

  renderHTML() {
    return `
      <div class="orders-toolbar">
        <div class="orders-filters">
          <button class="orders-filter-btn active" data-filter="all" onclick="Orders.setFilter('all')">
            📋 Todos
          </button>
          <button class="orders-filter-btn" data-filter="pending" onclick="Orders.setFilter('pending')">
            🟡 Pendientes
          </button>
          <button class="orders-filter-btn" data-filter="completed" onclick="Orders.setFilter('completed')">
            🟢 Completados
          </button>
          <button class="orders-filter-btn" data-filter="voided" onclick="Orders.setFilter('voided')">
            🔴 Anulados
          </button>
          <button class="orders-filter-btn" data-filter="cancelled" onclick="Orders.setFilter('cancelled')">
            ⚫ Cancelados
          </button>
        </div>
        <div class="orders-search">
          <input type="text" id="orders-search-input" class="form-input" placeholder="Buscar por # venta, mesa..." 
                 oninput="Orders.onSearch(this.value)" />
        </div>
        <div class="orders-date-range">
          <input type="date" id="orders-date-start" class="form-input" onchange="Orders.loadOrders()" />
          <span style="color:var(--text-muted)">a</span>
          <input type="date" id="orders-date-end" class="form-input" onchange="Orders.loadOrders()" />
        </div>
      </div>

      <!-- Stats resumen -->
      <div class="orders-stats" id="orders-stats"></div>

      <!-- Tabla de pedidos -->
      <div class="card" style="margin-top:16px">
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th># Venta</th>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Mesa</th>
                <th>Cajero</th>
                <th>Items</th>
                <th>Total</th>
                <th>Pago</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="orders-tbody">
              <tr><td colspan="10" class="text-center text-muted" style="padding:40px">Cargando...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Paginación -->
      <div class="orders-pagination" id="orders-pagination"></div>

      <!-- Modal detalle pedido -->
      <div class="modal-overlay" id="order-detail-modal">
        <div class="modal-content" style="max-width:600px" id="order-detail-content"></div>
      </div>

      <!-- Modal anulación -->
      <div class="modal-overlay" id="void-modal">
        <div class="modal-content" style="max-width:420px" id="void-modal-content"></div>
      </div>
    `;
  },

  bindEvents() {
    // Cerrar modales con click fuera
    document.getElementById('order-detail-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'order-detail-modal') this.closeDetailModal();
    });
    document.getElementById('void-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'void-modal') this.closeVoidModal();
    });

    // Fechas por defecto: hoy
    const today = new Date().toISOString().split('T')[0];
    const startEl = document.getElementById('orders-date-start');
    const endEl = document.getElementById('orders-date-end');
    if (startEl) startEl.value = today;
    if (endEl) endEl.value = today;
  },

  setFilter(filter) {
    this.currentFilter = filter;
    this.currentPage = 1;

    document.querySelectorAll('.orders-filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    this.loadOrders();
  },

  onSearch(value) {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.currentPage = 1;
      this.loadOrders();
    }, 400);
  },

  async loadOrders() {
    const startDate = document.getElementById('orders-date-start')?.value;
    const endDate = document.getElementById('orders-date-end')?.value;
    const search = document.getElementById('orders-search-input')?.value || '';

    let url = `/pos/sales?page=${this.currentPage}&limit=25`;
    
    if (startDate) url += `&startDate=${startDate}T00:00:00`;
    if (endDate) url += `&endDate=${endDate}T23:59:59`;
    if (this.currentFilter !== 'all') url += `&status=${this.currentFilter}`;

    try {
      const res = await API.get(url);
      if (!res?.success) throw new Error(res?.message || 'Error');

      let { sales, total } = res.data;

      // Filtro de búsqueda local
      if (search.trim()) {
        const q = search.toLowerCase();
        sales = sales.filter(s =>
          (s.sale_number || '').toLowerCase().includes(q) ||
          (s.table_name || '').toLowerCase().includes(q) ||
          (s.cashier_name || '').toLowerCase().includes(q)
        );
      }

      this.orders = sales;
      this.totalPages = Math.ceil(total / 25);
      this.renderOrders();
      this.renderStats();
      this.renderPagination();
    } catch (err) {
      Toast.error('Error al cargar pedidos: ' + (err.message || err));
    }
  },

  renderStats() {
    const container = document.getElementById('orders-stats');
    if (!container) return;

    const user = API.getUser();
    // Cajero no ve tarjetas de totales
    if (user?.role !== 'admin') {
      container.innerHTML = '';
      return;
    }

    const completed = this.orders.filter(o => o.status === 'completed');
    const pending = this.orders.filter(o => o.status === 'pending');
    const voided = this.orders.filter(o => o.status === 'voided');

    const totalCompleted = completed.reduce((s, o) => s + parseFloat(o.total || 0), 0);
    const totalVoided = voided.reduce((s, o) => s + parseFloat(o.total || 0), 0);

    container.innerHTML = `
      <div class="orders-stat-card">
        <div class="orders-stat-value">${this.orders.length}</div>
        <div class="orders-stat-label">Pedidos</div>
      </div>
      <div class="orders-stat-card stat-success">
        <div class="orders-stat-value">${completed.length}</div>
        <div class="orders-stat-label">Completados</div>
      </div>
      <div class="orders-stat-card stat-warning">
        <div class="orders-stat-value">${pending.length}</div>
        <div class="orders-stat-label">Pendientes</div>
      </div>
      <div class="orders-stat-card stat-danger">
        <div class="orders-stat-value">${voided.length}</div>
        <div class="orders-stat-label">Anulados</div>
      </div>
      <div class="orders-stat-card stat-success">
        <div class="orders-stat-value">$${totalCompleted.toFixed(2)}</div>
        <div class="orders-stat-label">Venta neta</div>
      </div>
      <div class="orders-stat-card stat-danger">
        <div class="orders-stat-value">$${totalVoided.toFixed(2)}</div>
        <div class="orders-stat-label">Anulado</div>
      </div>
    `;
  },

  renderOrders() {
    const tbody = document.getElementById('orders-tbody');
    if (!tbody) return;

    if (this.orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted" style="padding:40px">
        <div style="font-size:2rem;margin-bottom:8px">📭</div>
        No se encontraron pedidos
      </td></tr>`;
      return;
    }

    tbody.innerHTML = this.orders.map(order => {
      const statusBadge = this.getStatusBadge(order.status);
      const date = new Date(order.created_at);
      const dateStr = date.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: '2-digit' });
      const timeStr = date.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
      const payIcon = order.payment_method === 'cash' ? '💵' : '📱';
      const typeIcon = order.order_type === 'takeaway' ? '🥡' : '🍽️';
      const total = parseFloat(order.total || 0).toFixed(2);
      const user = API.getUser();
      const isCashier = user?.role !== 'admin';

      // Solo puede anular pedidos completed (no pendientes, no ya anulados)
      const canVoid = order.status === 'completed';

      // Total: borroso para cajero, click para revelar
      const totalCell = isCashier
        ? `<span class="blurred-amount" data-amount="$${total}" onclick="Orders.toggleReveal(this)">$${total}</span>`
        : `<strong>$${total}</strong>`;

      return `
        <tr class="orders-row ${order.status === 'voided' ? 'voided-row' : ''}">
          <td><strong>${order.sale_number}</strong></td>
          <td><div>${dateStr}</div><div style="font-size:0.8rem;color:var(--text-muted)">${timeStr}</div></td>
          <td>${typeIcon} ${order.order_type === 'takeaway' ? 'Llevar' : 'Mesa'}</td>
          <td>${order.table_name || '—'}</td>
          <td>${order.cashier_name || '—'}</td>
          <td style="text-align:center">—</td>
          <td>${totalCell}</td>
          <td>${payIcon} ${order.payment_method === 'cash' ? 'Efectivo' : 'Transfer.'}</td>
          <td>${statusBadge}</td>
          <td>
            <div style="display:flex;gap:4px">
              <button class="btn-icon" title="Ver detalle" onclick="Orders.showDetail(${order.id})">👁️</button>
              ${canVoid ? `<button class="btn-icon btn-icon-danger" title="Anular pedido" onclick="Orders.openVoidModal(${order.id})">🚫</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  getStatusBadge(status) {
    const map = {
      pending: '<span class="status-badge badge-warning">Pendiente</span>',
      completed: '<span class="status-badge badge-success">Completado</span>',
      cancelled: '<span class="status-badge badge-muted">Cancelado</span>',
      voided: '<span class="status-badge badge-danger">Anulado</span>',
    };
    return map[status] || status;
  },

  renderPagination() {
    const container = document.getElementById('orders-pagination');
    if (!container || this.totalPages <= 1) {
      if (container) container.innerHTML = '';
      return;
    }

    let html = '';
    html += `<button class="btn btn-secondary btn-sm" ${this.currentPage <= 1 ? 'disabled' : ''} onclick="Orders.goToPage(${this.currentPage - 1})">← Anterior</button>`;
    html += `<span style="padding:0 12px;color:var(--text-secondary)">Página ${this.currentPage} de ${this.totalPages}</span>`;
    html += `<button class="btn btn-secondary btn-sm" ${this.currentPage >= this.totalPages ? 'disabled' : ''} onclick="Orders.goToPage(${this.currentPage + 1})">Siguiente →</button>`;

    container.innerHTML = html;
  },

  goToPage(page) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadOrders();
  },

  // ─── DETALLE DE PEDIDO ───

  async showDetail(saleId) {
    try {
      const res = await API.get(`/pos/sales/${saleId}`);
      if (!res?.success) throw new Error(res?.message || 'Error');

      const sale = res.data;
      const content = document.getElementById('order-detail-content');
      const date = new Date(sale.created_at);

      content.innerHTML = `
        <div class="modal-header">
          <h3 class="modal-title">📄 Pedido ${sale.sale_number}</h3>
          <button class="modal-close" onclick="Orders.closeDetailModal()">✕</button>
        </div>
        <div style="padding:16px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
            <div>
              <div style="font-size:0.8rem;color:var(--text-muted)">Fecha</div>
              <div style="font-weight:600">${date.toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' })} ${date.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <div>
              <div style="font-size:0.8rem;color:var(--text-muted)">Cajero</div>
              <div style="font-weight:600">${sale.cashier_name || '—'}</div>
            </div>
            <div>
              <div style="font-size:0.8rem;color:var(--text-muted)">Estado</div>
              <div>${this.getStatusBadge(sale.status)}</div>
            </div>
            <div>
              <div style="font-size:0.8rem;color:var(--text-muted)">Pago</div>
              <div style="font-weight:600">${sale.payment_method === 'cash' ? '💵 Efectivo' : '📱 Transferencia'}</div>
            </div>
            ${sale.table_name ? `
            <div>
              <div style="font-size:0.8rem;color:var(--text-muted)">Mesa</div>
              <div style="font-weight:600">🍽️ ${sale.table_name}</div>
            </div>` : ''}
            ${sale.order_type ? `
            <div>
              <div style="font-size:0.8rem;color:var(--text-muted)">Tipo</div>
              <div style="font-weight:600">${sale.order_type === 'takeaway' ? '🥡 Para llevar' : '🍽️ En mesa'}</div>
            </div>` : ''}
          </div>

          ${sale.status === 'voided' ? `
          <div style="background:rgba(239,68,68,0.1);border:1px solid var(--color-danger);border-radius:var(--radius-md);padding:12px;margin-bottom:16px">
            <div style="font-weight:700;color:var(--color-danger);margin-bottom:4px">🚫 PEDIDO ANULADO</div>
            <div style="font-size:0.85rem;color:var(--text-secondary)">
              ${sale.void_reason ? `<div><strong>Motivo:</strong> ${sale.void_reason}</div>` : ''}
              ${sale.voided_at ? `<div><strong>Fecha:</strong> ${new Date(sale.voided_at).toLocaleString('es-EC')}</div>` : ''}
            </div>
          </div>` : ''}

          <!-- Items -->
          <div style="font-weight:700;margin-bottom:8px;font-size:0.9rem">Productos</div>
          <table class="data-table" style="font-size:0.85rem">
            <thead>
              <tr>
                <th>Producto</th>
                <th style="text-align:center">Cant.</th>
                <th style="text-align:right">P.Unit</th>
                <th style="text-align:right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${(sale.items || []).map(item => `
                <tr>
                  <td>
                    ${item.product_name}
                    ${item.modifiers ? `<div style="font-size:0.75rem;color:var(--accent-primary);font-style:italic">▸ ${item.modifiers}</div>` : ''}
                  </td>
                  <td style="text-align:center">${item.quantity}</td>
                  <td style="text-align:right">$${parseFloat(item.unit_price).toFixed(2)}</td>
                  <td style="text-align:right">$${parseFloat(item.subtotal).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <!-- Totales -->
          <div style="display:flex;flex-direction:column;align-items:flex-end;margin-top:12px;gap:4px">
            <div style="font-size:0.85rem;color:var(--text-muted)">Subtotal: $${parseFloat(sale.subtotal).toFixed(2)}</div>
            <div style="font-size:0.85rem;color:var(--text-muted)">IVA: $${parseFloat(sale.tax_total).toFixed(2)}</div>
            <div style="font-size:1.2rem;font-weight:700;color:${sale.status === 'voided' ? 'var(--color-danger)' : 'var(--color-success)'}">
              ${sale.status === 'voided' ? '<s>' : ''}Total: $${parseFloat(sale.total).toFixed(2)}${sale.status === 'voided' ? '</s>' : ''}
            </div>
          </div>

          ${sale.notes ? `<div style="margin-top:12px;padding:8px;background:var(--bg-primary);border-radius:var(--radius-sm);font-size:0.85rem;color:var(--text-muted)">📝 ${sale.notes}</div>` : ''}
        </div>
      `;

      document.getElementById('order-detail-modal').classList.add('active');
    } catch (err) {
      Toast.error('Error al cargar detalle: ' + (err.message || err));
    }
  },

  closeDetailModal() {
    document.getElementById('order-detail-modal')?.classList.remove('active');
  },

  // ─── ANULACIÓN DE PEDIDO ───

  openVoidModal(saleId) {
    const order = this.orders.find(o => o.id === saleId);
    if (!order) return;

    const user = API.getUser();
    const isAdmin = user?.role === 'admin';

    const content = document.getElementById('void-modal-content');
    content.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">🚫 Anular Pedido ${order.sale_number}</h3>
        <button class="modal-close" onclick="Orders.closeVoidModal()">✕</button>
      </div>
      <div style="padding:16px">
        <div style="background:rgba(239,68,68,0.08);border:1px solid var(--color-danger);border-radius:var(--radius-md);padding:12px;margin-bottom:16px">
          <div style="font-weight:600;margin-bottom:4px">⚠️ Esta acción no se puede deshacer</div>
          <div style="font-size:0.85rem;color:var(--text-secondary)">
            El pedido <strong>${order.sale_number}</strong> por <strong>$${parseFloat(order.total).toFixed(2)}</strong> será anulado.
            No se sumará a las ventas pero quedará registrado.
          </div>
        </div>

        ${!isAdmin ? `
        <div style="margin-bottom:16px">
          <div style="font-size:0.85rem;font-weight:600;margin-bottom:8px;color:var(--color-warning)">
            🔐 Se requiere autorización de administrador
          </div>
          <div class="form-group" style="margin-bottom:8px">
            <label class="form-label">Usuario Admin</label>
            <input type="text" id="void-admin-user" class="form-input" placeholder="Usuario administrador" autocomplete="off" />
          </div>
          <div class="form-group">
            <label class="form-label">Contraseña Admin</label>
            <input type="password" id="void-admin-pass" class="form-input" placeholder="Contraseña" autocomplete="off" />
          </div>
        </div>` : `
        <input type="hidden" id="void-admin-user" value="${user.username}" />
        <div class="form-group" style="margin-bottom:16px">
          <label class="form-label">🔐 Confirma tu contraseña</label>
          <input type="password" id="void-admin-pass" class="form-input" placeholder="Tu contraseña de admin" autocomplete="off" />
        </div>
        `}

        <div class="form-group" style="margin-bottom:16px">
          <label class="form-label">Motivo de anulación</label>
          <textarea id="void-reason" class="form-input" rows="2" placeholder="Ej: Error en el pedido, cliente canceló..." style="resize:vertical"></textarea>
        </div>

        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-secondary" onclick="Orders.closeVoidModal()">Cancelar</button>
          <button class="btn btn-danger" id="void-confirm-btn" onclick="Orders.confirmVoid(${saleId})">
            🚫 Anular Pedido
          </button>
        </div>
      </div>
    `;

    document.getElementById('void-modal').classList.add('active');

    // Focus en el primer campo
    setTimeout(() => {
      const firstInput = document.getElementById('void-admin-user');
      if (firstInput && firstInput.type !== 'hidden') firstInput.focus();
      else document.getElementById('void-admin-pass')?.focus();
    }, 200);
  },

  async confirmVoid(saleId) {
    const adminUser = document.getElementById('void-admin-user')?.value?.trim();
    const adminPass = document.getElementById('void-admin-pass')?.value;
    const reason = document.getElementById('void-reason')?.value?.trim();

    if (!adminUser || !adminPass) {
      Toast.warning('Ingrese usuario y contraseña de administrador');
      return;
    }

    const btn = document.getElementById('void-confirm-btn');
    btn.disabled = true;
    btn.textContent = 'Verificando...';

    try {
      const res = await API.post(`/pos/sales/${saleId}/void`, {
        adminUsername: adminUser,
        adminPassword: adminPass,
        reason: reason || 'Sin motivo especificado',
      });

      if (!res?.success) throw new Error(res?.message || 'Error al anular');

      Toast.success(res.message || 'Pedido anulado exitosamente');
      this.closeVoidModal();
      await this.loadOrders();
    } catch (err) {
      Toast.error(err.message || 'Error al anular el pedido');
      btn.disabled = false;
      btn.textContent = '🚫 Anular Pedido';
    }
  },

  closeVoidModal() {
    document.getElementById('void-modal')?.classList.remove('active');
  },

  /**
   * Toggle para revelar/ocultar monto borroso (cajero)
   */
  toggleReveal(el) {
    el.classList.toggle('revealed');
    // Auto-ocultar después de 3 segundos
    if (el.classList.contains('revealed')) {
      setTimeout(() => el.classList.remove('revealed'), 3000);
    }
  },
};

window.Orders = Orders;

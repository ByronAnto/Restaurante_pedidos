/**
 * ═══════════════════════════════════════════════════════
 *  Kitchen Module - Comandera Digital
 *  Soporta ventana independiente para segunda pantalla
 * ═══════════════════════════════════════════════════════
 */

const Kitchen = {
  orders: [],
  socket: null,

  async init(container) {
    await this.loadOrders();
    this.render(container);
    this.connectSocket();
  },

  async loadOrders() {
    try {
      const res = await API.get('/kitchen/orders/active');
      this.orders = res.data || [];
    } catch (err) {
      Toast.error('Error cargando órdenes');
    }
  },

  connectSocket() {
    // Limpiar conexión previa para evitar duplicados
    if (this.socket) {
      this.socket.off('new-kitchen-order');
      this.socket.off('kitchen-order-updated');
      this.socket.disconnect();
      this.socket = null;
    }

    if (typeof io !== 'undefined') {
      this.socket = io();
      this.socket.emit('join-kitchen');

      this.socket.on('new-kitchen-order', (data) => {
        Toast.info(`🆕 Nueva orden: ${data.saleNumber}`);
        this.loadOrders().then(() => this.updateUI());
      });

      this.socket.on('kitchen-order-updated', () => {
        this.loadOrders().then(() => this.updateUI());
      });
    }
  },

  /**
   * Abre la comandera en una ventana independiente (segunda pantalla)
   */
  openInNewWindow() {
    const kitchenWindow = window.open('/kitchen-display.html', 'ComanderaDigital', 'width=1200,height=800,menubar=no,toolbar=no');
    if (!kitchenWindow) {
      Toast.error('Permite las ventanas emergentes para la comandera');
      return;
    }
    kitchenWindow.focus();
  },

  render(container) {
    const pending = this.orders.filter((o) => o.status === 'pending');
    const preparing = this.orders.filter((o) => o.status === 'preparing');
    const ready = this.orders.filter((o) => o.status === 'ready');

    container.innerHTML = `
      <div class="page-content" style="padding: var(--space-lg)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md)">
          <div style="display:flex;gap:12px;align-items:center">
            <span class="badge" style="background:rgba(239,68,68,0.15);color:#ef4444;padding:6px 14px;font-weight:700;font-size:0.85rem;border-radius:20px">🔴 ${pending.length} Pendientes</span>
            <span class="badge" style="background:rgba(245,158,11,0.15);color:#f59e0b;padding:6px 14px;font-weight:700;font-size:0.85rem;border-radius:20px">🟡 ${preparing.length} Preparando</span>
            <span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981;padding:6px 14px;font-weight:700;font-size:0.85rem;border-radius:20px">🟢 ${ready.length} Listos</span>
          </div>
          <button class="btn btn-primary" onclick="Kitchen.openInNewWindow()">
            🖥️ Abrir en Segunda Pantalla
          </button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--space-lg);height:calc(100vh - 200px)">
          <!-- Pendientes -->
          <div class="card" style="overflow-y:auto">
            <div class="card-header">
              <h3 class="card-title">🔴 Pendientes (${pending.length})</h3>
            </div>
            ${pending.map((o) => this.renderOrderCard(o, 'preparing')).join('')}
            ${pending.length === 0 ? '<div class="empty-state"><div class="empty-state-icon">✨</div><p>Sin pedidos pendientes</p></div>' : ''}
          </div>

          <!-- Preparando -->
          <div class="card" style="overflow-y:auto">
            <div class="card-header">
              <h3 class="card-title">🟡 Preparando (${preparing.length})</h3>
            </div>
            ${preparing.map((o) => this.renderOrderCard(o, 'ready')).join('')}
            ${preparing.length === 0 ? '<div class="empty-state"><div class="empty-state-icon">👨‍🍳</div><p>Nada en preparación</p></div>' : ''}
          </div>

          <!-- Listos -->
          <div class="card" style="overflow-y:auto">
            <div class="card-header">
              <h3 class="card-title">🟢 Listos (${ready.length})</h3>
            </div>
            ${ready.map((o) => this.renderOrderCard(o, 'delivered')).join('')}
            ${ready.length === 0 ? '<div class="empty-state"><div class="empty-state-icon">🍽️</div><p>Sin pedidos listos</p></div>' : ''}
          </div>
        </div>
      </div>
    `;
  },

  renderOrderCard(order, nextStatus) {
    const items = order.items || [];
    const time = new Date(order.created_at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
    const btnLabels = { preparing: '👨‍🍳 Preparar', ready: '✅ Listo', delivered: '🍽️ Entregado' };
    
    // Elapsed time
    const diffMin = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
    const elapsedText = diffMin < 1 ? '<1 min' : diffMin + ' min';
    const elapsedColor = diffMin < 10 ? '#10b981' : diffMin < 20 ? '#f59e0b' : '#ef4444';
    const elapsedBg = diffMin < 10 ? 'rgba(16,185,129,0.15)' : diffMin < 20 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';

    // Order type badge
    const orderType = order.order_type || 'dine_in';
    const isTakeaway = orderType === 'takeaway';
    const typeLabel = isTakeaway ? '📦 Para Llevar' : `🏠 ${order.table_name || 'Mesa'}`;
    const typeBadgeStyle = isTakeaway 
      ? 'background:#fb923c;color:white;border:2px solid #ea580c' 
      : 'background:#10b981;color:white;border:2px solid #059669';
    const cardBorderColor = isTakeaway ? '#fb923c' : 'var(--accent-primary)';

    return `
      <div class="card" style="margin-bottom:var(--space-md);padding:var(--space-md);border-left:4px solid ${cardBorderColor}${diffMin >= 20 ? ';animation:pulse 1.5s infinite' : ''}">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:8px">
            <strong style="color:${cardBorderColor};font-size:1rem">#${order.sale_number || order.id}</strong>
            <span class="badge" style="${typeBadgeStyle};font-size:0.7rem;padding:3px 8px;border-radius:4px;font-weight:600">
              ${typeLabel}
            </span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:10px;background:${elapsedBg};color:${elapsedColor}">${elapsedText}</span>
            <span class="fs-sm text-muted">⏰ ${time}</span>
          </div>
        </div>
        <ul style="margin-bottom:10px">
          ${items.filter(i => i.id).map((item) => `
            <li style="padding:4px 0;font-size:0.85rem;border-bottom:1px dashed var(--border-color)">
              <strong style="color:var(--accent-primary)">${item.quantity}x</strong> ${item.product_name}
              ${item.modifiers ? `<div style="margin-left:20px;font-size:0.8rem;color:var(--accent-primary);font-weight:600;font-style:italic">▸ ${item.modifiers}</div>` : ''}
              ${item.notes ? `<div class="text-muted fs-xs" style="margin-left:20px;font-style:italic">📝 ${item.notes}</div>` : ''}
            </li>
          `).join('')}
        </ul>
        ${order.notes ? `<p class="fs-xs text-muted mb-sm" style="padding:4px 8px;background:var(--bg-primary);border-radius:6px">📝 ${order.notes}</p>` : ''}
        <button class="btn btn-primary btn-sm btn-block" onclick="Kitchen.updateStatus(${order.id}, '${nextStatus}')" style="text-transform:uppercase;letter-spacing:0.5px;font-weight:700">
          ${btnLabels[nextStatus]}
        </button>
      </div>
    `;
  },

  async updateStatus(orderId, status) {
    try {
      await API.patch(`/kitchen/orders/${orderId}/status`, { status });
      await this.loadOrders();
      this.updateUI();
      Toast.success(`Orden actualizada a: ${status}`);
    } catch (err) {
      Toast.error(err.message);
    }
  },

  updateUI() {
    const container = document.getElementById('page-container');
    if (container && App.currentPage === 'kitchen') {
      this.render(container);
    }
  },
};

window.Kitchen = Kitchen;

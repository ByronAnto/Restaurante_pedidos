/**
 * ═══════════════════════════════════════════════════════
 *  POS Module - Punto de Venta
 *  Gestión de ventas con selección de productos y pagos
 * ═══════════════════════════════════════════════════════
 */

const POS = {
  cart: [],
  products: [],
  categories: [],
  tables: [],
  zones: [],
  selectedCategory: null,
  searchTerm: '',
  container: null, // Referencia al contenedor
  
  // Full Service Mode
  mode: 'table-map', // 'table-map' | 'ordering'
  orderType: null, // 'dine_in' | 'takeaway'
  currentTable: null,
  currentOrder: null,

  // Período / Jornada de caja
  currentPeriod: null,

  /**
   * Inicializa el POS
   */
  async init(container) {
    this.cart = [];
    this.products = [];
    this.categories = [];
    this.tables = [];
    this.zones = [];
    this.container = container; // Guardar referencia
    this.mode = 'table-map';
    this.orderType = null;
    this.currentTable = null;
    this.currentOrder = null;
    this.currentPeriod = null;
    await this.loadPeriod();
    await this.loadData();
    this.render(container);
    this.bindEvents();
  },

  /**
   * Carga el período activo
   */
  async loadPeriod() {
    try {
      const res = await API.get('/periods/current');
      this.currentPeriod = res.data || null;
    } catch (err) {
      console.error('Error cargando período:', err);
      this.currentPeriod = null;
    }
  },

  /**
   * Carga productos, categorías y mesas
   */
  async loadData() {
    try {
      const [productsRes, categoriesRes, tablesRes, zonesRes] = await Promise.all([
        API.get('/products?available=true'),
        API.get('/products/categories'),
        API.get('/tables/map'),
        API.get('/zones'),
      ]);

      this.products = Array.isArray(productsRes?.data) ? productsRes.data : [];
      this.categories = Array.isArray(categoriesRes?.data) ? categoriesRes.data : [];
      // El endpoint /tables/map devuelve { tables: [], zones: [], summary: {} }
      this.tables = Array.isArray(tablesRes?.data?.tables) ? tablesRes.data.tables : [];
      this.zones = Array.isArray(zonesRes?.data) ? zonesRes.data : [];
      
      console.log('Datos cargados:', { 
        products: this.products.length, 
        categories: this.categories.length, 
        tables: this.tables.length,
        zones: this.zones.length 
      });
    } catch (err) {
      Toast.error('Error cargando datos');
      console.error('Error en loadData:', err);
      // Asegurar arrays vacíos en caso de error
      this.products = this.products || [];
      this.categories = this.categories || [];
      this.tables = this.tables || [];
    }
  },

  /**
   * Renderiza la vista del POS
   */
  render(container) {
    console.log('POS.render called - mode:', this.mode, 'container:', container);
    if (!container) {
      console.error('Container not found!');
      return;
    }

    // Si no hay período abierto, mostrar pantalla de apertura de caja
    if (!this.currentPeriod) {
      this.renderOpenPeriod(container);
      return;
    }
    
    if (this.mode === 'table-map') {
      this.renderTableMap(container);
    } else {
      this.renderOrdering(container);
      // Inicializar scroll de categorías después del render
      this.initCategoryScroll();
    }
  },

  /**
   * Pantalla de apertura de caja (cuando no hay período abierto)
   */
  renderOpenPeriod(container) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-EC', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    container.innerHTML = `
      <div class="floor-plan-view" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:calc(100vh - var(--header-height));">
        <div class="card" style="max-width:480px;width:100%;padding:var(--space-xl);text-align:center;">
          <div style="font-size:3.5rem;margin-bottom:var(--space-md);">💰</div>
          <h2 style="margin-bottom:var(--space-xs);font-size:1.4rem;">Abrir Caja</h2>
          <p style="color:var(--text-muted);margin-bottom:var(--space-lg);font-size:0.9rem;">${dateStr}</p>
          
          <div class="form-group" style="text-align:left;margin-bottom:var(--space-lg);">
            <label class="form-label">💵 Monto Inicial en Caja (efectivo)</label>
            <input type="number" class="form-input" id="opening-cash" value="0" min="0" step="0.01" 
                   style="font-size:1.4rem;text-align:center;font-weight:700;" autofocus>
            <p style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;">Ingrese el dinero en efectivo con el que inicia la jornada</p>
          </div>

          <div class="form-group" style="text-align:left;margin-bottom:var(--space-lg);">
            <label class="form-label">📝 Notas (opcional)</label>
            <input type="text" class="form-input" id="opening-notes" placeholder="Ej: Turno mañana, etc.">
          </div>

          <button class="btn btn-primary btn-block" onclick="POS.doOpenPeriod()" style="padding:16px;font-size:1.1rem;font-weight:700;">
            🔓 Abrir Período de Ventas
          </button>
        </div>
      </div>
    `;
  },

  /**
   * Ejecuta la apertura de caja / período
   */
  async doOpenPeriod() {
    const openingCash = parseFloat(document.getElementById('opening-cash').value) || 0;
    const notes = document.getElementById('opening-notes')?.value || '';
    
    try {
      const res = await API.post('/periods/open', { openingCash, notes });
      this.currentPeriod = res.data;
      Toast.success('✅ Caja abierta · $' + openingCash.toFixed(2));
      this.render(this.container);
    } catch (err) {
      Toast.error(err.message || 'Error abriendo caja');
    }
  },

  /**
   * Renderiza el plano visual del restaurante (Floor Plan)
   * Layout dinámico basado en zonas configuradas por el usuario
   */
  renderTableMap(container) {
    if (!Array.isArray(this.tables)) this.tables = [];
    if (!Array.isArray(this.zones)) this.zones = [];

    const freeCount = this.tables.filter(t => !t.active_sale_id).length;
    const occupiedCount = this.tables.filter(t => t.active_sale_id).length;

    // Mesas sin zona asignada
    const unzonedTables = this.tables.filter(t =>
      !t.zone_id && !this.zones.some(z => z.name === t.zone)
    );

    container.innerHTML = `
      <div class="floor-plan-view">
        <!-- ── Header ── -->
        <div class="fp-header">
          <div class="fp-header-left">
            <h2 class="fp-title">📐 Plano del Restaurante</h2>
            <div class="fp-legend">
              <span class="fp-legend-item free"><span class="fp-dot"></span>${freeCount} Libres</span>
              <span class="fp-legend-item occupied"><span class="fp-dot"></span>${occupiedCount} Ocupadas</span>
              <span class="fp-legend-item total">${this.tables.length} Total</span>
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <button class="btn btn-sm pos-action-icon" onclick="window.open('/kitchen-display.html','ComanderaDigital','width=1200,height=800')" title="Comandera">
              👨‍🍳
            </button>
            <button class="btn btn-sm pos-action-icon" onclick="POS.showWithdrawalModal()" title="Retiro de Efectivo" style="color:#f59e0b;">
              💸
            </button>
            <button class="btn btn-sm pos-action-icon" onclick="POS.showClosePeriodModal()" title="Cerrar Caja" style="color:#ef4444;">
              🔒
            </button>
            <button class="takeaway-btn" data-action="start-takeaway">
              <span class="takeaway-btn-icon">🏃</span>
              <span class="takeaway-btn-text">
                <span class="takeaway-btn-title">PARA LLEVAR</span>
                <span class="takeaway-btn-sub">Pedido sin mesa</span>
              </span>
            </button>
          </div>
        </div>

        ${this.tables.length === 0 && this.zones.length === 0 ? `
        <div class="fp-empty-state">
          <div class="fp-empty-icon">🪑</div>
          <h3>No hay mesas configuradas</h3>
          <p>Ve a Configuración → Plano del Restaurante para crear tu mapa</p>
        </div>
        ` : `
        <!-- ── Blueprint dinámico con CSS Grid ── -->
        <div class="fp-blueprint"
             style="display:grid;grid-template-columns:repeat(12,1fr);grid-template-rows:repeat(8,minmax(60px,1fr));gap:3px;">
          ${this.zones.map(z => {
            const zoneTables = this.tables.filter(t => t.zone_id === z.id || (!t.zone_id && t.zone === z.name));
            const isDecor = z.zone_type === 'wall';
            const isEntrance = z.zone_type === 'entrance';
            const isKitchen = z.zone_type === 'kitchen';
            const isStorage = z.zone_type === 'storage' || z.zone_type === 'bathroom';

            return `
            <div class="fp-zone fp-zone-${z.zone_type}"
                 style="grid-column:${z.grid_col + 1}/span ${z.grid_w};grid-row:${z.grid_row + 1}/span ${z.grid_h};--zone-color:${z.color};">
              <div class="fp-zone-label">
                <span class="fp-zone-icon">${z.icon}</span>
                <span class="fp-zone-name">${z.name}</span>
                ${!isDecor && !isKitchen && !isEntrance && !isStorage ? `<span class="fp-zone-count">${zoneTables.length} mesas</span>` : ''}
              </div>
              ${isKitchen ? `
              <div class="fp-kitchen-deco"><span>🔥</span><span>🍳</span><span>🥘</span></div>
              ` : isEntrance ? `
              <div class="fp-entrance-deco"><span>🚪</span></div>
              ` : isDecor || isStorage ? '' : `
              <div class="fp-tables">${this.renderFloorTables(zoneTables)}</div>
              `}
            </div>`;
          }).join('')}
          ${unzonedTables.length > 0 ? `
          <div class="fp-zone fp-zone-dining" style="grid-column:1/-1;--zone-color:#6b7280;">
            <div class="fp-zone-label">
              <span class="fp-zone-icon">📋</span>
              <span class="fp-zone-name">Sin zona</span>
              <span class="fp-zone-count">${unzonedTables.length}</span>
            </div>
            <div class="fp-tables">${this.renderFloorTables(unzonedTables)}</div>
          </div>
          ` : ''}
        </div>
        `}
      </div>
    `;
  },

  /**
   * Renderiza las mesas de una zona con vista top-down
   */
  renderFloorTables(tables) {
    if (!tables?.length) return '';
    return tables.map(t => {
      const occ = !!t.active_sale_id;
      const cls = occ ? 'occupied' : 'free';
      const shape = t.shape || 'square';
      return `
        <div class="fp-table ${cls} shape-${shape}"
             data-action="select-table" data-table-id="${t.id}"
             title="${t.name} · ${t.capacity} personas">
          <div class="fp-table-wrap">
            ${shape === 'round' ? this.renderRoundTable(t, occ) : this.renderSquareTable(t, occ)}
          </div>
          <div class="fp-table-badge ${cls}">${occ ? 'OCUPADA' : 'LIBRE'}</div>
        </div>`;
    }).join('');
  },

  /**
   * Mesa cuadrada / rectangular (sillas arriba y abajo)
   */
  renderSquareTable(t, occ) {
    const top = Math.ceil(t.capacity / 2);
    const bot = Math.floor(t.capacity / 2);
    const ch = '<div class="fp-chair"></div>';
    return `
      <div class="fp-chairs-row">${ch.repeat(top)}</div>
      <div class="fp-surface">
        <strong>${t.name}</strong>
        <small>👥 ${t.capacity}</small>
        ${occ ? `<span class="fp-total">$${Number.parseFloat(t.active_total || 0).toFixed(2)}</span>` : ''}
      </div>
      <div class="fp-chairs-row">${ch.repeat(bot)}</div>`;
  },

  /**
   * Mesa redonda (sillas en círculo alrededor)
   */
  renderRoundTable(t, occ) {
    const chairs = [];
    for (let i = 0; i < t.capacity; i++) {
      const a = ((360 / t.capacity) * i - 90) * Math.PI / 180;
      const x = (50 + 46 * Math.cos(a)).toFixed(1);
      const y = (50 + 46 * Math.sin(a)).toFixed(1);
      chairs.push(`<div class="fp-chair" style="left:${x}%;top:${y}%"></div>`);
    }
    return `
      <div class="fp-round-wrap">
        <div class="fp-chairs-ring">${chairs.join('')}</div>
        <div class="fp-surface round">
          <strong>${t.name}</strong>
          <small>👥 ${t.capacity}</small>
          ${occ ? `<span class="fp-total">$${Number.parseFloat(t.active_total || 0).toFixed(2)}</span>` : ''}
        </div>
      </div>`;
  },

  /**
   * Renderiza vista de pedido (productos + ticket)
   */
  renderOrdering(container) {
    const filteredProducts = this.getFilteredProducts();

    container.innerHTML = `
      <!-- Breadcrumb -->
      <div class="pos-breadcrumb">
        <button class="pos-breadcrumb-back" onclick="POS.backToMap()">
          <span class="breadcrumb-back-icon">←</span>
          <span>Mapa</span>
        </button>
        <span class="pos-breadcrumb-divider">/</span>
        <div class="pos-breadcrumb-current">
          <span class="breadcrumb-type-badge ${this.orderType === 'dine_in' ? 'dine-in' : 'takeaway'}">
            ${this.orderType === 'dine_in' ? `🏠 ${this.currentTable?.name || 'Mesa'}` : '📦 Para Llevar'}
          </span>
          ${this.currentOrder ? `<span class="breadcrumb-order-num">${this.currentOrder.sale_number}</span>` : '<span class="breadcrumb-new-order">Nuevo pedido</span>'}
        </div>
      </div>

      <div class="pos-layout" style="height: calc(100vh - var(--header-height) - 50px);">
        <!-- Panel de Productos -->
        <div class="pos-products-panel">
          <!-- Categorías -->
          <div class="pos-categories-wrapper">
            <button class="pos-cat-arrow pos-cat-arrow-left" id="cat-arrow-left" onclick="POS.scrollCategories(-1)">‹</button>
            <div class="pos-categories" id="pos-categories">
              <button class="pos-category-btn active" data-category="all" onclick="POS.filterCategory(null)">
                <span class="pos-category-icon">🍽️</span>
                <span>Todos</span>
              </button>
              ${this.categories.map((cat) => `
                <button class="pos-category-btn" data-category="${cat.id}" onclick="POS.filterCategory(${cat.id})">
                  <span class="pos-category-icon">${cat.icon}</span>
                  <span>${cat.name}</span>
                </button>
              `).join('')}
            </div>
            <button class="pos-cat-arrow pos-cat-arrow-right" id="cat-arrow-right" onclick="POS.scrollCategories(1)">›</button>
          </div>

          <!-- Búsqueda -->
          <div class="pos-search">
            <div class="pos-search-wrapper">
              <span class="pos-search-icon">🔍</span>
              <input type="text" class="pos-search-input" id="pos-search" 
                     placeholder="Buscar producto..." oninput="POS.search(this.value)">
            </div>
          </div>

          <!-- Grid de Productos -->
          <div class="pos-products-grid" id="pos-products-grid">
            ${this.renderProducts(filteredProducts)}
          </div>
        </div>

        <!-- Panel del Ticket -->
        <div class="pos-ticket-panel">
          <div class="pos-ticket-header">
            <button class="mobile-ticket-close" onclick="POS.closeMobileCart()">←</button>
            <div class="pos-ticket-title">
              🧾 Ticket de Venta
              <span class="pos-ticket-count" id="cart-count">${this.cart.length}</span>
            </div>
            <button class="pos-ticket-clear" onclick="POS.clearCart()" ${this.cart.length === 0 ? 'style="display:none"' : ''}>
              Limpiar todo
            </button>
          </div>

          <!-- Items ya enviados a cocina (orden existente) -->
          ${this.currentOrder && this.currentOrder.items && this.currentOrder.items.length > 0 ? `
            <div class="pos-existing-items">
              <div class="pos-existing-items-header">
                <span>✅ Ya en cocina</span>
                <span class="pos-existing-items-count">${this.currentOrder.items.length} items</span>
              </div>
              ${this.currentOrder.items.map(item => {
                const itemPVP = parseFloat(item.subtotal) * (1 + parseFloat(item.tax_rate || 0) / 100);
                return `
                <div class="pos-existing-item">
                  <span class="pos-existing-item-qty">${item.quantity}x</span>
                  <span class="pos-existing-item-name">${item.product_name}${item.modifiers ? ` <em style="color:var(--accent-primary);font-size:0.8rem">(${item.modifiers})</em>` : ''}</span>
                  <span class="pos-existing-item-price">$${itemPVP.toFixed(2)}</span>
                </div>
              `}).join('')}
            </div>
          ` : ''}

          <!-- Nuevos items (carrito) -->
          ${this.cart.length > 0 ? `
            <div class="pos-new-items-header" id="pos-new-items-header">
              <span>🆕 Nuevos items</span>
            </div>
          ` : ''}

          <!-- Items -->
          <div id="pos-ticket-items" class="pos-ticket-items">
            ${this.cart.length === 0 && !(this.currentOrder?.items?.length) ? this.renderEmptyCart() : 
              this.cart.length === 0 ? '' : this.renderCartItems()}
          </div>

          <!-- Totales -->
          <div class="pos-ticket-totals" id="pos-totals">
            ${this.renderTotals()}
          </div>

          <!-- Botones de Acción -->
          <div class="pos-action-buttons">
            ${this.orderType === 'dine_in' && !this.currentOrder ? `
              <!-- Dine-in: Enviar a cocina (nueva mesa) -->
              <button class="pos-action-btn kitchen" onclick="POS.sendToKitchen()" 
                      ${this.cart.length === 0 ? 'disabled' : ''} id="btn-send-kitchen">
                <div class="pos-action-btn-icon">🔥</div>
                <div class="pos-action-btn-text">
                  <span class="pos-action-btn-title">ENVIAR A COCINA</span>
                  <span class="pos-action-btn-sub">Preparar pedido · ${this.currentTable?.name || 'Mesa'}</span>
                </div>
              </button>
            ` : this.orderType === 'dine_in' && this.currentOrder ? `
              <!-- Dine-in: Con orden abierta -->
              <div class="pos-action-group">
                <!-- Fila 1: Agregar items (solo si hay nuevos) -->
                <button class="pos-action-btn add-items full-width" onclick="POS.addItemsToOrder()" 
                        ${this.cart.length === 0 ? 'disabled' : ''} id="btn-add-items">
                  <div class="pos-action-btn-icon">🔥</div>
                  <div class="pos-action-btn-text">
                    <span class="pos-action-btn-title">ENVIAR NUEVOS A COCINA</span>
                    <span class="pos-action-btn-sub">Agregar items al pedido</span>
                  </div>
                </button>
                <!-- Fila 2: Botones de cobro (deshabilitados si hay items nuevos sin enviar) -->
                <div class="pos-action-pay-row">
                  <button class="pos-action-btn charge" onclick="POS.closeOrderModal('cash')" 
                          ${this.cart.length > 0 ? 'disabled' : ''} id="btn-close-order">
                    <div class="pos-action-btn-icon">💵</div>
                    <div class="pos-action-btn-text">
                      <span class="pos-action-btn-title">EFECTIVO</span>
                      <span class="pos-action-btn-sub">$${this.currentOrder ? Number.parseFloat(this.currentOrder.active_total || this.currentOrder.total || 0).toFixed(2) : '0.00'}</span>
                    </div>
                  </button>
                  <button class="pos-action-btn transfer" onclick="POS.closeOrderModal('transfer')" 
                          ${this.cart.length > 0 ? 'disabled' : ''} id="btn-close-transfer">
                    <div class="pos-action-btn-icon">📱</div>
                    <div class="pos-action-btn-text">
                      <span class="pos-action-btn-title">TRANSFER.</span>
                      <span class="pos-action-btn-sub">Pago digital</span>
                    </div>
                  </button>
                </div>
              </div>
            ` : `
              <!-- Takeaway: Cobro inmediato -->
              <button class="pos-action-btn cash" onclick="POS.openPaymentModal('cash')" 
                      ${this.cart.length === 0 ? 'disabled' : ''} id="btn-pay-cash">
                <div class="pos-action-btn-icon">💵</div>
                <div class="pos-action-btn-text">
                  <span class="pos-action-btn-title">EFECTIVO</span>
                  <span class="pos-action-btn-sub">Pago en efectivo</span>
                </div>
              </button>
              <button class="pos-action-btn transfer" onclick="POS.openPaymentModal('transfer')" 
                      ${this.cart.length === 0 ? 'disabled' : ''} id="btn-pay-transfer">
                <div class="pos-action-btn-icon">📱</div>
                <div class="pos-action-btn-text">
                  <span class="pos-action-btn-title">TRANSFERENCIA</span>
                  <span class="pos-action-btn-sub">Pago por transferencia</span>
                </div>
              </button>
            `}
          </div>
        </div>
      </div>

      <!-- Mobile Cart FAB -->
      <button class="mobile-cart-fab" id="mobile-cart-fab" onclick="POS.toggleMobileCart()">
        🛒 Ver Ticket <span class="fab-badge" id="fab-cart-count">${this.cart.length || 0}</span>
      </button>
      <!-- Cart overlay for mobile -->
      <div class="cart-overlay" id="cart-overlay" onclick="POS.closeMobileCart()"></div>

      <!-- Modal de Pago (Redesigned) -->
      <div class="modal-overlay payment-modal" id="payment-modal">
        <div class="modal-content pay-modal-content">
          <!-- Header compacto -->
          <div class="pay-modal-header">
            <div class="pay-modal-header-left">
              <span class="pay-modal-icon" id="payment-modal-icon">💵</span>
              <span class="pay-modal-title" id="payment-modal-title">Pago en Efectivo</span>
            </div>
            <button class="modal-close" onclick="POS.closePaymentModal()">✕</button>
          </div>

          <div class="pay-modal-body">
            <!-- Resumen de consumo (visible al cobrar dine-in) -->
            <div class="pay-order-summary" id="pay-order-summary" style="display:none">
              <div class="pay-summary-label">📋 Detalle del consumo</div>
              <div class="pay-summary-items" id="pay-summary-items"></div>
            </div>

            <!-- Total grande -->
            <div class="pay-total-display">
              <span class="pay-total-label">TOTAL</span>
              <span class="pay-total-amount" id="payment-total">$0.00</span>
            </div>

            <!-- Sección Efectivo -->
            <div id="payment-cash-section">
              <!-- Input + Billetes + Monedas en layout compacto -->
              <div class="pay-input-row">
                <label class="form-label" style="margin-bottom:4px;font-size:0.8rem">Monto Recibido</label>
                <div class="pay-input-wrapper">
                  <span class="pay-input-currency">$</span>
                  <input type="number" class="pay-input" id="payment-received" 
                         step="0.01" min="0" placeholder="0.00" oninput="POS.calculateChange()">
                  <button type="button" class="pay-exact-btn" onclick="POS.setExactAmount()" title="Valor justo">=</button>
                </div>
              </div>

              <!-- Billetes (suman) -->
              <div class="pay-denomination-row">
                <span class="pay-denom-label">💵 Billetes</span>
                <div class="pay-denom-buttons">
                  <button type="button" class="pay-denom-btn bill" onclick="POS.addCashAmount(1)">$1</button>
                  <button type="button" class="pay-denom-btn bill" onclick="POS.addCashAmount(5)">$5</button>
                  <button type="button" class="pay-denom-btn bill accent-green" onclick="POS.addCashAmount(10)">$10</button>
                  <button type="button" class="pay-denom-btn bill accent-blue" onclick="POS.addCashAmount(20)">$20</button>
                  <button type="button" class="pay-denom-btn bill accent-purple" onclick="POS.addCashAmount(50)">$50</button>
                  <button type="button" class="pay-denom-btn bill accent-gold" onclick="POS.addCashAmount(100)">$100</button>
                </div>
              </div>

              <!-- Monedas (suman) -->
              <div class="pay-denomination-row">
                <span class="pay-denom-label">🪙 Monedas</span>
                <div class="pay-denom-buttons">
                  <button type="button" class="pay-denom-btn coin" onclick="POS.addCashAmount(0.05)">5¢</button>
                  <button type="button" class="pay-denom-btn coin" onclick="POS.addCashAmount(0.10)">10¢</button>
                  <button type="button" class="pay-denom-btn coin" onclick="POS.addCashAmount(0.25)">25¢</button>
                  <button type="button" class="pay-denom-btn coin" onclick="POS.addCashAmount(0.50)">50¢</button>
                  <button type="button" class="pay-denom-btn coin" onclick="POS.addCashAmount(1.00)">$1</button>
                </div>
              </div>

              <!-- Cambio -->
              <div class="pay-change-display" id="payment-change" style="display:none">
                <span class="pay-change-label">Vuelto</span>
                <span class="pay-change-amount" id="payment-change-value">$0.00</span>
              </div>

              <!-- Botón limpiar monto -->
              <button type="button" class="pay-clear-amount" onclick="POS.clearCashAmount()" id="pay-clear-btn" style="display:none">
                🗑️ Limpiar monto
              </button>
            </div>

            <!-- Sección Transferencia -->
            <div id="payment-transfer-section" style="display:none">
              <div class="form-group">
                <label class="form-label">Referencia</label>
                <input type="text" class="form-input" id="payment-transfer-ref" 
                       placeholder="Número de referencia">
              </div>
            </div>

            <!-- Cliente (collapsible) -->
            <details class="pay-client-details">
              <summary class="pay-client-summary">👤 Datos del cliente (opcional)</summary>
              <div class="pay-client-fields">
                <div class="form-group">
                  <label class="form-label">Cliente</label>
                  <input type="text" class="form-input" id="payment-customer-name" 
                         placeholder="Nombre" value="CONSUMIDOR FINAL">
                </div>
                <div class="form-group">
                  <label class="form-label">CI/RUC</label>
                  <input type="text" class="form-input" id="payment-customer-id" 
                         placeholder="9999999999999">
                </div>
              </div>
            </details>
          </div>

          <!-- Footer fijo -->
          <div class="pay-modal-footer">
            <button class="pay-cancel-btn" onclick="POS.closePaymentModal()">Cancelar</button>
            <button class="pay-confirm-btn" onclick="POS.processSale()" id="btn-process-sale">
              <span class="pay-confirm-icon">✅</span>
              <span class="pay-confirm-text">Procesar Venta</span>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Renderiza productos
   */
  renderProducts(products) {
    if (products.length === 0) {
      return '<div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">No se encontraron productos</div></div>';
    }

    return products.map((product) => {
      const pvp = parseFloat(product.price);
      const hasModifiers = product.modifier_groups && product.modifier_groups.length > 0;
      return `
      <div class="pos-product-card ${!product.available ? 'unavailable' : ''}" 
           onclick="POS.addToCart(${product.id})">
        <div class="pos-product-emoji">${product.category_icon || '🍽️'}</div>
        <div class="pos-product-name">${product.name}</div>
        <div class="pos-product-price">$${pvp.toFixed(2)}</div>
        ${hasModifiers ? '<div class="pos-product-modifier-badge">⚙️</div>' : ''}
      </div>
    `;
    }).join('');
  },

  /**
   * Renderiza items del carrito
   */
  renderCartItems() {
    return this.cart.map((item, index) => {
      const lineTotal = item.pvp * item.quantity;
      const modLabel = item.modifiers ? `<div class="pos-ticket-item-mods">${item.modifiers}</div>` : '';
      return `
      <div class="pos-ticket-item">
        <div class="pos-ticket-item-name">${item.productName}${modLabel}</div>
        <div class="pos-ticket-item-row">
          <span class="pos-ticket-item-uprice">$${item.pvp.toFixed(2)} c/u</span>
          <div class="pos-ticket-item-qty">
            <button class="pos-qty-btn" onclick="POS.updateQuantity(${index}, -1)">−</button>
            <span class="pos-qty-value">${item.quantity}</span>
            <button class="pos-qty-btn" onclick="POS.updateQuantity(${index}, 1)">+</button>
          </div>
          <div class="pos-ticket-item-subtotal">$${lineTotal.toFixed(2)}</div>
          <button class="pos-ticket-item-remove" onclick="POS.removeFromCart(${index})">🗑️</button>
        </div>
      </div>
    `;
    }).join('');
  },

  renderEmptyCart() {
    return `
      <div class="pos-ticket-empty">
        <div class="pos-ticket-empty-icon">🛒</div>
        <div class="pos-ticket-empty-text">Agrega productos al ticket</div>
      </div>
    `;
  },

  /**
   * Renderiza totales
   */
  renderTotals() {
    const { taxTotal, total } = this.calculateTotals();
    
    // Si hay orden existente, mostrar el total completo de la cuenta
    if (this.currentOrder && this.currentOrder.total) {
      const orderTotal = parseFloat(this.currentOrder.total);
      return `
        ${this.cart.length > 0 ? `
          <div class="pos-total-row" style="font-size:0.82rem;opacity:0.7">
            <span>Nuevos items</span>
            <span>+$${total.toFixed(2)}</span>
          </div>
        ` : ''}
        <div class="pos-total-row total">
          <span>CUENTA TOTAL</span>
          <span class="pos-total-value">$${orderTotal.toFixed(2)}</span>
        </div>
      `;
    }

    return `
      <div class="pos-total-row total">
        <span>TOTAL</span>
        <span class="pos-total-value">$${total.toFixed(2)}</span>
      </div>
      ${taxTotal > 0 ? `
        <div class="pos-total-row" style="font-size:0.75rem;opacity:0.6;margin-top:-4px">
          <span>Incluye IVA</span>
          <span>$${taxTotal.toFixed(2)}</span>
        </div>
      ` : ''}
    `;
  },

  /**
   * Calcula totales del carrito (basado en PVP = precio final al cliente)
   * El PVP ya incluye IVA. El desglose es solo informativo.
   */
  calculateTotals() {
    let total = 0;
    let taxTotal = 0;

    this.cart.forEach((item) => {
      const pvp = item.pvp * item.quantity;
      total += pvp;
      // Desglose informativo: IVA incluido en el PVP
      const base = pvp / (1 + item.taxRate / 100);
      taxTotal += pvp - base;
    });

    const subtotal = total - taxTotal;
    return { subtotal, taxTotal, total };
  },

  /**
   * Agrega producto al carrito
   * Si tiene modificadores, abre modal de selección primero
   */
  addToCart(productId) {
    const product = this.products.find((p) => p.id === productId);
    if (!product) return;

    // Si tiene modificadores, mostrar modal de selección
    if (product.modifier_groups && product.modifier_groups.length > 0) {
      this.openModifierModal(product);
      return;
    }

    this._addProductToCart(product, '');
  },

  /**
   * Agrega un producto al carrito (sin o con modificadores ya seleccionados)
   */
  _addProductToCart(product, modifiersText, priceAdjustment = 0) {
    this._addProductToCartWithQty(product, modifiersText, priceAdjustment, 1);
  },

  /**
   * Agrega producto al carrito con cantidad específica y modificador
   */
  _addProductToCartWithQty(product, modifiersText, priceAdjustment = 0, qty = 1) {
    const pvp = parseFloat(product.price) + priceAdjustment;
    const taxRate = parseFloat(product.tax_rate);
    const cartKey = `${product.id}_${modifiersText}`;

    const existingIndex = this.cart.findIndex((item) => item.cartKey === cartKey);

    if (existingIndex >= 0) {
      this.cart[existingIndex].quantity += qty;
    } else {
      const basePrice = taxRate > 0 ? pvp / (1 + taxRate / 100) : pvp;
      this.cart.push({
        cartKey,
        productId: product.id,
        productName: product.name,
        unitPrice: Math.round(basePrice * 100) / 100,
        pvp: pvp,
        taxRate: taxRate,
        quantity: qty,
        trackStock: product.track_stock,
        modifiers: modifiersText,
      });
    }

    this.updateTicketUI();
  },

  // ─── MODAL DE MODIFICADORES EN POS ───

  /**
   * Abre el modal para seleccionar modificadores de un producto
   */
  openModifierModal(product) {
    this._pendingModProduct = product;
    this._modQuantities = {};

    // Inicializar cantidades en 0 por cada opción de cada grupo
    product.modifier_groups.forEach(g => {
      this._modQuantities[g.id] = {};
      (g.options || []).forEach(o => {
        this._modQuantities[g.id][o.id] = 0;
      });
    });

    // Crear o reutilizar modal
    let modal = document.getElementById('pos-modifier-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'pos-modifier-modal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    this._renderModifierModal();
    modal.classList.add('active');
  },

  /**
   * Renderiza el contenido del modal de modificadores
   */
  _renderModifierModal() {
    const product = this._pendingModProduct;
    const modal = document.getElementById('pos-modifier-modal');
    if (!modal || !product) return;

    const groups = product.modifier_groups;
    const basePvp = parseFloat(product.price);

    // Contar total de unidades y ajuste de precio
    let totalUnits = 0;
    let totalAdjustment = 0;
    for (const g of groups) {
      const gQtys = this._modQuantities[g.id] || {};
      for (const o of (g.options || [])) {
        const qty = gQtys[o.id] || 0;
        totalUnits += qty;
        totalAdjustment += qty * (parseFloat(o.price_adjustment) || 0);
      }
    }

    // Verificar válido: cada grupo required tiene al menos 1 unidad
    const allValid = groups.every(g => {
      if (!g.required) return true;
      const gQtys = this._modQuantities[g.id] || {};
      const groupTotal = Object.values(gQtys).reduce((s, q) => s + q, 0);
      return groupTotal > 0;
    });

    modal.innerHTML = `
      <div class="modal-content" style="max-width:460px">
        <div class="modal-header">
          <h3 class="modal-title">${product.category_icon || '🍽️'} ${product.name}</h3>
          <button class="modal-close" onclick="POS.closeModifierModal()">✕</button>
        </div>
        <div style="padding:16px;max-height:60vh;overflow-y:auto">
          ${groups.map(g => {
            const opts = (g.options || []).filter(o => o.available !== false);
            const gQtys = this._modQuantities[g.id] || {};
            const groupTotal = Object.values(gQtys).reduce((s, q) => s + q, 0);
            return `
            <div style="margin-bottom:16px">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
                <span style="font-weight:700;font-size:0.95rem">${g.name}</span>
                ${g.required ? '<span style="font-size:0.7rem;background:var(--color-danger);color:#fff;padding:1px 6px;border-radius:8px">Requerido</span>' : '<span style="font-size:0.7rem;color:var(--text-muted)">(Opcional)</span>'}
                <span style="margin-left:auto;font-size:0.8rem;color:var(--text-muted)">${groupTotal} selec.</span>
              </div>
              <div class="pos-mod-options-list">
                ${opts.map(o => {
                  const qty = gQtys[o.id] || 0;
                  const adj = parseFloat(o.price_adjustment) || 0;
                  return `
                  <div class="pos-mod-option-row ${qty > 0 ? 'active' : ''}">
                    <div class="pos-mod-option-info">
                      <span class="pos-mod-option-name">${o.name}</span>
                      ${adj > 0 ? `<span class="pos-mod-option-price">+$${adj.toFixed(2)} c/u</span>` : '<span class="pos-mod-option-price">sin cargo</span>'}
                    </div>
                    <div class="pos-mod-qty-control">
                      <button type="button" class="pos-mod-qty-btn" ${qty <= 0 ? 'disabled' : ''}
                              onclick="POS.changeModQty(${g.id}, ${o.id}, -1)">−</button>
                      <span class="pos-mod-qty-value ${qty > 0 ? 'has-qty' : ''}">${qty}</span>
                      <button type="button" class="pos-mod-qty-btn"
                              onclick="POS.changeModQty(${g.id}, ${o.id}, 1)">+</button>
                    </div>
                  </div>
                `}).join('')}
              </div>
            </div>
          `}).join('')}
        </div>
        <div style="padding:12px 16px;border-top:1px solid var(--border-color);display:flex;align-items:center;justify-content:space-between">
          <div>
            <span style="font-size:0.8rem;color:var(--text-secondary)">Total:</span>
            <span style="font-size:1.1rem;font-weight:700;color:var(--color-success);margin-left:4px">${totalUnits} uds</span>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secondary" onclick="POS.closeModifierModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="POS.confirmModifiers()" ${(!allValid || totalUnits === 0) ? 'disabled title="Selecciona al menos una opción"' : ''}>
              ✅ Agregar${totalUnits > 0 ? ` (${totalUnits})` : ''}
            </button>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Cambia la cantidad de una opción de modificador (+1 o -1)
   */
  changeModQty(groupId, optionId, delta) {
    if (!this._modQuantities[groupId]) this._modQuantities[groupId] = {};
    const current = this._modQuantities[groupId][optionId] || 0;
    const newQty = Math.max(0, current + delta);
    this._modQuantities[groupId][optionId] = newQty;
    this._renderModifierModal();
  },

  /**
   * Confirma los modificadores y agrega al carrito
   */
  confirmModifiers() {
    const product = this._pendingModProduct;
    if (!product) return;

    const groups = product.modifier_groups;

    // Recopilar todas las opciones con qty > 0
    const entries = [];
    for (const g of groups) {
      const gQtys = this._modQuantities[g.id] || {};
      for (const o of (g.options || [])) {
        const qty = gQtys[o.id] || 0;
        if (qty > 0) {
          entries.push({
            name: o.name,
            qty,
            priceAdj: parseFloat(o.price_adjustment) || 0,
          });
        }
      }
    }

    if (entries.length === 0) return;

    // Agregar una línea al carrito por cada opción con su cantidad
    for (const entry of entries) {
      this._addProductToCartWithQty(product, entry.name, entry.priceAdj, entry.qty);
    }

    this.closeModifierModal();
  },

  closeModifierModal() {
    const modal = document.getElementById('pos-modifier-modal');
    if (modal) modal.classList.remove('active');
    this._pendingModProduct = null;
    this._modQuantities = {};
  },

  /**
   * Actualiza cantidad de un item
   */
  updateQuantity(index, delta) {
    if (!this.cart[index]) return;

    this.cart[index].quantity += delta;
    if (this.cart[index].quantity <= 0) {
      this.cart.splice(index, 1);
    }

    this.updateTicketUI();
  },

  /**
   * Elimina del carrito
   */
  removeFromCart(index) {
    this.cart.splice(index, 1);
    this.updateTicketUI();
  },

  /**
   * Toggle mobile cart panel
   */
  toggleMobileCart() {
    const ticketPanel = document.querySelector('.pos-ticket-panel');
    const overlay = document.getElementById('cart-overlay');
    if (!ticketPanel) return;
    const isOpen = ticketPanel.classList.toggle('mobile-open');
    if (overlay) overlay.classList.toggle('active', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  },

  /**
   * Close mobile cart panel
   */
  closeMobileCart() {
    const ticketPanel = document.querySelector('.pos-ticket-panel');
    const overlay = document.getElementById('cart-overlay');
    if (ticketPanel) ticketPanel.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
  },

  /**
   * Limpia el carrito
   */
  clearCart() {
    this.cart = [];
    this.updateTicketUI();
  },

  /**
   * Actualiza la UI del ticket
   */
  updateTicketUI() {
    const itemsEl = document.getElementById('pos-ticket-items');
    const totalsEl = document.getElementById('pos-totals');
    const countEl = document.getElementById('cart-count');
    const clearBtn = document.querySelector('.pos-ticket-clear');
    const cashBtn = document.getElementById('btn-pay-cash');
    const transferBtn = document.getElementById('btn-pay-transfer');
    const sendKitchenBtn = document.getElementById('btn-send-kitchen');
    const addItemsBtn = document.getElementById('btn-add-items');
    const newItemsHeader = document.getElementById('pos-new-items-header');

    if (itemsEl) {
      const hasExistingItems = this.currentOrder?.items?.length > 0;
      itemsEl.innerHTML = this.cart.length === 0 && !hasExistingItems
        ? this.renderEmptyCart()
        : this.cart.length === 0 ? '' : this.renderCartItems();
    }
    if (totalsEl) totalsEl.innerHTML = this.renderTotals();
    if (countEl) countEl.textContent = this.cart.length;
    if (clearBtn) clearBtn.style.display = this.cart.length > 0 ? '' : 'none';
    if (cashBtn) cashBtn.disabled = this.cart.length === 0;
    if (transferBtn) transferBtn.disabled = this.cart.length === 0;
    if (sendKitchenBtn) sendKitchenBtn.disabled = this.cart.length === 0;
    if (addItemsBtn) addItemsBtn.disabled = this.cart.length === 0;
    if (newItemsHeader) newItemsHeader.style.display = this.cart.length > 0 ? '' : 'none';

    // Dine-in con orden abierta: bloquear cobro si hay items nuevos sin enviar
    // y actualizar el monto del botón EFECTIVO
    const closeOrderBtn = document.getElementById('btn-close-order');
    const closeTransferBtn = document.getElementById('btn-close-transfer');
    if (closeOrderBtn) {
      closeOrderBtn.disabled = this.cart.length > 0;
      // Actualizar monto: total orden + nuevos items del carrito
      const orderTotal = parseFloat(this.currentOrder?.total || 0);
      const cartTotal = this.calculateTotals().total;
      const grandTotal = orderTotal + cartTotal;
      const subEl = closeOrderBtn.querySelector('.pos-action-btn-sub');
      if (subEl) subEl.textContent = `$${grandTotal.toFixed(2)}`;
    }
    if (closeTransferBtn) closeTransferBtn.disabled = this.cart.length > 0;

    // Update mobile FAB badge
    const fabBadge = document.getElementById('fab-cart-count');
    if (fabBadge) {
      const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
      fabBadge.textContent = totalItems;
      fabBadge.style.display = totalItems > 0 ? '' : 'none';
    }
  },

  /**
   * Filtra por categoría
   */
  filterCategory(categoryId) {
    this.selectedCategory = categoryId;

    document.querySelectorAll('.pos-category-btn').forEach((btn) => {
      const btnCat = btn.dataset.category;
      btn.classList.toggle('active', categoryId === null ? btnCat === 'all' : btnCat === String(categoryId));
    });

    // Scroll la categoría activa al centro visible
    const activeBtn = document.querySelector('.pos-category-btn.active');
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    const grid = document.getElementById('pos-products-grid');
    if (grid) grid.innerHTML = this.renderProducts(this.getFilteredProducts());
  },

  /**
   * Scroll horizontal de categorías con flechas
   */
  scrollCategories(direction) {
    const container = document.getElementById('pos-categories');
    if (!container) return;
    const scrollAmount = 200;
    container.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
  },

  /**
   * Inicializa drag-to-scroll y flechas de las categorías
   */
  initCategoryScroll() {
    const container = document.getElementById('pos-categories');
    if (!container) return;

    // Drag-to-scroll
    let isDown = false, startX, scrollLeft;
    container.addEventListener('mousedown', (e) => {
      if (e.target.closest('.pos-category-btn')) return; // no drag desde botones
      isDown = true;
      container.classList.add('grabbing');
      startX = e.pageX - container.offsetLeft;
      scrollLeft = container.scrollLeft;
    });
    container.addEventListener('mouseleave', () => { isDown = false; container.classList.remove('grabbing'); });
    container.addEventListener('mouseup', () => { isDown = false; container.classList.remove('grabbing'); });
    container.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - container.offsetLeft;
      container.scrollLeft = scrollLeft - (x - startX) * 1.5;
    });

    // Mouse wheel → horizontal scroll
    container.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) > 0) {
        e.preventDefault();
        container.scrollBy({ left: e.deltaY * 2, behavior: 'smooth' });
      }
    }, { passive: false });

    // Actualizar visibilidad de flechas
    const updateArrows = () => {
      const left = document.getElementById('cat-arrow-left');
      const right = document.getElementById('cat-arrow-right');
      if (!left || !right) return;
      left.classList.toggle('visible', container.scrollLeft > 5);
      right.classList.toggle('visible', container.scrollLeft < container.scrollWidth - container.clientWidth - 5);
    };
    container.addEventListener('scroll', updateArrows);
    // Inicial check después del render
    setTimeout(updateArrows, 100);
    window.addEventListener('resize', updateArrows);
  },

  /**
   * Búsqueda de productos
   */
  search(term) {
    this.searchTerm = term.toLowerCase();
    const grid = document.getElementById('pos-products-grid');
    if (grid) grid.innerHTML = this.renderProducts(this.getFilteredProducts());
  },

  /**
   * Productos filtrados
   */
  getFilteredProducts() {
    return this.products.filter((p) => {
      const matchCategory = !this.selectedCategory || p.category_id === this.selectedCategory || p.show_in_all_categories;
      const matchSearch = !this.searchTerm || p.name.toLowerCase().includes(this.searchTerm);
      return matchCategory && matchSearch;
    });
  },

  /**
   * Abre modal de pago
   */
  openPaymentModal(method, isClosingOrder = false) {
    // Cerrar ticket móvil antes de abrir el modal de pago
    this.closeMobileCart();

    this.paymentMethod = method;
    this.isClosingOrder = isClosingOrder;
    const totalToPay = isClosingOrder && this.currentOrder
      ? parseFloat(this.currentOrder.total)
      : this.calculateTotals().total;

    document.getElementById('payment-total').textContent = `$${totalToPay.toFixed(2)}`;
    document.getElementById('payment-modal-title').textContent =
      method === 'cash' ? 'Pago en Efectivo' : 'Pago por Transferencia';
    document.getElementById('payment-modal-icon').textContent =
      method === 'cash' ? '💵' : '📱';

    document.getElementById('payment-cash-section').style.display = method === 'cash' ? '' : 'none';
    document.getElementById('payment-transfer-section').style.display = method === 'transfer' ? '' : 'none';

    // Mostrar resumen de consumo cuando es cierre de orden dine-in
    const summaryEl = document.getElementById('pay-order-summary');
    const summaryItemsEl = document.getElementById('pay-summary-items');
    if (isClosingOrder && this.currentOrder && this.currentOrder.items && this.currentOrder.items.length > 0) {
      summaryEl.style.display = '';
      summaryItemsEl.innerHTML = this.currentOrder.items.map(item => {
        const itemPVP = parseFloat(item.subtotal) * (1 + parseFloat(item.tax_rate || 0) / 100);
        return `
        <div class="pay-summary-item">
          <span class="pay-summary-item-qty">${item.quantity}x</span>
          <span class="pay-summary-item-name">${item.product_name}</span>
          <span class="pay-summary-item-price">$${itemPVP.toFixed(2)}</span>
        </div>
      `}).join('');
    } else if (!isClosingOrder && this.cart.length > 0) {
      // Takeaway: mostrar items del carrito con PVP
      summaryEl.style.display = '';
      summaryItemsEl.innerHTML = this.cart.map(item => {
        const pvpSubtotal = item.pvp * item.quantity;
        return `
        <div class="pay-summary-item">
          <span class="pay-summary-item-qty">${item.quantity}x</span>
          <span class="pay-summary-item-name">${item.productName}</span>
          <span class="pay-summary-item-price">$${pvpSubtotal.toFixed(2)}</span>
        </div>
      `}).join('');
    } else {
      summaryEl.style.display = 'none';
    }

    if (method === 'cash') {
      document.getElementById('payment-received').value = '';
      document.getElementById('payment-change').style.display = 'none';
      const clearBtn = document.getElementById('pay-clear-btn');
      if (clearBtn) clearBtn.style.display = 'none';
    }

    document.getElementById('payment-modal').classList.add('active');

    // Focus solo en desktop (en mobile el teclado tapa la pantalla)
    if (window.innerWidth > 768) {
      setTimeout(() => {
        const input = method === 'cash'
          ? document.getElementById('payment-received')
          : document.getElementById('payment-transfer-ref');
        if (input) input.focus();
      }, 300);
    }
  },

  closePaymentModal() {
    document.getElementById('payment-modal').classList.remove('active');
  },

  /**
   * Suma dinero al monto recibido (billetes y monedas)
   */
  addCashAmount(amount) {
    const input = document.getElementById('payment-received');
    if (input) {
      const current = parseFloat(input.value) || 0;
      input.value = (current + amount).toFixed(2);
      this.calculateChange();
      // Mostrar botón limpiar
      const clearBtn = document.getElementById('pay-clear-btn');
      if (clearBtn) clearBtn.style.display = '';
    }
  },

  /**
   * Limpia el monto recibido
   */
  clearCashAmount() {
    const input = document.getElementById('payment-received');
    if (input) {
      input.value = '';
      this.calculateChange();
      const clearBtn = document.getElementById('pay-clear-btn');
      if (clearBtn) clearBtn.style.display = 'none';
    }
  },

  /**
   * Pone el valor justo (exacto al total)
   */
  setExactAmount() {
    const totalToPay = (this.orderType === 'dine_in' && this.currentOrder)
      ? parseFloat(this.currentOrder.total)
      : this.calculateTotals().total;
    const input = document.getElementById('payment-received');
    if (input) {
      input.value = totalToPay.toFixed(2);
      this.calculateChange();
      const clearBtn = document.getElementById('pay-clear-btn');
      if (clearBtn) clearBtn.style.display = '';
    }
  },

  /**
   * Calcula el cambio
   */
  calculateChange() {
    const isClosingOrder = this.orderType === 'dine_in' && this.currentOrder;
    const totalToPay = isClosingOrder
      ? parseFloat(this.currentOrder.total)
      : this.calculateTotals().total;
    const received = parseFloat(document.getElementById('payment-received').value) || 0;
    const change = received - totalToPay;
    const changeEl = document.getElementById('payment-change');
    const changeValue = document.getElementById('payment-change-value');
    const clearBtn = document.getElementById('pay-clear-btn');

    if (clearBtn) clearBtn.style.display = received > 0 ? '' : 'none';

    if (received > 0) {
      changeEl.style.display = '';
      changeValue.textContent = `$${Math.max(0, change).toFixed(2)}`;
      changeValue.className = `pay-change-amount ${change >= 0 ? 'positive' : 'negative'}`;
    } else {
      changeEl.style.display = 'none';
    }
  },

  /**
   * Selecciona una mesa
   */
  async selectTable(tableId) {
    console.log('selectTable called with ID:', tableId);
    const table = this.tables.find(t => t.id === tableId);
    if (!table) {
      console.error('Table not found:', tableId);
      return;
    }
    console.log('Table found:', table);

    this.currentTable = table;
    this.orderType = 'dine_in';
    this.mode = 'ordering';
    this.cart = [];

    // Si tiene orden abierta, cargar sus datos
    if (table.active_sale_id) {
      try {
        const res = await API.get(`/pos/sales/${table.active_sale_id}`);
        if (res && res.data) {
          this.currentOrder = { ...table, ...res.data };
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      this.currentOrder = null;
    }

    this.render(this.container);
  },

  /**
   * Inicia modo Para Llevar
   */
  startTakeaway() {
    console.log('startTakeaway called');
    this.currentTable = null;
    this.currentOrder = null;
    this.orderType = 'takeaway';
    this.mode = 'ordering';
    this.cart = [];
    this.render(this.container);
  },

  /**
   * Vuelve al mapa de mesas
   */
  async backToMap() {
    if (this.cart.length > 0) {
      if (!confirm('Hay items en el carrito. ¿Deseas descartarlos y volver al mapa?')) {
        return;
      }
    }
    this.mode = 'table-map';
    this.cart = [];
    this.currentTable = null;
    this.currentOrder = null;
    this.orderType = null;
    await this.loadData();
    this.render(this.container);
  },

  /**
   * Envía pedido a cocina (dine-in pending)
   */
  async sendToKitchen() {
    if (this.cart.length === 0) return;

    const btn = document.getElementById('btn-send-kitchen');
    btn.disabled = true;
    btn.classList.add('loading');
    btn.querySelector('.pos-action-btn-title').textContent = 'Enviando...';

    try {
      const saleData = {
        items: this.cart.map(item => ({
          productId: item.productId,
          productName: item.productName,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          quantity: item.quantity,
          trackStock: item.trackStock,
          modifiers: item.modifiers || '',
        })),
        orderType: 'dine_in',
        tableId: this.currentTable.id,
        paymentMethod: 'cash', // Se cobrará después
      };

      const res = await API.post('/pos/sales', saleData);
      if (res && res.success) {
        Toast.success(`✅ Pedido enviado a cocina - ${this.currentTable.name}`);
        this.cart = [];
        // Recargar datos de mesas para obtener active_sale_id actualizado
        await this.loadData();
        // Actualizar referencia a la mesa con datos frescos
        const freshTable = this.tables.find(t => t.id === this.currentTable.id);
        if (freshTable) this.currentTable = freshTable;
        await this.selectTable(this.currentTable.id); // Reload con datos frescos
      }
    } catch (err) {
      Toast.error(err.message || 'Error al enviar pedido');
      btn.disabled = false;
      btn.classList.remove('loading');
      btn.querySelector('.pos-action-btn-title').textContent = 'ENVIAR A COCINA';
    }
  },

  /**
   * Agrega items a un pedido existente
   */
  async addItemsToOrder() {
    if (this.cart.length === 0 || !this.currentOrder) return;

    const btn = document.getElementById('btn-add-items');
    btn.disabled = true;
    btn.classList.add('loading');
    btn.querySelector('.pos-action-btn-title').textContent = 'Agregando...';

    try {
      const data = {
        items: this.cart.map(item => ({
          productId: item.productId,
          productName: item.productName,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          quantity: item.quantity,
          trackStock: item.trackStock,
          modifiers: item.modifiers || '',
        })),
      };

      const res = await API.post(`/pos/orders/${this.currentOrder.id}/items`, data);
      if (res && res.success) {
        Toast.success(`✅ Items agregados al pedido`);
        this.cart = [];
        await this.selectTable(this.currentTable.id); // Reload
      }
    } catch (err) {
      Toast.error(err.message || 'Error al agregar items');
      btn.disabled = false;
      btn.innerHTML = '<span>➕ Agregar Items</span>';
    }
  },

  /**
   * Abre modal de cierre de orden (cobro)
   */
  closeOrderModal(method = 'cash') {
    if (!this.currentOrder) return;
    this.openPaymentModal(method, true);
  },

  /**
   * Procesa la venta (takeaway inmediato o cierre de orden dine-in)
   */
  async processSale() {
    const { total } = this.calculateTotals();
    const btn = document.getElementById('btn-process-sale');
    const isClosingOrder = this.orderType === 'dine_in' && this.currentOrder;

    // Validaciones
    if (this.paymentMethod === 'cash') {
      const received = parseFloat(document.getElementById('payment-received').value) || 0;
      const totalToPay = isClosingOrder ? parseFloat(this.currentOrder.total) : total;
      if (received < totalToPay) {
        Toast.warning('El monto recibido es menor al total');
        return;
      }
    }

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div><span class="pay-confirm-text">Procesando...</span>';

    try {
      if (isClosingOrder) {
        // Cerrar orden existente
        const closeData = {
          paymentMethod: this.paymentMethod,
          amountReceived: this.paymentMethod === 'cash'
            ? parseFloat(document.getElementById('payment-received').value)
            : parseFloat(this.currentOrder.total),
          transferRef: this.paymentMethod === 'transfer'
            ? document.getElementById('payment-transfer-ref').value
            : null,
          customerName: document.getElementById('payment-customer-name').value || 'CONSUMIDOR FINAL',
          customerIdNumber: document.getElementById('payment-customer-id').value || '9999999999999',
        };

        const res = await API.post(`/pos/orders/${this.currentOrder.id}/close`, closeData);
        if (res && res.success) {
          Toast.success(`✅ Cuenta cerrada - ${this.currentOrder.sale_number} - $${parseFloat(res.data.total).toFixed(2)}`);
          this.closePaymentModal();
          this.backToMap();
        }
      } else {
        // Venta takeaway inmediata
        const saleData = {
          items: this.cart.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            quantity: item.quantity,
            trackStock: item.trackStock,
            modifiers: item.modifiers || '',
          })),
          orderType: 'takeaway',
          paymentMethod: this.paymentMethod,
          amountReceived: this.paymentMethod === 'cash'
            ? parseFloat(document.getElementById('payment-received').value)
            : total,
          transferRef: this.paymentMethod === 'transfer'
            ? document.getElementById('payment-transfer-ref').value
            : null,
          customerName: document.getElementById('payment-customer-name').value || 'CONSUMIDOR FINAL',
          customerIdNumber: document.getElementById('payment-customer-id').value || '9999999999999',
        };

        const res = await API.post('/pos/sales', saleData);
        if (res && res.success) {
          Toast.success(`✅ Venta ${res.data.sale.sale_number} registrada - $${parseFloat(res.data.sale.total).toFixed(2)}`);
          this.closePaymentModal();
          this.clearCart();
          this.backToMap();
        }
      }
    } catch (err) {
      Toast.error(err.message || 'Error al procesar');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span class="pay-confirm-icon">✅</span><span class="pay-confirm-text">Procesar Venta</span>';
    }
  },

  // ═══════════════════════════════════════════════════════
  //  PERÍODO / JORNADA DE CAJA
  // ═══════════════════════════════════════════════════════

  /**
   * Barra de información del período activo
   */
  renderPeriodBar() {
    const p = this.currentPeriod;
    if (!p) return '';
    const openTime = new Date(p.open_time).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
    const sales = parseFloat(p.total_sales) || 0;
    const orders = parseInt(p.total_orders) || 0;
    const cash = parseFloat(p.cash_total) || 0;
    const transfer = parseFloat(p.transfer_total) || 0;

    return `
      <div class="period-bar">
        <div class="period-bar-left">
          <span class="period-bar-status">🟢 Caja Abierta</span>
          <span class="period-bar-time">desde ${openTime}</span>
          ${p.opened_by_name ? `<span class="period-bar-user">· ${p.opened_by_name}</span>` : ''}
        </div>
        <div class="period-bar-right">
          <span class="period-bar-stat">📦 ${orders}</span>
          <span class="period-bar-stat">💵 $${cash.toFixed(2)}</span>
          <span class="period-bar-stat">🏦 $${transfer.toFixed(2)}</span>
          <span class="period-bar-stat period-bar-total">Total: $${sales.toFixed(2)}</span>
        </div>
      </div>`;
  },

  /**
   * Modal para retiro de efectivo
   */
  async showWithdrawalModal() {
    try {
      await this.loadPeriod();
      if (!this.currentPeriod) {
        Toast.error('No hay período abierto');
        return;
      }

      // Cargar retiros existentes
      let withdrawals = [];
      try {
        const wRes = await API.get('/periods/withdrawals');
        withdrawals = Array.isArray(wRes.data) ? wRes.data : [];
      } catch(e) { /* ok */ }

      const totalRetiros = withdrawals.reduce((s, w) => s + parseFloat(w.amount), 0);
      const p = this.currentPeriod;
      const expectedCash = parseFloat(p.expected_cash) || 0;

      const withdrawalRows = withdrawals.length > 0 ? withdrawals.map(w => {
        const time = new Date(w.created_at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-color);">
          <div>
            <div style="font-weight:600;font-size:0.9rem;">$${parseFloat(w.amount).toFixed(2)}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);">${w.reason || 'Sin motivo'} · ${w.withdrawn_by_name || ''} · ${time}</div>
          </div>
        </div>`;
      }).join('') : '<p style="text-align:center;color:var(--text-muted);font-size:0.85rem;padding:12px 0;">No hay retiros en este período</p>';

      const overlay = document.createElement('div');
      overlay.id = 'withdrawal-overlay';
      overlay.className = 'modal-overlay active';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:16px;opacity:1;visibility:visible;';

      overlay.innerHTML = `
        <div class="card" style="max-width:480px;width:100%;max-height:90vh;overflow-y:auto;padding:var(--space-xl);">
          <div style="text-align:center;margin-bottom:var(--space-lg);">
            <div style="font-size:2.5rem;margin-bottom:8px;">💸</div>
            <h2 style="font-size:1.3rem;margin-bottom:4px;">Retiro de Efectivo</h2>
            <p style="color:var(--text-muted);font-size:0.85rem;">Efectivo disponible en caja: <strong style="color:var(--accent-primary);">$${expectedCash.toFixed(2)}</strong></p>
          </div>

          <!-- Formulario de retiro -->
          <div class="form-group" style="margin-bottom:var(--space-md);">
            <label class="form-label">💵 Monto a Retirar</label>
            <input type="number" class="form-input" id="withdrawal-amount" value="" min="0.01" step="0.01"
                   style="font-size:1.3rem;text-align:center;font-weight:700;" placeholder="0.00" autofocus>
          </div>

          <div class="form-group" style="margin-bottom:var(--space-lg);">
            <label class="form-label">📝 Motivo del Retiro</label>
            <input type="text" class="form-input" id="withdrawal-reason" placeholder="Ej: Retiro parcial, pago proveedor, etc.">
          </div>

          <div style="display:flex;gap:10px;margin-bottom:var(--space-lg);">
            <button class="btn btn-block" onclick="document.getElementById('withdrawal-overlay').remove()"
                    style="background:var(--bg-secondary);color:var(--text-secondary);border:1px solid var(--border-color);padding:14px;">
              Cancelar
            </button>
            <button class="btn btn-primary btn-block" id="btn-do-withdrawal" onclick="POS.doWithdrawal()"
                    style="padding:14px;font-weight:700;background:#f59e0b;border-color:#f59e0b;">
              💸 Registrar Retiro
            </button>
          </div>

          <!-- Historial de retiros -->
          ${withdrawals.length > 0 ? `
          <div style="border-top:1px solid var(--border-color);padding-top:var(--space-md);">
            <h3 style="font-size:0.9rem;margin-bottom:var(--space-sm);color:var(--text-muted);">
              📋 Retiros de Hoy (${withdrawals.length}) · Total: $${totalRetiros.toFixed(2)}
            </h3>
            ${withdrawalRows}
          </div>
          ` : ''}
        </div>
      `;

      document.body.appendChild(overlay);
      // Focus en el input
      setTimeout(() => document.getElementById('withdrawal-amount')?.focus(), 100);
    } catch (err) {
      console.error('Error showWithdrawalModal:', err);
      Toast.error('Error al abrir retiro de efectivo');
    }
  },

  /**
   * Ejecuta el retiro de efectivo
   */
  async doWithdrawal() {
    const btn = document.getElementById('btn-do-withdrawal');
    if (btn) { btn.disabled = true; btn.textContent = 'Registrando...'; }

    const amount = parseFloat(document.getElementById('withdrawal-amount')?.value);
    const reason = document.getElementById('withdrawal-reason')?.value || '';

    if (!amount || amount <= 0) {
      Toast.error('Ingrese un monto válido');
      if (btn) { btn.disabled = false; btn.textContent = '💸 Registrar Retiro'; }
      return;
    }

    try {
      await API.post('/periods/withdrawals', { amount, reason });

      // Cerrar modal
      document.getElementById('withdrawal-overlay')?.remove();

      Toast.success(`✅ Retiro de $${amount.toFixed(2)} registrado`);

      // Refrescar datos del período
      await this.loadPeriod();
    } catch (err) {
      Toast.error(err.message || 'Error registrando retiro');
      if (btn) { btn.disabled = false; btn.textContent = '💸 Registrar Retiro'; }
    }
  },

  /**
   * Modal para cerrar caja / período
   */
  async showClosePeriodModal() {
    try {
      // Refrescar datos del período
      await this.loadPeriod();
      const p = this.currentPeriod;
      if (!p) {
        Toast.error('No hay período abierto');
        return;
      }

    const expectedCash = parseFloat(p.expected_cash) || 0;
    const sales = parseFloat(p.total_sales) || 0;
    const orders = parseInt(p.total_orders) || 0;
    const cash = parseFloat(p.cash_total) || 0;
    const transfer = parseFloat(p.transfer_total) || 0;
    const voided = parseFloat(p.voided_total) || 0;
    const voidedCount = parseInt(p.voided_count) || 0;
    const pending = parseInt(p.pending_count) || 0;
    const opening = parseFloat(p.opening_cash) || 0;
    const totalWithdrawals = parseFloat(p.total_withdrawals) || 0;
    const withdrawalCount = parseInt(p.withdrawal_count) || 0;
    const openTime = new Date(p.open_time).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });

    // Crear modal
    const overlay = document.createElement('div');
    overlay.id = 'close-period-overlay';
    overlay.className = 'modal-overlay active';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:16px;opacity:1;visibility:visible;';
    
    overlay.innerHTML = `
      <div class="card" style="max-width:520px;width:100%;max-height:90vh;overflow-y:auto;padding:var(--space-xl);">
        <div style="text-align:center;margin-bottom:var(--space-lg);">
          <div style="font-size:2.5rem;margin-bottom:8px;">🔒</div>
          <h2 style="font-size:1.3rem;margin-bottom:4px;">Cerrar Caja</h2>
          <p style="color:var(--text-muted);font-size:0.85rem;">Resumen del período · Abierto a las ${openTime}</p>
        </div>

        ${pending > 0 ? `
        <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:12px;margin-bottom:var(--space-md);text-align:center;">
          <strong style="color:#ef4444;">⚠️ Hay ${pending} pedido(s) pendiente(s)</strong>
          <p style="color:var(--text-muted);font-size:0.8rem;margin-top:4px;">Cierre o cancele los pedidos antes de cerrar la caja</p>
        </div>
        ` : ''}

        <!-- Resumen -->
        <div style="background:var(--bg-primary);border-radius:10px;padding:16px;margin-bottom:var(--space-lg);">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div style="text-align:center;padding:10px;background:var(--bg-secondary);border-radius:8px;">
              <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">Caja Inicial</div>
              <div style="font-size:1.1rem;font-weight:700;">$${opening.toFixed(2)}</div>
            </div>
            <div style="text-align:center;padding:10px;background:var(--bg-secondary);border-radius:8px;">
              <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">Órdenes</div>
              <div style="font-size:1.1rem;font-weight:700;">${orders}</div>
            </div>
            <div style="text-align:center;padding:10px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:8px;">
              <div style="font-size:0.75rem;color:#10b981;margin-bottom:4px;">💵 Efectivo</div>
              <div style="font-size:1.1rem;font-weight:700;color:#10b981;">$${cash.toFixed(2)}</div>
            </div>
            <div style="text-align:center;padding:10px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);border-radius:8px;">
              <div style="font-size:0.75rem;color:#3b82f6;margin-bottom:4px;">🏦 Transferencia</div>
              <div style="font-size:1.1rem;font-weight:700;color:#3b82f6;">$${transfer.toFixed(2)}</div>
            </div>
          </div>

          <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:700;font-size:1rem;">Venta Total:</span>
            <span style="font-weight:800;font-size:1.3rem;color:var(--accent-primary);">$${sales.toFixed(2)}</span>
          </div>
          ${voidedCount > 0 ? `
          <div style="margin-top:8px;display:flex;justify-content:space-between;font-size:0.85rem;">
            <span style="color:#ef4444;">Anuladas (${voidedCount}):</span>
            <span style="color:#ef4444;">-$${voided.toFixed(2)}</span>
          </div>` : ''}
          ${withdrawalCount > 0 ? `
          <div style="margin-top:8px;display:flex;justify-content:space-between;font-size:0.85rem;">
            <span style="color:#f59e0b;">💸 Retiros (${withdrawalCount}):</span>
            <span style="color:#f59e0b;">-$${totalWithdrawals.toFixed(2)}</span>
          </div>` : ''}

          <div style="margin-top:12px;padding:10px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);border-radius:8px;text-align:center;">
            <div style="font-size:0.75rem;color:var(--accent-primary);margin-bottom:4px;">Efectivo Esperado en Caja</div>
            <div style="font-size:1.4rem;font-weight:800;color:var(--accent-primary);">$${expectedCash.toFixed(2)}</div>
            <div style="font-size:0.72rem;color:var(--text-muted);">($${opening.toFixed(2)} inicial + $${cash.toFixed(2)} ventas${withdrawalCount > 0 ? ` - $${totalWithdrawals.toFixed(2)} retiros` : ''})</div>
          </div>
        </div>

        <!-- Conteo de caja -->
        <div class="form-group" style="margin-bottom:var(--space-md);">
          <label class="form-label">💵 Efectivo Contado en Caja</label>
          <input type="number" class="form-input" id="closing-cash" value="" min="0" step="0.01"
                 style="font-size:1.3rem;text-align:center;font-weight:700;" placeholder="${expectedCash.toFixed(2)}"
                 oninput="POS.updateCashDifference()">
          <div id="cash-difference" style="text-align:center;margin-top:6px;font-size:0.85rem;font-weight:600;"></div>
        </div>

        <div class="form-group" style="margin-bottom:var(--space-lg);">
          <label class="form-label">📝 Notas de Cierre (opcional)</label>
          <input type="text" class="form-input" id="closing-notes" placeholder="Observaciones del cierre">
        </div>

        <div style="display:flex;gap:10px;">
          <button class="btn btn-block" onclick="document.getElementById('close-period-overlay').remove()"
                  style="background:var(--bg-secondary);color:var(--text-secondary);border:1px solid var(--border-color);padding:14px;">
            Cancelar
          </button>
          <button class="btn btn-primary btn-block" id="btn-close-period" onclick="POS.doClosePeriod()"
                  style="padding:14px;font-weight:700;${pending > 0 ? 'opacity:0.5;pointer-events:none;' : ''}">
            🔒 Cerrar Caja
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    } catch (err) {
      console.error('Error showClosePeriodModal:', err);
      Toast.error('Error al abrir cierre de caja');
    }
  },

  /**
   * Actualiza la diferencia en el modal de cierre
   */
  updateCashDifference() {
    const input = document.getElementById('closing-cash');
    const diffEl = document.getElementById('cash-difference');
    if (!input || !diffEl || !this.currentPeriod) return;

    const counted = parseFloat(input.value);
    if (isNaN(counted)) { diffEl.textContent = ''; return; }

    const expected = parseFloat(this.currentPeriod.expected_cash) || 0;
    const diff = counted - expected;

    if (Math.abs(diff) < 0.01) {
      diffEl.innerHTML = '<span style="color:#10b981;">✅ Caja cuadrada</span>';
    } else if (diff > 0) {
      diffEl.innerHTML = `<span style="color:#3b82f6;">📈 Sobrante: +$${diff.toFixed(2)}</span>`;
    } else {
      diffEl.innerHTML = `<span style="color:#ef4444;">📉 Faltante: -$${Math.abs(diff).toFixed(2)}</span>`;
    }
  },

  /**
   * Ejecuta el cierre de caja / período
   */
  async doClosePeriod() {
    const btn = document.getElementById('btn-close-period');
    if (btn) { btn.disabled = true; btn.textContent = 'Cerrando...'; }

    const closingCash = parseFloat(document.getElementById('closing-cash')?.value) || 0;
    const notes = document.getElementById('closing-notes')?.value || '';

    try {
      const res = await API.post('/periods/close', { closingCash, notes });
      
      // Remover modal de cierre
      document.getElementById('close-period-overlay')?.remove();

      // Mostrar resumen final
      const d = res.data;
      const diff = parseFloat(d.difference) || 0;
      const diffText = Math.abs(diff) < 0.01 ? '✅ Caja cuadrada'
        : diff > 0 ? `📈 Sobrante: +$${diff.toFixed(2)}`
        : `📉 Faltante: -$${Math.abs(diff).toFixed(2)}`;
      const diffColor = Math.abs(diff) < 0.01 ? '#10b981' : diff > 0 ? '#3b82f6' : '#ef4444';

      this.currentPeriod = null;

      // Mostrar pantalla de resumen
      if (this.container) {
        this.container.innerHTML = `
          <div class="floor-plan-view" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:calc(100vh - var(--header-height));">
            <div class="card" style="max-width:480px;width:100%;padding:var(--space-xl);text-align:center;">
              <div style="font-size:3rem;margin-bottom:var(--space-md);">✅</div>
              <h2 style="margin-bottom:var(--space-xs);">Caja Cerrada</h2>
              <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:var(--space-lg);">Período finalizado correctamente</p>

              <div style="background:var(--bg-primary);border-radius:10px;padding:16px;margin-bottom:var(--space-lg);text-align:left;">
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-color);">
                  <span style="color:var(--text-muted);">Caja Inicial:</span>
                  <span style="font-weight:600;">$${parseFloat(d.opening_cash).toFixed(2)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-color);">
                  <span style="color:var(--text-muted);">Órdenes:</span>
                  <span style="font-weight:600;">${d.total_orders}</span>
                </div>
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-color);">
                  <span style="color:var(--text-muted);">Venta Total:</span>
                  <span style="font-weight:700;color:var(--accent-primary);">$${parseFloat(d.total_sales).toFixed(2)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-color);">
                  <span style="color:var(--text-muted);">💵 Efectivo:</span>
                  <span style="font-weight:600;">$${parseFloat(d.cash_total).toFixed(2)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-color);">
                  <span style="color:var(--text-muted);">🏦 Transferencia:</span>
                  <span style="font-weight:600;">$${parseFloat(d.transfer_total).toFixed(2)}</span>
                </div>
                ${parseFloat(d.total_withdrawals) > 0 ? `
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-color);">
                  <span style="color:#f59e0b;">💸 Retiros:</span>
                  <span style="font-weight:600;color:#f59e0b;">-$${parseFloat(d.total_withdrawals).toFixed(2)}</span>
                </div>
                ` : ''}
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-color);">
                  <span style="color:var(--text-muted);">Esperado en Caja:</span>
                  <span style="font-weight:700;">$${parseFloat(d.expected_cash).toFixed(2)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-color);">
                  <span style="color:var(--text-muted);">Contado en Caja:</span>
                  <span style="font-weight:700;">$${parseFloat(d.closing_cash).toFixed(2)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;padding:8px 0;">
                  <span style="font-weight:700;">Diferencia:</span>
                  <span style="font-weight:800;color:${diffColor};">${diffText}</span>
                </div>
              </div>

              <button class="btn btn-primary btn-block" onclick="POS.init(POS.container)" style="padding:14px;font-size:1.05rem;">
                🔓 Abrir Nuevo Período
              </button>
            </div>
          </div>
        `;
      }

      Toast.success('✅ Caja cerrada exitosamente');
    } catch (err) {
      Toast.error(err.message || 'Error cerrando caja');
      if (btn) { btn.disabled = false; btn.textContent = '🔒 Cerrar Caja'; }
    }
  },

  bindEvents() {
    console.log('POS.bindEvents called');
    
    // Event delegation para clicks en el POS
    document.addEventListener('click', (e) => {
      if (App.currentPage !== 'pos') return;
      
      const target = e.target.closest('[data-action]');
      if (!target) return;
      
      const action = target.dataset.action;
      console.log('POS action clicked:', action);
      
      switch (action) {
        case 'select-table':
          const tableId = parseInt(target.dataset.tableId);
          console.log('Selecting table:', tableId);
          if (tableId) this.selectTable(tableId);
          break;
        case 'start-takeaway':
          console.log('Starting takeaway mode');
          this.startTakeaway();
          break;
      }
    });

    // Atajos de teclado
    document.addEventListener('keydown', (e) => {
      if (App.currentPage !== 'pos') return;

      if (e.key === 'F2') {
        e.preventDefault();
        if (this.cart.length > 0) this.openPaymentModal('cash');
      }
      if (e.key === 'F3') {
        e.preventDefault();
        if (this.cart.length > 0) this.openPaymentModal('transfer');
      }
      if (e.key === 'Escape') {
        this.closePaymentModal();
      }
      if (e.key === 'F4') {
        e.preventDefault();
        document.getElementById('pos-search')?.focus();
      }
    });
  },
};

window.POS = POS;

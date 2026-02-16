/**
 * ═══════════════════════════════════════════════════════
 *  Reports Module - Sistema Avanzado de Reportes
 *  Financieros · Operacionales · Estratégicos
 * ═══════════════════════════════════════════════════════
 */

const Reports = {
  data: {},
  currentTab: 'financial',
  currentPeriod: 'today',

  async init(container) {
    this.container = container;
    await this.loadAllData();
    this.render();
  },

  async loadAllData() {
    try {
      const p = this.currentPeriod;
      const [pnl, pnlTrend, cashFlow, salesByHour, ticketStats, abc, menuEng, comparison, topProducts, orderTypes] = await Promise.all([
        API.get(`/reports/pnl?period=${p}`),
        API.get('/reports/pnl-trend?days=7'),
        API.get(`/reports/cash-flow?period=${p}`),
        API.get(`/reports/sales-by-hour?period=${p}`),
        API.get(`/reports/ticket-stats?period=${p}`),
        API.get(`/reports/abc?period=${p}`),
        API.get(`/reports/menu-engineering?period=${p}`),
        API.get('/reports/comparison'),
        API.get(`/reports/top-products?period=${p}&limit=10`),
        API.get(`/reports/order-types?period=${p}`),
      ]);
      this.data = {
        pnl: pnl.data || {},
        pnlTrend: pnlTrend.data || [],
        cashFlow: cashFlow.data || {},
        salesByHour: salesByHour.data || {},
        ticketStats: ticketStats.data || {},
        abc: abc.data || {},
        menuEng: menuEng.data || {},
        comparison: comparison.data || {},
        topProducts: topProducts.data || [],
        orderTypes: orderTypes.data || {},
      };
    } catch (err) {
      Toast.error('Error cargando reportes');
    }
  },

  async changePeriod(period) {
    this.currentPeriod = period;
    await this.loadAllData();
    this.render();
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.report-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.getElementById('report-content').innerHTML = this.renderTabContent();
  },

  render() {
    const pnl = this.data.pnl || {};
    const profitColor = pnl.netProfit >= 0 ? '#10b981' : '#ef4444';

    this.container.innerHTML = `
      <div class="page-content">
        <div class="page-header">
          <div>
            <h2 class="page-title">📊 Reportes Avanzados</h2>
            <p class="page-description">Análisis financiero, operacional y estratégico</p>
          </div>
        </div>

        <!-- Filtro de período -->
        <div style="display:flex;gap:8px;margin-bottom:var(--space-lg);flex-wrap:wrap">
          ${['today', 'week', 'month', 'year'].map(p => `
            <button class="pos-category-btn ${this.currentPeriod === p ? 'active' : ''}" onclick="Reports.changePeriod('${p}')">${{ today: '📅 Hoy', week: '📆 Semana', month: '🗓️ Mes', year: '📈 Año' }[p]}</button>
          `).join('')}
        </div>

        <!-- KPIs Principales (siempre visibles) -->
        <div class="stats-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:var(--space-lg)">
          <div class="stat-card">
            <div class="stat-icon success">💰</div>
            <div>
              <div class="stat-value">$${pnl.revenue?.toFixed(2) || '0.00'}</div>
              <div class="stat-label">Ingresos (${pnl.totalSales || 0} ventas)</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon danger">📉</div>
            <div>
              <div class="stat-value" style="color:#ef4444">$${pnl.expenses?.total?.toFixed(2) || '0.00'}</div>
              <div class="stat-label">Gastos Totales</div>
            </div>
          </div>
          <div class="stat-card" style="border-left:3px solid ${profitColor}">
            <div class="stat-icon" style="background:${profitColor}22;color:${profitColor}">💵</div>
            <div>
              <div class="stat-value" style="color:${profitColor}">$${pnl.netProfit?.toFixed(2) || '0.00'}</div>
              <div class="stat-label">Ganancia Neta (${pnl.marginPct || 0}%)</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon ${(pnl.foodCostPct || 0) > 35 ? 'danger' : 'success'}">🍖</div>
            <div>
              <div class="stat-value">${pnl.foodCostPct || 0}%</div>
              <div class="stat-label">Food Cost ${(pnl.foodCostPct || 0) > 35 ? '⚠️ Alto' : '✅'}</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon ${(pnl.laborCostPct || 0) > 30 ? 'danger' : 'success'}">👷</div>
            <div>
              <div class="stat-value">${pnl.laborCostPct || 0}%</div>
              <div class="stat-label">Labor Cost ${(pnl.laborCostPct || 0) > 30 ? '⚠️ Alto' : '✅'}</div>
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:4px;margin-bottom:var(--space-lg);border-bottom:2px solid var(--border-color);padding-bottom:2px">
          <button class="report-tab ${this.currentTab === 'financial' ? 'active' : ''}" data-tab="financial" onclick="Reports.switchTab('financial')" style="padding:10px 20px;border:none;background:${this.currentTab === 'financial' ? 'var(--accent-primary)' : 'transparent'};color:${this.currentTab === 'financial' ? '#fff' : 'var(--text-secondary)'};border-radius:8px 8px 0 0;cursor:pointer;font-weight:600">💰 Financiero</button>
          <button class="report-tab ${this.currentTab === 'operational' ? 'active' : ''}" data-tab="operational" onclick="Reports.switchTab('operational')" style="padding:10px 20px;border:none;background:${this.currentTab === 'operational' ? 'var(--accent-primary)' : 'transparent'};color:${this.currentTab === 'operational' ? '#fff' : 'var(--text-secondary)'};border-radius:8px 8px 0 0;cursor:pointer;font-weight:600">📦 Operacional</button>
          <button class="report-tab ${this.currentTab === 'strategic' ? 'active' : ''}" data-tab="strategic" onclick="Reports.switchTab('strategic')" style="padding:10px 20px;border:none;background:${this.currentTab === 'strategic' ? 'var(--accent-primary)' : 'transparent'};color:${this.currentTab === 'strategic' ? '#fff' : 'var(--text-secondary)'};border-radius:8px 8px 0 0;cursor:pointer;font-weight:600">📈 Estratégico</button>
        </div>

        <div id="report-content">
          ${this.renderTabContent()}
        </div>
      </div>
    `;
  },

  renderTabContent() {
    switch (this.currentTab) {
      case 'financial': return this.renderFinancial();
      case 'operational': return this.renderOperational();
      case 'strategic': return this.renderStrategic();
      default: return '';
    }
  },

  // ════════════════════════════════════════════════════
  //  💰 TAB FINANCIERO
  // ════════════════════════════════════════════════════
  renderFinancial() {
    const pnl = this.data.pnl || {};
    const cf = this.data.cashFlow || {};
    const trend = this.data.pnlTrend || [];
    const exp = pnl.expenses || {};

    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-lg)">
        <!-- P&L Detallado -->
        <div class="card">
          <div class="card-header"><h3 class="card-title">📋 Estado de Resultados (P&L)</h3></div>
          <div style="padding:var(--space-md)">
            <table class="data-table" style="margin:0">
              <tbody>
                <tr style="background:rgba(16,185,129,0.05)"><td class="fw-bold" style="font-size:1.1em">🟢 INGRESOS</td><td class="fw-bold text-right" style="font-size:1.1em;color:#10b981">$${pnl.revenue?.toFixed(2) || '0.00'}</td></tr>
                <tr><td colspan="2" style="padding:4px;font-weight:700;color:var(--text-muted)">🔴 GASTOS</td></tr>
                <tr><td style="padding-left:24px">🍖 Compras de insumos</td><td class="text-right" style="color:#ef4444">-$${exp.inventory?.toFixed(2) || '0.00'}</td></tr>
                <tr><td style="padding-left:24px">🏢 Inversiones / Gastos</td><td class="text-right" style="color:#ef4444">-$${exp.investments?.toFixed(2) || '0.00'}</td></tr>
                <tr><td style="padding-left:24px">👷 Nómina Pagada</td><td class="text-right" style="color:#ef4444">-$${exp.payroll?.toFixed(2) || '0.00'}</td></tr>
                <tr style="border-top:2px solid var(--border-color)"><td class="fw-bold">Total Gastos</td><td class="fw-bold text-right" style="color:#ef4444">-$${exp.total?.toFixed(2) || '0.00'}</td></tr>
                <tr style="background:${pnl.netProfit >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'};border-top:3px double var(--border-color)">
                  <td class="fw-bold" style="font-size:1.2em">${pnl.netProfit >= 0 ? '✅' : '❌'} GANANCIA NETA</td>
                  <td class="fw-bold text-right" style="font-size:1.2em;color:${pnl.netProfit >= 0 ? '#10b981' : '#ef4444'}">$${pnl.netProfit?.toFixed(2) || '0.00'}</td>
                </tr>
                <tr><td>Margen de Ganancia</td><td class="fw-bold text-right">${pnl.marginPct || 0}%</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Cash Flow -->
        <div class="card">
          <div class="card-header"><h3 class="card-title">💳 Flujo de Caja</h3></div>
          <div style="padding:var(--space-md)">
            <table class="data-table" style="margin:0">
              <thead><tr><th></th><th class="text-right">💵 Efectivo</th><th class="text-right">📱 Transfer.</th><th class="text-right">Total</th></tr></thead>
              <tbody>
                <tr style="background:rgba(16,185,129,0.05)">
                  <td class="fw-bold">Ingresos</td>
                  <td class="text-right fw-bold" style="color:#10b981">$${cf.income?.cash?.toFixed(2) || '0.00'}</td>
                  <td class="text-right fw-bold" style="color:#3b82f6">$${cf.income?.transfer?.toFixed(2) || '0.00'}</td>
                  <td class="text-right fw-bold">$${cf.income?.total?.toFixed(2) || '0.00'}</td>
                </tr>
                <tr style="background:rgba(239,68,68,0.05)">
                  <td class="fw-bold">Egresos</td>
                  <td class="text-right" style="color:#ef4444">-$${cf.expenses?.cash?.toFixed(2) || '0.00'}</td>
                  <td class="text-right" style="color:#ef4444">-$${cf.expenses?.transfer?.toFixed(2) || '0.00'}</td>
                  <td class="text-right" style="color:#ef4444">-$${cf.expenses?.total?.toFixed(2) || '0.00'}</td>
                </tr>
                <tr style="border-top:2px solid var(--border-color)">
                  <td class="fw-bold">Neto</td>
                  <td class="text-right fw-bold" style="color:${(cf.netCash || 0) >= 0 ? '#10b981' : '#ef4444'}">$${cf.netCash?.toFixed(2) || '0.00'}</td>
                  <td class="text-right fw-bold" style="color:${(cf.netTransfer || 0) >= 0 ? '#10b981' : '#ef4444'}">$${cf.netTransfer?.toFixed(2) || '0.00'}</td>
                  <td class="text-right fw-bold" style="color:${(cf.netTotal || 0) >= 0 ? '#10b981' : '#ef4444'}">$${cf.netTotal?.toFixed(2) || '0.00'}</td>
                </tr>
              </tbody>
            </table>

            <!-- KPIs visuales -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:var(--space-lg)">
              <div style="text-align:center;padding:16px;background:var(--bg-primary);border-radius:10px">
                <div class="text-muted fs-xs">Food Cost %</div>
                <div style="font-size:2rem;font-weight:800;color:${(this.data.pnl?.foodCostPct || 0) > 35 ? '#ef4444' : '#10b981'}">${this.data.pnl?.foodCostPct || 0}%</div>
                <div class="fs-xs" style="color:var(--text-muted)">Ideal: &lt; 30-35%</div>
              </div>
              <div style="text-align:center;padding:16px;background:var(--bg-primary);border-radius:10px">
                <div class="text-muted fs-xs">Labor Cost %</div>
                <div style="font-size:2rem;font-weight:800;color:${(this.data.pnl?.laborCostPct || 0) > 30 ? '#ef4444' : '#10b981'}">${this.data.pnl?.laborCostPct || 0}%</div>
                <div class="fs-xs" style="color:var(--text-muted)">Ideal: &lt; 25-30%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tendencia de Ganancia 7 días -->
      <div class="card" style="margin-top:var(--space-lg)">
        <div class="card-header"><h3 class="card-title">📈 Tendencia de Ganancia - Últimos 7 Días</h3></div>
        <div style="padding:var(--space-md)">
          <div style="display:flex;align-items:end;gap:4px;height:180px;padding:0 8px">
            ${trend.map(d => {
      const maxVal = Math.max(...trend.map(t => Math.max(Math.abs(parseFloat(t.profit)), parseFloat(t.revenue))));
      const revH = maxVal > 0 ? (parseFloat(d.revenue) / maxVal * 150) : 0;
      const profit = parseFloat(d.profit);
      const profitH = maxVal > 0 ? (Math.abs(profit) / maxVal * 150) : 0;
      const dayName = new Date(d.date).toLocaleDateString('es-EC', { weekday: 'short' });
      return `
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
                <div class="fs-xs fw-bold" style="color:${profit >= 0 ? '#10b981' : '#ef4444'}">$${profit.toFixed(0)}</div>
                <div style="width:100%;display:flex;gap:2px;align-items:end;height:150px">
                  <div style="flex:1;background:rgba(59,130,246,0.3);height:${revH}px;border-radius:4px 4px 0 0" title="Ingresos: $${parseFloat(d.revenue).toFixed(2)}"></div>
                  <div style="flex:1;background:${profit >= 0 ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)'};height:${profitH}px;border-radius:4px 4px 0 0" title="Ganancia: $${profit.toFixed(2)}"></div>
                </div>
                <div class="fs-xs text-muted">${dayName}</div>
              </div>`;
    }).join('')}
          </div>
          <div style="display:flex;gap:16px;justify-content:center;margin-top:8px">
            <span class="fs-xs"><span style="display:inline-block;width:12px;height:12px;background:rgba(59,130,246,0.3);border-radius:2px"></span> Ingresos</span>
            <span class="fs-xs"><span style="display:inline-block;width:12px;height:12px;background:rgba(16,185,129,0.5);border-radius:2px"></span> Ganancia</span>
          </div>
        </div>
      </div>
    `;
  },

  // ════════════════════════════════════════════════════
  //  📦 TAB OPERACIONAL
  // ════════════════════════════════════════════════════
  renderOperational() {
    const hourData = this.data.salesByHour?.hours || [];
    const peak = this.data.salesByHour?.peakHour || {};
    const ticket = this.data.ticketStats || {};
    const abc = this.data.abc || {};
    const topProducts = this.data.topProducts || [];
    const orderTypes = this.data.orderTypes?.breakdown || [];

    return `
      <!-- Stats operacionales -->
      <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:var(--space-lg)">
        <div class="stat-card">
          <div class="stat-icon success">🎫</div>
          <div>
            <div class="stat-value">$${parseFloat(ticket.avg_ticket || 0).toFixed(2)}</div>
            <div class="stat-label">Ticket Promedio</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon info">📊</div>
          <div>
            <div class="stat-value">${parseFloat(ticket.avg_items || 0).toFixed(1)}</div>
            <div class="stat-label">Items por Ticket</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon warning">⏰</div>
          <div>
            <div class="stat-value">${peak.label || '--:--'}</div>
            <div class="stat-label">Hora Pico (${peak.sales || 0} ventas)</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon accent">🏆</div>
          <div>
            <div class="stat-value">${topProducts[0]?.product_name || '-'}</div>
            <div class="stat-label">Más Vendido</div>
          </div>
        </div>
      </div>

      <!-- Tipos de Servicio (Dine-in vs Takeaway) -->
      ${orderTypes.length > 0 ? `
      <div class="card" style="margin-bottom:var(--space-lg)">
        <div class="card-header"><h3 class="card-title">🍽️ Tipo de Servicio</h3></div>
        <div style="display:grid;grid-template-columns:300px 1fr;gap:var(--space-lg);padding:var(--space-md)">
          <!-- Dona chart simulado -->
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center">
            <div style="position:relative;width:200px;height:200px;border-radius:50%;background:conic-gradient(${orderTypes.map((type, i) => {
              const colors = { dine_in: '#10b981', takeaway: '#fb923c' };
              const color = colors[type.order_type] || '#6b7280';
              const prevPct = orderTypes.slice(0, i).reduce((sum, t) => sum + (t.percentage || 0), 0);
              const currPct = type.percentage || 0;
              return `${color} ${prevPct}% ${prevPct + currPct}%`;
            }).join(', ')});display:flex;align-items:center;justify-content:center">
              <div style="width:100px;height:100px;background:white;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center">
                <div style="font-size:1.5rem;font-weight:700">${orderTypes.reduce((sum, t) => sum + (t.count || 0), 0)}</div>
                <div style="font-size:0.7rem;color:var(--color-text-secondary)">Ventas</div>
              </div>
            </div>
            <div style="margin-top:var(--space-md);display:flex;flex-direction:column;gap:8px;width:100%">
              ${orderTypes.map(type => {
                const labels = { dine_in: '🏠 Mesas', takeaway: '📦 Para Llevar' };
                const colors = { dine_in: '#10b981', takeaway: '#fb923c' };
                return `
                  <div style="display:flex;align-items:center;gap:8px">
                    <div style="width:12px;height:12px;border-radius:50%;background:${colors[type.order_type]}"></div>
                    <div style="flex:1;font-size:0.9rem">${labels[type.order_type] || type.order_type}</div>
                    <div style="font-weight:700">${type.percentage}%</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
          
          <!-- Detalles -->
          <div>
            <table class="data-table" style="margin:0">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th class="text-right">Cantidad</th>
                  <th class="text-right">% Cantidad</th>
                  <th class="text-right">Ingresos</th>
                  <th class="text-right">% Ingresos</th>
                  <th class="text-right">Ticket Prom.</th>
                </tr>
              </thead>
              <tbody>
                ${orderTypes.map(type => {
                  const labels = { dine_in: '🏠 Mesas (Dine-in)', takeaway: '📦 Para Llevar' };
                  const colors = { dine_in: '#10b981', takeaway: '#fb923c' };
                  return `
                    <tr>
                      <td><strong style="color:${colors[type.order_type]}">${labels[type.order_type] || type.order_type}</strong></td>
                      <td class="text-right fw-bold">${type.count}</td>
                      <td class="text-right">${type.count_percentage}%</td>
                      <td class="text-right fw-bold" style="color:${colors[type.order_type]}">$${parseFloat(type.total_revenue).toFixed(2)}</td>
                      <td class="text-right">${type.percentage}%</td>
                      <td class="text-right">$${parseFloat(type.avg_ticket).toFixed(2)}</td>
                    </tr>
                  `;
                }).join('')}
                <tr style="border-top:2px solid var(--color-border);font-weight:700">
                  <td>TOTAL</td>
                  <td class="text-right">${this.data.orderTypes?.totals?.count || 0}</td>
                  <td class="text-right">100%</td>
                  <td class="text-right">$${parseFloat(this.data.orderTypes?.totals?.revenue || 0).toFixed(2)}</td>
                  <td class="text-right">100%</td>
                  <td class="text-right">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      ` : ''}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-lg)">
        <!-- Ventas por Hora -->
        <div class="card">
          <div class="card-header"><h3 class="card-title">⏰ Ventas por Hora</h3></div>
          <div style="padding:var(--space-md)">
            <div style="display:flex;align-items:end;gap:2px;height:160px">
              ${hourData.filter(h => h.hour >= 6 && h.hour <= 23).map(h => {
      const maxSales = Math.max(...hourData.map(x => x.sales));
      const height = maxSales > 0 ? (h.sales / maxSales * 140) : 0;
      const isPeak = h.hour === peak.hour;
      return `
                  <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:end;height:100%">
                    ${h.sales > 0 ? `<div class="fs-xs fw-bold" style="color:${isPeak ? 'var(--accent-primary)' : 'var(--text-muted)'}">${h.sales}</div>` : ''}
                    <div style="width:100%;height:${Math.max(height, 2)}px;background:${isPeak ? 'var(--accent-primary)' : 'rgba(59,130,246,0.4)'};border-radius:3px 3px 0 0;transition:all 0.3s" title="${h.label}: ${h.sales} ventas - $${h.revenue.toFixed(2)}"></div>
                    <div class="fs-xs text-muted" style="transform:rotate(-45deg);margin-top:4px">${h.hour}</div>
                  </div>`;
    }).join('')}
            </div>
          </div>
        </div>

        <!-- Top Productos -->
        <div class="card">
          <div class="card-header"><h3 class="card-title">🏆 Top 10 Productos</h3></div>
          <div class="table-wrapper">
            <table class="data-table">
              <thead><tr><th>#</th><th>Producto</th><th>Qty</th><th>Ingresos</th></tr></thead>
              <tbody>
                ${topProducts.map((p, i) => {
      const medals = ['🥇', '🥈', '🥉'];
      return `<tr><td>${medals[i] || (i + 1)}</td><td class="fw-bold">${p.product_name}</td><td>${p.total_quantity}</td><td class="text-accent fw-bold">$${parseFloat(p.total_revenue).toFixed(2)}</td></tr>`;
    }).join('')}
                ${topProducts.length === 0 ? '<tr><td colspan="4" class="text-center text-muted" style="padding:20px">Sin ventas</td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ABC de Productos -->
      <div class="card" style="margin-top:var(--space-lg)">
        <div class="card-header">
          <h3 class="card-title">🔤 Análisis ABC de Productos</h3>
          <div style="display:flex;gap:12px">
            <span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981;padding:4px 12px">A: ${abc.summary?.a_count || 0} (80% ventas)</span>
            <span class="badge" style="background:rgba(245,158,11,0.15);color:#f59e0b;padding:4px 12px">B: ${abc.summary?.b_count || 0} (15%)</span>
            <span class="badge" style="background:rgba(239,68,68,0.15);color:#ef4444;padding:4px 12px">C: ${abc.summary?.c_count || 0} (5%)</span>
          </div>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr><th>Clase</th><th>Producto</th><th>Qty</th><th>Ingresos</th><th>% Ingresos</th><th>% Acum.</th></tr></thead>
            <tbody>
              ${(abc.products || []).map(p => {
      const colors = { A: '#10b981', B: '#f59e0b', C: '#ef4444' };
      return `
                <tr>
                  <td><span class="badge" style="background:${colors[p.classification]}22;color:${colors[p.classification]};font-weight:700;padding:4px 10px">${p.classification}</span></td>
                  <td class="fw-bold">${p.product_name}</td>
                  <td>${p.total_qty}</td>
                  <td class="text-accent fw-bold">$${parseFloat(p.total_revenue).toFixed(2)}</td>
                  <td>${p.revenue_pct}%</td>
                  <td>${p.cumulative_pct}%</td>
                </tr>`;
    }).join('')}
              ${(abc.products || []).length === 0 ? '<tr><td colspan="6" class="text-center text-muted" style="padding:20px">Sin datos</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // ════════════════════════════════════════════════════
  //  📈 TAB ESTRATÉGICO
  // ════════════════════════════════════════════════════
  renderStrategic() {
    const me = this.data.menuEng || {};
    const comp = this.data.comparison || {};
    const products = me.products || [];
    const summary = me.summary || {};

    return `
      <!-- Comparativo Semanal -->
      <div class="card" style="margin-bottom:var(--space-lg)">
        <div class="card-header"><h3 class="card-title">📊 Comparativo vs Semana Anterior</h3></div>
        <div style="padding:var(--space-md)">
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px">
            ${this.renderComparisonCard('Ventas', comp.current?.sales, comp.previous?.sales, '', false)}
            ${this.renderComparisonCard('Ingresos', comp.current?.revenue, comp.previous?.revenue, '$')}
            ${this.renderComparisonCard('Ticket Prom.', comp.current?.avgTicket, comp.previous?.avgTicket, '$')}
            ${this.renderComparisonCard('Gastos', comp.current?.expenses, comp.previous?.expenses, '$', true)}
            ${this.renderComparisonCard('Ganancia', comp.current?.profit, comp.previous?.profit, '$')}
          </div>
          <div style="text-align:center;margin-top:var(--space-md);padding-top:var(--space-md);border-top:1px solid var(--border-color)">
            <span style="font-size:1.3rem;font-weight:800;color:${(comp.growthPct || 0) >= 0 ? '#10b981' : '#ef4444'}">
              ${(comp.growthPct || 0) >= 0 ? '📈' : '📉'} ${(comp.growthPct || 0) >= 0 ? '+' : ''}${comp.growthPct || 0}% crecimiento en ingresos
            </span>
          </div>
        </div>
      </div>

      <!-- Ingeniería de Menú -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">🧪 Ingeniería de Menú</h3>
          <div style="display:flex;gap:8px">
            <span class="badge" style="background:rgba(234,179,8,0.15);color:#eab308;padding:4px 10px">⭐ Estrellas: ${summary.stars || 0}</span>
            <span class="badge" style="background:rgba(168,85,247,0.15);color:#a855f7;padding:4px 10px">🧩 Rompecab.: ${summary.puzzles || 0}</span>
            <span class="badge" style="background:rgba(59,130,246,0.15);color:#3b82f6;padding:4px 10px">🐴 Caballos: ${summary.horses || 0}</span>
            <span class="badge" style="background:rgba(239,68,68,0.15);color:#ef4444;padding:4px 10px">🐕 Perros: ${summary.dogs || 0}</span>
          </div>
        </div>
        <div style="padding:var(--space-sm)">
          <div class="text-muted fs-sm" style="padding:0 var(--space-md) var(--space-sm)">
            ⭐ <strong>Estrella</strong> = Popular + Rentable (mantener) · 🧩 <strong>Rompecabezas</strong> = Rentable pero poco vendido (promocionar) · 🐴 <strong>Caballo</strong> = Popular pero baja ganancia (subir precio) · 🐕 <strong>Perro</strong> = Ni vende ni gana (considerar eliminar)
          </div>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr><th>Categoría</th><th>Producto</th><th>Precio</th><th>Costo Receta</th><th>Margen</th><th>Qty Vendida</th><th>Ingresos</th></tr></thead>
            <tbody>
              ${products.map(p => {
      const catColors = {
        '⭐ Estrella': '#eab308',
        '🧩 Rompecabezas': '#a855f7',
        '🐴 Caballo': '#3b82f6',
        '🐕 Perro': '#ef4444'
      };
      const color = catColors[p.category] || '#888';
      return `
                <tr>
                  <td><span class="badge" style="background:${color}22;color:${color};padding:4px 10px;font-weight:600">${p.category}</span></td>
                  <td class="fw-bold">${p.name}</td>
                  <td>$${p.price.toFixed(2)}</td>
                  <td>${p.recipe_cost > 0 ? '$' + p.recipe_cost.toFixed(2) : '<span class="text-muted">Sin receta</span>'}</td>
                  <td class="fw-bold" style="color:${p.margin > 0 ? '#10b981' : '#ef4444'}">$${p.margin.toFixed(2)}</td>
                  <td>${p.total_qty}</td>
                  <td class="text-accent fw-bold">$${p.total_revenue.toFixed(2)}</td>
                </tr>`;
    }).join('')}
              ${products.length === 0 ? '<tr><td colspan="7" class="text-center text-muted" style="padding:20px">Sin datos de ventas</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  renderComparisonCard(label, current, previous, prefix = '', invertColor = false) {
    const c = parseFloat(current || 0);
    const p = parseFloat(previous || 0);
    const diff = c - p;
    const pct = p > 0 ? ((diff / p) * 100).toFixed(0) : (c > 0 ? 100 : 0);
    const isPositive = invertColor ? diff <= 0 : diff >= 0;

    return `
      <div style="text-align:center;padding:14px;background:var(--bg-primary);border-radius:10px">
        <div class="text-muted fs-xs">${label}</div>
        <div class="fw-bold" style="font-size:1.1rem">${prefix}${c.toFixed(prefix === '$' ? 2 : 0)}</div>
        <div class="fs-xs" style="color:var(--text-muted)">Ant: ${prefix}${p.toFixed(prefix === '$' ? 2 : 0)}</div>
        <div class="fs-xs fw-bold" style="color:${isPositive ? '#10b981' : '#ef4444'}">
          ${diff >= 0 ? '▲' : '▼'} ${pct}%
        </div>
      </div>`;
  },
};

window.Reports = Reports;

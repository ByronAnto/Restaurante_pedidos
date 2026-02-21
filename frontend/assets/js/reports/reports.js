/**
 * ═══════════════════════════════════════════════════════
 *  Reports Module - Business Intelligence Dashboard
 *  Transacciones · Productos · Análisis BI · Financiero · Estratégico
 *  Con Impresión y Descarga CSV
 * ═══════════════════════════════════════════════════════
 */

const Reports = {
  data: {},
  currentTab: 'transactions',
  currentPeriod: 'today',
  transPage: 1,
  selectedPeriodId: null,

  async init(container) {
    this.container = container;
    await this.loadAllData();
    this.render();
  },

  async loadAllData() {
    try {
      const p = this.currentPeriod;
      const [pnl, pnlTrend, cashFlow, salesByHour, ticketStats, abc, menuEng, comparison, topProducts, orderTypes, topDishes, dayAnalysis, heatmap, periodsList] = await Promise.all([
        API.get(`/reports/pnl?period=${p}`),
        API.get('/reports/pnl-trend?days=14'),
        API.get(`/reports/cash-flow?period=${p}`),
        API.get(`/reports/sales-by-hour?period=${p}`),
        API.get(`/reports/ticket-stats?period=${p}`),
        API.get(`/reports/abc?period=${p}`),
        API.get(`/reports/menu-engineering?period=${p}`),
        API.get('/reports/comparison'),
        API.get(`/reports/top-products?period=${p}&limit=10`),
        API.get(`/reports/order-types?period=${p}`),
        API.get(`/reports/top-dishes?period=${p}&limit=20`),
        API.get('/reports/day-analysis?weeks=8'),
        API.get('/reports/hourly-heatmap?weeks=4'),
        API.get('/reports/periods-list?limit=30'),
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
        topDishes: topDishes.data || {},
        dayAnalysis: dayAnalysis.data || {},
        heatmap: heatmap.data || {},
        periodsList: periodsList.data || [],
      };
    } catch (err) {
      console.error('Reports load error:', err);
      Toast.error('Error cargando reportes');
    }
  },

  async loadTransactions(page = 1) {
    try {
      const params = [`page=${page}`, 'limit=50'];
      if (this.selectedPeriodId) {
        params.push(`period_id=${this.selectedPeriodId}`);
      } else {
        params.push(`period=${this.currentPeriod}`);
      }
      const res = await API.get(`/reports/transactions?${params.join('&')}`);
      this.data.transactions = res.data || {};
      this.transPage = page;
    } catch (err) {
      Toast.error('Error cargando transacciones');
    }
  },

  async changePeriod(period) {
    this.currentPeriod = period;
    this.selectedPeriodId = null;
    await this.loadAllData();
    if (this.currentTab === 'transactions') {
      await this.loadTransactions(1);
    }
    this.render();
  },

  async selectCashPeriod(periodId) {
    this.selectedPeriodId = periodId || null;
    await this.loadTransactions(1);
    document.getElementById('report-content').innerHTML = this.renderTabContent();
  },

  switchTab(tab) {
    this.currentTab = tab;
    if (tab === 'transactions' && !this.data.transactions) {
      this.loadTransactions(1).then(() => {
        document.getElementById('report-content').innerHTML = this.renderTabContent();
      });
      return;
    }
    document.querySelectorAll('.rpt-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.getElementById('report-content').innerHTML = this.renderTabContent();
  },

  render() {
    const pnl = this.data.pnl || {};
    const profitColor = pnl.netProfit >= 0 ? '#10b981' : '#ef4444';
    const tabs = [
      { id: 'transactions', icon: '🧾', label: 'Transacciones' },
      { id: 'products', icon: '🍽️', label: 'Productos' },
      { id: 'bi', icon: '🔮', label: 'Análisis BI' },
      { id: 'financial', icon: '💰', label: 'Financiero' },
      { id: 'strategic', icon: '📈', label: 'Estratégico' },
    ];

    this.container.innerHTML = `
      <div class="page-content" id="reports-printable">
        <div class="page-header" style="display:flex;justify-content:space-between;align-items:start">
          <div>
            <h2 class="page-title">📊 Business Intelligence</h2>
            <p class="page-description">Análisis integral del negocio con predicción de ventas</p>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secondary" onclick="Reports.printReport()" title="Imprimir reporte">🖨️ Imprimir</button>
            <button class="btn btn-secondary" onclick="Reports.downloadCSV()" title="Descargar CSV">📥 CSV</button>
          </div>
        </div>

        <!-- Filtro de período -->
        <div style="display:flex;gap:8px;margin-bottom:var(--space-lg);flex-wrap:wrap">
          ${['today', 'week', 'month', 'year'].map(p => `
            <button class="pos-category-btn ${this.currentPeriod === p ? 'active' : ''}" onclick="Reports.changePeriod('${p}')">${{ today: '📅 Hoy', week: '📆 Semana', month: '🗓️ Mes', year: '📈 Año' }[p]}</button>
          `).join('')}
        </div>

        <!-- KPIs Principales -->
        <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-bottom:var(--space-lg)">
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
              <div class="stat-label">Food Cost ${(pnl.foodCostPct || 0) > 35 ? '⚠️' : '✅'}</div>
            </div>
          </div>
          ${pnl.withdrawals > 0 ? `
          <div class="stat-card">
            <div class="stat-icon warning">💸</div>
            <div>
              <div class="stat-value" style="color:#f59e0b">$${pnl.withdrawals?.toFixed(2)}</div>
              <div class="stat-label">Retiros de Caja</div>
            </div>
          </div>` : ''}
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:2px;margin-bottom:var(--space-lg);border-bottom:2px solid var(--border-color);padding-bottom:2px;overflow-x:auto">
          ${tabs.map(t => `
            <button class="rpt-tab ${this.currentTab === t.id ? 'active' : ''}" data-tab="${t.id}" onclick="Reports.switchTab('${t.id}')" 
              style="padding:10px 16px;border:none;background:${this.currentTab === t.id ? 'var(--accent-primary)' : 'transparent'};color:${this.currentTab === t.id ? '#fff' : 'var(--text-secondary)'};border-radius:8px 8px 0 0;cursor:pointer;font-weight:600;white-space:nowrap;font-size:0.85rem">${t.icon} ${t.label}</button>
          `).join('')}
        </div>

        <div id="report-content">
          ${this.renderTabContent()}
        </div>
      </div>
    `;

    if (this.currentTab === 'transactions' && !this.data.transactions) {
      this.loadTransactions(1).then(() => {
        const el = document.getElementById('report-content');
        if (el) el.innerHTML = this.renderTabContent();
      });
    }
  },

  renderTabContent() {
    switch (this.currentTab) {
      case 'transactions': return this.renderTransactions();
      case 'products': return this.renderProducts();
      case 'bi': return this.renderBI();
      case 'financial': return this.renderFinancial();
      case 'strategic': return this.renderStrategic();
      default: return '';
    }
  },

  // ════════════════════════════════════════════════════
  //  🧾 TAB TRANSACCIONES
  // ════════════════════════════════════════════════════
  renderTransactions() {
    const txData = this.data.transactions || {};
    const txns = txData.transactions || [];
    const totals = txData.totals || {};
    const pagination = txData.pagination || {};
    const periods = this.data.periodsList || [];

    return `
      <div class="card" style="margin-bottom:var(--space-lg)">
        <div class="card-header"><h3 class="card-title">📋 Filtrar por Período de Caja</h3></div>
        <div style="padding:var(--space-md)">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button class="btn ${!this.selectedPeriodId ? 'btn-primary' : 'btn-secondary'}" onclick="Reports.selectCashPeriod(null)" style="font-size:0.8rem">Usar filtro temporal</button>
            <select onchange="Reports.selectCashPeriod(this.value)" style="padding:8px 12px;border-radius:8px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border-color);font-size:0.85rem;min-width:300px">
              <option value="">-- Seleccionar período de caja --</option>
              ${periods.map(p => `
                <option value="${p.id}" ${this.selectedPeriodId == p.id ? 'selected' : ''}>
                  ${p.status === 'open' ? '🟢' : '🔴'} #${p.id} — ${new Date(p.open_time).toLocaleDateString('es-EC')} ${new Date(p.open_time).toLocaleTimeString('es-EC', {hour:'2-digit',minute:'2-digit'})}${p.close_time ? ' → ' + new Date(p.close_time).toLocaleTimeString('es-EC', {hour:'2-digit',minute:'2-digit'}) : ' (Abierto)'} — ${p.total_orders || 0} ventas — $${parseFloat(p.total_sales || 0).toFixed(2)}
                </option>
              `).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));margin-bottom:var(--space-lg)">
        <div class="stat-card"><div class="stat-icon success">✅</div><div><div class="stat-value">${totals.completed_count || 0}</div><div class="stat-label">Completadas</div></div></div>
        <div class="stat-card"><div class="stat-icon danger">❌</div><div><div class="stat-value" style="color:#ef4444">${totals.voided_count || 0}</div><div class="stat-label">Anuladas</div></div></div>
        <div class="stat-card"><div class="stat-icon info">💵</div><div><div class="stat-value">$${parseFloat(totals.cash_total || 0).toFixed(2)}</div><div class="stat-label">Efectivo</div></div></div>
        <div class="stat-card"><div class="stat-icon accent">📱</div><div><div class="stat-value">$${parseFloat(totals.transfer_total || 0).toFixed(2)}</div><div class="stat-label">Transferencias</div></div></div>
        <div class="stat-card" style="border-left:3px solid var(--accent-primary)"><div class="stat-icon warning">💰</div><div><div class="stat-value" style="color:var(--accent-primary)">$${parseFloat(totals.total_revenue || 0).toFixed(2)}</div><div class="stat-label">Total Ingresos</div></div></div>
        <div class="stat-card"><div class="stat-icon info">🎫</div><div><div class="stat-value">$${parseFloat(totals.avg_ticket || 0).toFixed(2)}</div><div class="stat-label">Ticket Prom.</div></div></div>
      </div>

      <div class="card">
        <div class="card-header"><h3 class="card-title">🧾 Detalle de Transacciones (${pagination.total || 0})</h3></div>
        <div class="table-wrapper">
          <table class="data-table" id="transactions-table">
            <thead><tr><th>#</th><th>Fecha/Hora</th><th>Estado</th><th>Tipo</th><th>Pago</th><th>Items</th><th class="text-right">Total</th><th>Cajero</th></tr></thead>
            <tbody>
              ${txns.length === 0 ? '<tr><td colspan="8" class="text-center text-muted" style="padding:30px">Sin transacciones en este período</td></tr>' : ''}
              ${txns.map(tx => {
                const isVoided = tx.status === 'voided';
                const typeLabel = { dine_in: '🏠 Mesa', takeaway: '📦 Llevar' }[tx.order_type] || tx.order_type;
                const payLabel = { cash: '💵 Efectivo', transfer: '📱 Transfer.', mixed: '💳 Mixto' }[tx.payment_method] || tx.payment_method;
                return `<tr style="${isVoided ? 'opacity:0.5;text-decoration:line-through' : ''}">
                  <td class="fw-bold">${tx.sale_number}</td>
                  <td style="font-size:0.8rem">${new Date(tx.created_at).toLocaleString('es-EC', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
                  <td>${isVoided ? '<span style="color:#ef4444;font-weight:700">ANULADA</span>' : '<span style="color:#10b981">✓</span>'}</td>
                  <td>${typeLabel}${tx.table_name ? ' ' + tx.table_name : ''}</td>
                  <td>${payLabel}</td>
                  <td style="font-size:0.75rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(tx.items_summary || '').replace(/"/g, '&quot;')}">${tx.items_summary || '-'}</td>
                  <td class="text-right fw-bold" style="color:${isVoided ? '#ef4444' : '#10b981'}">$${parseFloat(tx.total).toFixed(2)}</td>
                  <td style="font-size:0.8rem">${tx.cashier || '-'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        ${pagination.pages > 1 ? `
          <div style="display:flex;justify-content:center;gap:8px;padding:var(--space-md)">
            ${this.transPage > 1 ? `<button class="btn btn-secondary" onclick="Reports.loadTransactions(${this.transPage - 1}).then(()=>document.getElementById('report-content').innerHTML=Reports.renderTabContent())" style="font-size:0.8rem">← Anterior</button>` : ''}
            <span style="padding:8px 16px;color:var(--text-secondary);font-size:0.85rem">Pág. ${pagination.page} de ${pagination.pages}</span>
            ${this.transPage < pagination.pages ? `<button class="btn btn-secondary" onclick="Reports.loadTransactions(${this.transPage + 1}).then(()=>document.getElementById('report-content').innerHTML=Reports.renderTabContent())" style="font-size:0.8rem">Siguiente →</button>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  },

  // ════════════════════════════════════════════════════
  //  🍽️ TAB PRODUCTOS — Platos más vendidos
  // ════════════════════════════════════════════════════
  renderProducts() {
    const dishes = this.data.topDishes?.dishes || [];
    const byCategory = this.data.topDishes?.byCategory || [];
    const abc = this.data.abc || {};

    return `
      <div class="card" style="margin-bottom:var(--space-lg)">
        <div class="card-header"><h3 class="card-title">📊 Ventas por Categoría</h3></div>
        <div style="padding:var(--space-md)">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
            ${byCategory.map((cat, i) => {
              const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
              const color = colors[i % colors.length];
              return `
                <div style="padding:16px;background:${color}11;border-radius:12px;border-left:4px solid ${color}">
                  <div style="font-weight:700;color:${color};font-size:1.1rem">${cat.category}</div>
                  <div style="color:var(--text-primary);font-size:1.3rem;font-weight:800;margin:4px 0">$${parseFloat(cat.total_revenue).toFixed(2)}</div>
                  <div style="display:flex;justify-content:space-between;font-size:0.8rem;color:var(--text-muted)">
                    <span>${cat.total_qty} uds · ${cat.products_count} platos</span>
                    <span style="font-weight:700;color:${color}">${cat.pct}%</span>
                  </div>
                  <div style="height:4px;background:${color}22;border-radius:4px;margin-top:8px">
                    <div style="height:100%;background:${color};border-radius:4px;width:${cat.pct}%"></div>
                  </div>
                </div>`;
            }).join('')}
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:var(--space-lg)">
        <div class="card-header"><h3 class="card-title">🏆 Top 20 Platos Más Vendidos</h3></div>
        <div style="padding:var(--space-md)">
          ${dishes.slice(0, 15).map((d, i) => {
            const maxQty = dishes[0]?.total_qty || 1;
            const pct = (d.total_qty / maxQty) * 100;
            const medals = ['🥇', '🥈', '🥉'];
            return `
              <div style="display:grid;grid-template-columns:40px 200px 1fr 100px;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border-color)">
                <div style="font-size:${i < 3 ? '1.3rem' : '0.9rem'};text-align:center;font-weight:700;color:var(--text-muted)">${medals[i] || (i + 1)}</div>
                <div>
                  <div class="fw-bold" style="font-size:0.9rem">${d.product_name}</div>
                  <div style="font-size:0.7rem;color:var(--text-muted)">${d.category_name} · ${d.orders_count} pedidos</div>
                </div>
                <div style="position:relative;height:24px;background:var(--bg-primary);border-radius:12px;overflow:hidden">
                  <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#f59e0b,#ef4444);border-radius:12px;transition:width 0.5s"></div>
                  <span style="position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:0.75rem;font-weight:700;color:var(--text-primary)">${d.total_qty} uds</span>
                </div>
                <div class="text-right" style="font-weight:700;color:#10b981">$${d.total_revenue.toFixed(2)}</div>
              </div>`;
          }).join('')}
          ${dishes.length === 0 ? '<div class="text-center text-muted" style="padding:30px">Sin datos de ventas</div>' : ''}
        </div>
      </div>

      <div class="card" style="margin-bottom:var(--space-lg)">
        <div class="card-header"><h3 class="card-title">📋 Tabla Detallada de Productos</h3></div>
        <div class="table-wrapper">
          <table class="data-table" id="products-table">
            <thead><tr><th>#</th><th>Producto</th><th>Categoría</th><th class="text-right">Cant.</th><th class="text-right">Pedidos</th><th class="text-right">Días Vendido</th><th class="text-right">Prom/Pedido</th><th class="text-right">Ingresos</th><th class="text-right">% Ingresos</th></tr></thead>
            <tbody>
              ${dishes.map((d, i) => `
                <tr>
                  <td class="fw-bold">${i + 1}</td>
                  <td class="fw-bold">${d.product_name}</td>
                  <td style="font-size:0.8rem">${d.category_name}</td>
                  <td class="text-right fw-bold">${d.total_qty}</td>
                  <td class="text-right">${d.orders_count}</td>
                  <td class="text-right">${d.days_sold}</td>
                  <td class="text-right">${d.avg_qty_per_order}</td>
                  <td class="text-right fw-bold" style="color:#10b981">$${d.total_revenue.toFixed(2)}</td>
                  <td class="text-right">${d.pct_revenue}%</td>
                </tr>
              `).join('')}
              ${dishes.length === 0 ? '<tr><td colspan="9" class="text-center text-muted" style="padding:20px">Sin datos</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">🔤 Análisis ABC</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <span style="background:rgba(16,185,129,0.15);color:#10b981;padding:4px 12px;border-radius:20px;font-size:0.8rem;font-weight:600">A: ${abc.summary?.a_count || 0} prods (80%)</span>
            <span style="background:rgba(245,158,11,0.15);color:#f59e0b;padding:4px 12px;border-radius:20px;font-size:0.8rem;font-weight:600">B: ${abc.summary?.b_count || 0} prods (15%)</span>
            <span style="background:rgba(239,68,68,0.15);color:#ef4444;padding:4px 12px;border-radius:20px;font-size:0.8rem;font-weight:600">C: ${abc.summary?.c_count || 0} prods (5%)</span>
          </div>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr><th>Clase</th><th>Producto</th><th class="text-right">Qty</th><th class="text-right">Ingresos</th><th class="text-right">%</th><th class="text-right">% Acum.</th></tr></thead>
            <tbody>
              ${(abc.products || []).map(p => {
                const colors = { A: '#10b981', B: '#f59e0b', C: '#ef4444' };
                return `<tr>
                    <td><span style="background:${colors[p.classification]}22;color:${colors[p.classification]};padding:3px 10px;border-radius:12px;font-weight:700;font-size:0.85rem">${p.classification}</span></td>
                    <td class="fw-bold">${p.product_name}</td>
                    <td class="text-right">${p.total_qty}</td>
                    <td class="text-right fw-bold" style="color:#10b981">$${parseFloat(p.total_revenue).toFixed(2)}</td>
                    <td class="text-right">${p.revenue_pct}%</td>
                    <td class="text-right">${p.cumulative_pct}%</td>
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
  //  🔮 TAB ANÁLISIS BI — Predicción + Heatmap
  // ════════════════════════════════════════════════════
  renderBI() {
    const da = this.data.dayAnalysis || {};
    const analysis = da.analysis || [];
    const insights = da.insights || {};
    const heatmapData = this.data.heatmap?.heatmap || [];
    const todayPred = insights.todayPrediction || {};

    return `
      <div class="card" style="margin-bottom:var(--space-lg);background:linear-gradient(135deg,#1a1a2e,#16213e);border:2px solid var(--accent-primary)30">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--space-lg);padding:var(--space-lg)">
          <div style="text-align:center">
            <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:4px">🔮 Predicción para Hoy (${todayPred.name || ''})</div>
            <div style="font-size:3rem;font-weight:800;color:var(--accent-primary)">${todayPred.prediction || 0}</div>
            <div style="font-size:0.85rem;color:var(--text-secondary)">transacciones esperadas</div>
            <div style="margin-top:8px;font-size:1.2rem;font-weight:700;color:#10b981">$${(todayPred.predRevenue || 0).toFixed(2)}</div>
            <div style="font-size:0.75rem;color:var(--text-muted)">ingreso estimado</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:4px">📊 Confianza del Modelo</div>
            <div style="position:relative;width:120px;height:120px;margin:0 auto">
              <svg viewBox="0 0 36 36" style="transform:rotate(-90deg)">
                <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="3"/>
                <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="${(todayPred.confidence || 0) > 70 ? '#10b981' : (todayPred.confidence || 0) > 50 ? '#f59e0b' : '#ef4444'}" stroke-width="3" stroke-dasharray="${todayPred.confidence || 0}, 100"/>
              </svg>
              <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:1.5rem;font-weight:800">${todayPred.confidence || 0}%</div>
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">Basado en ${todayPred.weeksAnalyzed || 0} semanas</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:4px">📈 Tendencia ${todayPred.name || ''}</div>
            <div style="font-size:2rem;margin:8px 0">${todayPred.trend === 'up' ? '📈' : todayPred.trend === 'down' ? '📉' : '➡️'}</div>
            <div style="font-weight:700;color:${todayPred.trend === 'up' ? '#10b981' : todayPred.trend === 'down' ? '#ef4444' : '#f59e0b'}">${todayPred.trend === 'up' ? 'Al alza' : todayPred.trend === 'down' ? 'A la baja' : 'Estable'}</div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px">
              ${todayPred.monthFactor === 'fin_de_mes' ? '⚠️ Fin de mes: posible baja' : todayPred.monthFactor === 'inicio_de_mes' ? '💪 Inicio de mes: posible alza' : '📊 Mes normal'}
            </div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">Rango: ${todayPred.minSales || 0} - ${todayPred.maxSales || 0} ventas</div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:var(--space-lg)">
        <div class="card-header"><h3 class="card-title">📅 Pronóstico Semanal — $${(insights.weekForecast || 0).toFixed(2)} estimado</h3></div>
        <div style="padding:var(--space-md)">
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px">
            ${analysis.map(day => {
              const isToday = day.dow === new Date().getDay();
              const trendIcon = day.trend === 'up' ? '📈' : day.trend === 'down' ? '📉' : '➡️';
              const bgColor = isToday ? 'var(--accent-primary)15' : 'var(--bg-primary)';
              return `
                <div style="text-align:center;padding:12px 8px;background:${bgColor};border-radius:12px;border:${isToday ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)'}">
                  <div style="font-weight:700;font-size:0.85rem;color:${isToday ? 'var(--accent-primary)' : 'var(--text-primary)'}">${day.name.substring(0, 3)}</div>
                  <div style="font-size:1.5rem;font-weight:800;margin:4px 0">${day.prediction}</div>
                  <div style="font-size:0.7rem;color:var(--text-muted)">ventas</div>
                  <div style="font-size:0.85rem;font-weight:700;color:#10b981;margin:4px 0">$${day.predRevenue.toFixed(0)}</div>
                  <div style="font-size:0.75rem">${trendIcon}</div>
                  <div style="font-size:0.65rem;color:var(--text-muted)">±${day.stdDev} desv.</div>
                </div>`;
            }).join('')}
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:var(--space-lg)">
        <div class="card-header">
          <h3 class="card-title">📊 Análisis por Día de Semana (${insights.weeksAnalyzed || 8} semanas)</h3>
          <div style="font-size:0.85rem;color:var(--text-muted)">
            🏆 Mejor: <strong style="color:#10b981">${insights.bestDay || '-'}</strong> ($${(insights.bestDayAvgRevenue || 0).toFixed(2)}/día)
            · 📉 Peor: <strong style="color:#ef4444">${insights.worstDay || '-'}</strong> ($${(insights.worstDayAvgRevenue || 0).toFixed(2)}/día)
          </div>
        </div>
        <div class="table-wrapper">
          <table class="data-table" id="dayanalysis-table">
            <thead><tr><th>Día</th><th class="text-right">Prom. Ventas</th><th class="text-right">Prom. Ingresos</th><th class="text-right">Ticket Prom.</th><th class="text-right">Min-Max</th><th>Tendencia</th><th class="text-right">Predicción</th><th class="text-right">Confianza</th><th>Último</th></tr></thead>
            <tbody>
              ${analysis.map(day => {
                const isToday = day.dow === new Date().getDay();
                const trendColor = day.trend === 'up' ? '#10b981' : day.trend === 'down' ? '#ef4444' : '#f59e0b';
                const trendLabel = day.trend === 'up' ? '📈 Subiendo' : day.trend === 'down' ? '📉 Bajando' : '➡️ Estable';
                const lastDateStr = day.lastOccurrence ? new Date(day.lastOccurrence.date).toLocaleDateString('es-EC', {day:'2-digit',month:'short'}) : '-';
                const lastSales = day.lastOccurrence?.sales || 0;
                return `
                  <tr style="${isToday ? 'background:var(--accent-primary)10;font-weight:600' : ''}">
                    <td class="fw-bold">${isToday ? '▶ ' : ''}${day.name}</td>
                    <td class="text-right fw-bold">${day.avgSales}</td>
                    <td class="text-right fw-bold" style="color:#10b981">$${day.avgRevenue.toFixed(2)}</td>
                    <td class="text-right">$${day.avgTicket.toFixed(2)}</td>
                    <td class="text-right" style="font-size:0.8rem">${day.minSales} — ${day.maxSales}</td>
                    <td><span style="color:${trendColor};font-weight:600;font-size:0.85rem">${trendLabel}</span></td>
                    <td class="text-right fw-bold" style="color:var(--accent-primary);font-size:1.05rem">${day.prediction}</td>
                    <td class="text-right"><span style="background:${day.confidence > 70 ? '#10b98122' : day.confidence > 50 ? '#f59e0b22' : '#ef444422'};color:${day.confidence > 70 ? '#10b981' : day.confidence > 50 ? '#f59e0b' : '#ef4444'};padding:2px 8px;border-radius:10px;font-size:0.8rem;font-weight:700">${day.confidence}%</span></td>
                    <td style="font-size:0.8rem">${lastDateStr}: ${lastSales} ventas</td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      ${this.renderInsightCards(analysis)}

      <div class="card">
        <div class="card-header"><h3 class="card-title">🗓️ Mapa de Calor — Ventas por Día y Hora</h3></div>
        <div style="padding:var(--space-md);overflow-x:auto">
          <div style="display:grid;grid-template-columns:60px repeat(18,1fr);gap:2px;min-width:700px">
            <div></div>
            ${Array.from({length: 18}, (_, i) => `<div style="text-align:center;font-size:0.65rem;color:var(--text-muted);padding:2px">${(i + 6).toString().padStart(2, '0')}h</div>`).join('')}
            ${['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((dayName, dow) => {
              return `<div style="font-size:0.8rem;font-weight:600;display:flex;align-items:center">${dayName}</div>` +
                Array.from({length: 18}, (_, i) => {
                  const h = i + 6;
                  const cell = heatmapData.find(c => c.dow === dow && c.hour === h);
                  const intensity = cell?.intensity || 0;
                  const sales = cell?.sales || 0;
                  const bg = intensity === 0 ? 'var(--bg-primary)' : `rgba(245,158,11,${0.1 + intensity * 0.8})`;
                  return `<div style="height:28px;background:${bg};border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:0.6rem;color:${intensity > 0.5 ? '#000' : 'var(--text-muted)'};font-weight:${intensity > 0.5 ? '700' : '400'}" title="${dayName} ${h}:00 - ${sales} ventas">${sales || ''}</div>`;
                }).join('');
            }).join('')}
          </div>
          <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px">
            <span style="font-size:0.75rem;color:var(--text-muted)">Menos</span>
            ${[0, 0.2, 0.4, 0.6, 0.8, 1].map(i => `<div style="width:20px;height:12px;background:rgba(245,158,11,${0.1 + i * 0.8});border-radius:2px"></div>`).join('')}
            <span style="font-size:0.75rem;color:var(--text-muted)">Más</span>
          </div>
        </div>
      </div>
    `;
  },

  renderInsightCards(analysis) {
    const insights = [];
    const today = new Date().getDay();
    const tomorrow = (today + 1) % 7;
    const dayToday = analysis[today];
    const dayTomorrow = analysis[tomorrow];

    if (dayToday && dayToday.lastOccurrence) {
      const lastSales = dayToday.lastOccurrence.sales;
      const diff = dayToday.prediction - lastSales;
      insights.push({
        icon: diff >= 0 ? '📈' : '📉',
        title: `${dayToday.name} anterior: ${lastSales} ventas`,
        text: `Hoy se predicen ${dayToday.prediction} ventas (${diff >= 0 ? '+' : ''}${diff}). ${dayToday.trend === 'up' ? 'La tendencia es positiva.' : dayToday.trend === 'down' ? 'La tendencia es a la baja, considere promociones.' : 'La tendencia se mantiene estable.'}`,
        color: diff >= 0 ? '#10b981' : '#ef4444',
      });
    }

    if (dayToday?.monthFactor === 'fin_de_mes') {
      insights.push({ icon: '⚠️', title: 'Efecto Fin de Mes', text: 'Estamos en los últimos días del mes. Históricamente las ventas pueden disminuir. Considere ofertas especiales para atraer clientes.', color: '#f59e0b' });
    } else if (dayToday?.monthFactor === 'inicio_de_mes') {
      insights.push({ icon: '💪', title: 'Efecto Inicio de Mes', text: 'Inicio de mes suele traer mayor afluencia por cobro de salarios. Buen momento para platos premium.', color: '#10b981' });
    }

    if (dayTomorrow) {
      insights.push({ icon: '🔮', title: `Mañana (${dayTomorrow.name})`, text: `Se esperan ~${dayTomorrow.prediction} ventas con ingreso estimado de $${dayTomorrow.predRevenue.toFixed(2)}. ${dayTomorrow.trend === 'up' ? 'Tendencia al alza.' : dayTomorrow.trend === 'down' ? 'Tendencia a la baja.' : 'Tendencia estable.'}`, color: '#3b82f6' });
    }

    const bestDay = [...analysis].sort((a, b) => b.avgRevenue - a.avgRevenue)[0];
    if (bestDay) {
      insights.push({ icon: '🏆', title: `Mejor día: ${bestDay.name}`, text: `Promedio de $${bestDay.avgRevenue.toFixed(2)}/día con ${bestDay.avgSales} ventas. Maximice recursos y personal para este día.`, color: '#10b981' });
    }

    if (insights.length === 0) return '';
    return `
      <div class="card" style="margin-bottom:var(--space-lg)">
        <div class="card-header"><h3 class="card-title">💡 Insights de Inteligencia de Negocio</h3></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;padding:var(--space-md)">
          ${insights.map(ins => `
            <div style="padding:16px;background:${ins.color}08;border-radius:12px;border-left:4px solid ${ins.color}">
              <div style="font-size:1.2rem;margin-bottom:4px">${ins.icon} <strong style="color:${ins.color}">${ins.title}</strong></div>
              <div style="font-size:0.85rem;color:var(--text-secondary);line-height:1.5">${ins.text}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
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
        <div class="card">
          <div class="card-header"><h3 class="card-title">📋 Estado de Resultados (P&L)</h3></div>
          <div style="padding:var(--space-md)">
            <table class="data-table" style="margin:0" id="pnl-table">
              <tbody>
                <tr style="background:rgba(16,185,129,0.05)"><td class="fw-bold" style="font-size:1.1em">🟢 INGRESOS</td><td class="fw-bold text-right" style="font-size:1.1em;color:#10b981">$${pnl.revenue?.toFixed(2) || '0.00'}</td></tr>
                <tr><td colspan="2" style="padding:4px;font-weight:700;color:var(--text-muted)">🔴 GASTOS</td></tr>
                <tr><td style="padding-left:24px">🍖 Compras de insumos</td><td class="text-right" style="color:#ef4444">-$${exp.inventory?.toFixed(2) || '0.00'}</td></tr>
                <tr><td style="padding-left:24px">🏢 Inversiones / Gastos</td><td class="text-right" style="color:#ef4444">-$${exp.investments?.toFixed(2) || '0.00'}</td></tr>
                <tr><td style="padding-left:24px">👷 Nómina Pagada</td><td class="text-right" style="color:#ef4444">-$${exp.payroll?.toFixed(2) || '0.00'}</td></tr>
                <tr style="border-top:2px solid var(--border-color)"><td class="fw-bold">Total Gastos</td><td class="fw-bold text-right" style="color:#ef4444">-$${exp.total?.toFixed(2) || '0.00'}</td></tr>
                ${pnl.withdrawals > 0 ? `<tr style="background:rgba(245,158,11,0.05)"><td style="padding-left:24px">💸 Retiros de Caja</td><td class="text-right" style="color:#f59e0b">-$${pnl.withdrawals?.toFixed(2) || '0.00'}</td></tr>` : ''}
                <tr style="background:${pnl.netProfit >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'};border-top:3px double var(--border-color)">
                  <td class="fw-bold" style="font-size:1.2em">${pnl.netProfit >= 0 ? '✅' : '❌'} GANANCIA NETA</td>
                  <td class="fw-bold text-right" style="font-size:1.2em;color:${pnl.netProfit >= 0 ? '#10b981' : '#ef4444'}">$${pnl.netProfit?.toFixed(2) || '0.00'}</td>
                </tr>
                <tr><td>Margen de Ganancia</td><td class="fw-bold text-right">${pnl.marginPct || 0}%</td></tr>
              </tbody>
            </table>
          </div>
        </div>

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
                ${cf.withdrawals > 0 ? `
                <tr style="background:rgba(245,158,11,0.05)">
                  <td class="fw-bold">💸 Retiros</td>
                  <td class="text-right" style="color:#f59e0b">-$${cf.withdrawals?.toFixed(2) || '0.00'}</td>
                  <td class="text-right">-</td>
                  <td class="text-right" style="color:#f59e0b">-$${cf.withdrawals?.toFixed(2) || '0.00'}</td>
                </tr>` : ''}
                <tr style="border-top:2px solid var(--border-color)">
                  <td class="fw-bold">Neto</td>
                  <td class="text-right fw-bold" style="color:${(cf.netCash || 0) >= 0 ? '#10b981' : '#ef4444'}">$${cf.netCash?.toFixed(2) || '0.00'}</td>
                  <td class="text-right fw-bold" style="color:${(cf.netTransfer || 0) >= 0 ? '#10b981' : '#ef4444'}">$${cf.netTransfer?.toFixed(2) || '0.00'}</td>
                  <td class="text-right fw-bold" style="color:${(cf.netTotal || 0) >= 0 ? '#10b981' : '#ef4444'}">$${cf.netTotal?.toFixed(2) || '0.00'}</td>
                </tr>
              </tbody>
            </table>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:var(--space-lg)">
              <div style="text-align:center;padding:16px;background:var(--bg-primary);border-radius:10px">
                <div class="text-muted" style="font-size:0.75rem">Food Cost %</div>
                <div style="font-size:2rem;font-weight:800;color:${(pnl.foodCostPct || 0) > 35 ? '#ef4444' : '#10b981'}">${pnl.foodCostPct || 0}%</div>
                <div style="font-size:0.7rem;color:var(--text-muted)">Ideal: &lt; 30-35%</div>
              </div>
              <div style="text-align:center;padding:16px;background:var(--bg-primary);border-radius:10px">
                <div class="text-muted" style="font-size:0.75rem">Labor Cost %</div>
                <div style="font-size:2rem;font-weight:800;color:${(pnl.laborCostPct || 0) > 30 ? '#ef4444' : '#10b981'}">${pnl.laborCostPct || 0}%</div>
                <div style="font-size:0.7rem;color:var(--text-muted)">Ideal: &lt; 25-30%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:var(--space-lg)">
        <div class="card-header"><h3 class="card-title">📈 Tendencia de Ganancia - Últimos 14 Días</h3></div>
        <div style="padding:var(--space-md)">
          <div style="display:flex;align-items:end;gap:3px;height:200px;padding:0 8px">
            ${trend.map(d => {
      const maxVal = Math.max(...trend.map(t => Math.max(Math.abs(parseFloat(t.profit)), parseFloat(t.revenue))), 1);
      const revH = maxVal > 0 ? (parseFloat(d.revenue) / maxVal * 170) : 0;
      const profit = parseFloat(d.profit);
      const profitH = maxVal > 0 ? (Math.abs(profit) / maxVal * 170) : 0;
      const dayName = new Date(d.date).toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric' });
      return `
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
                <div style="font-size:0.6rem;font-weight:700;color:${profit >= 0 ? '#10b981' : '#ef4444'}">$${profit.toFixed(0)}</div>
                <div style="width:100%;display:flex;gap:1px;align-items:end;height:170px">
                  <div style="flex:1;background:rgba(59,130,246,0.3);height:${revH}px;border-radius:3px 3px 0 0" title="Ingresos: $${parseFloat(d.revenue).toFixed(2)}"></div>
                  <div style="flex:1;background:${profit >= 0 ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)'};height:${profitH}px;border-radius:3px 3px 0 0" title="Ganancia: $${profit.toFixed(2)}"></div>
                </div>
                <div style="font-size:0.55rem;color:var(--text-muted);white-space:nowrap">${dayName}</div>
              </div>`;
    }).join('')}
          </div>
          <div style="display:flex;gap:16px;justify-content:center;margin-top:8px">
            <span style="font-size:0.75rem"><span style="display:inline-block;width:12px;height:12px;background:rgba(59,130,246,0.3);border-radius:2px"></span> Ingresos</span>
            <span style="font-size:0.75rem"><span style="display:inline-block;width:12px;height:12px;background:rgba(16,185,129,0.5);border-radius:2px"></span> Ganancia</span>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-lg);margin-top:var(--space-lg)">
        <div class="card">
          <div class="card-header"><h3 class="card-title">⏰ Ventas por Hora</h3></div>
          <div style="padding:var(--space-md)">
            <div style="display:flex;align-items:end;gap:2px;height:160px">
              ${(this.data.salesByHour?.hours || []).filter(h => h.hour >= 6 && h.hour <= 23).map(h => {
                const maxSales = Math.max(...(this.data.salesByHour?.hours || []).map(x => x.sales), 1);
                const height = maxSales > 0 ? (h.sales / maxSales * 140) : 0;
                const isPeak = h.hour === (this.data.salesByHour?.peakHour?.hour);
                return `
                  <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:end;height:100%">
                    ${h.sales > 0 ? `<div style="font-size:0.6rem;font-weight:700;color:${isPeak ? 'var(--accent-primary)' : 'var(--text-muted)'}">${h.sales}</div>` : ''}
                    <div style="width:100%;height:${Math.max(height, 2)}px;background:${isPeak ? 'var(--accent-primary)' : 'rgba(59,130,246,0.4)'};border-radius:3px 3px 0 0" title="${h.label}: ${h.sales} ventas"></div>
                    <div style="font-size:0.55rem;color:var(--text-muted);transform:rotate(-45deg);margin-top:4px">${h.hour}</div>
                  </div>`;
              }).join('')}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3 class="card-title">🍽️ Tipo de Servicio</h3></div>
          <div style="padding:var(--space-md)">
            ${(this.data.orderTypes?.breakdown || []).map(type => {
              const labels = { dine_in: '🏠 Mesas', takeaway: '📦 Para Llevar' };
              const colors = { dine_in: '#10b981', takeaway: '#fb923c' };
              const color = colors[type.order_type] || '#6b7280';
              return `
                <div style="margin-bottom:16px">
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                    <span style="font-weight:700;color:${color}">${labels[type.order_type] || type.order_type}</span>
                    <span style="font-weight:700">$${parseFloat(type.total_revenue).toFixed(2)} · ${type.count} ventas · ${type.percentage}%</span>
                  </div>
                  <div style="height:8px;background:var(--bg-primary);border-radius:4px;overflow:hidden">
                    <div style="height:100%;width:${type.percentage}%;background:${color};border-radius:4px"></div>
                  </div>
                </div>`;
            }).join('')}
            ${(this.data.orderTypes?.breakdown || []).length === 0 ? '<div class="text-center text-muted" style="padding:20px">Sin datos</div>' : ''}
          </div>
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
    const ticket = this.data.ticketStats || {};

    return `
      <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));margin-bottom:var(--space-lg)">
        <div class="stat-card"><div class="stat-icon success">🎫</div><div><div class="stat-value">$${parseFloat(ticket.avg_ticket || 0).toFixed(2)}</div><div class="stat-label">Ticket Promedio</div></div></div>
        <div class="stat-card"><div class="stat-icon info">📊</div><div><div class="stat-value">${parseFloat(ticket.avg_items || 0).toFixed(1)}</div><div class="stat-label">Items/Ticket</div></div></div>
        <div class="stat-card"><div class="stat-icon warning">📈</div><div><div class="stat-value">$${parseFloat(ticket.max_ticket || 0).toFixed(2)}</div><div class="stat-label">Ticket Máximo</div></div></div>
        <div class="stat-card"><div class="stat-icon danger">📉</div><div><div class="stat-value">$${parseFloat(ticket.min_ticket || 0).toFixed(2)}</div><div class="stat-label">Ticket Mínimo</div></div></div>
      </div>

      <div class="card" style="margin-bottom:var(--space-lg)">
        <div class="card-header"><h3 class="card-title">📊 Comparativo vs Semana Anterior</h3></div>
        <div style="padding:var(--space-md)">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">
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

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">🧪 Ingeniería de Menú</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <span style="background:rgba(234,179,8,0.15);color:#eab308;padding:4px 10px;border-radius:20px;font-size:0.8rem;font-weight:600">⭐ Estrellas: ${summary.stars || 0}</span>
            <span style="background:rgba(168,85,247,0.15);color:#a855f7;padding:4px 10px;border-radius:20px;font-size:0.8rem;font-weight:600">🧩 Rompecab.: ${summary.puzzles || 0}</span>
            <span style="background:rgba(59,130,246,0.15);color:#3b82f6;padding:4px 10px;border-radius:20px;font-size:0.8rem;font-weight:600">🐴 Caballos: ${summary.horses || 0}</span>
            <span style="background:rgba(239,68,68,0.15);color:#ef4444;padding:4px 10px;border-radius:20px;font-size:0.8rem;font-weight:600">🐕 Perros: ${summary.dogs || 0}</span>
          </div>
        </div>
        <div style="padding:var(--space-sm)">
          <div class="text-muted" style="font-size:0.8rem;padding:0 var(--space-md) var(--space-sm)">
            ⭐ <strong>Estrella</strong> = Popular + Rentable (mantener) · 🧩 <strong>Rompecabezas</strong> = Rentable pero poco vendido (promocionar) · 🐴 <strong>Caballo</strong> = Popular pero baja ganancia (subir precio) · 🐕 <strong>Perro</strong> = Ni vende ni gana (considerar eliminar)
          </div>
        </div>
        <div class="table-wrapper">
          <table class="data-table" id="menueng-table">
            <thead><tr><th>Categoría</th><th>Producto</th><th class="text-right">Precio</th><th class="text-right">Costo</th><th class="text-right">Margen</th><th class="text-right">Qty</th><th class="text-right">Ingresos</th></tr></thead>
            <tbody>
              ${products.map(p => {
      const catColors = { '⭐ Estrella': '#eab308', '🧩 Rompecabezas': '#a855f7', '🐴 Caballo': '#3b82f6', '🐕 Perro': '#ef4444' };
      const color = catColors[p.category] || '#888';
      return `
                <tr>
                  <td><span style="background:${color}22;color:${color};padding:3px 10px;border-radius:12px;font-weight:600;font-size:0.8rem">${p.category}</span></td>
                  <td class="fw-bold">${p.name}</td>
                  <td class="text-right">$${p.price.toFixed(2)}</td>
                  <td class="text-right">${p.recipe_cost > 0 ? '$' + p.recipe_cost.toFixed(2) : '<span class="text-muted">-</span>'}</td>
                  <td class="text-right fw-bold" style="color:${p.margin > 0 ? '#10b981' : '#ef4444'}">$${p.margin.toFixed(2)}</td>
                  <td class="text-right">${p.total_qty}</td>
                  <td class="text-right fw-bold" style="color:#10b981">$${p.total_revenue.toFixed(2)}</td>
                </tr>`;
    }).join('')}
              ${products.length === 0 ? '<tr><td colspan="7" class="text-center text-muted" style="padding:20px">Sin datos</td></tr>' : ''}
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
        <div class="text-muted" style="font-size:0.75rem">${label}</div>
        <div class="fw-bold" style="font-size:1.1rem">${prefix}${c.toFixed(prefix === '$' ? 2 : 0)}</div>
        <div style="font-size:0.7rem;color:var(--text-muted)">Ant: ${prefix}${p.toFixed(prefix === '$' ? 2 : 0)}</div>
        <div style="font-size:0.75rem;font-weight:700;color:${isPositive ? '#10b981' : '#ef4444'}">
          ${diff >= 0 ? '▲' : '▼'} ${pct}%
        </div>
      </div>`;
  },

  // ════════════════════════════════════════════════════
  //  🖨️ IMPRESIÓN Y DESCARGA
  // ════════════════════════════════════════════════════
  printReport() {
    const printWindow = window.open('', '_blank');
    const content = document.getElementById('reports-printable');
    if (!content || !printWindow) { Toast.error('No se pudo abrir ventana de impresión'); return; }

    printWindow.document.write(`<!DOCTYPE html>
<html><head><title>Reporte - ${new Date().toLocaleDateString('es-EC')}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
  body { padding: 20px; color: #1a1a2e; background: #fff; font-size: 12px; }
  .page-title { font-size: 18px; margin-bottom: 4px; }
  .page-description { font-size: 11px; color: #666; margin-bottom: 12px; }
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin-bottom: 12px; }
  .stat-card { background: #f8f9fa; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; display: flex; align-items: center; gap: 8px; }
  .stat-icon { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; }
  .stat-value { font-size: 14px; font-weight: 700; }
  .stat-label { font-size: 10px; color: #666; }
  .card { border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 12px; page-break-inside: avoid; }
  .card-header { padding: 10px 14px; background: #f8f9fa; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; }
  .card-title { font-size: 13px; font-weight: 700; }
  .data-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .data-table th, .data-table td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; }
  .data-table th { background: #f1f5f9; font-weight: 600; }
  .text-right { text-align: right; }
  .fw-bold { font-weight: 700; }
  .text-muted { color: #666; }
  .text-center { text-align: center; }
  button, .rpt-tab, .pos-category-btn, select { display: none !important; }
  .table-wrapper { overflow: visible; }
  .page-header > div:last-child { display: none; }
  @media print { body { padding: 10px; } }
</style></head><body>
  <div style="text-align:center;margin-bottom:12px;border-bottom:2px solid #1a1a2e;padding-bottom:8px">
    <strong style="font-size:16px">REPORTE DE NEGOCIO</strong><br>
    <span style="font-size:11px;color:#666">Generado: ${new Date().toLocaleString('es-EC')} · Período: ${this.currentPeriod.toUpperCase()}</span>
  </div>
  ${content.innerHTML}
</body></html>`);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  },

  downloadCSV() {
    let csv = '';
    let filename = 'reporte';

    switch (this.currentTab) {
      case 'transactions': {
        const txns = this.data.transactions?.transactions || [];
        csv = 'Numero,Fecha,Estado,Tipo,Pago,Total,Cajero,Items\n';
        txns.forEach(tx => {
          csv += `${tx.sale_number},"${new Date(tx.created_at).toLocaleString('es-EC')}",${tx.status},${tx.order_type},${tx.payment_method},${parseFloat(tx.total).toFixed(2)},${tx.cashier || ''},"${(tx.items_summary || '').replace(/"/g, '""')}"\n`;
        });
        filename = 'transacciones';
        break;
      }
      case 'products': {
        const dishes = this.data.topDishes?.dishes || [];
        csv = 'Rank,Producto,Categoría,Cantidad,Pedidos,Días Vendido,Ingresos,%Ingresos\n';
        dishes.forEach(d => {
          csv += `${d.rank},"${d.product_name}","${d.category_name}",${d.total_qty},${d.orders_count},${d.days_sold},${d.total_revenue.toFixed(2)},${d.pct_revenue}\n`;
        });
        filename = 'platos_vendidos';
        break;
      }
      case 'bi': {
        const analysis = this.data.dayAnalysis?.analysis || [];
        csv = 'Día,Prom Ventas,Prom Ingresos,Ticket Prom,Min,Max,Tendencia,Predicción,Confianza\n';
        analysis.forEach(d => {
          csv += `${d.name},${d.avgSales},${d.avgRevenue.toFixed(2)},${d.avgTicket.toFixed(2)},${d.minSales},${d.maxSales},${d.trend},${d.prediction},${d.confidence}%\n`;
        });
        filename = 'analisis_bi';
        break;
      }
      case 'financial': {
        const pnl = this.data.pnl || {};
        const exp = pnl.expenses || {};
        csv = 'Concepto,Monto\n';
        csv += `Ingresos,${(pnl.revenue || 0).toFixed(2)}\n`;
        csv += `Compras Insumos,-${(exp.inventory || 0).toFixed(2)}\n`;
        csv += `Inversiones,-${(exp.investments || 0).toFixed(2)}\n`;
        csv += `Nómina,-${(exp.payroll || 0).toFixed(2)}\n`;
        csv += `Retiros de Caja,-${(pnl.withdrawals || 0).toFixed(2)}\n`;
        csv += `Ganancia Neta,${(pnl.netProfit || 0).toFixed(2)}\n`;
        csv += `Margen %,${pnl.marginPct || 0}\n`;
        csv += `Food Cost %,${pnl.foodCostPct || 0}\n`;
        csv += `Labor Cost %,${pnl.laborCostPct || 0}\n`;
        filename = 'financiero';
        break;
      }
      case 'strategic': {
        const prods = this.data.menuEng?.products || [];
        csv = 'Categoría,Producto,Precio,Costo Receta,Margen,Cantidad,Ingresos\n';
        prods.forEach(p => {
          csv += `"${p.category}","${p.name}",${p.price.toFixed(2)},${p.recipe_cost.toFixed(2)},${p.margin.toFixed(2)},${p.total_qty},${p.total_revenue.toFixed(2)}\n`;
        });
        filename = 'ingenieria_menu';
        break;
      }
    }

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    Toast.success('CSV descargado correctamente');
  },
};

window.Reports = Reports;
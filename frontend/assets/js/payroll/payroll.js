/**
 * ═══════════════════════════════════════════════════════
 *  Payroll Module - Nómina con Pagos Diarios
 * ═══════════════════════════════════════════════════════
 */

const Payroll = {
  employees: [],
  entries: [],
  summary: {},
  currentRange: 'month',

  async init(container) {
    await this.loadData();
    this.render(container);
  },

  async loadData() {
    try {
      const [empRes, entriesRes, summaryRes] = await Promise.all([
        API.get('/payroll/employees?active=true'),
        API.get('/payroll/entries'),
        API.get(`/payroll/summary?range=${this.currentRange}`),
      ]);
      this.employees = empRes.data || [];
      this.entries = entriesRes.data?.entries || [];
      this.summary = summaryRes.data || {};
    } catch (err) {
      Toast.error('Error cargando nómina');
    }
  },

  async changeRange(range) {
    this.currentRange = range;
    try {
      const summaryRes = await API.get(`/payroll/summary?range=${range}`);
      this.summary = summaryRes.data || {};
      this.updateSummaryUI();
      document.querySelectorAll('.range-btn').forEach((b) => b.classList.toggle('active', b.dataset.range === range));
    } catch (err) {
      Toast.error('Error cargando resumen');
    }
  },

  render(container) {
    const s = this.summary;

    container.innerHTML = `
      <div class="page-content">
        <div class="page-header">
          <div>
            <h2 class="page-title">👥 Nómina</h2>
            <p class="page-description">Pagos diarios a empleados y análisis de costos</p>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-primary" onclick="Payroll.showPaymentModal()">💵 Registrar Pago</button>
            <button class="btn btn-outline" onclick="Payroll.showEmployeeModal()">➕ Nuevo Empleado</button>
          </div>
        </div>

        <!-- Filtro de período -->
        <div style="display:flex;gap:8px;margin-bottom:var(--space-lg)">
          <button class="pos-category-btn range-btn ${this.currentRange === 'today' ? 'active' : ''}" data-range="today" onclick="Payroll.changeRange('today')">Hoy</button>
          <button class="pos-category-btn range-btn ${this.currentRange === 'week' ? 'active' : ''}" data-range="week" onclick="Payroll.changeRange('week')">Semana</button>
          <button class="pos-category-btn range-btn ${this.currentRange === 'month' ? 'active' : ''}" data-range="month" onclick="Payroll.changeRange('month')">Mes</button>
        </div>

        <!-- Stats -->
        <div class="stats-grid" id="payroll-summary" style="grid-template-columns:repeat(4,1fr)">
          ${this.renderSummaryCards()}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-lg)">
          <!-- Empleados -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">👥 Empleados (${this.employees.length})</h3>
            </div>
            <div class="table-wrapper">
              <table class="data-table">
                <thead><tr><th>Nombre</th><th>Rol</th><th>Salario Base</th><th></th></tr></thead>
                <tbody>
                  ${this.employees.map((e) => `
                    <tr>
                      <td><strong>${e.name}</strong><br><span class="text-muted fs-xs">${e.id_number || 'Sin CI'}</span></td>
                      <td>${e.role || '-'}</td>
                      <td class="fw-bold">$${parseFloat(e.base_salary).toFixed(2)}</td>
                      <td><button class="btn btn-sm btn-outline" onclick="Payroll.showEmployeeModal(${e.id})">✏️</button></td>
                    </tr>
                  `).join('')}
                  ${this.employees.length === 0 ? '<tr><td colspan="4" class="text-center text-muted" style="padding:30px">Sin empleados</td></tr>' : ''}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Historial de Pagos -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">📜 Últimos Pagos</h3>
            </div>
            <div class="table-wrapper">
              <table class="data-table">
                <thead><tr><th>Empleado</th><th>Fecha</th><th>Monto</th><th>Método</th><th></th></tr></thead>
                <tbody>
                  ${this.entries.slice(0, 20).map((e) => {
      const methodIcon = e.payment_method === 'transfer' ? '📱' : '💵';
      const methodLabel = e.payment_method === 'transfer' ? 'Transfer.' : 'Efectivo';
      const date = e.payment_date ? new Date(e.payment_date).toLocaleDateString('es-EC') : '-';
      return `
                    <tr>
                      <td><strong>${e.employee_name}</strong></td>
                      <td class="fs-sm">${date}</td>
                      <td class="fw-bold text-accent">$${parseFloat(e.net_pay).toFixed(2)}</td>
                      <td><span class="badge" style="background:${e.payment_method === 'transfer' ? 'rgba(59,130,246,0.15);color:#3b82f6' : 'rgba(16,185,129,0.15);color:#10b981'}">${methodIcon} ${methodLabel}</span></td>
                      <td><button class="btn btn-sm btn-outline" onclick="Payroll.deleteEntry(${e.id})" style="color:#ef4444" title="Eliminar">🗑️</button></td>
                    </tr>`;
    }).join('')}
                  ${this.entries.length === 0 ? '<tr><td colspan="5" class="text-center text-muted" style="padding:30px">Sin pagos registrados</td></tr>' : ''}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Pago -->
      <div class="modal-overlay" id="payment-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">💵 Registrar Pago Diario</h3>
            <button class="modal-close" onclick="Payroll.closeModal('payment-modal')">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group"><label class="form-label">Empleado *</label>
              <select class="form-input" id="pay-employee" onchange="Payroll.autoFillSalary()">
                <option value="">Seleccionar...</option>
                ${this.employees.map((e) => `<option value="${e.id}" data-salary="${e.base_salary}">${e.name} ($${parseFloat(e.base_salary).toFixed(2)}/mes)</option>`).join('')}
              </select>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div class="form-group"><label class="form-label">Monto a Pagar $</label>
                <input type="number" class="form-input" id="pay-amount" step="0.01" placeholder="Ej: 25.00">
              </div>
              <div class="form-group"><label class="form-label">Método de Pago</label>
                <select class="form-input" id="pay-method">
                  <option value="cash">💵 Efectivo</option>
                  <option value="transfer">📱 Transferencia</option>
                </select>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div class="form-group"><label class="form-label">Bonificaciones $</label>
                <input type="number" class="form-input" id="pay-bonus" step="0.01" value="0">
              </div>
              <div class="form-group"><label class="form-label">Deducciones $</label>
                <input type="number" class="form-input" id="pay-deductions" step="0.01" value="0">
              </div>
            </div>
            <div class="form-group"><label class="form-label">Notas</label>
              <input type="text" class="form-input" id="pay-notes" placeholder="Ej: Pago del día, horas extra...">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="Payroll.closeModal('payment-modal')">Cancelar</button>
            <button class="btn btn-primary" onclick="Payroll.savePayment()">💾 Registrar Pago</button>
          </div>
        </div>
      </div>

      <!-- Modal Empleado -->
      <div class="modal-overlay" id="employee-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title" id="emp-modal-title">Nuevo Empleado</h3>
            <button class="modal-close" onclick="Payroll.closeModal('employee-modal')">✕</button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="emp-id">
            <div class="form-group"><label class="form-label">Nombre *</label><input type="text" class="form-input" id="emp-name"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div class="form-group"><label class="form-label">Cédula</label><input type="text" class="form-input" id="emp-ci"></div>
              <div class="form-group"><label class="form-label">Rol</label><input type="text" class="form-input" id="emp-role" placeholder="Ej: Cocinero"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div class="form-group"><label class="form-label">Salario Base $</label><input type="number" class="form-input" id="emp-salary" step="0.01"></div>
              <div class="form-group"><label class="form-label">Teléfono</label><input type="text" class="form-input" id="emp-phone"></div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="Payroll.closeModal('employee-modal')">Cancelar</button>
            <button class="btn btn-primary" onclick="Payroll.saveEmployee()">💾 Guardar</button>
          </div>
        </div>
      </div>
    `;
  },

  renderSummaryCards() {
    const s = this.summary;
    return `
      <div class="stat-card">
        <div class="stat-icon success">💰</div>
        <div>
          <div class="stat-value">$${parseFloat(s.total_paid || 0).toFixed(2)}</div>
          <div class="stat-label">Total Pagado (${s.total_payments || 0} pagos)</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(16,185,129,0.15);color:#10b981">💵</div>
        <div>
          <div class="stat-value">$${parseFloat(s.cash_total || 0).toFixed(2)}</div>
          <div class="stat-label">Efectivo (${s.cash_count || 0})</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(59,130,246,0.15);color:#3b82f6">📱</div>
        <div>
          <div class="stat-value">$${parseFloat(s.transfer_total || 0).toFixed(2)}</div>
          <div class="stat-label">Transferencia (${s.transfer_count || 0})</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon info">👥</div>
        <div>
          <div class="stat-value">${this.employees.length}</div>
          <div class="stat-label">Empleados Activos</div>
        </div>
      </div>
    `;
  },

  updateSummaryUI() {
    const el = document.getElementById('payroll-summary');
    if (el) el.innerHTML = this.renderSummaryCards();
  },

  autoFillSalary() {
    const sel = document.getElementById('pay-employee');
    const opt = sel.options[sel.selectedIndex];
    const salary = parseFloat(opt?.dataset?.salary || 0);
    document.getElementById('pay-amount').value = (salary / 30).toFixed(2);
  },

  closeModal(id) {
    document.getElementById(id)?.classList.remove('active');
  },

  showPaymentModal() {
    document.getElementById('pay-employee').value = '';
    document.getElementById('pay-amount').value = '';
    document.getElementById('pay-method').value = 'cash';
    document.getElementById('pay-bonus').value = '0';
    document.getElementById('pay-deductions').value = '0';
    document.getElementById('pay-notes').value = '';
    document.getElementById('payment-modal').classList.add('active');
  },

  showEmployeeModal(id = null) {
    const emp = id ? this.employees.find((e) => e.id === id) : null;
    document.getElementById('emp-modal-title').textContent = emp ? 'Editar Empleado' : 'Nuevo Empleado';
    document.getElementById('emp-id').value = emp?.id || '';
    document.getElementById('emp-name').value = emp?.name || '';
    document.getElementById('emp-ci').value = emp?.id_number || '';
    document.getElementById('emp-role').value = emp?.role || '';
    document.getElementById('emp-salary').value = emp ? parseFloat(emp.base_salary) : '';
    document.getElementById('emp-phone').value = emp?.phone || '';
    document.getElementById('employee-modal').classList.add('active');
  },

  async savePayment() {
    const employeeId = parseInt(document.getElementById('pay-employee').value);
    const baseSalary = parseFloat(document.getElementById('pay-amount').value);
    const paymentMethod = document.getElementById('pay-method').value;
    const bonuses = parseFloat(document.getElementById('pay-bonus').value) || 0;
    const deductions = parseFloat(document.getElementById('pay-deductions').value) || 0;
    const notes = document.getElementById('pay-notes').value;

    if (!employeeId) return Toast.error('Selecciona un empleado');
    if (!baseSalary || baseSalary <= 0) return Toast.error('Ingresa un monto válido');

    try {
      await API.post('/payroll/entries', {
        employeeId,
        baseSalary,
        bonuses,
        deductions,
        paymentMethod,
        notes,
        iessContribution: 0,
      });
      Toast.success('Pago registrado exitosamente');
      this.closeModal('payment-modal');
      await this.loadData();
      this.render(document.getElementById('page-container'));
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async saveEmployee() {
    const id = document.getElementById('emp-id').value;
    const data = {
      name: document.getElementById('emp-name').value,
      idNumber: document.getElementById('emp-ci').value,
      role: document.getElementById('emp-role').value,
      baseSalary: parseFloat(document.getElementById('emp-salary').value) || 0,
      phone: document.getElementById('emp-phone').value,
    };

    if (!data.name) return Toast.error('El nombre es requerido');

    try {
      if (id) {
        await API.put(`/payroll/employees/${id}`, data);
        Toast.success('Empleado actualizado');
      } else {
        await API.post('/payroll/employees', data);
        Toast.success('Empleado creado');
      }
      this.closeModal('employee-modal');
      await this.loadData();
      this.render(document.getElementById('page-container'));
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async deleteEntry(id) {
    if (!confirm('¿Eliminar este pago?')) return;
    try {
      await API.delete(`/payroll/entries/${id}`);
      Toast.success('Pago eliminado');
      await this.loadData();
      this.render(document.getElementById('page-container'));
    } catch (err) {
      Toast.error(err.message);
    }
  },
};

window.Payroll = Payroll;

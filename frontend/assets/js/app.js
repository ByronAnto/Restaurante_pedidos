/**
 * ═══════════════════════════════════════════════════════
 *  App Router - SPA Navigation & UI Utilities
 * ═══════════════════════════════════════════════════════
 */

const App = {
  currentPage: null,

  /**
   * Inicializa la aplicación
   */
  init() {
    if (!API.isAuthenticated()) {
      return;  // Queda en login
    }

    // Cargar shell del dashboard
    this.loadDashboard();
  },

  /**
   * Carga la estructura del dashboard
   */
  async loadDashboard() {
    const user = API.getUser();
    const mainContent = document.getElementById('app');

    mainContent.innerHTML = `
      <div class="app-layout">
        <!-- Sidebar -->
        <aside class="sidebar" id="sidebar">
          <div class="sidebar-brand">
            <div class="sidebar-brand-icon">🍽️</div>
            <div>
              <div class="sidebar-brand-text">RestaurantePOS</div>
              <div class="sidebar-brand-sub">Sistema de Gestión</div>
            </div>
          </div>

          <nav class="sidebar-nav">
            <div class="nav-section">
              <div class="nav-section-title">Principal</div>
              ${user.role !== 'kitchen' ? `
              <div class="nav-item ${user.role !== 'kitchen' ? 'active' : ''}" data-page="pos" onclick="App.navigate('pos')">
                <span class="nav-item-icon">🛒</span>
                <span class="nav-item-text">Punto de Venta</span>
              </div>` : ''}
              <div class="nav-item ${user.role === 'kitchen' ? 'active' : ''}" data-page="kitchen" onclick="App.navigate('kitchen')">
                <span class="nav-item-icon">👨‍🍳</span>
                <span class="nav-item-text">Comandera</span>
                <span class="nav-item-badge" id="kitchen-badge" style="display:none">0</span>
              </div>
            </div>

            ${user.role === 'admin' ? `
            <div class="nav-section">
              <div class="nav-section-title">Gestión</div>
              <div class="nav-item" data-page="products" onclick="App.navigate('products')">
                <span class="nav-item-icon">📦</span>
                <span class="nav-item-text">Productos</span>
              </div>
              <div class="nav-item" data-page="inventory" onclick="App.navigate('inventory')">
                <span class="nav-item-icon">🏪</span>
                <span class="nav-item-text">Inventario</span>
              </div>
              <div class="nav-item" data-page="recipes" onclick="App.navigate('recipes')">
                <span class="nav-item-icon">📋</span>
                <span class="nav-item-text">Recetas</span>
              </div>
              <div class="nav-item" data-page="investments" onclick="App.navigate('investments')">
                <span class="nav-item-icon">💰</span>
                <span class="nav-item-text">Inversiones</span>
              </div>
              <div class="nav-item" data-page="payroll" onclick="App.navigate('payroll')">
                <span class="nav-item-icon">👥</span>
                <span class="nav-item-text">Nómina</span>
              </div>
              <div class="nav-item" data-page="reports" onclick="App.navigate('reports')">
                <span class="nav-item-icon">📊</span>
                <span class="nav-item-text">Reportes</span>
              </div>
            </div>

            <div class="nav-section">
              <div class="nav-section-title">Sistema</div>
              <div class="nav-item" data-page="users" onclick="App.navigate('users')">
                <span class="nav-item-icon">🔐</span>
                <span class="nav-item-text">Usuarios</span>
              </div>
              <div class="nav-item" data-page="config" onclick="App.navigate('config')">
                <span class="nav-item-icon">⚙️</span>
                <span class="nav-item-text">Configuración</span>
              </div>
            </div>` : ''}
          </nav>

          <div class="sidebar-footer">
            <div class="sidebar-user">
              <div class="sidebar-user-avatar">${user.fullName.charAt(0).toUpperCase()}</div>
              <div class="sidebar-user-info">
                <div class="sidebar-user-name">${user.fullName}</div>
                <div class="sidebar-user-role">${user.role}</div>
              </div>
              <button class="sidebar-logout" onclick="API.logout()" title="Cerrar Sesión">🚪</button>
            </div>
          </div>
        </aside>

        <!-- Main -->
        <main class="main-content">
          <header class="main-header">
            <div>
              <div class="header-title" id="header-title">Punto de Venta</div>
              <div class="header-subtitle" id="header-subtitle">Crea y gestiona tus ventas</div>
            </div>
            <div class="header-actions">
              <div class="header-datetime">
                <div class="time" id="header-time"></div>
                <div id="header-date"></div>
              </div>
            </div>
          </header>

          <div id="page-container"></div>
        </main>
      </div>
    `;

    // Iniciar reloj
    this.updateClock();
    setInterval(() => this.updateClock(), 1000);

    // Navegar según rol
    const defaultPage = user.role === 'kitchen' ? 'kitchen' : 'pos';
    this.navigate(defaultPage);
  },

  /**
   * Navega a una página
   */
  async navigate(page) {
    // Protección por rol
    const user = API.getUser();
    const adminOnlyPages = ['products', 'inventory', 'recipes', 'investments', 'payroll', 'reports', 'users', 'config'];
    // Rol cocina solo puede ver comandera
    if (user?.role === 'kitchen' && page !== 'kitchen') {
      Toast.warning('Solo tiene acceso a la Comandera');
      return;
    }
    if (user?.role !== 'admin' && adminOnlyPages.includes(page)) {
      Toast.warning('No tiene permisos para acceder a esta sección');
      return;
    }

    this.currentPage = page;

    // Actualizar sidebar
    document.querySelectorAll('.nav-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    // Actualizar header
    const titles = {
      pos: ['Punto de Venta', 'Crea y gestiona tus ventas'],
      kitchen: ['Comandera Digital', 'Gestión de pedidos en cocina'],
      products: ['Productos', 'Gestiona tu catálogo y precios'],
      inventory: ['Inventario', 'Control de insumos y costos'],
      recipes: ['Recetas', 'Costo por plato e ingredientes'],
      investments: ['Inversiones', 'Registro de compras y gastos'],
      payroll: ['Nómina', 'Gestión de empleados y pagos'],
      reports: ['Reportes', 'Análisis de ventas y rendimiento'],
      users: ['Usuarios', 'Gestión de cuentas y accesos'],
      config: ['Configuración', 'Ajustes del sistema'],
    };

    const [title, subtitle] = titles[page] || ['', ''];
    document.getElementById('header-title').textContent = title;
    document.getElementById('header-subtitle').textContent = subtitle;

    // Cargar módulo
    const container = document.getElementById('page-container');
    container.innerHTML = '<div class="page-content"><div class="loading-spinner" style="text-align:center;padding:60px"><div class="spinner" style="margin:0 auto"></div><p style="margin-top:12px;color:var(--text-muted)">Cargando...</p></div></div>';

    try {
      switch (page) {
        case 'pos': await POS.init(container); break;
        case 'kitchen': await Kitchen.init(container); break;
        case 'products': await Products.init(container); break;
        case 'inventory': await Inventory.init(container); break;
        case 'recipes': await Recipes.init(container); break;
        case 'investments': await Investments.init(container); break;
        case 'payroll': await Payroll.init(container); break;
        case 'reports': await Reports.init(container); break;
        case 'users': await Users.init(container); break;
        case 'config': await Config.init(container); break;
        default: container.innerHTML = '<div class="page-content"><div class="empty-state"><div class="empty-state-icon">🚧</div><div class="empty-state-text">Página en construcción</div></div></div>';
      }
    } catch (err) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-text">Error cargando la página</div><p class="text-muted">${err.message}</p></div></div>`;
    }
  },

  /**
   * Actualiza el reloj
   */
  updateClock() {
    const now = new Date();
    const timeEl = document.getElementById('header-time');
    const dateEl = document.getElementById('header-date');
    if (timeEl) {
      timeEl.textContent = now.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
  },
};

// ─── Toast Notifications ───
const Toast = {
  container: null,

  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },

  show(message, type = 'info', duration = 3500) {
    this.init();
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;

    this.container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  },

  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error', 5000); },
  warning(msg) { this.show(msg, 'warning'); },
  info(msg) { this.show(msg, 'info'); },
};

window.Toast = Toast;
window.App = App;

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
            <button class="sidebar-toggle" id="sidebar-toggle" onclick="App.toggleSidebar()" title="Menú">
              <span class="toggle-bar"></span>
              <span class="toggle-bar"></span>
              <span class="toggle-bar"></span>
            </button>
            <div class="sidebar-brand-icon">🍽️</div>
            <div class="sidebar-brand-info">
              <div class="sidebar-brand-text">RestaurantePOS</div>
              <div class="sidebar-brand-sub">Sistema de Gestión</div>
            </div>
          </div>

          <nav class="sidebar-nav">
            <div class="nav-section">
              <div class="nav-section-title">Principal</div>
              ${user.role !== 'kitchen' ? `
              <div class="nav-item ${user.role !== 'kitchen' ? 'active' : ''}" data-page="pos" data-tooltip="Punto de Venta" onclick="App.navigate('pos')">
                <span class="nav-item-icon">🛒</span>
                <span class="nav-item-text">Punto de Venta</span>
              </div>` : ''}
              <div class="nav-item" data-page="orders" data-tooltip="Pedidos" onclick="App.navigate('orders')">
                <span class="nav-item-icon">📝</span>
                <span class="nav-item-text">Pedidos</span>
              </div>
              <div class="nav-item ${user.role === 'kitchen' ? 'active' : ''}" data-page="kitchen" data-tooltip="Comandera" onclick="App.navigate('kitchen')">
                <span class="nav-item-icon">👨‍🍳</span>
                <span class="nav-item-text">Comandera</span>
                <span class="nav-item-badge" id="kitchen-badge" style="display:none">0</span>
              </div>
            </div>

            ${user.role === 'admin' ? `
            <div class="nav-section">
              <div class="nav-section-title">Gestión</div>
              <div class="nav-item" data-page="products" data-tooltip="Productos" onclick="App.navigate('products')">
                <span class="nav-item-icon">📦</span>
                <span class="nav-item-text">Productos</span>
              </div>
              <div class="nav-item" data-page="inventory" data-tooltip="Inventario" onclick="App.navigate('inventory')">
                <span class="nav-item-icon">🏪</span>
                <span class="nav-item-text">Inventario</span>
              </div>
              <div class="nav-item" data-page="recipes" data-tooltip="Recetas" onclick="App.navigate('recipes')">
                <span class="nav-item-icon">📋</span>
                <span class="nav-item-text">Recetas</span>
              </div>
              <div class="nav-item" data-page="investments" data-tooltip="Inversiones" onclick="App.navigate('investments')">
                <span class="nav-item-icon">💰</span>
                <span class="nav-item-text">Inversiones</span>
              </div>
              <div class="nav-item" data-page="payroll" data-tooltip="Nómina" onclick="App.navigate('payroll')">
                <span class="nav-item-icon">👥</span>
                <span class="nav-item-text">Nómina</span>
              </div>
              <div class="nav-item" data-page="reports" data-tooltip="Reportes" onclick="App.navigate('reports')">
                <span class="nav-item-icon">📊</span>
                <span class="nav-item-text">Reportes</span>
              </div>
            </div>

            <div class="nav-section">
              <div class="nav-section-title">Sistema</div>
              <div class="nav-item" data-page="users" data-tooltip="Usuarios" onclick="App.navigate('users')">
                <span class="nav-item-icon">🔐</span>
                <span class="nav-item-text">Usuarios</span>
              </div>
              <div class="nav-item" data-page="config" data-tooltip="Configuración" onclick="App.navigate('config')">
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

        <!-- Mobile overlay for sidebar -->
        <div class="sidebar-overlay" id="sidebar-overlay" onclick="App.closeMobileMenu()"></div>

        <!-- Main -->
        <main class="main-content">
          <header class="main-header">
            <div style="display:flex;align-items:center;gap:var(--space-sm)">
              <button class="mobile-menu-btn" id="mobile-menu-btn" onclick="App.toggleMobileMenu()">☰</button>
              <div>
                <div class="header-title" id="header-title">Punto de Venta</div>
                <div class="header-subtitle" id="header-subtitle">Crea y gestiona tus ventas</div>
              </div>
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

    // Restaurar estado del sidebar
    this.restoreSidebarState();

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

    // Cerrar sidebar en mobile
    this.closeMobileMenu();

    // Actualizar sidebar
    document.querySelectorAll('.nav-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    // Actualizar header
    const titles = {
      pos: ['Punto de Venta', 'Crea y gestiona tus ventas'],
      orders: ['Pedidos', 'Historial de pedidos abiertos, cerrados y anulados'],
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
        case 'orders': await Orders.init(container); break;
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
   * Toggle sidebar colapsado/expandido
   */
  toggleSidebar() {
    // En mobile, usar mobile menu en su lugar
    if (window.innerWidth <= 768) {
      this.toggleMobileMenu();
      return;
    }
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const collapsed = sidebar.classList.toggle('collapsed');
    localStorage.setItem('sidebar_collapsed', collapsed ? '1' : '0');
  },

  /**
   * Restaurar estado guardado del sidebar
   */
  restoreSidebarState() {
    // No restaurar en mobile
    if (window.innerWidth <= 768) return;
    const saved = localStorage.getItem('sidebar_collapsed');
    const sidebar = document.getElementById('sidebar');
    if (saved === '1' && sidebar) {
      sidebar.classList.add('collapsed');
    }
  },

  /**
   * Toggle mobile menu (sidebar overlay)
   */
  toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar) return;
    const isOpen = sidebar.classList.toggle('mobile-open');
    if (overlay) overlay.classList.toggle('active', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  },

  /**
   * Cierra el mobile menu
   */
  closeMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
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

/**
 * ═══════════════════════════════════════════════════════
 *  Login Module
 * ═══════════════════════════════════════════════════════
 */

const Login = {
    init() {
        const form = document.getElementById('login-form');
        const errorEl = document.getElementById('login-error');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;
            const btn = document.getElementById('login-btn');

            if (!username || !password) {
                this.showError('Ingrese usuario y contraseña');
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '<div class="spinner"></div> Ingresando...';
            errorEl.classList.remove('show');

            try {
                const res = await API.login(username, password);

                if (res && res.success) {
                    Toast.success(`Bienvenido, ${res.data.user.fullName}`);
                    setTimeout(() => App.init(), 300);
                }
            } catch (err) {
                this.showError(err.message || 'Error al iniciar sesión');
                btn.disabled = false;
                btn.innerHTML = '🔐 Iniciar Sesión';
            }
        });
    },

    showError(msg) {
        const errorEl = document.getElementById('login-error');
        errorEl.querySelector('.error-text').textContent = msg;
        errorEl.classList.add('show');
    },
};

// Auto-inicializar si estamos en login
document.addEventListener('DOMContentLoaded', () => {
    if (API.isAuthenticated()) {
        App.init();
    } else {
        Login.init();
    }
});

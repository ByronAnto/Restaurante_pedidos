/**
 * ═══════════════════════════════════════════════════════
 *  API Client - HTTP client con JWT interceptor
 *  Maneja todas las peticiones al backend
 * ═══════════════════════════════════════════════════════
 */

const API = {
    baseUrl: window.location.origin + '/api',

    /**
     * Obtiene el token JWT almacenado
     */
    getToken() {
        return localStorage.getItem('token');
    },

    /**
     * Almacena el token JWT
     */
    setToken(token) {
        localStorage.setItem('token', token);
    },

    /**
     * Obtiene datos del usuario
     */
    getUser() {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    },

    /**
     * Almacena datos del usuario
     */
    setUser(user) {
        localStorage.setItem('user', JSON.stringify(user));
    },

    /**
     * Limpia la sesión
     */
    clearSession() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    },

    /**
     * Verifica si hay sesión activa
     */
    isAuthenticated() {
        return !!this.getToken();
    },

    /**
     * Petición HTTP genérica con JWT
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const token = this.getToken();

        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` }),
                ...options.headers,
            },
            ...options,
        };

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (response.status === 401) {
                this.clearSession();
                window.location.href = '/';
                return null;
            }

            if (!response.ok) {
                throw { status: response.status, message: data.message || 'Error en la petición' };
            }

            return data;
        } catch (error) {
            if (error.status) throw error;
            throw { status: 0, message: 'Error de conexión con el servidor' };
        }
    },

    // ─── Métodos HTTP ───

    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },

    post(endpoint, body) {
        return this.request(endpoint, { method: 'POST', body });
    },

    put(endpoint, body) {
        return this.request(endpoint, { method: 'PUT', body });
    },

    patch(endpoint, body) {
        return this.request(endpoint, { method: 'PATCH', body });
    },

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    },

    // ─── Auth ───

    async login(username, password) {
        const res = await this.post('/auth/login', { username, password });
        if (res && res.success) {
            this.setToken(res.data.token);
            this.setUser(res.data.user);
        }
        return res;
    },

    logout() {
        this.clearSession();
        window.location.href = '/';
    },
};

// Hacer API disponible globalmente
window.API = API;

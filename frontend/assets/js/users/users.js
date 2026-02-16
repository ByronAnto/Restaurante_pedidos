/**
 * ═══════════════════════════════════════════════════════
 *  Users Module - Gestión de Usuarios
 *  Solo visible para administradores
 * ═══════════════════════════════════════════════════════
 */

const Users = {
    users: [],

    async init(container) {
        await this.loadUsers();
        this.render(container);
    },

    async loadUsers() {
        try {
            const res = await API.get('/auth/users');
            this.users = res.data || [];
        } catch (err) {
            Toast.error('Error cargando usuarios');
        }
    },

    render(container) {
        const currentUser = API.getUser();
        container.innerHTML = `
        <div class="page-content">
            <div class="page-header">
                <div>
                    <h2 class="page-title">👥 Gestión de Usuarios</h2>
                    <p class="page-description">Crea y administra cuentas de acceso</p>
                </div>
                <button class="btn btn-primary" onclick="Users.showForm()">➕ Nuevo Usuario</button>
            </div>

            <div class="card">
                <table class="data-table" id="users-table">
                    <thead>
                        <tr>
                            <th>Usuario</th>
                            <th>Nombre Completo</th>
                            <th>Rol</th>
                            <th>Estado</th>
                            <th>Creado</th>
                            <th style="text-align:center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.users.map(u => {
                            const isSelf = u.id === currentUser?.id;
                            const roleBadge = this.getRoleBadge(u.role);
                            const statusBadge = u.active
                                ? '<span class="badge badge-success">Activo</span>'
                                : '<span class="badge badge-danger">Inactivo</span>';
                            const created = new Date(u.created_at).toLocaleDateString('es-EC');

                            return `<tr style="${!u.active ? 'opacity:0.5' : ''}">
                                <td><strong>${u.username}</strong></td>
                                <td>${u.full_name}</td>
                                <td>${roleBadge}</td>
                                <td>${statusBadge}</td>
                                <td>${created}</td>
                                <td style="text-align:center">
                                    <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap">
                                        <button class="btn btn-sm btn-outline" onclick="Users.showForm(${u.id})" title="Editar">✏️</button>
                                        <button class="btn btn-sm btn-outline" onclick="Users.showPasswordForm(${u.id}, '${u.username}')" title="Cambiar contraseña">🔑</button>
                                        ${!isSelf ? `
                                        <button class="btn btn-sm ${u.active ? 'btn-warning' : 'btn-success'}" onclick="Users.toggleActive(${u.id})" title="${u.active ? 'Desactivar' : 'Activar'}">
                                            ${u.active ? '🚫' : '✅'}
                                        </button>
                                        <button class="btn btn-sm btn-danger" onclick="Users.deleteUser(${u.id}, '${u.username}')" title="Eliminar">🗑️</button>
                                        ` : '<span class="badge badge-info" style="font-size:11px">Tú</span>'}
                                    </div>
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
                ${this.users.length === 0 ? '<div class="empty-state" style="padding:40px"><div class="empty-state-icon">👥</div><div class="empty-state-text">No hay usuarios registrados</div></div>' : ''}
            </div>
        </div>

        <!-- Modal crear/editar usuario -->
        <div class="modal-overlay" id="user-modal" onclick="if(event.target===this)Users.closeModal()">
            <div class="modal-content" style="max-width:480px">
                <div class="modal-header">
                    <h3 class="modal-title" id="user-modal-title">Nuevo Usuario</h3>
                    <button class="modal-close" onclick="Users.closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <form id="user-form" onsubmit="Users.saveUser(event)">
                        <input type="hidden" id="user-id" value="">
                        <div class="form-group">
                            <label class="form-label">Usuario *</label>
                            <input type="text" class="form-input" id="user-username" required minlength="3" autocomplete="off">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Nombre Completo *</label>
                            <input type="text" class="form-input" id="user-fullname" required autocomplete="off">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Email</label>
                            <input type="email" class="form-input" id="user-email" autocomplete="off">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Rol *</label>
                            <select class="form-select" id="user-role" required>
                                <option value="cashier">Cajero (Solo POS + Comanda)</option>
                                <option value="waiter">Mesero (Solo POS + Comanda)</option>
                                <option value="kitchen">Cocina (Solo Comanda)</option>
                                <option value="admin">Administrador (Acceso Total)</option>
                            </select>
                        </div>
                        <div class="form-group" id="password-group">
                            <label class="form-label">Contraseña *</label>
                            <input type="password" class="form-input" id="user-password" minlength="4" autocomplete="new-password">
                            <small class="form-hint" id="password-hint" style="color:var(--text-muted);font-size:12px;margin-top:4px">Mínimo 4 caracteres</small>
                        </div>
                        <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:20px">
                            <button type="button" class="btn btn-outline" onclick="Users.closeModal()">Cancelar</button>
                            <button type="submit" class="btn btn-primary" id="user-save-btn">💾 Guardar</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <!-- Modal cambiar contraseña -->
        <div class="modal-overlay" id="password-modal" onclick="if(event.target===this)Users.closePasswordModal()">
            <div class="modal-content" style="max-width:400px">
                <div class="modal-header">
                    <h3 class="modal-title">🔑 Cambiar Contraseña</h3>
                    <button class="modal-close" onclick="Users.closePasswordModal()">✕</button>
                </div>
                <div class="modal-body">
                    <form id="password-form" onsubmit="Users.savePassword(event)">
                        <input type="hidden" id="pw-user-id" value="">
                        <p style="margin-bottom:16px;color:var(--text-muted)">Usuario: <strong id="pw-username"></strong></p>
                        <div class="form-group">
                            <label class="form-label">Nueva Contraseña *</label>
                            <input type="password" class="form-input" id="pw-new" required minlength="4" autocomplete="new-password">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Confirmar Contraseña *</label>
                            <input type="password" class="form-input" id="pw-confirm" required minlength="4" autocomplete="new-password">
                        </div>
                        <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:20px">
                            <button type="button" class="btn btn-outline" onclick="Users.closePasswordModal()">Cancelar</button>
                            <button type="submit" class="btn btn-primary">🔑 Cambiar</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
        `;
    },

    getRoleBadge(role) {
        const roles = {
            admin: { label: 'Administrador', cls: 'badge-primary' },
            cashier: { label: 'Cajero', cls: 'badge-info' },
            waiter: { label: 'Mesero', cls: 'badge-warning' },
            kitchen: { label: 'Cocina', cls: 'badge-success' },
        };
        const r = roles[role] || { label: role, cls: '' };
        return `<span class="badge ${r.cls}">${r.label}</span>`;
    },

    showForm(userId = null) {
        const modal = document.getElementById('user-modal');
        const title = document.getElementById('user-modal-title');
        const form = document.getElementById('user-form');
        const pwGroup = document.getElementById('password-group');
        const pwInput = document.getElementById('user-password');
        const usernameInput = document.getElementById('user-username');

        form.reset();
        document.getElementById('user-id').value = '';

        if (userId) {
            // Editar
            const user = this.users.find(u => u.id === userId);
            if (!user) return;

            title.textContent = '✏️ Editar Usuario';
            document.getElementById('user-id').value = user.id;
            usernameInput.value = user.username;
            usernameInput.disabled = true; // No se puede cambiar username
            document.getElementById('user-fullname').value = user.full_name;
            document.getElementById('user-email').value = user.email || '';
            document.getElementById('user-role').value = user.role;
            pwGroup.style.display = 'none';
            pwInput.required = false;
        } else {
            // Nuevo
            title.textContent = '➕ Nuevo Usuario';
            usernameInput.disabled = false;
            pwGroup.style.display = 'block';
            pwInput.required = true;
        }

        modal.classList.add('active');
    },

    closeModal() {
        document.getElementById('user-modal').classList.remove('active');
    },

    showPasswordForm(userId, username) {
        document.getElementById('pw-user-id').value = userId;
        document.getElementById('pw-username').textContent = username;
        document.getElementById('password-form').reset();
        document.getElementById('password-modal').classList.add('active');
    },

    closePasswordModal() {
        document.getElementById('password-modal').classList.remove('active');
    },

    async saveUser(e) {
        e.preventDefault();
        const id = document.getElementById('user-id').value;
        const data = {
            username: document.getElementById('user-username').value.trim(),
            fullName: document.getElementById('user-fullname').value.trim(),
            email: document.getElementById('user-email').value.trim(),
            role: document.getElementById('user-role').value,
        };

        try {
            if (id) {
                // Actualizar
                await API.put(`/auth/users/${id}`, data);
                Toast.success('Usuario actualizado');
            } else {
                // Crear
                data.password = document.getElementById('user-password').value;
                if (!data.password || data.password.length < 4) {
                    Toast.error('La contraseña debe tener al menos 4 caracteres');
                    return;
                }
                await API.post('/auth/register', data);
                Toast.success('Usuario creado');
            }

            this.closeModal();
            await this.loadUsers();
            this.render(document.getElementById('page-container'));
        } catch (err) {
            Toast.error(err.message || 'Error guardando usuario');
        }
    },

    async savePassword(e) {
        e.preventDefault();
        const id = document.getElementById('pw-user-id').value;
        const password = document.getElementById('pw-new').value;
        const confirm = document.getElementById('pw-confirm').value;

        if (password !== confirm) {
            Toast.error('Las contraseñas no coinciden');
            return;
        }

        try {
            await API.patch(`/auth/users/${id}/password`, { password });
            Toast.success('Contraseña actualizada');
            this.closePasswordModal();
        } catch (err) {
            Toast.error(err.message || 'Error cambiando contraseña');
        }
    },

    async toggleActive(userId) {
        try {
            await API.patch(`/auth/users/${userId}/toggle`);
            await this.loadUsers();
            this.render(document.getElementById('page-container'));
        } catch (err) {
            Toast.error(err.message || 'Error cambiando estado');
        }
    },

    async deleteUser(userId, username) {
        if (!confirm(`¿Eliminar al usuario "${username}"? Esta acción no se puede deshacer.`)) return;

        try {
            await API.delete(`/auth/users/${userId}`);
            Toast.success('Usuario eliminado');
            await this.loadUsers();
            this.render(document.getElementById('page-container'));
        } catch (err) {
            Toast.error(err.message || 'Error eliminando usuario');
        }
    },
};

window.Users = Users;

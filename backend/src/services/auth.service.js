const bcrypt = require('bcryptjs');
const { generateToken } = require('../config/jwt');
const { query } = require('../config/database');

class AuthService {
    /**
     * Registra un nuevo usuario
     */
    async register({ username, email, password, fullName, role = 'cashier' }) {
        const existingUser = await query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
        if (existingUser.rows.length > 0) {
            throw { statusCode: 409, message: 'El usuario o email ya existe' };
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const result = await query(
            `INSERT INTO users (username, email, password_hash, full_name, role) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, full_name, role, created_at`,
            [username, email, passwordHash, fullName, role]
        );

        return result.rows[0];
    }

    /**
     * Autentica un usuario y retorna token JWT
     */
    async login(username, password) {
        const result = await query(
            'SELECT id, username, email, password_hash, full_name, role, active FROM users WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            throw { statusCode: 401, message: 'Credenciales inválidas' };
        }

        const user = result.rows[0];

        if (!user.active) {
            throw { statusCode: 403, message: 'Usuario desactivado, contacte al administrador' };
        }

        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            throw { statusCode: 401, message: 'Credenciales inválidas' };
        }

        const token = generateToken({
            id: user.id,
            username: user.username,
            role: user.role,
        });

        return {
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: user.full_name,
                role: user.role,
            },
        };
    }

    /**
     * Obtiene el perfil del usuario actual
     */
    async getProfile(userId) {
        const result = await query(
            'SELECT id, username, email, full_name, role, active, created_at FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            throw { statusCode: 404, message: 'Usuario no encontrado' };
        }

        return result.rows[0];
    }

    /**
     * Lista todos los usuarios (solo admin)
     */
    async listUsers() {
        const result = await query(
            'SELECT id, username, email, full_name, role, active, created_at FROM users ORDER BY created_at DESC'
        );
        return result.rows;
    }

    /**
     * Actualiza estado de un usuario
     */
    async toggleUserActive(userId) {
        const result = await query(
            'UPDATE users SET active = NOT active, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, username, active',
            [userId]
        );

        if (result.rows.length === 0) {
            throw { statusCode: 404, message: 'Usuario no encontrado' };
        }

        return result.rows[0];
    }

    /**
     * Actualiza datos de un usuario (nombre, email, role)
     */
    async updateUser(userId, { fullName, email, role }) {
        const fields = [];
        const values = [];
        let idx = 1;

        if (fullName) { fields.push(`full_name = $${idx++}`); values.push(fullName); }
        if (email !== undefined) { fields.push(`email = $${idx++}`); values.push(email || null); }
        if (role) { fields.push(`role = $${idx++}`); values.push(role); }

        if (fields.length === 0) {
            throw { statusCode: 400, message: 'Nada que actualizar' };
        }

        fields.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(userId);

        const result = await query(
            `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, username, email, full_name, role, active`,
            values
        );

        if (result.rows.length === 0) {
            throw { statusCode: 404, message: 'Usuario no encontrado' };
        }

        return result.rows[0];
    }

    /**
     * Cambia la contraseña de un usuario (admin puede resetear cualquier password)
     */
    async resetPassword(userId, newPassword) {
        if (!newPassword || newPassword.length < 4) {
            throw { statusCode: 400, message: 'La contraseña debe tener al menos 4 caracteres' };
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        const result = await query(
            'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, username',
            [passwordHash, userId]
        );

        if (result.rows.length === 0) {
            throw { statusCode: 404, message: 'Usuario no encontrado' };
        }

        return result.rows[0];
    }

    /**
     * Elimina un usuario (no permite eliminarse a sí mismo)
     */
    async deleteUser(userId, requesterId) {
        if (parseInt(userId) === parseInt(requesterId)) {
            throw { statusCode: 400, message: 'No puede eliminarse a sí mismo' };
        }

        const result = await query(
            'DELETE FROM users WHERE id = $1 RETURNING id, username',
            [userId]
        );

        if (result.rows.length === 0) {
            throw { statusCode: 404, message: 'Usuario no encontrado' };
        }

        return result.rows[0];
    }
}

module.exports = new AuthService();

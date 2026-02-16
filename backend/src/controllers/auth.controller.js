const authService = require('../services/auth.service');
const { success, created, error } = require('../utils/responses');

class AuthController {
    async login(req, res, next) {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return error(res, 'Usuario y contraseña son requeridos', 400);
            }

            const result = await authService.login(username, password);
            return success(res, result, 'Inicio de sesión exitoso');
        } catch (err) {
            if (err.statusCode) {
                return error(res, err.message, err.statusCode);
            }
            next(err);
        }
    }

    async register(req, res, next) {
        try {
            const { username, email, password, fullName, role } = req.body;

            if (!username || !password || !fullName) {
                return error(res, 'Username, password y nombre completo son requeridos', 400);
            }

            const user = await authService.register({ username, email, password, fullName, role });
            return created(res, user, 'Usuario registrado exitosamente');
        } catch (err) {
            if (err.statusCode) {
                return error(res, err.message, err.statusCode);
            }
            next(err);
        }
    }

    async getProfile(req, res, next) {
        try {
            const profile = await authService.getProfile(req.user.id);
            return success(res, profile);
        } catch (err) {
            next(err);
        }
    }

    async listUsers(req, res, next) {
        try {
            const users = await authService.listUsers();
            return success(res, users);
        } catch (err) {
            next(err);
        }
    }

    async toggleUserActive(req, res, next) {
        try {
            const user = await authService.toggleUserActive(req.params.id);
            return success(res, user, `Usuario ${user.active ? 'activado' : 'desactivado'}`);
        } catch (err) {
            if (err.statusCode) {
                return error(res, err.message, err.statusCode);
            }
            next(err);
        }
    }

    async updateUser(req, res, next) {
        try {
            const { fullName, email, role } = req.body;
            const user = await authService.updateUser(req.params.id, { fullName, email, role });
            return success(res, user, 'Usuario actualizado');
        } catch (err) {
            if (err.statusCode) {
                return error(res, err.message, err.statusCode);
            }
            next(err);
        }
    }

    async resetPassword(req, res, next) {
        try {
            const { password } = req.body;
            if (!password) {
                return error(res, 'La contraseña es requerida', 400);
            }
            const user = await authService.resetPassword(req.params.id, password);
            return success(res, user, 'Contraseña actualizada');
        } catch (err) {
            if (err.statusCode) {
                return error(res, err.message, err.statusCode);
            }
            next(err);
        }
    }

    async deleteUser(req, res, next) {
        try {
            const user = await authService.deleteUser(req.params.id, req.user.id);
            return success(res, user, 'Usuario eliminado');
        } catch (err) {
            if (err.statusCode) {
                return error(res, err.message, err.statusCode);
            }
            next(err);
        }
    }
}

module.exports = new AuthController();

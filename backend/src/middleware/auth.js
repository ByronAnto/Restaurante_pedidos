const { verifyToken } = require('../config/jwt');

/**
 * Middleware de autenticación JWT
 * Verifica el token en el header Authorization: Bearer <token>
 */
const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Token de acceso requerido',
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);

        req.user = {
            id: decoded.id,
            username: decoded.username,
            role: decoded.role,
        };

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expirado, inicie sesión nuevamente',
            });
        }
        return res.status(401).json({
            success: false,
            message: 'Token inválido',
        });
    }
};

/**
 * Middleware de autorización por rol
 * @param  {...string} roles - Roles permitidos
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'No autenticado',
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permisos para esta acción',
            });
        }

        next();
    };
};

module.exports = { authMiddleware, authorize };

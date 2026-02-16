/**
 * Middleware global de manejo de errores
 */
const errorHandler = (err, req, res, next) => {
    console.error('❌ Error:', err.stack || err.message);

    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({
            success: false,
            message: 'JSON inválido en el cuerpo de la petición',
        });
    }

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Error interno del servidor';

    res.status(statusCode).json({
        success: false,
        message: process.env.NODE_ENV === 'development' ? message : 'Error interno del servidor',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};

/**
 * Middleware para rutas no encontradas
 */
const notFound = (req, res) => {
    res.status(404).json({
        success: false,
        message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
    });
};

module.exports = { errorHandler, notFound };

/**
 * Utilidades para respuestas estandarizadas de la API
 */

const success = (res, data = null, message = 'Operación exitosa', statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
    });
};

const created = (res, data = null, message = 'Recurso creado exitosamente') => {
    return success(res, data, message, 201);
};

const error = (res, message = 'Error en la operación', statusCode = 400) => {
    return res.status(statusCode).json({
        success: false,
        message,
    });
};

const paginated = (res, data, total, page, limit, message = 'Consulta exitosa') => {
    return res.status(200).json({
        success: true,
        message,
        data,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    });
};

module.exports = { success, created, error, paginated };

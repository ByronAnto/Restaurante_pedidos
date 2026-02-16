const { query } = require('../config/database');
const { success, error } = require('../utils/responses');

class ConfigController {
    /**
     * Obtiene todas las configuraciones o por grupo
     */
    async getConfig(req, res, next) {
        try {
            const { group } = req.query;
            let sql = 'SELECT * FROM config';
            const params = [];

            if (group) {
                sql += ' WHERE config_group = $1';
                params.push(group);
            }
            sql += ' ORDER BY config_group, key';

            const result = await query(sql, params);

            // Agrupar por config_group
            const grouped = {};
            result.rows.forEach((row) => {
                if (!grouped[row.config_group]) grouped[row.config_group] = {};
                grouped[row.config_group][row.key] = row.value;
            });

            return success(res, { raw: result.rows, grouped });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Obtiene una configuración por clave
     */
    async getConfigByKey(req, res, next) {
        try {
            const result = await query('SELECT * FROM config WHERE key = $1', [req.params.key]);
            if (result.rows.length === 0) return error(res, 'Configuración no encontrada', 404);
            return success(res, result.rows[0]);
        } catch (err) {
            next(err);
        }
    }

    /**
     * Actualiza una o múltiples configuraciones
     */
    async updateConfig(req, res, next) {
        try {
            const { configs } = req.body;

            if (!configs || !Array.isArray(configs)) {
                return error(res, 'Se requiere un array de configuraciones [{key, value}]', 400);
            }

            const updated = [];
            for (const { key, value } of configs) {
                const result = await query(
                    'UPDATE config SET value = $1, updated_at = CURRENT_TIMESTAMP WHERE key = $2 RETURNING *',
                    [value, key]
                );
                if (result.rows.length > 0) updated.push(result.rows[0]);
            }

            return success(res, updated, `${updated.length} configuraciones actualizadas`);
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new ConfigController();

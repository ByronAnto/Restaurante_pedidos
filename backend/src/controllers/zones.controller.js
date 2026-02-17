/**
 * ═══════════════════════════════════════════════════════
 *  Zones Controller - Gestión de Zonas del Restaurante
 *  CRUD para zonas del plano (Cocina, Salón, etc.)
 * ═══════════════════════════════════════════════════════
 */

const { query } = require('../config/database');
const { success, error, created } = require('../utils/responses');

class ZonesController {
    /**
     * Lista todas las zonas activas con conteo de mesas
     */
    async getZones(req, res, next) {
        try {
            const result = await query(`
                SELECT z.*,
                    COALESCE(COUNT(t.id), 0)::int as table_count
                FROM zones z
                LEFT JOIN tables t ON t.zone_id = z.id AND t.active = true
                WHERE z.active = true
                GROUP BY z.id
                ORDER BY z.display_order, z.id
            `);
            return success(res, result.rows);
        } catch (err) {
            next(err);
        }
    }

    /**
     * Crear zona
     */
    async createZone(req, res, next) {
        try {
            const { name, zoneType, icon, gridCol, gridRow, gridW, gridH, color, displayOrder } = req.body;
            if (!name) return error(res, 'El nombre es requerido', 400);

            const result = await query(
                `INSERT INTO zones (name, zone_type, icon, grid_col, grid_row, grid_w, grid_h, color, display_order)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                [name, zoneType ?? 'dining', icon ?? '🍽️', gridCol ?? 0, gridRow ?? 0, gridW ?? 2, gridH ?? 2, color ?? '#10b981', displayOrder ?? 0]
            );
            return created(res, result.rows[0], 'Zona creada');
        } catch (err) {
            next(err);
        }
    }

    /**
     * Actualizar zona
     */
    async updateZone(req, res, next) {
        try {
            const { name, zoneType, icon, gridCol, gridRow, gridW, gridH, color, displayOrder } = req.body;
            const result = await query(
                `UPDATE zones SET name=$1, zone_type=$2, icon=$3, grid_col=$4, grid_row=$5,
                 grid_w=$6, grid_h=$7, color=$8, display_order=$9
                 WHERE id=$10 RETURNING *`,
                [name, zoneType, icon, gridCol, gridRow, gridW, gridH, color, displayOrder ?? 0, req.params.id]
            );
            if (result.rows.length === 0) return error(res, 'Zona no encontrada', 404);
            return success(res, result.rows[0], 'Zona actualizada');
        } catch (err) {
            next(err);
        }
    }

    /**
     * Eliminar zona
     */
    async deleteZone(req, res, next) {
        try {
            const tables = await query(
                'SELECT COUNT(*) FROM tables WHERE zone_id = $1 AND active = true',
                [req.params.id]
            );
            if (parseInt(tables.rows[0].count) > 0) {
                return error(res, 'No se puede eliminar una zona con mesas asignadas. Mueve o elimina las mesas primero.', 400);
            }

            const result = await query('DELETE FROM zones WHERE id = $1 RETURNING *', [req.params.id]);
            if (result.rows.length === 0) return error(res, 'Zona no encontrada', 404);
            return success(res, null, 'Zona eliminada');
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new ZonesController();

/**
 * ═══════════════════════════════════════════════════════
 *  Tables Controller - Gestión de Mesas del Restaurante
 * ═══════════════════════════════════════════════════════
 */

const { query } = require('../config/database');
const { success, error } = require('../utils/responses');

class TablesController {
    /**
     * Lista todas las mesas con estado actual (libre/ocupada)
     */
    async getTables(req, res, next) {
        try {
            const result = await query(`
                SELECT t.*,
                    s.id as active_sale_id,
                    s.sale_number as active_sale_number,
                    s.total as active_total,
                    s.created_at as order_started_at
                FROM tables t
                LEFT JOIN sales s ON s.table_id = t.id AND s.status = 'pending'
                WHERE t.active = true
                ORDER BY t.zone, t.name
            `);
            return success(res, result.rows);
        } catch (err) {
            next(err);
        }
    }

    /**
     * Obtiene el mapa con estado en tiempo real
     */
    async getMap(req, res, next) {
        try {
            const tablesResult = await query(`
                SELECT t.*,
                    z.zone_type, z.icon as zone_icon, z.grid_col, z.grid_row,
                    z.grid_w, z.grid_h, z.color as zone_color,
                    s.id as active_sale_id,
                    s.sale_number as active_sale_number,
                    s.total as active_total,
                    s.subtotal as active_subtotal,
                    s.created_at as order_started_at,
                    COALESCE(json_agg(json_build_object(
                        'id', si.id,
                        'product_name', si.product_name,
                        'quantity', si.quantity,
                        'unit_price', si.unit_price,
                        'subtotal', si.subtotal
                    )) FILTER (WHERE si.id IS NOT NULL), '[]') as order_items
                FROM tables t
                LEFT JOIN zones z ON z.id = t.zone_id
                LEFT JOIN sales s ON s.table_id = t.id AND s.status = 'pending'
                LEFT JOIN sale_items si ON si.sale_id = s.id
                WHERE t.active = true
                GROUP BY t.id, z.id, s.id
                ORDER BY t.zone, t.name
            `);

            // Get zones
            const zones = [...new Set(tablesResult.rows.map(t => t.zone))];

            return success(res, {
                tables: tablesResult.rows,
                zones,
                summary: {
                    total: tablesResult.rows.length,
                    free: tablesResult.rows.filter(t => !t.active_sale_id).length,
                    occupied: tablesResult.rows.filter(t => t.active_sale_id).length,
                }
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Crear mesa
     */
    async createTable(req, res, next) {
        try {
            const { name, capacity, positionX, positionY, shape, zone, zoneId } = req.body;
            if (!name) return error(res, 'El nombre es requerido', 400);

            const result = await query(
                `INSERT INTO tables (name, capacity, position_x, position_y, shape, zone, zone_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                [name, capacity || 4, positionX || 0, positionY || 0, shape || 'square', zone || 'Salón', zoneId || null]
            );
            return success(res, result.rows[0], 'Mesa creada', 201);
        } catch (err) {
            next(err);
        }
    }

    /**
     * Editar mesa
     */
    async updateTable(req, res, next) {
        try {
            const { name, capacity, positionX, positionY, shape, zone, zoneId } = req.body;
            const result = await query(
                `UPDATE tables SET name=$1, capacity=$2, position_x=$3, position_y=$4, shape=$5, zone=$6, zone_id=$7
                 WHERE id=$8 RETURNING *`,
                [name, capacity, positionX, positionY, shape, zone, zoneId, req.params.id]
            );
            if (result.rows.length === 0) return error(res, 'Mesa no encontrada', 404);
            return success(res, result.rows[0], 'Mesa actualizada');
        } catch (err) {
            next(err);
        }
    }

    /**
     * Eliminar mesa
     */
    async deleteTable(req, res, next) {
        try {
            // Check for open orders
            const openOrders = await query(
                `SELECT COUNT(*) FROM sales WHERE table_id = $1 AND status = 'pending'`,
                [req.params.id]
            );
            if (parseInt(openOrders.rows[0].count) > 0) {
                return error(res, 'No se puede eliminar una mesa con pedidos abiertos', 400);
            }

            const result = await query('DELETE FROM tables WHERE id = $1 RETURNING *', [req.params.id]);
            if (result.rows.length === 0) return error(res, 'Mesa no encontrada', 404);
            return success(res, null, 'Mesa eliminada');
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new TablesController();

const { query } = require('../config/database');
const { success, error } = require('../utils/responses');

class KitchenController {
    /**
     * Lista órdenes de cocina con filtro por estado
     */
    async getOrders(req, res, next) {
        try {
            const { status } = req.query;
            let whereClause = '';
            const params = [];

            if (status) {
                whereClause = 'WHERE ko.status = $1';
                params.push(status);
            }

            const result = await query(
                `SELECT ko.*, s.sale_number, ko.order_type, ko.table_name,
         json_agg(json_build_object(
           'id', koi.id,
           'product_name', koi.product_name,
           'quantity', koi.quantity,
           'notes', koi.notes,
           'modifiers', koi.modifiers
         )) as items
         FROM kitchen_orders ko
         LEFT JOIN sales s ON ko.sale_id = s.id
         LEFT JOIN kitchen_order_items koi ON ko.id = koi.kitchen_order_id
         ${whereClause}
         GROUP BY ko.id, s.sale_number
         ORDER BY ko.created_at ASC`,
                params
            );

            return success(res, result.rows);
        } catch (err) {
            next(err);
        }
    }

    /**
     * Obtiene órdenes activas (para la comandera digital)
     */
    async getActiveOrders(req, res, next) {
        try {
            const result = await query(
                `SELECT ko.*, s.sale_number, ko.order_type, ko.table_name,
         json_agg(json_build_object(
           'id', koi.id,
           'product_name', koi.product_name,
           'quantity', koi.quantity,
           'notes', koi.notes,
           'modifiers', koi.modifiers
         )) as items
         FROM kitchen_orders ko
         LEFT JOIN sales s ON ko.sale_id = s.id
         LEFT JOIN kitchen_order_items koi ON ko.id = koi.kitchen_order_id
         WHERE ko.status IN ('pending', 'preparing', 'ready')
         GROUP BY ko.id, s.sale_number
         ORDER BY ko.created_at ASC`
            );

            return success(res, result.rows);
        } catch (err) {
            next(err);
        }
    }

    /**
     * Actualiza estado de una orden de cocina
     */
    async updateOrderStatus(req, res, next) {
        try {
            const { status } = req.body;
            if (!status || !['pending', 'preparing', 'ready', 'delivered'].includes(status)) {
                return error(res, 'Estado inválido', 400);
            }

            const timestampField = {
                preparing: 'preparing_at',
                ready: 'ready_at',
                delivered: 'delivered_at',
            }[status];

            let sql = `UPDATE kitchen_orders SET status = $1`;
            if (timestampField) {
                sql += `, ${timestampField} = CURRENT_TIMESTAMP`;
            }
            sql += ` WHERE id = $2 RETURNING *`;

            const result = await query(sql, [status, req.params.id]);

            if (result.rows.length === 0) {
                return error(res, 'Orden no encontrada', 404);
            }

            // Emitir evento Socket.IO
            if (req.app.get('io')) {
                req.app.get('io').emit('kitchen-order-updated', {
                    orderId: result.rows[0].id,
                    status: result.rows[0].status,
                    updatedAt: new Date(),
                });
            }

            return success(res, result.rows[0], `Estado actualizado a: ${status}`);
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new KitchenController();

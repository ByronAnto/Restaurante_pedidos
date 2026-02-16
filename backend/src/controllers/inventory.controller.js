/**
 * ═══════════════════════════════════════════════════════
 *  Inventory Controller - Control de Insumos
 * ═══════════════════════════════════════════════════════
 */

const { query } = require('../config/database');
const { success, error } = require('../utils/responses');

const InventoryController = {
    /**
     * Listar ítems de inventario
     * GET /api/inventory/items
     */
    async getItems(req, res, next) {
        try {
            const result = await query(`
                SELECT * FROM inventory_items 
                WHERE active = true 
                ORDER BY name ASC
            `);
            return success(res, result.rows);
        } catch (err) {
            next(err);
        }
    },

    /**
     * Crear ítem de inventario
     * POST /api/inventory/items
     */
    async createItem(req, res, next) {
        try {
            const { name, unit, currentStock, minStock, lastCostPerUnit, category } = req.body;
            if (!name) return error(res, 'El nombre es requerido', 400);

            const result = await query(`
                INSERT INTO inventory_items (name, unit, current_stock, min_stock, last_cost_per_unit, category)
                VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
            `, [name, unit || 'kg', currentStock || 0, minStock || 0, lastCostPerUnit || 0, category || 'ingredientes']);

            return success(res, result.rows[0], 'Insumo creado', 201);
        } catch (err) {
            next(err);
        }
    },

    /**
     * Actualizar ítem
     * PUT /api/inventory/items/:id
     */
    async updateItem(req, res, next) {
        try {
            const { id } = req.params;
            const { name, unit, currentStock, minStock, lastCostPerUnit, category } = req.body;

            const result = await query(`
                UPDATE inventory_items 
                SET name = COALESCE($1, name), unit = COALESCE($2, unit), 
                    current_stock = COALESCE($3, current_stock), min_stock = COALESCE($4, min_stock),
                    last_cost_per_unit = COALESCE($5, last_cost_per_unit), category = COALESCE($6, category)
                WHERE id = $7 RETURNING *
            `, [name, unit, currentStock, minStock, lastCostPerUnit, category, id]);

            if (result.rows.length === 0) return error(res, 'Insumo no encontrado', 404);
            return success(res, result.rows[0], 'Insumo actualizado');
        } catch (err) {
            next(err);
        }
    },

    /**
     * Eliminar ítem (soft delete)
     * DELETE /api/inventory/items/:id
     */
    async deleteItem(req, res, next) {
        try {
            await query('UPDATE inventory_items SET active = false WHERE id = $1', [req.params.id]);
            return success(res, null, 'Insumo eliminado');
        } catch (err) {
            next(err);
        }
    },

    /**
     * Registrar compra de insumo
     * POST /api/inventory/purchases
     */
    async createPurchase(req, res, next) {
        try {
            const { inventoryItemId, quantity, costPerUnit, supplier, notes } = req.body;
            if (!inventoryItemId || !quantity || !costPerUnit) {
                return error(res, 'inventoryItemId, quantity y costPerUnit son requeridos', 400);
            }

            const totalCost = parseFloat(quantity) * parseFloat(costPerUnit);

            const purchase = await query(`
                INSERT INTO inventory_purchases (inventory_item_id, quantity, cost_per_unit, total_cost, supplier, notes)
                VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
            `, [inventoryItemId, quantity, costPerUnit, totalCost, supplier || null, notes || null]);

            // Actualizar stock y costo del ítem
            await query(`
                UPDATE inventory_items 
                SET current_stock = current_stock + $1, last_cost_per_unit = $2
                WHERE id = $3
            `, [quantity, costPerUnit, inventoryItemId]);

            return success(res, purchase.rows[0], 'Compra registrada', 201);
        } catch (err) {
            next(err);
        }
    },

    /**
     * Historial de compras
     * GET /api/inventory/purchases?itemId=X
     */
    async getPurchases(req, res, next) {
        try {
            const { itemId } = req.query;
            let sql = `
                SELECT ip.*, ii.name as item_name, ii.unit
                FROM inventory_purchases ip
                JOIN inventory_items ii ON ii.id = ip.inventory_item_id
            `;
            const params = [];
            if (itemId) {
                sql += ' WHERE ip.inventory_item_id = $1';
                params.push(itemId);
            }
            sql += ' ORDER BY ip.created_at DESC LIMIT 100';

            const result = await query(sql, params);
            return success(res, result.rows);
        } catch (err) {
            next(err);
        }
    },

    /**
     * Análisis MIX - Costo total por ítem
     * GET /api/inventory/analysis
     */
    async analysis(req, res, next) {
        try {
            const result = await query(`
                SELECT 
                    ii.id, ii.name, ii.unit, ii.current_stock, ii.last_cost_per_unit, ii.min_stock,
                    COALESCE(SUM(ip.total_cost), 0) as total_invested,
                    COALESCE(SUM(ip.quantity), 0) as total_purchased,
                    COUNT(ip.id) as purchase_count,
                    CASE WHEN ii.current_stock <= ii.min_stock THEN true ELSE false END as low_stock
                FROM inventory_items ii
                LEFT JOIN inventory_purchases ip ON ip.inventory_item_id = ii.id
                WHERE ii.active = true
                GROUP BY ii.id
                ORDER BY total_invested DESC
            `);

            const totals = await query(`
                SELECT 
                    COUNT(DISTINCT ii.id) as total_items,
                    COALESCE(SUM(ip.total_cost), 0) as total_invested,
                    COUNT(CASE WHEN ii.current_stock <= ii.min_stock THEN 1 END) as low_stock_count
                FROM inventory_items ii
                LEFT JOIN inventory_purchases ip ON ip.inventory_item_id = ii.id
                WHERE ii.active = true
            `);

            return success(res, {
                items: result.rows,
                summary: totals.rows[0],
            });
        } catch (err) {
            next(err);
        }
    },
};

module.exports = InventoryController;

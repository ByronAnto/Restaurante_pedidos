/**
 * ═══════════════════════════════════════════════════════
 *  Recipes Controller - Recetas y Costo por Plato
 * ═══════════════════════════════════════════════════════
 */

const { query } = require('../config/database');
const { success, error } = require('../utils/responses');

const RecipesController = {
    /**
     * Obtener receta de un producto
     * GET /api/recipes/:productId
     */
    async getRecipe(req, res, next) {
        try {
            const { productId } = req.params;
            const result = await query(`
                SELECT r.id, r.product_id, r.inventory_item_id, r.quantity_needed,
                       ii.name as ingredient_name, ii.unit, ii.last_cost_per_unit,
                       (r.quantity_needed * ii.last_cost_per_unit) as ingredient_cost
                FROM recipes r
                JOIN inventory_items ii ON ii.id = r.inventory_item_id
                WHERE r.product_id = $1
                ORDER BY ii.name
            `, [productId]);

            // Costo total de la receta
            const totalCost = result.rows.reduce((sum, r) => sum + parseFloat(r.ingredient_cost), 0);

            return success(res, { ingredients: result.rows, totalCost });
        } catch (err) {
            next(err);
        }
    },

    /**
     * Agregar ingrediente a receta
     * POST /api/recipes
     */
    async addIngredient(req, res, next) {
        try {
            const { productId, inventoryItemId, quantityNeeded } = req.body;
            if (!productId || !inventoryItemId || !quantityNeeded) {
                return error(res, 'productId, inventoryItemId y quantityNeeded son requeridos', 400);
            }

            const result = await query(`
                INSERT INTO recipes (product_id, inventory_item_id, quantity_needed)
                VALUES ($1, $2, $3)
                ON CONFLICT (product_id, inventory_item_id) 
                DO UPDATE SET quantity_needed = $3
                RETURNING *
            `, [productId, inventoryItemId, quantityNeeded]);

            return success(res, result.rows[0], 'Ingrediente agregado', 201);
        } catch (err) {
            next(err);
        }
    },

    /**
     * Eliminar ingrediente de receta
     * DELETE /api/recipes/:id
     */
    async removeIngredient(req, res, next) {
        try {
            await query('DELETE FROM recipes WHERE id = $1', [req.params.id]);
            return success(res, null, 'Ingrediente removido');
        } catch (err) {
            next(err);
        }
    },

    /**
     * Análisis: todos los productos con costo de receta vs precio de venta
     * GET /api/recipes/analysis
     */
    async analysis(req, res, next) {
        try {
            const result = await query(`
                SELECT 
                    p.id, p.name, p.price, p.cost,
                    COALESCE(SUM(r.quantity_needed * ii.last_cost_per_unit), 0) as recipe_cost,
                    COUNT(r.id) as ingredient_count
                FROM products p
                LEFT JOIN recipes r ON r.product_id = p.id
                LEFT JOIN inventory_items ii ON ii.id = r.inventory_item_id
                WHERE p.available = true
                GROUP BY p.id
                ORDER BY p.name
            `);

            const products = result.rows.map((p) => ({
                ...p,
                recipe_cost: parseFloat(p.recipe_cost),
                price: parseFloat(p.price),
                margin: parseFloat(p.price) - parseFloat(p.recipe_cost),
                margin_pct: parseFloat(p.price) > 0 ? ((parseFloat(p.price) - parseFloat(p.recipe_cost)) / parseFloat(p.price) * 100) : 0,
            }));

            return success(res, products);
        } catch (err) {
            next(err);
        }
    },
};

module.exports = RecipesController;

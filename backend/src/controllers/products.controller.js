const { query } = require('../config/database');
const { success, created, error } = require('../utils/responses');

class ProductsController {
    // ─── CATEGORÍAS ───

    async getCategories(req, res, next) {
        try {
            const result = await query('SELECT * FROM categories ORDER BY display_order ASC');
            return success(res, result.rows);
        } catch (err) {
            next(err);
        }
    }

    async createCategory(req, res, next) {
        try {
            const { name, description, icon, displayOrder } = req.body;
            if (!name) return error(res, 'El nombre es requerido', 400);

            const result = await query(
                'INSERT INTO categories (name, description, icon, display_order) VALUES ($1, $2, $3, $4) RETURNING *',
                [name, description || '', icon || '🍽️', displayOrder || 0]
            );
            return created(res, result.rows[0], 'Categoría creada');
        } catch (err) {
            next(err);
        }
    }

    async updateCategory(req, res, next) {
        try {
            const { name, description, icon, displayOrder, active } = req.body;
            const result = await query(
                `UPDATE categories SET name = COALESCE($1, name), description = COALESCE($2, description),
         icon = COALESCE($3, icon), display_order = COALESCE($4, display_order), active = COALESCE($5, active)
         WHERE id = $6 RETURNING *`,
                [name, description, icon, displayOrder, active, req.params.id]
            );
            if (result.rows.length === 0) return error(res, 'Categoría no encontrada', 404);
            return success(res, result.rows[0], 'Categoría actualizada');
        } catch (err) {
            next(err);
        }
    }

    async deleteCategory(req, res, next) {
        try {
            const result = await query('DELETE FROM categories WHERE id = $1 RETURNING id', [req.params.id]);
            if (result.rows.length === 0) return error(res, 'Categoría no encontrada', 404);
            return success(res, null, 'Categoría eliminada');
        } catch (err) {
            next(err);
        }
    }

    // ─── PRODUCTOS ───

    async getProducts(req, res, next) {
        try {
            const { categoryId, available, search } = req.query;
            let whereClause = 'WHERE 1=1';
            const params = [];
            let paramIdx = 1;

            if (categoryId) {
                whereClause += ` AND p.category_id = $${paramIdx++}`;
                params.push(categoryId);
            }
            if (available !== undefined) {
                whereClause += ` AND p.available = $${paramIdx++}`;
                params.push(available === 'true');
            }
            if (search) {
                whereClause += ` AND (p.name ILIKE $${paramIdx++})`;
                params.push(`%${search}%`);
            }

            const result = await query(
                `SELECT p.*, c.name as category_name, c.icon as category_icon
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         ${whereClause}
         ORDER BY c.display_order ASC, p.name ASC`,
                params
            );

            // Adjuntar modificadores a cada producto que los tenga
            const productIds = result.rows.map(p => p.id);
            let modifierMap = {};

            if (productIds.length > 0) {
                const groupsRes = await query(
                    `SELECT mg.*, json_agg(
                        json_build_object('id', mo.id, 'name', mo.name, 'price_adjustment', mo.price_adjustment, 'available', mo.available, 'display_order', mo.display_order)
                        ORDER BY mo.display_order
                     ) AS options
                     FROM modifier_groups mg
                     LEFT JOIN modifier_options mo ON mo.modifier_group_id = mg.id
                     WHERE mg.product_id = ANY($1)
                     GROUP BY mg.id
                     ORDER BY mg.display_order`,
                    [productIds]
                );
                for (const g of groupsRes.rows) {
                    if (!modifierMap[g.product_id]) modifierMap[g.product_id] = [];
                    // Limpiar opciones nulas (LEFT JOIN sin opciones)
                    const opts = (g.options || []).filter(o => o.id !== null);
                    modifierMap[g.product_id].push({ ...g, options: opts });
                }
            }

            const products = result.rows.map(p => ({
                ...p,
                modifier_groups: modifierMap[p.id] || [],
            }));

            return success(res, products);
        } catch (err) {
            next(err);
        }
    }

    async getProductById(req, res, next) {
        try {
            const result = await query(
                `SELECT p.*, c.name as category_name FROM products p
         LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = $1`,
                [req.params.id]
            );
            if (result.rows.length === 0) return error(res, 'Producto no encontrado', 404);
            return success(res, result.rows[0]);
        } catch (err) {
            next(err);
        }
    }

    async createProduct(req, res, next) {
        try {
            const { categoryId, name, description, price, cost, taxRate, imageUrl, available, trackStock, stockQuantity, showInAllCategories } = req.body;

            if (!name || price === undefined) {
                return error(res, 'Nombre y precio son requeridos', 400);
            }

            const result = await query(
                `INSERT INTO products (category_id, name, description, price, cost, tax_rate, image_url, available, track_stock, stock_quantity, show_in_all_categories)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
                [categoryId, name, description || '', price, cost || 0, taxRate || 15, imageUrl, available !== false, trackStock || false, stockQuantity || 0, showInAllCategories || false]
            );

            return created(res, result.rows[0], 'Producto creado');
        } catch (err) {
            next(err);
        }
    }

    async updateProduct(req, res, next) {
        try {
            const { categoryId, name, description, price, cost, taxRate, imageUrl, available, trackStock, stockQuantity, showInAllCategories } = req.body;

            const result = await query(
                `UPDATE products SET
         category_id = COALESCE($1, category_id), name = COALESCE($2, name),
         description = COALESCE($3, description), price = COALESCE($4, price),
         cost = COALESCE($5, cost), tax_rate = COALESCE($6, tax_rate),
         image_url = COALESCE($7, image_url), available = COALESCE($8, available),
         track_stock = COALESCE($9, track_stock), stock_quantity = COALESCE($10, stock_quantity),
         show_in_all_categories = COALESCE($11, show_in_all_categories),
         updated_at = CURRENT_TIMESTAMP
         WHERE id = $12 RETURNING *`,
                [categoryId, name, description, price, cost, taxRate, imageUrl, available, trackStock, stockQuantity, showInAllCategories, req.params.id]
            );

            if (result.rows.length === 0) return error(res, 'Producto no encontrado', 404);
            return success(res, result.rows[0], 'Producto actualizado');
        } catch (err) {
            next(err);
        }
    }

    async deleteProduct(req, res, next) {
        try {
            const result = await query('DELETE FROM products WHERE id = $1 RETURNING id', [req.params.id]);
            if (result.rows.length === 0) return error(res, 'Producto no encontrado', 404);
            return success(res, null, 'Producto eliminado');
        } catch (err) {
            next(err);
        }
    }

    // ─── MODIFICADORES ───

    /**
     * Obtiene los grupos de modificadores con sus opciones para un producto
     */
    async getModifiersByProduct(req, res, next) {
        try {
            const groups = await query(
                `SELECT * FROM modifier_groups WHERE product_id = $1 ORDER BY display_order ASC`,
                [req.params.productId]
            );

            const result = [];
            for (const group of groups.rows) {
                const options = await query(
                    `SELECT * FROM modifier_options WHERE modifier_group_id = $1 ORDER BY display_order ASC`,
                    [group.id]
                );
                result.push({ ...group, options: options.rows });
            }

            return success(res, result);
        } catch (err) {
            next(err);
        }
    }

    /**
     * Guarda (reemplaza) todos los grupos de modificadores de un producto
     * Body: { groups: [{ name, required, maxSelect, displayOrder, options: [{ name, priceAdjustment, displayOrder }] }] }
     */
    async saveModifiers(req, res, next) {
        try {
            const { productId } = req.params;
            const { groups } = req.body;

            // Verificar que el producto existe
            const prodCheck = await query('SELECT id FROM products WHERE id = $1', [productId]);
            if (prodCheck.rows.length === 0) return error(res, 'Producto no encontrado', 404);

            // Eliminar grupos anteriores (CASCADE elimina opciones)
            await query('DELETE FROM modifier_groups WHERE product_id = $1', [productId]);

            if (!groups || groups.length === 0) {
                return success(res, [], 'Modificadores eliminados');
            }

            const saved = [];
            for (let i = 0; i < groups.length; i++) {
                const g = groups[i];
                const groupRes = await query(
                    `INSERT INTO modifier_groups (product_id, name, required, max_select, display_order)
                     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                    [productId, g.name, g.required !== false, g.maxSelect || 1, g.displayOrder || i]
                );
                const group = groupRes.rows[0];
                const opts = [];

                if (g.options && g.options.length > 0) {
                    for (let j = 0; j < g.options.length; j++) {
                        const o = g.options[j];
                        const optRes = await query(
                            `INSERT INTO modifier_options (modifier_group_id, name, price_adjustment, display_order)
                             VALUES ($1, $2, $3, $4) RETURNING *`,
                            [group.id, o.name, o.priceAdjustment || 0, o.displayOrder || j]
                        );
                        opts.push(optRes.rows[0]);
                    }
                }

                saved.push({ ...group, options: opts });
            }

            return success(res, saved, 'Modificadores guardados');
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new ProductsController();

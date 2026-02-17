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

            return success(res, result.rows);
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
}

module.exports = new ProductsController();

const { query } = require('../config/database');
const { success, created, error, paginated } = require('../utils/responses');

class InvestmentsController {
    async getInvestments(req, res, next) {
        try {
            const { page = 1, limit = 20, category, startDate, endDate } = req.query;
            let whereClause = 'WHERE 1=1';
            const params = [];
            let idx = 1;

            if (category) { whereClause += ` AND i.category = $${idx++}`; params.push(category); }
            if (startDate) { whereClause += ` AND i.purchase_date >= $${idx++}`; params.push(startDate); }
            if (endDate) { whereClause += ` AND i.purchase_date <= $${idx++}`; params.push(endDate); }

            const countResult = await query(`SELECT COUNT(*) FROM investments i ${whereClause}`, params);
            const total = parseInt(countResult.rows[0].count);

            const offset = (parseInt(page) - 1) * parseInt(limit);
            params.push(parseInt(limit), offset);

            const result = await query(
                `SELECT i.*, u.full_name as registered_by
         FROM investments i LEFT JOIN users u ON i.user_id = u.id
         ${whereClause} ORDER BY i.purchase_date DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
                params
            );

            // Totales por categoría
            const summaryResult = await query(
                `SELECT category, COUNT(*) as count, COALESCE(SUM(amount), 0) as total
         FROM investments ${whereClause.replace(/i\./g, '')} GROUP BY category`,
                params.slice(0, -2)
            );

            return success(res, {
                investments: result.rows,
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                summary: summaryResult.rows,
            });
        } catch (err) {
            next(err);
        }
    }

    async createInvestment(req, res, next) {
        try {
            const { description, category, amount, supplier, invoiceNumber, purchaseDate, notes } = req.body;
            if (!description || !amount) return error(res, 'Descripción y monto son requeridos', 400);

            const result = await query(
                `INSERT INTO investments (user_id, description, category, amount, supplier, invoice_number, purchase_date, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
                [req.user.id, description, category || 'supplies', amount, supplier, invoiceNumber, purchaseDate || new Date(), notes]
            );
            return created(res, result.rows[0], 'Inversión registrada');
        } catch (err) {
            next(err);
        }
    }

    async updateInvestment(req, res, next) {
        try {
            const { description, category, amount, supplier, invoiceNumber, purchaseDate, notes } = req.body;
            const result = await query(
                `UPDATE investments SET description = COALESCE($1, description), category = COALESCE($2, category),
         amount = COALESCE($3, amount), supplier = COALESCE($4, supplier),
         invoice_number = COALESCE($5, invoice_number), purchase_date = COALESCE($6, purchase_date),
         notes = COALESCE($7, notes) WHERE id = $8 RETURNING *`,
                [description, category, amount, supplier, invoiceNumber, purchaseDate, notes, req.params.id]
            );
            if (result.rows.length === 0) return error(res, 'Inversión no encontrada', 404);
            return success(res, result.rows[0], 'Inversión actualizada');
        } catch (err) {
            next(err);
        }
    }

    async deleteInvestment(req, res, next) {
        try {
            const result = await query('DELETE FROM investments WHERE id = $1 RETURNING id', [req.params.id]);
            if (result.rows.length === 0) return error(res, 'Inversión no encontrada', 404);
            return success(res, null, 'Inversión eliminada');
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new InvestmentsController();

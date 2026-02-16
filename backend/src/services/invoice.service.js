const { query } = require('../config/database');

class InvoiceService {
    /**
     * Genera una nota de venta (modo offline)
     */
    async createNotaVenta(saleId, customerData = {}) {
        const saleResult = await query(
            `SELECT s.*, json_agg(json_build_object(
        'product_name', si.product_name,
        'quantity', si.quantity,
        'unit_price', si.unit_price,
        'tax_rate', si.tax_rate,
        'subtotal', si.subtotal
      )) as items
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE s.id = $1
      GROUP BY s.id`,
            [saleId]
        );

        if (saleResult.rows.length === 0) {
            throw { statusCode: 404, message: 'Venta no encontrada' };
        }

        // Verificar si ya tiene factura
        const existing = await query('SELECT id FROM invoices WHERE sale_id = $1', [saleId]);
        if (existing.rows.length > 0) {
            return existing.rows[0];
        }

        const result = await query(
            `INSERT INTO invoices (sale_id, type, sri_status, customer_id_number, customer_name, customer_email, customer_address)
       VALUES ($1, 'nota_venta', 'offline', $2, $3, $4, $5) RETURNING *`,
            [saleId, customerData.idNumber || 'CONSUMIDOR FINAL', customerData.name || 'CONSUMIDOR FINAL',
                customerData.email || '', customerData.address || '']
        );

        return result.rows[0];
    }

    /**
     * Lista facturas/notas de venta con filtros
     */
    async getInvoices({ page = 1, limit = 20, type, status }) {
        let whereClause = 'WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (type) {
            whereClause += ` AND i.type = $${paramIndex++}`;
            params.push(type);
        }
        if (status) {
            whereClause += ` AND i.sri_status = $${paramIndex++}`;
            params.push(status);
        }

        const countResult = await query(`SELECT COUNT(*) FROM invoices i ${whereClause}`, params);
        const total = parseInt(countResult.rows[0].count);

        const offset = (page - 1) * limit;
        params.push(limit, offset);

        const result = await query(
            `SELECT i.*, s.sale_number, s.total, s.payment_method
       FROM invoices i
       LEFT JOIN sales s ON i.sale_id = s.id
       ${whereClause}
       ORDER BY i.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
            params
        );

        return { invoices: result.rows, total };
    }

    /**
     * Obtiene detalle de una factura
     */
    async getInvoiceById(invoiceId) {
        const result = await query(
            `SELECT i.*, s.sale_number, s.subtotal as sale_subtotal, s.tax_total, s.total as sale_total,
        s.payment_method, s.created_at as sale_date
       FROM invoices i
       LEFT JOIN sales s ON i.sale_id = s.id
       WHERE i.id = $1`,
            [invoiceId]
        );

        if (result.rows.length === 0) {
            throw { statusCode: 404, message: 'Factura no encontrada' };
        }

        const items = await query(
            'SELECT * FROM sale_items WHERE sale_id = $1',
            [result.rows[0].sale_id]
        );

        return { ...result.rows[0], items: items.rows };
    }
}

module.exports = new InvoiceService();

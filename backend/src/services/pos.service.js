const { query, getClient } = require('../config/database');

class PosService {
    /**
     * Genera el siguiente número de venta
     */
    async getNextSaleNumber() {
        const configResult = await query("SELECT value FROM config WHERE key = 'sale_number_prefix'");
        const counterResult = await query("SELECT value FROM config WHERE key = 'sale_number_counter'");

        const prefix = configResult.rows[0]?.value || 'V';
        const counter = parseInt(counterResult.rows[0]?.value || '0') + 1;

        await query("UPDATE config SET value = $1, updated_at = CURRENT_TIMESTAMP WHERE key = 'sale_number_counter'", [
            counter.toString(),
        ]);

        return `${prefix}${counter.toString().padStart(6, '0')}`;
    }

    /**
     * Crea una nueva venta completa (sale + items + kitchen order)
     * Soporta Full Service (pending) y Fast Food/Takeaway (completed)
     */
    async createSale({ userId, items, paymentMethod, amountReceived, transferRef, customerName, customerIdNumber, notes, orderType, tableId }) {
        const client = await getClient();

        try {
            await client.query('BEGIN');

            // Calcular totales
            let subtotal = 0;
            let taxTotal = 0;

            const processedItems = items.map((item) => {
                const itemSubtotal = item.quantity * item.unitPrice;
                const itemTax = itemSubtotal * (item.taxRate / 100);
                subtotal += itemSubtotal;
                taxTotal += itemTax;

                return {
                    ...item,
                    subtotal: itemSubtotal,
                    taxAmount: itemTax,
                };
            });

            const total = subtotal + taxTotal;

            // Full Service dine_in: status=pending (no se cobra aún)
            const isOpenOrder = orderType === 'dine_in' && tableId;
            const status = isOpenOrder ? 'pending' : 'completed';
            const changeAmount = (!isOpenOrder && paymentMethod === 'cash') ? Math.max(0, (amountReceived || 0) - total) : 0;

            // Generar número de venta
            const saleNumber = await this.getNextSaleNumber();

            // Obtener nombre de mesa si aplica
            let tableName = null;
            if (tableId) {
                const tbl = await client.query('SELECT name FROM tables WHERE id = $1', [tableId]);
                tableName = tbl.rows[0]?.name || null;
            }

            // Insertar venta
            const saleResult = await client.query(
                `INSERT INTO sales (user_id, sale_number, status, payment_method, subtotal, tax_total, total, 
         amount_received, change_amount, transfer_ref, customer_name, customer_id_number, notes, order_type, table_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING *`,
                [userId, saleNumber, status, paymentMethod || 'cash', subtotal.toFixed(2), taxTotal.toFixed(2), total.toFixed(2),
                    isOpenOrder ? 0 : (amountReceived || total), changeAmount.toFixed(2), transferRef, customerName, customerIdNumber, notes,
                    orderType || 'dine_in', tableId || null]
            );

            const sale = saleResult.rows[0];

            // Insertar items
            for (const item of processedItems) {
                await client.query(
                    `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, tax_rate, subtotal, modifiers)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [sale.id, item.productId, item.productName, item.quantity, item.unitPrice, item.taxRate, item.subtotal.toFixed(2), item.modifiers || '']
                );

                // Actualizar stock si aplica
                if (item.trackStock) {
                    await client.query(
                        'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
                        [item.quantity, item.productId]
                    );
                }
            }

            // Crear nota de venta solo si es completed (cobrado)
            if (!isOpenOrder) {
                await client.query(
                    `INSERT INTO invoices (sale_id, type, sri_status, customer_id_number, customer_name)
             VALUES ($1, 'nota_venta', 'offline', $2, $3)`,
                    [sale.id, customerIdNumber, customerName]
                );
            }

            // Crear orden de cocina
            const kitchenResult = await client.query(
                `INSERT INTO kitchen_orders (sale_id, notes, order_type, table_name) VALUES ($1, $2, $3, $4) RETURNING id`,
                [sale.id, notes, orderType || 'dine_in', tableName]
            );

            const kitchenOrderId = kitchenResult.rows[0].id;

            // Items de cocina
            for (const item of processedItems) {
                await client.query(
                    `INSERT INTO kitchen_order_items (kitchen_order_id, product_name, quantity, notes, modifiers)
           VALUES ($1, $2, $3, $4, $5)`,
                    [kitchenOrderId, item.productName, item.quantity, item.notes || '', item.modifiers || '']
                );
            }

            await client.query('COMMIT');

            return {
                sale,
                items: processedItems,
                kitchenOrderId,
                tableName,
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Obtiene pedidos abiertos (pending) por mesa
     */
    async getOpenOrders() {
        const result = await query(`
            SELECT s.*, t.name as table_name,
                COALESCE(json_agg(json_build_object(
                    'id', si.id,
                    'product_id', si.product_id,
                    'product_name', si.product_name,
                    'quantity', si.quantity,
                    'unit_price', si.unit_price,
                    'tax_rate', si.tax_rate,
                    'subtotal', si.subtotal,
                    'modifiers', si.modifiers
                )) FILTER (WHERE si.id IS NOT NULL), '[]') as items
            FROM sales s
            LEFT JOIN tables t ON s.table_id = t.id
            LEFT JOIN sale_items si ON si.sale_id = s.id
            WHERE s.status = 'pending'
            GROUP BY s.id, t.name
            ORDER BY s.created_at ASC
        `);
        return result.rows;
    }

    /**
     * Agrega items a un pedido abierto (dine_in pending)
     */
    async addItemsToOrder(saleId, items, userId) {
        const client = await getClient();

        try {
            await client.query('BEGIN');

            // Verificar que la venta esté pending
            const saleCheck = await client.query('SELECT * FROM sales WHERE id = $1 AND status = $2', [saleId, 'pending']);
            if (saleCheck.rows.length === 0) {
                throw { statusCode: 404, message: 'Pedido no encontrado o ya cerrado' };
            }

            let addedSubtotal = 0;
            let addedTax = 0;

            const processedItems = items.map(item => {
                const itemSubtotal = item.quantity * item.unitPrice;
                const itemTax = itemSubtotal * (item.taxRate / 100);
                addedSubtotal += itemSubtotal;
                addedTax += itemTax;
                return { ...item, subtotal: itemSubtotal, taxAmount: itemTax };
            });

            // Insertar items
            for (const item of processedItems) {
                await client.query(
                    `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, tax_rate, subtotal, modifiers)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [saleId, item.productId, item.productName, item.quantity, item.unitPrice, item.taxRate, item.subtotal.toFixed(2), item.modifiers || '']
                );

                if (item.trackStock) {
                    await client.query('UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
                        [item.quantity, item.productId]);
                }
            }

            // Actualizar totales de la venta
            await client.query(
                `UPDATE sales SET
                    subtotal = subtotal + $1,
                    tax_total = tax_total + $2,
                    total = total + $3
                 WHERE id = $4`,
                [addedSubtotal.toFixed(2), addedTax.toFixed(2), (addedSubtotal + addedTax).toFixed(2), saleId]
            );

            // Crear nueva orden de cocina para estos items adicionales
            const sale = saleCheck.rows[0];
            let tableName = null;
            if (sale.table_id) {
                const tbl = await client.query('SELECT name FROM tables WHERE id = $1', [sale.table_id]);
                tableName = tbl.rows[0]?.name || null;
            }

            const kitchenResult = await client.query(
                `INSERT INTO kitchen_orders (sale_id, notes, order_type, table_name) VALUES ($1, $2, $3, $4) RETURNING id`,
                [saleId, 'Items adicionales', sale.order_type, tableName]
            );
            const kitchenOrderId = kitchenResult.rows[0].id;

            for (const item of processedItems) {
                await client.query(
                    `INSERT INTO kitchen_order_items (kitchen_order_id, product_name, quantity, notes, modifiers)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [kitchenOrderId, item.productName, item.quantity, item.notes || '', item.modifiers || '']
                );
            }

            await client.query('COMMIT');

            // Retornar venta actualizada
            const updatedSale = await this.getSaleById(saleId);
            return { ...updatedSale, kitchenOrderId };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Cierra un pedido abierto (cobra la cuenta)
     */
    async closeOrder(saleId, { paymentMethod, amountReceived, transferRef, customerName, customerIdNumber }) {
        const client = await getClient();

        try {
            await client.query('BEGIN');

            const saleCheck = await client.query('SELECT * FROM sales WHERE id = $1 AND status = $2', [saleId, 'pending']);
            if (saleCheck.rows.length === 0) {
                throw { statusCode: 404, message: 'Pedido no encontrado o ya cerrado' };
            }

            const sale = saleCheck.rows[0];
            const total = parseFloat(sale.total);
            const changeAmount = paymentMethod === 'cash' ? Math.max(0, (amountReceived || 0) - total) : 0;

            await client.query(
                `UPDATE sales SET
                    status = 'completed',
                    payment_method = $1,
                    amount_received = $2,
                    change_amount = $3,
                    transfer_ref = $4,
                    customer_name = COALESCE($5, customer_name),
                    customer_id_number = COALESCE($6, customer_id_number)
                 WHERE id = $7`,
                [paymentMethod, amountReceived || total, changeAmount.toFixed(2), transferRef,
                    customerName, customerIdNumber, saleId]
            );

            // Crear invoice
            await client.query(
                `INSERT INTO invoices (sale_id, type, sri_status, customer_id_number, customer_name)
                 VALUES ($1, 'nota_venta', 'offline', $2, $3)`,
                [saleId, customerIdNumber || sale.customer_id_number, customerName || sale.customer_name]
            );

            await client.query('COMMIT');

            return await this.getSaleById(saleId);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Obtiene ventas con paginación y filtros
     */
    async getSales({ page = 1, limit = 20, startDate, endDate, status, paymentMethod }) {
        let whereClause = 'WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (startDate) {
            whereClause += ` AND s.created_at >= $${paramIndex++}`;
            params.push(startDate);
        }
        if (endDate) {
            whereClause += ` AND s.created_at <= $${paramIndex++}`;
            params.push(endDate);
        }
        if (status) {
            whereClause += ` AND s.status = $${paramIndex++}`;
            params.push(status);
        }
        if (paymentMethod) {
            whereClause += ` AND s.payment_method = $${paramIndex++}`;
            params.push(paymentMethod);
        }

        const countResult = await query(`SELECT COUNT(*) FROM sales s ${whereClause}`, params);
        const total = parseInt(countResult.rows[0].count);

        const offset = (page - 1) * limit;
        params.push(limit, offset);

        const result = await query(
            `SELECT s.*, u.full_name as cashier_name, t.name as table_name
       FROM sales s
       LEFT JOIN users u ON s.user_id = u.id
       LEFT JOIN tables t ON s.table_id = t.id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
            params
        );

        return { sales: result.rows, total };
    }

    /**
     * Obtiene detalle de una venta
     */
    async getSaleById(saleId) {
        const saleResult = await query(
            `SELECT s.*, u.full_name as cashier_name, t.name as table_name
       FROM sales s
       LEFT JOIN users u ON s.user_id = u.id
       LEFT JOIN tables t ON s.table_id = t.id
       WHERE s.id = $1`,
            [saleId]
        );

        if (saleResult.rows.length === 0) {
            throw { statusCode: 404, message: 'Venta no encontrada' };
        }

        const itemsResult = await query('SELECT * FROM sale_items WHERE sale_id = $1', [saleId]);
        const invoiceResult = await query('SELECT * FROM invoices WHERE sale_id = $1', [saleId]);

        return {
            ...saleResult.rows[0],
            items: itemsResult.rows,
            invoice: invoiceResult.rows[0] || null,
        };
    }

    /**
     * Cancela una venta
     */
    async cancelSale(saleId) {
        const result = await query(
            "UPDATE sales SET status = 'cancelled' WHERE id = $1 AND status != 'cancelled' RETURNING *",
            [saleId]
        );

        if (result.rows.length === 0) {
            throw { statusCode: 404, message: 'Venta no encontrada o ya cancelada' };
        }

        return result.rows[0];
    }

    /**
     * Anula una venta completada (void)
     * Solo admin puede anular. La venta queda registrada pero no suma a ventas.
     */
    async voidSale(saleId, { adminUserId, reason }) {
        const client = await getClient();
        try {
            await client.query('BEGIN');

            const saleCheck = await client.query('SELECT * FROM sales WHERE id = $1', [saleId]);
            if (saleCheck.rows.length === 0) {
                throw { statusCode: 404, message: 'Venta no encontrada' };
            }

            const sale = saleCheck.rows[0];
            if (sale.status === 'voided') {
                throw { statusCode: 400, message: 'Esta venta ya fue anulada' };
            }
            if (sale.status === 'pending') {
                throw { statusCode: 400, message: 'No se puede anular un pedido pendiente. Cancélelo primero.' };
            }

            // Marcar como anulada
            await client.query(
                `UPDATE sales SET status = 'voided', voided_at = CURRENT_TIMESTAMP, voided_by = $1, void_reason = $2 WHERE id = $3`,
                [adminUserId, reason || 'Sin motivo especificado', saleId]
            );

            // Devolver stock si aplica
            const items = await client.query('SELECT * FROM sale_items WHERE sale_id = $1', [saleId]);
            for (const item of items.rows) {
                const prod = await client.query('SELECT track_stock FROM products WHERE id = $1', [item.product_id]);
                if (prod.rows[0]?.track_stock) {
                    await client.query(
                        'UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2',
                        [item.quantity, item.product_id]
                    );
                }
            }

            await client.query('COMMIT');

            return await this.getSaleById(saleId);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Verifica credenciales de admin (para anulación)
     */
    async verifyAdminPassword(username, password) {
        const bcrypt = require('bcryptjs');
        const result = await query('SELECT * FROM users WHERE username = $1 AND role = $2 AND active = true', [username, 'admin']);
        if (result.rows.length === 0) {
            throw { statusCode: 401, message: 'Usuario admin no encontrado' };
        }
        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            throw { statusCode: 401, message: 'Contraseña incorrecta' };
        }
        return { id: user.id, username: user.username, fullName: user.full_name };
    }

    /**
     * Resumen de ventas del día
     */
    async getDailySummary(date) {
        const targetDate = date || new Date().toISOString().split('T')[0];

        const result = await query(
            `SELECT 
        COUNT(*) as total_sales,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN status = 'completed' AND payment_method = 'cash' THEN total ELSE 0 END), 0) as cash_total,
        COALESCE(SUM(CASE WHEN status = 'completed' AND payment_method = 'transfer' THEN total ELSE 0 END), 0) as transfer_total,
        COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) as cancelled_count,
        COALESCE(SUM(CASE WHEN status = 'voided' THEN 1 ELSE 0 END), 0) as voided_count,
        COALESCE(SUM(CASE WHEN status = 'voided' THEN total ELSE 0 END), 0) as voided_total,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN tax_total ELSE 0 END), 0) as total_taxes,
        COALESCE(SUM(CASE WHEN status = 'completed' AND order_type = 'dine_in' THEN total ELSE 0 END), 0) as dine_in_total,
        COALESCE(SUM(CASE WHEN status = 'completed' AND order_type = 'takeaway' THEN total ELSE 0 END), 0) as takeaway_total,
        COALESCE(SUM(CASE WHEN status = 'completed' AND order_type = 'dine_in' THEN 1 ELSE 0 END), 0) as dine_in_count,
        COALESCE(SUM(CASE WHEN status = 'completed' AND order_type = 'takeaway' THEN 1 ELSE 0 END), 0) as takeaway_count
       FROM sales
       WHERE DATE(created_at) = $1`,
            [targetDate]
        );

        return { date: targetDate, ...result.rows[0] };
    }
}

module.exports = new PosService();

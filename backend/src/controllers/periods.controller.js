/**
 * ═══════════════════════════════════════════════════════
 *  Periods Controller - Jornadas / Turnos de Caja
 *  Gestiona apertura y cierre de períodos diarios
 * ═══════════════════════════════════════════════════════
 */

const { query, getClient } = require('../config/database');
const { success, error } = require('../utils/responses');

class PeriodsController {
    /**
     * Obtiene el período activo (abierto)
     */
    async getCurrent(req, res, next) {
        try {
            const result = await query(`
                SELECT sp.*, u1.full_name as opened_by_name
                FROM sales_periods sp
                LEFT JOIN users u1 ON sp.opened_by = u1.id
                WHERE sp.status = 'open'
                ORDER BY sp.open_time DESC LIMIT 1
            `);

            if (result.rows.length === 0) {
                return success(res, null, 'No hay período abierto');
            }

            // Calcular totales en tiempo real
            const period = result.rows[0];
            const sales = await query(`
                SELECT
                    COUNT(*) FILTER (WHERE status = 'completed') as total_orders,
                    COALESCE(SUM(total) FILTER (WHERE status = 'completed'), 0) as total_sales,
                    COALESCE(SUM(total) FILTER (WHERE status = 'completed' AND payment_method = 'cash'), 0) as cash_total,
                    COALESCE(SUM(total) FILTER (WHERE status = 'completed' AND payment_method = 'transfer'), 0) as transfer_total,
                    COALESCE(SUM(total) FILTER (WHERE status = 'voided'), 0) as voided_total,
                    COUNT(*) FILTER (WHERE status = 'voided') as voided_count,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending_count
                FROM sales
                WHERE period_id = $1
            `, [period.id]);

            const stats = sales.rows[0];
            const openingCash = parseFloat(period.opening_cash) || 0;
            const cashSales = parseFloat(stats.cash_total) || 0;

            // Obtener retiros de efectivo del período
            const withdrawalsRes = await query(`
                SELECT COALESCE(SUM(amount), 0) as total_withdrawals,
                       COUNT(*) as withdrawal_count
                FROM cash_withdrawals WHERE period_id = $1
            `, [period.id]);
            const totalWithdrawals = parseFloat(withdrawalsRes.rows[0].total_withdrawals) || 0;
            const withdrawalCount = parseInt(withdrawalsRes.rows[0].withdrawal_count) || 0;

            return success(res, {
                ...period,
                total_orders: parseInt(stats.total_orders) || 0,
                total_sales: parseFloat(stats.total_sales) || 0,
                cash_total: cashSales,
                transfer_total: parseFloat(stats.transfer_total) || 0,
                voided_total: parseFloat(stats.voided_total) || 0,
                voided_count: parseInt(stats.voided_count) || 0,
                pending_count: parseInt(stats.pending_count) || 0,
                total_withdrawals: totalWithdrawals,
                withdrawal_count: withdrawalCount,
                expected_cash: openingCash + cashSales - totalWithdrawals,
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Abre un nuevo período (jornada)
     */
    async openPeriod(req, res, next) {
        try {
            const { openingCash, notes } = req.body;

            // Verificar que no haya un período abierto
            const existing = await query("SELECT id FROM sales_periods WHERE status = 'open'");
            if (existing.rows.length > 0) {
                return error(res, 'Ya existe un período abierto. Ciérrelo primero.', 400);
            }

            const today = new Date().toISOString().split('T')[0];

            const result = await query(`
                INSERT INTO sales_periods (open_date, opened_by, opening_cash, notes)
                VALUES ($1, $2, $3, $4) RETURNING *
            `, [today, req.user.id, parseFloat(openingCash) || 0, notes || null]);

            return success(res, result.rows[0], 'Período abierto exitosamente', 201);
        } catch (err) {
            next(err);
        }
    }

    /**
     * Cierra el período activo
     */
    async closePeriod(req, res, next) {
        const client = await getClient();
        try {
            await client.query('BEGIN');

            const { closingCash, notes } = req.body;

            // Buscar período abierto
            const periodRes = await client.query("SELECT * FROM sales_periods WHERE status = 'open' ORDER BY open_time DESC LIMIT 1");
            if (periodRes.rows.length === 0) {
                await client.query('ROLLBACK');
                return error(res, 'No hay período abierto para cerrar', 404);
            }

            const period = periodRes.rows[0];

            // Verificar que no haya pedidos pendientes
            const pendingRes = await client.query(
                "SELECT COUNT(*) FROM sales WHERE period_id = $1 AND status = 'pending'",
                [period.id]
            );
            if (parseInt(pendingRes.rows[0].count) > 0) {
                await client.query('ROLLBACK');
                return error(res, `Hay ${pendingRes.rows[0].count} pedido(s) pendiente(s). Cierre o cancele los pedidos antes de cerrar el período.`, 400);
            }

            // Calcular totales finales
            const salesStats = await client.query(`
                SELECT
                    COUNT(*) FILTER (WHERE status = 'completed') as total_orders,
                    COALESCE(SUM(total) FILTER (WHERE status = 'completed'), 0) as total_sales,
                    COALESCE(SUM(total) FILTER (WHERE status = 'completed' AND payment_method = 'cash'), 0) as cash_total,
                    COALESCE(SUM(total) FILTER (WHERE status = 'completed' AND payment_method = 'transfer'), 0) as transfer_total,
                    COALESCE(SUM(total) FILTER (WHERE status = 'voided'), 0) as voided_total
                FROM sales
                WHERE period_id = $1
            `, [period.id]);

            const stats = salesStats.rows[0];
            const openingCash = parseFloat(period.opening_cash) || 0;
            const cashSales = parseFloat(stats.cash_total) || 0;

            // Retiros de efectivo
            const wdRes = await client.query(`SELECT COALESCE(SUM(amount),0) as total FROM cash_withdrawals WHERE period_id=$1`, [period.id]);
            const totalWithdrawals = parseFloat(wdRes.rows[0].total) || 0;
            const expectedCash = openingCash + cashSales - totalWithdrawals;

            // Cerrar período
            await client.query(`
                UPDATE sales_periods SET
                    status = 'closed',
                    close_time = CURRENT_TIMESTAMP,
                    closed_by = $1,
                    closing_cash = $2,
                    expected_cash = $3,
                    total_sales = $4,
                    total_orders = $5,
                    cash_total = $6,
                    transfer_total = $7,
                    voided_total = $8,
                    notes = COALESCE($9, notes)
                WHERE id = $10
            `, [
                req.user.id,
                parseFloat(closingCash) || 0,
                expectedCash,
                parseFloat(stats.total_sales) || 0,
                parseInt(stats.total_orders) || 0,
                cashSales,
                parseFloat(stats.transfer_total) || 0,
                parseFloat(stats.voided_total) || 0,
                notes || null,
                period.id
            ]);

            await client.query('COMMIT');

            // Devolver resumen
            const difference = (parseFloat(closingCash) || 0) - expectedCash;

            return success(res, {
                period_id: period.id,
                open_date: period.open_date,
                open_time: period.open_time,
                close_time: new Date(),
                opening_cash: openingCash,
                closing_cash: parseFloat(closingCash) || 0,
                expected_cash: expectedCash,
                difference: difference,
                total_sales: parseFloat(stats.total_sales) || 0,
                total_orders: parseInt(stats.total_orders) || 0,
                cash_total: cashSales,
                transfer_total: parseFloat(stats.transfer_total) || 0,
                voided_total: parseFloat(stats.voided_total) || 0,
                total_withdrawals: totalWithdrawals,
            }, 'Período cerrado exitosamente');
        } catch (err) {
            await client.query('ROLLBACK');
            next(err);
        } finally {
            client.release();
        }
    }

    /**
     * Registra un retiro de efectivo en el período actual
     */
    async createWithdrawal(req, res, next) {
        try {
            const { amount, reason } = req.body;

            if (!amount || parseFloat(amount) <= 0) {
                return error(res, 'El monto debe ser mayor a 0', 400);
            }

            // Verificar que haya un período abierto
            const periodRes = await query("SELECT id, opening_cash FROM sales_periods WHERE status = 'open' ORDER BY open_time DESC LIMIT 1");
            if (periodRes.rows.length === 0) {
                return error(res, 'No hay período abierto', 404);
            }

            const periodId = periodRes.rows[0].id;

            const result = await query(`
                INSERT INTO cash_withdrawals (period_id, amount, reason, withdrawn_by)
                VALUES ($1, $2, $3, $4) RETURNING *
            `, [periodId, parseFloat(amount), reason || null, req.user.id]);

            // Obtener nombre del usuario
            const userRes = await query('SELECT full_name FROM users WHERE id=$1', [req.user.id]);
            const withdrawal = {
                ...result.rows[0],
                withdrawn_by_name: userRes.rows[0]?.full_name || 'Desconocido'
            };

            return success(res, withdrawal, 'Retiro registrado exitosamente', 201);
        } catch (err) {
            next(err);
        }
    }

    /**
     * Lista retiros del período activo
     */
    async getWithdrawals(req, res, next) {
        try {
            const periodId = req.query.period_id;
            let whereClause = '';
            let params = [];

            if (periodId) {
                whereClause = 'WHERE cw.period_id = $1';
                params = [periodId];
            } else {
                // Si no se pasa period_id, buscar el período abierto
                whereClause = "WHERE cw.period_id = (SELECT id FROM sales_periods WHERE status = 'open' ORDER BY open_time DESC LIMIT 1)";
            }

            const result = await query(`
                SELECT cw.*, u.full_name as withdrawn_by_name
                FROM cash_withdrawals cw
                LEFT JOIN users u ON cw.withdrawn_by = u.id
                ${whereClause}
                ORDER BY cw.created_at DESC
            `, params);

            return success(res, result.rows);
        } catch (err) {
            next(err);
        }
    }

    /**
     * Historial de períodos
     */
    async getHistory(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;
            const offset = (parseInt(page) - 1) * parseInt(limit);

            const countRes = await query('SELECT COUNT(*) FROM sales_periods');
            const total = parseInt(countRes.rows[0].count);

            const result = await query(`
                SELECT sp.*,
                    u1.full_name as opened_by_name,
                    u2.full_name as closed_by_name
                FROM sales_periods sp
                LEFT JOIN users u1 ON sp.opened_by = u1.id
                LEFT JOIN users u2 ON sp.closed_by = u2.id
                ORDER BY sp.open_time DESC
                LIMIT $1 OFFSET $2
            `, [parseInt(limit), offset]);

            return success(res, { periods: result.rows, total });
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new PeriodsController();

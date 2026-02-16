const { query } = require('../config/database');
const { success, created, error } = require('../utils/responses');

class PayrollController {
    // ─── EMPLEADOS ───

    async getEmployees(req, res, next) {
        try {
            const { active } = req.query;
            let sql = 'SELECT * FROM employees';
            const params = [];
            if (active !== undefined) {
                sql += ' WHERE active = $1';
                params.push(active === 'true');
            }
            sql += ' ORDER BY name ASC';
            const result = await query(sql, params);
            return success(res, result.rows);
        } catch (err) {
            next(err);
        }
    }

    async createEmployee(req, res, next) {
        try {
            const { name, idNumber, role, baseSalary, hireDate, phone, address } = req.body;
            if (!name || baseSalary === undefined) return error(res, 'Nombre y salario base son requeridos', 400);

            const result = await query(
                `INSERT INTO employees (name, id_number, role, base_salary, hire_date, phone, address)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                [name, idNumber, role, baseSalary, hireDate || new Date(), phone, address]
            );
            return created(res, result.rows[0], 'Empleado creado');
        } catch (err) {
            next(err);
        }
    }

    async updateEmployee(req, res, next) {
        try {
            const { name, idNumber, role, baseSalary, phone, address, active } = req.body;
            const result = await query(
                `UPDATE employees SET name = COALESCE($1, name), id_number = COALESCE($2, id_number),
         role = COALESCE($3, role), base_salary = COALESCE($4, base_salary),
         phone = COALESCE($5, phone), address = COALESCE($6, address), active = COALESCE($7, active)
         WHERE id = $8 RETURNING *`,
                [name, idNumber, role, baseSalary, phone, address, active, req.params.id]
            );
            if (result.rows.length === 0) return error(res, 'Empleado no encontrado', 404);
            return success(res, result.rows[0], 'Empleado actualizado');
        } catch (err) {
            next(err);
        }
    }

    // ─── NÓMINA (Pagos diarios) ───

    async getPayrollEntries(req, res, next) {
        try {
            const { period, status, employeeId } = req.query;
            let whereClause = 'WHERE 1=1';
            const params = [];
            let idx = 1;

            if (period) { whereClause += ` AND pe.period = $${idx++}`; params.push(period); }
            if (status) { whereClause += ` AND pe.status = $${idx++}`; params.push(status); }
            if (employeeId) { whereClause += ` AND pe.employee_id = $${idx++}`; params.push(employeeId); }

            const result = await query(
                `SELECT pe.*, e.name as employee_name, e.id_number, e.role as employee_role
         FROM payroll_entries pe
         LEFT JOIN employees e ON pe.employee_id = e.id
         ${whereClause}
         ORDER BY pe.payment_date DESC, pe.created_at DESC`,
                params
            );

            return success(res, { entries: result.rows });
        } catch (err) {
            next(err);
        }
    }

    async createPayrollEntry(req, res, next) {
        try {
            const { employeeId, period, baseSalary, bonuses = 0, deductions = 0, iessContribution, notes, paymentMethod, paymentDate } = req.body;

            if (!employeeId || !baseSalary) {
                return error(res, 'employeeId y baseSalary son requeridos', 400);
            }

            // Auto-generar período si no viene
            const actualPeriod = period || new Date().toISOString().slice(0, 7);
            const actualDate = paymentDate || new Date().toISOString().slice(0, 10);
            const method = paymentMethod || 'cash';

            // Calcular IESS (9.45% aporte personal)
            const iess = iessContribution !== undefined ? iessContribution : parseFloat(baseSalary) * 0.0945;
            const netPay = parseFloat(baseSalary) + parseFloat(bonuses) - parseFloat(deductions) - iess;

            const result = await query(
                `INSERT INTO payroll_entries (employee_id, period, base_salary, bonuses, deductions, iess_contribution, net_pay, notes, payment_method, payment_date, status, paid_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'paid', CURRENT_TIMESTAMP) RETURNING *`,
                [employeeId, actualPeriod, baseSalary, bonuses, deductions, iess.toFixed(2), netPay.toFixed(2), notes, method, actualDate]
            );

            return created(res, result.rows[0], 'Pago registrado');
        } catch (err) {
            next(err);
        }
    }

    async markAsPaid(req, res, next) {
        try {
            const { paymentMethod } = req.body;
            const result = await query(
                "UPDATE payroll_entries SET status = 'paid', paid_at = CURRENT_TIMESTAMP, payment_method = COALESCE($1, payment_method) WHERE id = $2 RETURNING *",
                [paymentMethod || 'cash', req.params.id]
            );
            if (result.rows.length === 0) return error(res, 'Registro no encontrado', 404);
            return success(res, result.rows[0], 'Marcado como pagado');
        } catch (err) {
            next(err);
        }
    }

    async deletePayrollEntry(req, res, next) {
        try {
            const result = await query(
                'DELETE FROM payroll_entries WHERE id = $1 RETURNING id',
                [req.params.id]
            );
            if (result.rows.length === 0) return error(res, 'Registro no encontrado', 404);
            return success(res, null, 'Registro eliminado');
        } catch (err) {
            next(err);
        }
    }

    /**
     * Resumen de pagos por período
     * GET /api/payroll/summary?range=today|week|month
     */
    async getSummary(req, res, next) {
        try {
            const { range = 'month' } = req.query;
            let dateFilter;
            switch (range) {
                case 'today': dateFilter = "payment_date = CURRENT_DATE"; break;
                case 'week': dateFilter = "payment_date >= DATE_TRUNC('week', CURRENT_DATE)"; break;
                case 'month': dateFilter = "payment_date >= DATE_TRUNC('month', CURRENT_DATE)"; break;
                default: dateFilter = "payment_date >= DATE_TRUNC('month', CURRENT_DATE)";
            }

            const result = await query(`
                SELECT 
                    COUNT(*) as total_payments,
                    COALESCE(SUM(net_pay), 0) as total_paid,
                    COUNT(CASE WHEN payment_method = 'cash' THEN 1 END) as cash_count,
                    COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN net_pay ELSE 0 END), 0) as cash_total,
                    COUNT(CASE WHEN payment_method = 'transfer' THEN 1 END) as transfer_count,
                    COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN net_pay ELSE 0 END), 0) as transfer_total
                FROM payroll_entries
                WHERE status = 'paid' AND ${dateFilter}
            `);

            return success(res, result.rows[0]);
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new PayrollController();

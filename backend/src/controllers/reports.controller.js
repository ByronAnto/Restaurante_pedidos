/**
 * ═══════════════════════════════════════════════════════
 *  Reports Controller - Sistema Avanzado de Reportes
 *  Financieros · Operacionales · Personal · Estratégicos
 * ═══════════════════════════════════════════════════════
 */

const { query } = require('../config/database');
const { success } = require('../utils/responses');

const ReportsController = {

    // ════════════════════════════════════════════════════
    //  💰 FINANCIEROS
    // ════════════════════════════════════════════════════

    /**
     * P&L (Pérdidas y Ganancias)
     * GET /api/reports/pnl?period=today|week|month|year
     */
    async pnl(req, res, next) {
        try {
            const { period = 'today' } = req.query;
            const df = getDateFilter(period);
            const dfPurchase = getDateFilterCol(period, 'purchase_date');
            const dfPayroll = getDateFilterCol(period, 'payment_date');
            const dfInvestment = getDateFilterCol(period, 'purchase_date');

            // Ingresos (ventas)
            const salesRes = await query(`
                SELECT COUNT(*) as total_sales, COALESCE(SUM(total), 0) as revenue
                FROM sales WHERE status = 'completed' AND ${df}
            `);

            // Gastos: Compras de insumos
            const purchasesRes = await query(`
                SELECT COALESCE(SUM(total_cost), 0) as total
                FROM inventory_purchases WHERE ${dfPurchase}
            `);

            // Gastos: Inversiones/gastos operativos
            const investmentsRes = await query(`
                SELECT COALESCE(SUM(amount), 0) as total
                FROM investments WHERE ${dfInvestment}
            `);

            // Gastos: Nómina pagada
            const payrollRes = await query(`
                SELECT COALESCE(SUM(net_pay), 0) as total
                FROM payroll_entries WHERE status = 'paid' AND ${dfPayroll}
            `);

            const revenue = parseFloat(salesRes.rows[0].revenue);
            const costInventory = parseFloat(purchasesRes.rows[0].total);
            const costInvestments = parseFloat(investmentsRes.rows[0].total);
            const costPayroll = parseFloat(payrollRes.rows[0].total);
            const totalExpenses = costInventory + costInvestments + costPayroll;
            const netProfit = revenue - totalExpenses;
            const marginPct = revenue > 0 ? (netProfit / revenue * 100) : 0;
            const foodCostPct = revenue > 0 ? (costInventory / revenue * 100) : 0;
            const laborCostPct = revenue > 0 ? (costPayroll / revenue * 100) : 0;

            return success(res, {
                period,
                revenue,
                totalSales: parseInt(salesRes.rows[0].total_sales),
                expenses: {
                    inventory: costInventory,
                    investments: costInvestments,
                    payroll: costPayroll,
                    total: totalExpenses,
                },
                netProfit,
                marginPct: parseFloat(marginPct.toFixed(1)),
                foodCostPct: parseFloat(foodCostPct.toFixed(1)),
                laborCostPct: parseFloat(laborCostPct.toFixed(1)),
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * Tendencia P&L últimos N días
     * GET /api/reports/pnl-trend?days=7
     */
    async pnlTrend(req, res, next) {
        try {
            const { days = 7 } = req.query;
            const n = parseInt(days);

            const result = await query(`
                WITH dates AS (
                    SELECT generate_series(CURRENT_DATE - ${n - 1}, CURRENT_DATE, '1 day'::interval)::date AS d
                ),
                daily_sales AS (
                    SELECT DATE(created_at) AS d, COALESCE(SUM(total), 0) AS revenue, COUNT(*) as sales
                    FROM sales WHERE status = 'completed' AND created_at >= CURRENT_DATE - ${n - 1}
                    GROUP BY DATE(created_at)
                ),
                daily_purchases AS (
                    SELECT purchase_date AS d, COALESCE(SUM(total_cost), 0) AS cost
                    FROM inventory_purchases WHERE purchase_date >= CURRENT_DATE - ${n - 1}
                    GROUP BY purchase_date
                ),
                daily_investments AS (
                    SELECT purchase_date AS d, COALESCE(SUM(amount), 0) AS cost
                    FROM investments WHERE purchase_date >= CURRENT_DATE - ${n - 1}
                    GROUP BY purchase_date
                ),
                daily_payroll AS (
                    SELECT payment_date AS d, COALESCE(SUM(net_pay), 0) AS cost
                    FROM payroll_entries WHERE status = 'paid' AND payment_date >= CURRENT_DATE - ${n - 1}
                    GROUP BY payment_date
                )
                SELECT 
                    dates.d as date,
                    COALESCE(ds.revenue, 0) as revenue,
                    COALESCE(ds.sales, 0) as sales,
                    COALESCE(dp.cost, 0) + COALESCE(di.cost, 0) + COALESCE(dpy.cost, 0) as expenses,
                    COALESCE(ds.revenue, 0) - COALESCE(dp.cost, 0) - COALESCE(di.cost, 0) - COALESCE(dpy.cost, 0) as profit
                FROM dates
                LEFT JOIN daily_sales ds ON ds.d = dates.d
                LEFT JOIN daily_purchases dp ON dp.d = dates.d
                LEFT JOIN daily_investments di ON di.d = dates.d
                LEFT JOIN daily_payroll dpy ON dpy.d = dates.d
                ORDER BY dates.d ASC
            `);

            return success(res, result.rows);
        } catch (err) {
            next(err);
        }
    },

    /**
     * Cash Flow - Efectivo vs Transferencias
     * GET /api/reports/cash-flow?period=today
     */
    async cashFlow(req, res, next) {
        try {
            const { period = 'today' } = req.query;
            const df = getDateFilter(period);
            const dfPayroll = getDateFilterCol(period, 'payment_date');

            // Ingresos por método
            const salesRes = await query(`
                SELECT 
                    COALESCE(SUM(CASE WHEN payment_method='cash' THEN total ELSE 0 END), 0) as cash_in,
                    COALESCE(SUM(CASE WHEN payment_method='transfer' THEN total ELSE 0 END), 0) as transfer_in
                FROM sales WHERE status='completed' AND ${df}
            `);

            // Egresos nómina por método
            const payrollRes = await query(`
                SELECT 
                    COALESCE(SUM(CASE WHEN payment_method='cash' THEN net_pay ELSE 0 END), 0) as cash_out,
                    COALESCE(SUM(CASE WHEN payment_method='transfer' THEN net_pay ELSE 0 END), 0) as transfer_out
                FROM payroll_entries WHERE status='paid' AND ${dfPayroll}
            `);

            // Egresos inversiones (asumimos efectivo)
            const dfInvestment = getDateFilterCol(period, 'purchase_date');
            const invRes = await query(`
                SELECT COALESCE(SUM(amount), 0) as total FROM investments WHERE ${dfInvestment}
            `);

            // Egresos compras inventario (asumimos efectivo)
            const dfPurchase = getDateFilterCol(period, 'purchase_date');
            const purchRes = await query(`
                SELECT COALESCE(SUM(total_cost), 0) as total FROM inventory_purchases WHERE ${dfPurchase}
            `);

            const cashIn = parseFloat(salesRes.rows[0].cash_in);
            const transferIn = parseFloat(salesRes.rows[0].transfer_in);
            const cashOut = parseFloat(payrollRes.rows[0].cash_out) + parseFloat(invRes.rows[0].total) + parseFloat(purchRes.rows[0].total);
            const transferOut = parseFloat(payrollRes.rows[0].transfer_out);

            return success(res, {
                period,
                income: { cash: cashIn, transfer: transferIn, total: cashIn + transferIn },
                expenses: { cash: cashOut, transfer: transferOut, total: cashOut + transferOut },
                netCash: cashIn - cashOut,
                netTransfer: transferIn - transferOut,
                netTotal: (cashIn + transferIn) - (cashOut + transferOut),
            });
        } catch (err) {
            next(err);
        }
    },

    // ════════════════════════════════════════════════════
    //  📦 OPERACIONALES
    // ════════════════════════════════════════════════════

    /**
     * Ventas por hora (para detectar picos)
     * GET /api/reports/sales-by-hour?period=today
     */
    async salesByHour(req, res, next) {
        try {
            const { period = 'today' } = req.query;
            const df = getDateFilter(period);

            const result = await query(`
                SELECT 
                    EXTRACT(HOUR FROM created_at)::int as hour,
                    COUNT(*) as sales,
                    COALESCE(SUM(total), 0) as revenue
                FROM sales
                WHERE status = 'completed' AND ${df}
                GROUP BY EXTRACT(HOUR FROM created_at)
                ORDER BY hour ASC
            `);

            // Fill empty hours (0-23)
            const hours = Array.from({ length: 24 }, (_, i) => {
                const match = result.rows.find(r => parseInt(r.hour) === i);
                return {
                    hour: i,
                    label: `${i.toString().padStart(2, '0')}:00`,
                    sales: match ? parseInt(match.sales) : 0,
                    revenue: match ? parseFloat(match.revenue) : 0,
                };
            });

            const peakHour = hours.reduce((max, h) => h.sales > max.sales ? h : max, hours[0]);

            return success(res, { hours, peakHour });
        } catch (err) {
            next(err);
        }
    },

    /**
     * Ticket promedio y estadísticas
     * GET /api/reports/ticket-stats?period=today
     */
    async ticketStats(req, res, next) {
        try {
            const { period = 'today' } = req.query;
            const df = getDateFilter(period);

            const result = await query(`
                SELECT 
                    COUNT(*) as total_sales,
                    COALESCE(AVG(total), 0) as avg_ticket,
                    COALESCE(MIN(total), 0) as min_ticket,
                    COALESCE(MAX(total), 0) as max_ticket,
                    COALESCE(SUM(total), 0) as total_revenue,
                    COALESCE(AVG(items_count), 0) as avg_items
                FROM (
                    SELECT s.total, COUNT(si.id) as items_count
                    FROM sales s
                    LEFT JOIN sale_items si ON si.sale_id = s.id
                    WHERE s.status = 'completed' AND ${df.replace('created_at', 's.created_at')}
                    GROUP BY s.id, s.total
                ) sub
            `);

            return success(res, result.rows[0]);
        } catch (err) {
            next(err);
        }
    },

    /**
     * ABC de productos - Clasificación A/B/C por ventas
     * GET /api/reports/abc?period=month
     */
    async abcProducts(req, res, next) {
        try {
            const { period = 'month' } = req.query;
            const df = getDateFilter(period, 's.');

            const result = await query(`
                SELECT 
                    si.product_name,
                    SUM(si.quantity) as total_qty,
                    SUM(si.subtotal) as total_revenue,
                    COUNT(DISTINCT si.sale_id) as times_ordered
                FROM sale_items si
                JOIN sales s ON s.id = si.sale_id
                WHERE s.status = 'completed' AND ${df}
                GROUP BY si.product_name
                ORDER BY total_revenue DESC
            `);

            const totalRevenue = result.rows.reduce((sum, r) => sum + parseFloat(r.total_revenue), 0);
            let cumulative = 0;

            const products = result.rows.map(r => {
                const revenue = parseFloat(r.total_revenue);
                const pct = totalRevenue > 0 ? (revenue / totalRevenue * 100) : 0;
                cumulative += pct;

                let classification;
                if (cumulative <= 80) classification = 'A';
                else if (cumulative <= 95) classification = 'B';
                else classification = 'C';

                return {
                    ...r,
                    revenue_pct: parseFloat(pct.toFixed(1)),
                    cumulative_pct: parseFloat(cumulative.toFixed(1)),
                    classification,
                };
            });

            return success(res, {
                products,
                summary: {
                    total_revenue: totalRevenue,
                    a_count: products.filter(p => p.classification === 'A').length,
                    b_count: products.filter(p => p.classification === 'B').length,
                    c_count: products.filter(p => p.classification === 'C').length,
                },
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * Top productos
     * GET /api/reports/top-products?period=month&limit=10
     */
    async topProducts(req, res, next) {
        try {
            const { period = 'month', limit = 10 } = req.query;
            const df = getDateFilter(period, 's.');

            const result = await query(`
                SELECT 
                    si.product_name,
                    SUM(si.quantity) as total_quantity,
                    SUM(si.subtotal) as total_revenue,
                    COUNT(DISTINCT si.sale_id) as times_ordered
                FROM sale_items si
                JOIN sales s ON s.id = si.sale_id
                WHERE s.status = 'completed' AND ${df}
                GROUP BY si.product_name
                ORDER BY total_quantity DESC
                LIMIT $1
            `, [parseInt(limit)]);

            return success(res, result.rows);
        } catch (err) {
            next(err);
        }
    },

    // ════════════════════════════════════════════════════
    //  📈 ESTRATÉGICOS
    // ════════════════════════════════════════════════════

    /**
     * Ingeniería de Menú (Margen × Popularidad)
     * GET /api/reports/menu-engineering?period=month
     */
    async menuEngineering(req, res, next) {
        try {
            const { period = 'month' } = req.query;
            const df = getDateFilter(period, 's.');

            // Ventas por producto
            const salesData = await query(`
                SELECT 
                    si.product_name,
                    p.id as product_id,
                    p.price,
                    SUM(si.quantity) as total_qty,
                    SUM(si.subtotal) as total_revenue,
                    COUNT(DISTINCT si.sale_id) as times_ordered
                FROM sale_items si
                JOIN sales s ON s.id = si.sale_id
                LEFT JOIN products p ON p.name = si.product_name
                WHERE s.status = 'completed' AND ${df}
                GROUP BY si.product_name, p.id, p.price
                ORDER BY total_qty DESC
            `);

            // Costo de receta por producto
            const recipeCosts = await query(`
                SELECT 
                    p.id as product_id, p.name,
                    COALESCE(SUM(r.quantity_needed * ii.last_cost_per_unit), 0) as recipe_cost
                FROM products p
                LEFT JOIN recipes r ON r.product_id = p.id
                LEFT JOIN inventory_items ii ON ii.id = r.inventory_item_id
                GROUP BY p.id, p.name
            `);

            const costMap = {};
            recipeCosts.rows.forEach(r => { costMap[r.product_id] = parseFloat(r.recipe_cost); });

            const totalQty = salesData.rows.reduce((s, r) => s + parseInt(r.total_qty), 0);
            const avgQty = salesData.rows.length > 0 ? totalQty / salesData.rows.length : 0;

            // Calculate margin for each product
            const products = salesData.rows.map(r => {
                const price = parseFloat(r.price || 0);
                const recipeCost = costMap[r.product_id] || 0;
                const margin = price - recipeCost;
                const qty = parseInt(r.total_qty);
                const isPopular = qty >= avgQty;
                const isProfitable = margin > 0;

                // Menu Engineering classification
                let category;
                if (isPopular && isProfitable) category = '⭐ Estrella';       // High margin, high sales
                else if (!isPopular && isProfitable) category = '🧩 Rompecabezas'; // High margin, low sales
                else if (isPopular && !isProfitable) category = '🐴 Caballo';      // Low margin, high sales
                else category = '🐕 Perro';                                         // Low margin, low sales

                return {
                    name: r.product_name,
                    product_id: r.product_id,
                    price,
                    recipe_cost: recipeCost,
                    margin: parseFloat(margin.toFixed(2)),
                    total_qty: qty,
                    total_revenue: parseFloat(r.total_revenue),
                    category,
                    is_popular: isPopular,
                    is_profitable: isProfitable,
                };
            });

            return success(res, {
                products,
                avgQuantity: parseFloat(avgQty.toFixed(0)),
                summary: {
                    stars: products.filter(p => p.category.includes('Estrella')).length,
                    puzzles: products.filter(p => p.category.includes('Rompecabezas')).length,
                    horses: products.filter(p => p.category.includes('Caballo')).length,
                    dogs: products.filter(p => p.category.includes('Perro')).length,
                },
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * Comparativo vs semana anterior
     * GET /api/reports/comparison
     */
    async comparison(req, res, next) {
        try {
            // Semana actual
            const current = await query(`
                SELECT COUNT(*) as sales, COALESCE(SUM(total), 0) as revenue, COALESCE(AVG(total), 0) as avg_ticket
                FROM sales WHERE status='completed' AND created_at >= DATE_TRUNC('week', CURRENT_DATE)
            `);

            // Semana anterior
            const prev = await query(`
                SELECT COUNT(*) as sales, COALESCE(SUM(total), 0) as revenue, COALESCE(AVG(total), 0) as avg_ticket
                FROM sales WHERE status='completed' 
                    AND created_at >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '7 days'
                    AND created_at < DATE_TRUNC('week', CURRENT_DATE)
            `);

            // Gastos semana actual
            const currentExpenses = await query(`
                SELECT 
                    COALESCE((SELECT SUM(total_cost) FROM inventory_purchases WHERE purchase_date >= DATE_TRUNC('week', CURRENT_DATE)), 0)
                    + COALESCE((SELECT SUM(amount) FROM investments WHERE purchase_date >= DATE_TRUNC('week', CURRENT_DATE)), 0)
                    + COALESCE((SELECT SUM(net_pay) FROM payroll_entries WHERE status='paid' AND payment_date >= DATE_TRUNC('week', CURRENT_DATE)), 0)
                    as total
            `);

            // Gastos semana anterior
            const prevExpenses = await query(`
                SELECT 
                    COALESCE((SELECT SUM(total_cost) FROM inventory_purchases WHERE purchase_date >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '7 days' AND purchase_date < DATE_TRUNC('week', CURRENT_DATE)), 0)
                    + COALESCE((SELECT SUM(amount) FROM investments WHERE purchase_date >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '7 days' AND purchase_date < DATE_TRUNC('week', CURRENT_DATE)), 0)
                    + COALESCE((SELECT SUM(net_pay) FROM payroll_entries WHERE status='paid' AND payment_date >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '7 days' AND payment_date < DATE_TRUNC('week', CURRENT_DATE)), 0)
                    as total
            `);

            const cRev = parseFloat(current.rows[0].revenue);
            const pRev = parseFloat(prev.rows[0].revenue);
            const cExp = parseFloat(currentExpenses.rows[0].total);
            const pExp = parseFloat(prevExpenses.rows[0].total);

            const growthPct = pRev > 0 ? ((cRev - pRev) / pRev * 100) : 0;

            return success(res, {
                current: {
                    sales: parseInt(current.rows[0].sales),
                    revenue: cRev,
                    avgTicket: parseFloat(parseFloat(current.rows[0].avg_ticket).toFixed(2)),
                    expenses: cExp,
                    profit: cRev - cExp,
                },
                previous: {
                    sales: parseInt(prev.rows[0].sales),
                    revenue: pRev,
                    avgTicket: parseFloat(parseFloat(prev.rows[0].avg_ticket).toFixed(2)),
                    expenses: pExp,
                    profit: pRev - pExp,
                },
                growthPct: parseFloat(growthPct.toFixed(1)),
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * Dashboard general (resumen rápido)
     * GET /api/reports/dashboard
     */
    async dashboard(req, res, next) {
        try {
            const today = await query(`
                SELECT COUNT(*) as sales, COALESCE(SUM(total),0) as revenue
                FROM sales WHERE status='completed' AND DATE(created_at) = CURRENT_DATE
            `);
            const week = await query(`
                SELECT COUNT(*) as sales, COALESCE(SUM(total),0) as revenue
                FROM sales WHERE status='completed' AND created_at >= DATE_TRUNC('week', CURRENT_DATE)
            `);
            const month = await query(`
                SELECT COUNT(*) as sales, COALESCE(SUM(total),0) as revenue
                FROM sales WHERE status='completed' AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
            `);
            const year = await query(`
                SELECT COUNT(*) as sales, COALESCE(SUM(total),0) as revenue
                FROM sales WHERE status='completed' AND created_at >= DATE_TRUNC('year', CURRENT_DATE)
            `);

            return success(res, {
                today: today.rows[0], week: week.rows[0],
                month: month.rows[0], year: year.rows[0],
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * Métodos de pago
     * GET /api/reports/payment-methods?period=month
     */
    async paymentMethods(req, res, next) {
        try {
            const { period = 'month' } = req.query;
            const df = getDateFilter(period);
            const result = await query(`
                SELECT payment_method, COUNT(*) as count, COALESCE(SUM(total), 0) as total
                FROM sales WHERE status = 'completed' AND ${df}
                GROUP BY payment_method
            `);
            return success(res, result.rows);
        } catch (err) {
            next(err);
        }
    },

    /**
     * Tipos de servicio (Dine-in vs Takeaway)
     * GET /api/reports/order-types?period=month
     */
    async orderTypes(req, res, next) {
        try {
            const { period = 'month' } = req.query;
            const df = getDateFilter(period);
            
            const result = await query(`
                SELECT 
                    order_type,
                    COUNT(*) as count,
                    COALESCE(SUM(total), 0) as total_revenue,
                    COALESCE(AVG(total), 0) as avg_ticket
                FROM sales 
                WHERE status = 'completed' AND ${df}
                GROUP BY order_type
                ORDER BY total_revenue DESC
            `);

            const totals = await query(`
                SELECT COUNT(*) as total_count, COALESCE(SUM(total), 0) as total_revenue
                FROM sales WHERE status = 'completed' AND ${df}
            `);

            const totalRevenue = parseFloat(totals.rows[0].total_revenue);
            const totalCount = parseInt(totals.rows[0].total_count);

            const breakdown = result.rows.map(row => ({
                ...row,
                total_revenue: parseFloat(row.total_revenue),
                avg_ticket: parseFloat(row.avg_ticket),
                count: parseInt(row.count),
                percentage: totalRevenue > 0 ? parseFloat(((parseFloat(row.total_revenue) / totalRevenue) * 100).toFixed(1)) : 0,
                count_percentage: totalCount > 0 ? parseFloat(((parseInt(row.count) / totalCount) * 100).toFixed(1)) : 0,
            }));

            return success(res, {
                period,
                breakdown,
                totals: {
                    revenue: totalRevenue,
                    count: totalCount,
                }
            });
        } catch (err) {
            next(err);
        }
    },
};

// ─── Helpers de fecha ───
function getDateFilter(period, prefix = '') {
    const col = `${prefix}created_at`;
    switch (period) {
        case 'today': return `DATE(${col}) = CURRENT_DATE`;
        case 'yesterday': return `DATE(${col}) = CURRENT_DATE - 1`;
        case 'week': return `${col} >= DATE_TRUNC('week', CURRENT_DATE)`;
        case 'month': return `${col} >= DATE_TRUNC('month', CURRENT_DATE)`;
        case 'year': return `${col} >= DATE_TRUNC('year', CURRENT_DATE)`;
        default: return `DATE(${col}) = CURRENT_DATE`;
    }
}

function getDateFilterCol(period, col) {
    switch (period) {
        case 'today': return `${col} = CURRENT_DATE`;
        case 'yesterday': return `${col} = CURRENT_DATE - 1`;
        case 'week': return `${col} >= DATE_TRUNC('week', CURRENT_DATE)::date`;
        case 'month': return `${col} >= DATE_TRUNC('month', CURRENT_DATE)::date`;
        case 'year': return `${col} >= DATE_TRUNC('year', CURRENT_DATE)::date`;
        default: return `${col} = CURRENT_DATE`;
    }
}

module.exports = ReportsController;

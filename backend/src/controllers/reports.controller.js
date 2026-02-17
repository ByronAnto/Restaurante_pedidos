/**
 * ═══════════════════════════════════════════════════════
 *  Reports Controller - Business Intelligence
 *  Transacciones · Productos · Análisis BI · Financiero · Estratégico
 * ═══════════════════════════════════════════════════════
 */

const { query } = require('../config/database');
const { success } = require('../utils/responses');

const ReportsController = {

    // ════════════════════════════════════════════════════
    //  🧾 TRANSACCIONES — Reporte detallado por período
    // ════════════════════════════════════════════════════

    /**
     * Lista de transacciones con filtros
     * GET /api/reports/transactions?period=today&period_id=5&payment=cash&type=dine_in&page=1&limit=50
     */
    async transactions(req, res, next) {
        try {
            const { period = 'today', period_id, payment, type, page = 1, limit = 50 } = req.query;
            const params = [];
            const conditions = ["s.status IN ('completed','voided')"];

            if (period_id) {
                params.push(parseInt(period_id));
                conditions.push(`s.period_id = $${params.length}`);
            } else {
                conditions.push(getDateFilter(period, 's.'));
            }

            if (payment) {
                params.push(payment);
                conditions.push(`s.payment_method = $${params.length}`);
            }
            if (type) {
                params.push(type);
                conditions.push(`s.order_type = $${params.length}`);
            }

            const where = conditions.join(' AND ');
            const offset = (parseInt(page) - 1) * parseInt(limit);

            // Count
            const countRes = await query(`SELECT COUNT(*) as total FROM sales s WHERE ${where}`, params);

            // Main query
            params.push(parseInt(limit));
            params.push(offset);
            const result = await query(`
                SELECT s.id, s.sale_number, s.status, s.payment_method, s.order_type,
                       s.subtotal, s.tax_total, s.total, s.amount_received, s.change_amount,
                       s.customer_name, s.notes, s.period_id, s.voided_at, s.void_reason,
                       s.created_at,
                       u.username as cashier,
                       COALESCE(t.name, '') as table_name,
                       (SELECT string_agg(si.product_name || ' x' || si.quantity, ', ') 
                        FROM sale_items si WHERE si.sale_id = s.id) as items_summary,
                       (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) as item_count
                FROM sales s
                LEFT JOIN users u ON u.id = s.user_id
                LEFT JOIN tables t ON t.id = s.table_id
                WHERE ${where}
                ORDER BY s.created_at DESC
                LIMIT $${params.length - 1} OFFSET $${params.length}
            `, params);

            // Totals for filtered set
            const totalsRes = await query(`
                SELECT 
                    COUNT(*) FILTER (WHERE s.status='completed') as completed_count,
                    COUNT(*) FILTER (WHERE s.status='voided') as voided_count,
                    COALESCE(SUM(s.total) FILTER (WHERE s.status='completed'), 0) as total_revenue,
                    COALESCE(SUM(s.total) FILTER (WHERE s.payment_method='cash' AND s.status='completed'), 0) as cash_total,
                    COALESCE(SUM(s.total) FILTER (WHERE s.payment_method='transfer' AND s.status='completed'), 0) as transfer_total,
                    COALESCE(AVG(s.total) FILTER (WHERE s.status='completed'), 0) as avg_ticket,
                    COALESCE(MAX(s.total) FILTER (WHERE s.status='completed'), 0) as max_ticket,
                    COALESCE(MIN(s.total) FILTER (WHERE s.status='completed'), 0) as min_ticket
                FROM sales s WHERE ${where}
            `, params.slice(0, -2));

            return success(res, {
                transactions: result.rows,
                totals: totalsRes.rows[0],
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: parseInt(countRes.rows[0].total),
                    pages: Math.ceil(parseInt(countRes.rows[0].total) / parseInt(limit)),
                }
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * Lista de períodos de caja para selector
     * GET /api/reports/periods-list?limit=30
     */
    async periodsList(req, res, next) {
        try {
            const { limit = 30 } = req.query;
            const result = await query(`
                SELECT sp.id, sp.open_date, sp.open_time, sp.close_time, sp.status,
                       sp.opening_cash, sp.closing_cash, sp.expected_cash,
                       sp.total_sales, sp.total_orders, sp.cash_total, sp.transfer_total,
                       sp.voided_total,
                       u1.username as opened_by_name,
                       u2.username as closed_by_name,
                       COALESCE((SELECT SUM(amount) FROM cash_withdrawals cw WHERE cw.period_id = sp.id), 0) as total_withdrawals,
                       COALESCE((SELECT COUNT(*) FROM cash_withdrawals cw WHERE cw.period_id = sp.id), 0) as withdrawal_count
                FROM sales_periods sp
                LEFT JOIN users u1 ON u1.id = sp.opened_by
                LEFT JOIN users u2 ON u2.id = sp.closed_by
                ORDER BY sp.open_time DESC
                LIMIT $1
            `, [parseInt(limit)]);

            return success(res, result.rows);
        } catch (err) {
            next(err);
        }
    },

    // ════════════════════════════════════════════════════
    //  🍽️ PRODUCTOS — Platos más vendidos + análisis
    // ════════════════════════════════════════════════════

    /**
     * Top platos con tendencia y categoría
     * GET /api/reports/top-dishes?period=month&limit=20
     */
    async topDishes(req, res, next) {
        try {
            const { period = 'month', limit = 20 } = req.query;
            const df = getDateFilter(period, 's.');

            // Top products with category
            const result = await query(`
                SELECT 
                    si.product_name,
                    COALESCE(c.name, 'Sin categoría') as category_name,
                    SUM(si.quantity) as total_qty,
                    SUM(si.subtotal) as total_revenue,
                    COUNT(DISTINCT si.sale_id) as orders_count,
                    COUNT(DISTINCT DATE(s.created_at)) as days_sold,
                    ROUND(AVG(si.quantity)::numeric, 1) as avg_qty_per_order,
                    ROUND(AVG(si.unit_price)::numeric, 2) as avg_price
                FROM sale_items si
                JOIN sales s ON s.id = si.sale_id
                LEFT JOIN products p ON p.name = si.product_name
                LEFT JOIN categories c ON c.id = p.category_id
                WHERE s.status = 'completed' AND ${df}
                GROUP BY si.product_name, c.name
                ORDER BY total_qty DESC
                LIMIT $1
            `, [parseInt(limit)]);

            const totalRevAll = result.rows.reduce((s, r) => s + parseFloat(r.total_revenue), 0);
            const totalQtyAll = result.rows.reduce((s, r) => s + parseInt(r.total_qty), 0);

            const dishes = result.rows.map((r, i) => ({
                rank: i + 1,
                ...r,
                total_qty: parseInt(r.total_qty),
                total_revenue: parseFloat(r.total_revenue),
                orders_count: parseInt(r.orders_count),
                days_sold: parseInt(r.days_sold),
                avg_qty_per_order: parseFloat(r.avg_qty_per_order),
                avg_price: parseFloat(r.avg_price),
                pct_revenue: totalRevAll > 0 ? parseFloat(((parseFloat(r.total_revenue) / totalRevAll) * 100).toFixed(1)) : 0,
                pct_qty: totalQtyAll > 0 ? parseFloat(((parseInt(r.total_qty) / totalQtyAll) * 100).toFixed(1)) : 0,
            }));

            // By category
            const byCategory = await query(`
                SELECT 
                    COALESCE(c.name, 'Sin categoría') as category,
                    SUM(si.quantity) as total_qty,
                    SUM(si.subtotal) as total_revenue,
                    COUNT(DISTINCT si.product_name) as products_count
                FROM sale_items si
                JOIN sales s ON s.id = si.sale_id
                LEFT JOIN products p ON p.name = si.product_name
                LEFT JOIN categories c ON c.id = p.category_id
                WHERE s.status = 'completed' AND ${df}
                GROUP BY c.name
                ORDER BY total_revenue DESC
            `);

            return success(res, {
                dishes,
                byCategory: byCategory.rows.map(r => ({
                    ...r,
                    total_qty: parseInt(r.total_qty),
                    total_revenue: parseFloat(r.total_revenue),
                    products_count: parseInt(r.products_count),
                    pct: totalRevAll > 0 ? parseFloat(((parseFloat(r.total_revenue) / totalRevAll) * 100).toFixed(1)) : 0,
                })),
                totals: { revenue: totalRevAll, qty: totalQtyAll },
            });
        } catch (err) {
            next(err);
        }
    },

    // ════════════════════════════════════════════════════
    //  🔮 ANÁLISIS BI — Día de semana + Predicción
    // ════════════════════════════════════════════════════

    /**
     * Análisis por día de semana con predicción
     * GET /api/reports/day-analysis?weeks=8
     */
    async dayAnalysis(req, res, next) {
        try {
            const { weeks = 8 } = req.query;
            const n = parseInt(weeks);

            // Sales by day of week for last N weeks
            const result = await query(`
                SELECT 
                    EXTRACT(DOW FROM created_at)::int as dow,
                    TO_CHAR(created_at, 'YYYY-MM-DD') as sale_date,
                    DATE(created_at) as d,
                    COUNT(*) as sales,
                    COALESCE(SUM(total), 0) as revenue,
                    COALESCE(AVG(total), 0) as avg_ticket
                FROM sales 
                WHERE status = 'completed' 
                    AND created_at >= CURRENT_DATE - INTERVAL '${n} weeks'
                GROUP BY EXTRACT(DOW FROM created_at), DATE(created_at), TO_CHAR(created_at, 'YYYY-MM-DD')
                ORDER BY DATE(created_at) ASC
            `);

            const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

            // Group by day of week
            const byDay = {};
            for (let i = 0; i < 7; i++) {
                byDay[i] = { dow: i, name: dayNames[i], history: [], totalSales: 0, totalRevenue: 0, count: 0 };
            }

            result.rows.forEach(r => {
                const dow = parseInt(r.dow);
                byDay[dow].history.push({
                    date: r.sale_date,
                    sales: parseInt(r.sales),
                    revenue: parseFloat(r.revenue),
                    avgTicket: parseFloat(r.avg_ticket),
                });
                byDay[dow].totalSales += parseInt(r.sales);
                byDay[dow].totalRevenue += parseFloat(r.revenue);
                byDay[dow].count++;
            });

            // Calculate stats + prediction per day
            const analysis = Object.values(byDay).map(day => {
                const salesArr = day.history.map(h => h.sales);
                const revArr = day.history.map(h => h.revenue);
                const avgSales = day.count > 0 ? day.totalSales / day.count : 0;
                const avgRevenue = day.count > 0 ? day.totalRevenue / day.count : 0;

                // Standard deviation
                const stdDev = salesArr.length > 1 
                    ? Math.sqrt(salesArr.reduce((s, v) => s + Math.pow(v - avgSales, 2), 0) / (salesArr.length - 1))
                    : 0;

                // Weighted moving average (recent weeks weighted more)
                let weightedAvg = avgSales;
                if (salesArr.length >= 3) {
                    const recent = salesArr.slice(-4);
                    const weights = recent.map((_, i) => i + 1);
                    const totalWeight = weights.reduce((s, w) => s + w, 0);
                    weightedAvg = recent.reduce((s, v, i) => s + v * weights[i], 0) / totalWeight;
                }

                // Simple trend (slope of last entries)
                let trend = 0;
                if (salesArr.length >= 3) {
                    const last = salesArr.slice(-4);
                    const xMean = (last.length - 1) / 2;
                    const yMean = last.reduce((s, v) => s + v, 0) / last.length;
                    const num = last.reduce((s, v, i) => s + (i - xMean) * (v - yMean), 0);
                    const den = last.reduce((s, _, i) => s + Math.pow(i - xMean, 2), 0);
                    trend = den > 0 ? num / den : 0;
                }

                // Prediction = weighted average + trend adjustment
                const prediction = Math.max(0, Math.round(weightedAvg + trend));
                const predRevenue = avgSales > 0 ? (prediction / avgSales) * avgRevenue : 0;

                // Confidence based on data volume and consistency  
                const confidence = Math.min(95, Math.max(30, 
                    Math.round(60 + (day.count * 3) - (stdDev / Math.max(1, avgSales)) * 30)
                ));

                // End-of-month factor
                const today = new Date();
                const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
                const dayOfMonth = today.getDate();
                const isEndOfMonth = dayOfMonth >= daysInMonth - 5;
                const isStartOfMonth = dayOfMonth <= 5;
                let monthFactor = 'normal';
                if (isEndOfMonth) monthFactor = 'fin_de_mes';
                else if (isStartOfMonth) monthFactor = 'inicio_de_mes';

                // Last occurrence of this day
                const lastOccurrence = day.history.length > 0 ? day.history[day.history.length - 1] : null;

                return {
                    dow: day.dow,
                    name: day.name,
                    weeksAnalyzed: day.count,
                    avgSales: parseFloat(avgSales.toFixed(1)),
                    avgRevenue: parseFloat(avgRevenue.toFixed(2)),
                    avgTicket: day.count > 0 ? parseFloat((day.totalRevenue / day.totalSales).toFixed(2)) : 0,
                    minSales: salesArr.length > 0 ? Math.min(...salesArr) : 0,
                    maxSales: salesArr.length > 0 ? Math.max(...salesArr) : 0,
                    stdDev: parseFloat(stdDev.toFixed(1)),
                    trend: trend > 0.3 ? 'up' : (trend < -0.3 ? 'down' : 'stable'),
                    trendValue: parseFloat(trend.toFixed(2)),
                    prediction,
                    predRevenue: parseFloat(predRevenue.toFixed(2)),
                    confidence,
                    monthFactor,
                    lastOccurrence,
                    history: day.history.slice(-6), // last 6 occurrences
                };
            });

            // Best/worst days
            const sorted = [...analysis].sort((a, b) => b.avgRevenue - a.avgRevenue);
            const bestDay = sorted[0];
            const worstDay = sorted[sorted.length - 1];

            // Today's prediction
            const todayDow = new Date().getDay();
            const todayPrediction = analysis[todayDow];

            // This week forecast
            const weekForecast = analysis.reduce((s, d) => s + d.predRevenue, 0);

            return success(res, {
                analysis,
                insights: {
                    bestDay: bestDay?.name,
                    bestDayAvgRevenue: bestDay?.avgRevenue || 0,
                    worstDay: worstDay?.name,
                    worstDayAvgRevenue: worstDay?.avgRevenue || 0,
                    todayPrediction,
                    weekForecast: parseFloat(weekForecast.toFixed(2)),
                    weeksAnalyzed: n,
                },
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * Tendencia horaria por día de semana (heatmap data)
     * GET /api/reports/hourly-heatmap?weeks=4
     */
    async hourlyHeatmap(req, res, next) {
        try {
            const { weeks = 4 } = req.query;
            const result = await query(`
                SELECT 
                    EXTRACT(DOW FROM created_at)::int as dow,
                    EXTRACT(HOUR FROM created_at)::int as hour,
                    COUNT(*) as sales,
                    COALESCE(SUM(total), 0) as revenue
                FROM sales 
                WHERE status = 'completed' 
                    AND created_at >= CURRENT_DATE - INTERVAL '${parseInt(weeks)} weeks'
                GROUP BY EXTRACT(DOW FROM created_at), EXTRACT(HOUR FROM created_at)
                ORDER BY dow, hour
            `);

            const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            const heatmap = [];
            const maxSales = Math.max(1, ...result.rows.map(r => parseInt(r.sales)));

            for (let dow = 0; dow < 7; dow++) {
                for (let h = 6; h <= 23; h++) {
                    const match = result.rows.find(r => parseInt(r.dow) === dow && parseInt(r.hour) === h);
                    heatmap.push({
                        dow, hour: h,
                        dayName: dayNames[dow],
                        sales: match ? parseInt(match.sales) : 0,
                        revenue: match ? parseFloat(match.revenue) : 0,
                        intensity: match ? parseFloat((parseInt(match.sales) / maxSales).toFixed(2)) : 0,
                    });
                }
            }

            return success(res, { heatmap, maxSales });
        } catch (err) {
            next(err);
        }
    },

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

            // Retiros de efectivo en el período
            const withdrawalsRes = await query(`
                SELECT COALESCE(SUM(cw.amount), 0) as total
                FROM cash_withdrawals cw
                JOIN sales_periods sp ON sp.id = cw.period_id
                WHERE ${getDateFilter(period, 'sp.').replace('created_at', 'open_time')}
            `);

            const revenue = parseFloat(salesRes.rows[0].revenue);
            const costInventory = parseFloat(purchasesRes.rows[0].total);
            const costInvestments = parseFloat(investmentsRes.rows[0].total);
            const costPayroll = parseFloat(payrollRes.rows[0].total);
            const totalWithdrawals = parseFloat(withdrawalsRes.rows[0].total);
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
                withdrawals: totalWithdrawals,
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

            // Retiros de caja
            const withdrawRes = await query(`
                SELECT COALESCE(SUM(cw.amount), 0) as total
                FROM cash_withdrawals cw
                JOIN sales_periods sp ON sp.id = cw.period_id
                WHERE ${getDateFilter(period, 'sp.').replace('created_at', 'open_time')}
            `);

            const cashIn = parseFloat(salesRes.rows[0].cash_in);
            const transferIn = parseFloat(salesRes.rows[0].transfer_in);
            const withdrawals = parseFloat(withdrawRes.rows[0].total);
            const cashOut = parseFloat(payrollRes.rows[0].cash_out) + parseFloat(invRes.rows[0].total) + parseFloat(purchRes.rows[0].total);
            const transferOut = parseFloat(payrollRes.rows[0].transfer_out);

            return success(res, {
                period,
                income: { cash: cashIn, transfer: transferIn, total: cashIn + transferIn },
                expenses: { cash: cashOut, transfer: transferOut, total: cashOut + transferOut },
                withdrawals,
                netCash: cashIn - cashOut - withdrawals,
                netTransfer: transferIn - transferOut,
                netTotal: (cashIn + transferIn) - (cashOut + transferOut) - withdrawals,
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
                if (isPopular && isProfitable) category = '⭐ Estrella';
                else if (!isPopular && isProfitable) category = '🧩 Rompecabezas';
                else if (isPopular && !isProfitable) category = '🐴 Caballo';
                else category = '🐕 Perro';

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

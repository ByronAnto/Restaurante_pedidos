import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../../core/api/api_client.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/widgets/app_drawer.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/stat_card.dart';
import '../../../core/widgets/toast_notification.dart';
import '../../auth/providers/auth_provider.dart';
import '../../../core/utils/parsers.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> with SingleTickerProviderStateMixin {
  final ApiClient _api = ApiClient();
  late TabController _tabController;
  bool _isLoading = true;
  String _period = 'today';

  Map<String, dynamic> _pnl = {};
  Map<String, dynamic> _cashFlow = {};
  List<Map<String, dynamic>> _pnlTrend = [];
  Map<String, dynamic> _ticketStats = {};
  List<Map<String, dynamic>> _salesByHour = [];
  List<Map<String, dynamic>> _abc = [];
  List<Map<String, dynamic>> _menuEng = [];
  Map<String, dynamic> _comparison = {};
  List<Map<String, dynamic>> _topProducts = [];
  Map<String, dynamic> _orderTypes = {};

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final results = await Future.wait([
        _api.get('/reports/pnl?period=$_period'),
        _api.get('/reports/cash-flow?period=$_period'),
        _api.get('/reports/pnl-trend'),
        _api.get('/reports/ticket-stats?period=$_period'),
        _api.get('/reports/sales-by-hour?period=$_period'),
        _api.get('/reports/abc?period=$_period'),
        _api.get('/reports/menu-engineering?period=$_period'),
        _api.get('/reports/comparison'),
        _api.get('/reports/top-products?period=$_period'),
        _api.get('/reports/order-types?period=$_period'),
      ]);

      _pnl = results[0]['data'] as Map<String, dynamic>? ?? {};
      _cashFlow = results[1]['data'] as Map<String, dynamic>? ?? {};
      _pnlTrend = List<Map<String, dynamic>>.from(results[2]['data'] ?? []);
      _ticketStats = results[3]['data'] as Map<String, dynamic>? ?? {};
      _salesByHour = List<Map<String, dynamic>>.from(results[4]['data'] ?? []);
      _abc = List<Map<String, dynamic>>.from(results[5]['data'] ?? []);
      _menuEng = List<Map<String, dynamic>>.from(results[6]['data'] ?? []);
      _comparison = results[7]['data'] as Map<String, dynamic>? ?? {};
      _topProducts = List<Map<String, dynamic>>.from(results[8]['data'] ?? []);
      _orderTypes = results[9]['data'] as Map<String, dynamic>? ?? {};
    } catch (e) {
      if (mounted) showToast(context, 'Error cargando reportes', type: 'error');
    }
    if (mounted) setState(() => _isLoading = false);
  }

  @override
  Widget build(BuildContext context) {
    final user = context.read<AuthProvider>().user;

    return Scaffold(
      appBar: AppBar(
        title: const Text('📊 Reportes'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: '💰 Financiero'),
            Tab(text: '📈 Operacional'),
            Tab(text: '🎯 Estratégico'),
          ],
        ),
      ),
      drawer: AppDrawer(currentPage: 'reports', user: user),
      body: _isLoading
          ? const LoadingWidget(message: 'Cargando reportes...')
          : Column(
              children: [
                // Period filter
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _buildPeriodChip('Hoy', 'today'),
                        const SizedBox(width: 6),
                        _buildPeriodChip('Ayer', 'yesterday'),
                        const SizedBox(width: 6),
                        _buildPeriodChip('Semana', 'week'),
                        const SizedBox(width: 6),
                        _buildPeriodChip('Mes', 'month'),
                      ],
                    ),
                  ),
                ),

                // Tabs
                Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _buildFinancialTab(),
                      _buildOperationalTab(),
                      _buildStrategicTab(),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildPeriodChip(String label, String period) {
    final isActive = _period == period;
    return FilterChip(
      label: Text(label, style: const TextStyle(fontSize: 12)),
      selected: isActive,
      onSelected: (_) {
        setState(() => _period = period);
        _loadData();
      },
      selectedColor: AppConstants.accentPrimary.withValues(alpha: 0.2),
      checkmarkColor: AppConstants.accentPrimary,
    );
  }

  // ═══════════════════ FINANCIAL TAB ═══════════════════

  Widget _buildFinancialTab() {
    final revenue = toDouble(_pnl['total_revenue'], 0);
    final costs = toDouble(_pnl['total_costs'], 0);
    final profit = toDouble(_pnl['net_profit'], 0);
    final margin = toDouble(_pnl['profit_margin'], 0);

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        children: [
          // KPIs
          Row(
            children: [
              Expanded(child: StatCard(icon: '💰', value: '\$${revenue.toStringAsFixed(2)}', label: 'Ingresos', valueColor: AppConstants.success)),
              const SizedBox(width: 8),
              Expanded(child: StatCard(icon: '📉', value: '\$${costs.toStringAsFixed(2)}', label: 'Costos', valueColor: AppConstants.danger)),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(child: StatCard(icon: '📊', value: '\$${profit.toStringAsFixed(2)}', label: 'Ganancia Neta',
                valueColor: profit >= 0 ? AppConstants.success : AppConstants.danger)),
              const SizedBox(width: 8),
              Expanded(child: StatCard(icon: '📈', value: '${margin.toStringAsFixed(1)}%', label: 'Margen',
                valueColor: margin >= 30 ? AppConstants.success : AppConstants.warning)),
            ],
          ),
          const SizedBox(height: 16),

          // P&L Detail
          _buildSectionTitle('📊 Estado de Resultados (P&L)'),
          _buildPnlRow('Ventas Totales', revenue, AppConstants.success),
          _buildPnlRow('Costo de Insumos', toDouble(_pnl['ingredient_costs'], 0), AppConstants.danger),
          _buildPnlRow('Nómina', toDouble(_pnl['payroll_costs'], 0), AppConstants.danger),
          _buildPnlRow('Inversiones', toDouble(_pnl['investment_costs'], 0), AppConstants.danger),
          const Divider(),
          _buildPnlRow('GANANCIA NETA', profit, profit >= 0 ? AppConstants.success : AppConstants.danger, bold: true),
          const SizedBox(height: 16),

          // Cash Flow
          _buildSectionTitle('💵 Flujo de Caja'),
          _buildPnlRow('Efectivo Recibido', toDouble(_cashFlow['cash_received'], 0), AppConstants.success),
          _buildPnlRow('Transferencias', toDouble(_cashFlow['transfer_received'], 0), AppConstants.info),
          _buildPnlRow('Pagos Nómina (Efe.)', toDouble(_cashFlow['cash_payroll'], 0), AppConstants.danger),
          const SizedBox(height: 16),

          // Trend
          if (_pnlTrend.isNotEmpty) ...[
            _buildSectionTitle('📈 Tendencia 7 Días'),
            ..._pnlTrend.map((day) {
              final date = day['date']?.toString() ?? '';
              final rev = toDouble(day['revenue'], 0);
              String formatted = date;
              try { formatted = DateFormat('dd/MM').format(DateTime.parse(date)); } catch (_) {}
              return _buildPnlRow(formatted, rev, AppConstants.accentPrimary);
            }),
          ],
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  // ═══════════════════ OPERATIONAL TAB ═══════════════════

  Widget _buildOperationalTab() {
    final avgTicket = toDouble(_ticketStats['average_ticket'], 0);
    final totalOrders = toInt(_ticketStats['total_orders'], 0);
    final dineIn = toInt(_orderTypes['dine_in'], 0);
    final takeaway = toInt(_orderTypes['takeaway'], 0);

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        children: [
          // KPIs
          Row(
            children: [
              Expanded(child: StatCard(icon: '🎫', value: '\$${avgTicket.toStringAsFixed(2)}', label: 'Ticket Promedio')),
              const SizedBox(width: 8),
              Expanded(child: StatCard(icon: '📋', value: '$totalOrders', label: 'Órdenes')),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(child: StatCard(icon: '🍽️', value: '$dineIn', label: 'Mesa', valueColor: AppConstants.info)),
              const SizedBox(width: 8),
              Expanded(child: StatCard(icon: '🛍️', value: '$takeaway', label: 'Para Llevar', valueColor: AppConstants.warning)),
            ],
          ),
          const SizedBox(height: 16),

          // Top Products
          if (_topProducts.isNotEmpty) ...[
            _buildSectionTitle('🏆 Top Productos'),
            ..._topProducts.take(10).toList().asMap().entries.map((e) {
              final i = e.key;
              final p = e.value;
              final qty = toInt(p['total_quantity'], 0);
              final rev = toDouble(p['total_revenue'], 0);
              return Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: AppConstants.bgSecondary,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppConstants.borderColor),
                ),
                child: Row(
                  children: [
                    Text('${i + 1}.', style: TextStyle(fontWeight: FontWeight.w800, color: i < 3 ? AppConstants.accentPrimary : AppConstants.textMuted)),
                    const SizedBox(width: 10),
                    Expanded(child: Text(p['name']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
                    Text('${qty}u', style: const TextStyle(fontSize: 12, color: AppConstants.textMuted)),
                    const SizedBox(width: 10),
                    Text('\$${rev.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w700, color: AppConstants.accentPrimary)),
                  ],
                ),
              );
            }),
          ],
          const SizedBox(height: 16),

          // ABC Analysis
          if (_abc.isNotEmpty) ...[
            _buildSectionTitle('📊 Análisis ABC'),
            ..._abc.map((item) {
              final cat = item['category']?.toString() ?? '';
              final color = cat == 'A' ? AppConstants.success : cat == 'B' ? AppConstants.warning : AppConstants.danger;
              return Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: AppConstants.bgSecondary,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppConstants.borderColor),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 28, height: 28,
                      decoration: BoxDecoration(color: color.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(6)),
                      child: Center(child: Text(cat, style: TextStyle(fontWeight: FontWeight.w800, color: color))),
                    ),
                    const SizedBox(width: 10),
                    Expanded(child: Text(item['name']?.toString() ?? '', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500))),
                    Text('\$${(toDouble(item['revenue'], 0)).toStringAsFixed(2)}',
                      style: const TextStyle(fontWeight: FontWeight.w700, color: AppConstants.accentPrimary, fontSize: 13)),
                  ],
                ),
              );
            }),
          ],
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  // ═══════════════════ STRATEGIC TAB ═══════════════════

  Widget _buildStrategicTab() {
    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        children: [
          // Weekly comparison
          if (_comparison.isNotEmpty) ...[
            _buildSectionTitle('📅 Comparativo Semanal'),
            _buildComparisonRow('Ventas',
              toDouble(_comparison['current_revenue'], 0),
              toDouble(_comparison['previous_revenue'], 0)),
            _buildComparisonRow('Órdenes',
              toDouble(_comparison['current_orders'], 0),
              toDouble(_comparison['previous_orders'], 0)),
            _buildComparisonRow('Ticket Promedio',
              toDouble(_comparison['current_avg_ticket'], 0),
              toDouble(_comparison['previous_avg_ticket'], 0)),
            const SizedBox(height: 16),
          ],

          // Menu Engineering
          if (_menuEng.isNotEmpty) ...[
            _buildSectionTitle('🎯 Ingeniería de Menú'),
            const SizedBox(height: 4),
            const Text('Clasificación por popularidad y rentabilidad',
              style: TextStyle(fontSize: 12, color: AppConstants.textMuted)),
            const SizedBox(height: 10),
            ..._menuEng.map((item) {
              final cat = item['classification']?.toString() ?? '';
              final icons = {
                'Star': '⭐', 'Plow Horse': '🐴', 'Puzzle': '🧩', 'Dog': '🐕'
              };
              final colors = {
                'Star': AppConstants.success, 'Plow Horse': AppConstants.warning,
                'Puzzle': AppConstants.info, 'Dog': AppConstants.danger,
              };
              return Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: AppConstants.bgSecondary, borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppConstants.borderColor),
                ),
                child: Row(
                  children: [
                    Text(icons[cat] ?? '📦', style: const TextStyle(fontSize: 16)),
                    const SizedBox(width: 10),
                    Expanded(child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(item['name']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                        Text(cat, style: TextStyle(fontSize: 11, color: colors[cat] ?? AppConstants.textMuted, fontWeight: FontWeight.w600)),
                      ],
                    )),
                    Text('\$${(toDouble(item['revenue'], 0)).toStringAsFixed(2)}',
                      style: const TextStyle(fontWeight: FontWeight.w700, color: AppConstants.accentPrimary, fontSize: 13)),
                  ],
                ),
              );
            }),
          ],

          // Sales by hour
          if (_salesByHour.isNotEmpty) ...[
            const SizedBox(height: 16),
            _buildSectionTitle('⏰ Ventas por Hora'),
            ..._salesByHour.map((h) {
              final hour = h['hour']?.toString() ?? '';
              final count = toInt(h['count'], 0);
              final xCount = _salesByHour.map((x) => toInt(x['count'], 0));
              final maxCount = xCount.isEmpty ? 0 : xCount.reduce((a, b) => a > b ? a : b);
              final ratio = maxCount > 0 ? count / maxCount : 0.0;

              return Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  children: [
                    SizedBox(width: 40, child: Text('${hour}h', style: const TextStyle(fontSize: 11, color: AppConstants.textMuted))),
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(3),
                        child: LinearProgressIndicator(
                          value: ratio,
                          backgroundColor: AppConstants.bgTertiary,
                          color: AppConstants.accentPrimary,
                          minHeight: 16,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox(width: 30, child: Text('$count', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700))),
                  ],
                ),
              );
            }),
          ],
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  // ═══════════════════ HELPERS ═══════════════════

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10, top: 4),
      child: Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
    );
  }

  Widget _buildPnlRow(String label, double value, Color color, {bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(child: Text(label, style: TextStyle(
            fontSize: 13, fontWeight: bold ? FontWeight.w700 : FontWeight.w400,
            color: bold ? AppConstants.textPrimary : AppConstants.textSecondary))),
          Text('\$${value.toStringAsFixed(2)}', style: TextStyle(
            fontSize: 14, fontWeight: bold ? FontWeight.w800 : FontWeight.w600, color: color)),
        ],
      ),
    );
  }

  Widget _buildComparisonRow(String label, double current, double previous) {
    final change = previous > 0 ? ((current - previous) / previous * 100) : 0;
    final isUp = change >= 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppConstants.bgSecondary, borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppConstants.borderColor),
      ),
      child: Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w500))),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('\$${current.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w700)),
              Text(
                '${isUp ? '▲' : '▼'} ${change.toStringAsFixed(1)}%',
                style: TextStyle(fontSize: 11, color: isUp ? AppConstants.success : AppConstants.danger, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

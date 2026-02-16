import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/widgets/app_drawer.dart';
import '../../../core/widgets/empty_state.dart';
import '../../auth/providers/auth_provider.dart';
import '../providers/pos_provider.dart';
import 'ordering_screen.dart';
import '../../../core/utils/parsers.dart';

class TableMapScreen extends StatefulWidget {
  const TableMapScreen({super.key});

  @override
  State<TableMapScreen> createState() => _TableMapScreenState();
}

class _TableMapScreenState extends State<TableMapScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<PosProvider>().loadData();
    });
  }

  @override
  Widget build(BuildContext context) {
    final user = context.read<AuthProvider>().user;

    return Scaffold(
      appBar: AppBar(title: const Text('🛒 Punto de Venta')),
      drawer: AppDrawer(currentPage: 'pos', user: user),
      body: Consumer<PosProvider>(
        builder: (context, pos, _) {
          if (pos.isLoading) {
            return const LoadingWidget(message: 'Cargando mesas...');
          }

          // If a table or takeaway is selected, show ordering
          if (pos.currentTable != null || pos.orderType == 'takeaway') {
            return const OrderingScreen();
          }

          return _buildTableMap(pos);
        },
      ),
    );
  }

  Widget _buildTableMap(PosProvider pos) {
    final tables = pos.tables;
    final zones = <String>{};
    for (var t in tables) {
      zones.add(t['zone']?.toString() ?? 'General');
    }

    final freeCount = tables.where((t) => t['status'] == 'free').length;
    final occupiedCount = tables.length - freeCount;

    return RefreshIndicator(
      onRefresh: pos.refreshTables,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Stats row
          Row(
            children: [
              _buildStatChip('🟢', '$freeCount Libres', AppConstants.success),
              const SizedBox(width: 8),
              _buildStatChip('🔴', '$occupiedCount Ocupadas', AppConstants.danger),
              const SizedBox(width: 8),
              _buildStatChip('🍽️', '${tables.length} Total', AppConstants.info),
            ],
          ),
          const SizedBox(height: 16),

          // Takeaway button
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => pos.startTakeaway(),
              icon: const Text('🛍️', style: TextStyle(fontSize: 18)),
              label: const Text('Pedido Para Llevar'),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                side: const BorderSide(color: AppConstants.accentPrimary),
                foregroundColor: AppConstants.accentPrimary,
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Tables by zone
          if (tables.isEmpty)
            const EmptyStateWidget(
              icon: '🍽️',
              text: 'No hay mesas configuradas',
              subtext: 'Ve a Configuración para agregar mesas',
            )
          else
            ...zones.map((zone) => _buildZone(zone, tables, pos)),
        ],
      ),
    );
  }

  Widget _buildStatChip(String icon, String label, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(icon, style: const TextStyle(fontSize: 14)),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: color,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildZone(String zone, List<Map<String, dynamic>> allTables, PosProvider pos) {
    final zoneTables = allTables.where((t) => (t['zone']?.toString() ?? 'General') == zone).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text(
            zone,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppConstants.textSecondary,
            ),
          ),
        ),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 1.1,
          ),
          itemCount: zoneTables.length,
          itemBuilder: (context, i) => _buildTableCard(zoneTables[i], pos),
        ),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _buildTableCard(Map<String, dynamic> table, PosProvider pos) {
    final isFree = table['status'] == 'free';
    final color = isFree ? AppConstants.success : AppConstants.danger;
    final order = table['active_order'];
    final orderTotal = order != null ? toDouble(order['total'], 0.0) : 0.0;

    return GestureDetector(
      onTap: () => pos.selectTable(table),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.4), width: 1.5),
        ),
        padding: const EdgeInsets.all(10),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              table['name']?.toString() ?? 'Mesa',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: color,
              ),
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 2),
            Text(
              '👥 ${table['capacity'] ?? 4}',
              style: const TextStyle(fontSize: 11, color: AppConstants.textMuted),
            ),
            if (!isFree && orderTotal > 0) ...[
              const SizedBox(height: 4),
              Text(
                '\$${orderTotal.toStringAsFixed(2)}',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: AppConstants.accentPrimary,
                ),
              ),
            ],
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                isFree ? 'Libre' : 'Ocupada',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: color,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

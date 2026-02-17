import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/widgets/app_drawer.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/toast_notification.dart';
import '../../auth/providers/auth_provider.dart';
import '../providers/kitchen_provider.dart';

class KitchenScreen extends StatefulWidget {
  const KitchenScreen({super.key});

  @override
  State<KitchenScreen> createState() => _KitchenScreenState();
}

class _KitchenScreenState extends State<KitchenScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<KitchenProvider>();
      provider.loadOrders();
      provider.startPolling();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    context.read<KitchenProvider>().stopPolling();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = context.read<AuthProvider>().user;

    return Scaffold(
      appBar: AppBar(
        title: const Text('👨‍🍳 Comandera'),
        bottom: TabBar(
          controller: _tabController,
          tabs: [
            Consumer<KitchenProvider>(builder: (_, k, __) => Tab(
              child: _buildTabLabel('🔴 Pendientes', k.pendingOrders.length),
            )),
            Consumer<KitchenProvider>(builder: (_, k, __) => Tab(
              child: _buildTabLabel('🟡 Preparando', k.preparingOrders.length),
            )),
            Consumer<KitchenProvider>(builder: (_, k, __) => Tab(
              child: _buildTabLabel('🟢 Listos', k.readyOrders.length),
            )),
          ],
        ),
      ),
      drawer: AppDrawer(currentPage: 'kitchen', user: user),
      body: Consumer<KitchenProvider>(
        builder: (context, kitchen, _) {
          if (kitchen.isLoading && kitchen.orders.isEmpty) {
            return const LoadingWidget(message: 'Cargando órdenes...');
          }

          return TabBarView(
            controller: _tabController,
            children: [
              _buildOrdersList(kitchen.pendingOrders, 'pending', kitchen),
              _buildOrdersList(kitchen.preparingOrders, 'preparing', kitchen),
              _buildOrdersList(kitchen.readyOrders, 'ready', kitchen),
            ],
          );
        },
      ),
    );
  }

  Widget _buildTabLabel(String text, int count) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(text, style: const TextStyle(fontSize: 12)),
        if (count > 0) ...[
          const SizedBox(width: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: AppConstants.accentPrimary,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              '$count',
              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.black),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildOrdersList(List<Map<String, dynamic>> orders, String status, KitchenProvider kitchen) {
    if (orders.isEmpty) {
      return EmptyStateWidget(
        icon: status == 'pending' ? '🔴' : status == 'preparing' ? '🟡' : '🟢',
        text: 'No hay órdenes ${status == 'pending' ? 'pendientes' : status == 'preparing' ? 'en preparación' : 'listas'}',
      );
    }

    return RefreshIndicator(
      onRefresh: kitchen.loadOrders,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: orders.length,
        itemBuilder: (context, i) => _buildOrderCard(orders[i], status, kitchen),
      ),
    );
  }

  Widget _buildOrderCard(Map<String, dynamic> order, String status, KitchenProvider kitchen) {
    final orderId = order['id'];
    final orderType = order['order_type']?.toString() ?? 'takeaway';
    final tableName = order['table_name']?.toString() ?? '';
    final items = List<Map<String, dynamic>>.from(order['items'] ?? []);
    final createdAt = order['created_at']?.toString() ?? '';
    final elapsed = _calculateElapsed(createdAt);

    final statusColor = status == 'pending'
        ? AppConstants.danger
        : status == 'preparing'
            ? AppConstants.warning
            : AppConstants.success;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppConstants.bgSecondary,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: statusColor.withValues(alpha: 0.4)),
      ),
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.08),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            ),
            child: Row(
              children: [
                Text(
                  '#$orderId',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: statusColor,
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppConstants.bgTertiary,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    orderType == 'dine_in' ? '🍽️ $tableName' : '🛍️ Llevar',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
                  ),
                ),
                const Spacer(),
                Text(
                  '⏱️ $elapsed',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: _elapsedMinutes(createdAt) > 15 ? AppConstants.danger : AppConstants.textMuted,
                  ),
                ),
              ],
            ),
          ),

          // Items
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Column(
              children: items.map((item) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(
                  children: [
                    Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        color: AppConstants.accentPrimary.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Center(
                        child: Text(
                          '${item['quantity'] ?? 1}',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: AppConstants.accentPrimary,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        item['product_name']?.toString() ?? '',
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                      ),
                    ),
                    if (item['notes']?.toString().isNotEmpty == true)
                      Text(
                        '📝 ${item['notes']}',
                        style: const TextStyle(fontSize: 11, color: AppConstants.textMuted),
                      ),
                    if (item['modifiers']?.toString().isNotEmpty == true)
                      Text(
                        '🧩 ${item['modifiers']}',
                        style: const TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: AppConstants.accentSecondary),
                      ),
                  ],
                ),
              )).toList(),
            ),
          ),

          // Action button
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => _advanceStatus(kitchen, orderId, status),
                style: ElevatedButton.styleFrom(
                  backgroundColor: status == 'pending'
                      ? AppConstants.warning
                      : status == 'preparing'
                          ? AppConstants.success
                          : AppConstants.info,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                ),
                child: Text(
                  status == 'pending'
                      ? '👨‍🍳 Preparar'
                      : status == 'preparing'
                          ? '✅ Listo'
                          : '🏁 Entregado',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _calculateElapsed(String createdAt) {
    if (createdAt.isEmpty) return '--';
    try {
      final dt = DateTime.parse(createdAt);
      final diff = DateTime.now().difference(dt);
      if (diff.inMinutes < 1) return '< 1m';
      if (diff.inMinutes < 60) return '${diff.inMinutes}m';
      return '${diff.inHours}h ${diff.inMinutes % 60}m';
    } catch (e) {
      return '--';
    }
  }

  int _elapsedMinutes(String createdAt) {
    if (createdAt.isEmpty) return 0;
    try {
      return DateTime.now().difference(DateTime.parse(createdAt)).inMinutes;
    } catch (e) {
      return 0;
    }
  }

  void _advanceStatus(KitchenProvider kitchen, int orderId, String currentStatus) async {
    final newStatus = currentStatus == 'pending'
        ? 'preparing'
        : currentStatus == 'preparing'
            ? 'ready'
            : 'delivered';

    try {
      await kitchen.updateStatus(orderId, newStatus);
      if (mounted) showToast(context, 'Orden #$orderId actualizada', type: 'success');
    } catch (e) {
      if (mounted) showToast(context, e.toString(), type: 'error');
    }
  }
}

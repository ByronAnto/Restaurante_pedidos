import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/api/api_client.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/widgets/app_drawer.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/stat_card.dart';
import '../../../core/widgets/toast_notification.dart';
import '../../auth/providers/auth_provider.dart';
import '../../../core/utils/parsers.dart';

class InventoryScreen extends StatefulWidget {
  const InventoryScreen({super.key});

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> with SingleTickerProviderStateMixin {
  final ApiClient _api = ApiClient();
  List<Map<String, dynamic>> _items = [];
  List<Map<String, dynamic>> _purchases = [];
  Map<String, dynamic>? _analysis;
  bool _isLoading = true;
  late TabController _tabController;

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
        _api.get('/inventory/items'),
        _api.get('/inventory/purchases'),
        _api.get('/inventory/analysis'),
      ]);
      _items = List<Map<String, dynamic>>.from(results[0]['data'] ?? []);
      _purchases = List<Map<String, dynamic>>.from(results[1]['data'] ?? []);
      _analysis = results[2]['data'] as Map<String, dynamic>?;
    } catch (e) {
      if (mounted) showToast(context, 'Error cargando inventario', type: 'error');
    }
    if (mounted) setState(() => _isLoading = false);
  }

  @override
  Widget build(BuildContext context) {
    final user = context.read<AuthProvider>().user;
    final lowStock = _items.where((i) {
      final current = toDouble(i['current_stock'], 0);
      final min = toDouble(i['min_stock'], 0);
      return current <= min;
    }).length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('🏪 Inventario'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: '📦 Insumos'),
            Tab(text: '🛒 Compras'),
            Tab(text: '📊 Análisis'),
          ],
        ),
      ),
      drawer: AppDrawer(currentPage: 'inventory', user: user),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _tabController.index == 1 ? _showPurchaseForm() : _showItemForm(),
        child: const Icon(Icons.add),
      ),
      body: _isLoading
          ? const LoadingWidget(message: 'Cargando inventario...')
          : TabBarView(
              controller: _tabController,
              children: [
                _buildItemsTab(lowStock),
                _buildPurchasesTab(),
                _buildAnalysisTab(),
              ],
            ),
    );
  }

  Widget _buildItemsTab(int lowStock) {
    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Expanded(child: StatCard(icon: '📦', value: '${_items.length}', label: 'Total Insumos')),
              const SizedBox(width: 10),
              Expanded(child: StatCard(icon: '⚠️', value: '$lowStock', label: 'Stock Bajo', valueColor: AppConstants.danger)),
            ],
          ),
          const SizedBox(height: 16),

          // Low stock alerts
          if (lowStock > 0) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppConstants.danger.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppConstants.danger.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Text('⚠️', style: TextStyle(fontSize: 18)),
                  const SizedBox(width: 8),
                  Text('$lowStock insumo(s) con stock bajo', style: const TextStyle(color: AppConstants.danger, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          if (_items.isEmpty)
            const EmptyStateWidget(icon: '📦', text: 'No hay insumos registrados')
          else
            ..._items.map(_buildItemTile),
        ],
      ),
    );
  }

  Widget _buildItemTile(Map<String, dynamic> item) {
    final currentStock = toDouble(item['current_stock'], 0);
    final minStock = toDouble(item['min_stock'], 0);
    final isLow = currentStock <= minStock;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppConstants.bgSecondary,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: isLow ? AppConstants.danger.withValues(alpha: 0.5) : AppConstants.borderColor),
      ),
      child: ListTile(
        leading: Text(isLow ? '⚠️' : '📦', style: const TextStyle(fontSize: 20)),
        title: Text(item['name']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        subtitle: Text(
          'Stock: $currentStock ${item['unit'] ?? 'u'} · Mín: $minStock',
          style: TextStyle(fontSize: 12, color: isLow ? AppConstants.danger : AppConstants.textMuted),
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            GestureDetector(onTap: () => _showItemForm(item: item), child: const Text('✏️', style: TextStyle(fontSize: 16))),
            const SizedBox(width: 10),
            GestureDetector(
              onTap: () async {
                try {
                  await _api.delete('/inventory/items/${item['id']}');
                  _loadData();
                  if (mounted) showToast(context, 'Insumo eliminado', type: 'success');
                } catch (e) {
                  if (mounted) showToast(context, e.toString(), type: 'error');
                }
              },
              child: const Text('🗑️', style: TextStyle(fontSize: 16)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPurchasesTab() {
    return RefreshIndicator(
      onRefresh: _loadData,
      child: _purchases.isEmpty
          ? const EmptyStateWidget(icon: '🛒', text: 'No hay compras registradas')
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _purchases.length,
              itemBuilder: (context, i) {
                final p = _purchases[i];
                final amount = toDouble(p['total_amount'], 0);
                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  decoration: BoxDecoration(
                    color: AppConstants.bgSecondary,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppConstants.borderColor),
                  ),
                  child: ListTile(
                    leading: const Text('🛒', style: TextStyle(fontSize: 18)),
                    title: Text(p['item_name']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                    subtitle: Text(
                      '${p['quantity'] ?? 0} ${p['unit'] ?? 'u'} · ${p['supplier'] ?? 'Sin proveedor'}',
                      style: const TextStyle(fontSize: 12, color: AppConstants.textMuted),
                    ),
                    trailing: Text(
                      '\$${amount.toStringAsFixed(2)}',
                      style: const TextStyle(fontWeight: FontWeight.w800, color: AppConstants.accentPrimary),
                    ),
                  ),
                );
              },
            ),
    );
  }

  Widget _buildAnalysisTab() {
    if (_analysis == null) {
      return const EmptyStateWidget(icon: '📊', text: 'No hay datos para análisis');
    }

    final items = List<Map<String, dynamic>>.from(_analysis!['items'] ?? []);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('📊 Análisis MIX de Inventario', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
        const SizedBox(height: 16),
        ...items.map((item) {
          final percentage = toDouble(item['percentage'], 0);
          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppConstants.bgSecondary,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppConstants.borderColor),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(child: Text(item['name']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.w600))),
                    Text('${percentage.toStringAsFixed(1)}%', style: const TextStyle(fontWeight: FontWeight.w800, color: AppConstants.accentPrimary)),
                  ],
                ),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: percentage / 100,
                    backgroundColor: AppConstants.bgTertiary,
                    color: AppConstants.accentPrimary,
                    minHeight: 6,
                  ),
                ),
              ],
            ),
          );
        }),
      ],
    );
  }

  void _showItemForm({Map<String, dynamic>? item}) {
    final isEdit = item != null;
    final nameC = TextEditingController(text: item?['name']?.toString() ?? '');
    final unitC = TextEditingController(text: item?['unit']?.toString() ?? 'u');
    final minC = TextEditingController(text: item?['min_stock']?.toString() ?? '0');
    final costC = TextEditingController(text: item?['cost_per_unit']?.toString() ?? '0');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isEdit ? '✏️ Editar Insumo' : '➕ Nuevo Insumo'),
        content: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(controller: nameC, decoration: const InputDecoration(labelText: 'Nombre *')),
            const SizedBox(height: 10),
            TextField(controller: unitC, decoration: const InputDecoration(labelText: 'Unidad (ej: kg, L, u)')),
            const SizedBox(height: 10),
            TextField(controller: minC, decoration: const InputDecoration(labelText: 'Stock Mínimo'), keyboardType: TextInputType.number),
            const SizedBox(height: 10),
            TextField(controller: costC, decoration: const InputDecoration(labelText: 'Costo por Unidad'), keyboardType: TextInputType.number),
          ]),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
          ElevatedButton(
            onPressed: () async {
              final data = {
                'name': nameC.text, 'unit': unitC.text,
                'minStock': double.tryParse(minC.text) ?? 0,
                'costPerUnit': double.tryParse(costC.text) ?? 0,
              };
              try {
                if (isEdit) {
                  await _api.put('/inventory/items/${item['id']}', data);
                } else {
                  await _api.post('/inventory/items', data);
                }
                if (ctx.mounted) Navigator.pop(ctx);
                _loadData();
                if (mounted) showToast(context, isEdit ? 'Insumo actualizado' : 'Insumo creado', type: 'success');
              } catch (e) {
                if (mounted) showToast(context, e.toString(), type: 'error');
              }
            },
            child: Text(isEdit ? '💾 Guardar' : '➕ Crear'),
          ),
        ],
      ),
    );
  }

  void _showPurchaseForm() {
    final qtyC = TextEditingController();
    final priceC = TextEditingController();
    final supplierC = TextEditingController();
    String? selectedItemId;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('🛒 Registrar Compra'),
          content: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              DropdownButtonFormField<String>(
                initialValue: selectedItemId,
                decoration: const InputDecoration(labelText: 'Insumo *'),
                items: _items.map((i) => DropdownMenuItem(
                  value: i['id']?.toString(),
                  child: Text(i['name']?.toString() ?? ''),
                )).toList(),
                onChanged: (v) => setDialogState(() => selectedItemId = v),
              ),
              const SizedBox(height: 10),
              TextField(controller: qtyC, decoration: const InputDecoration(labelText: 'Cantidad *'), keyboardType: TextInputType.number),
              const SizedBox(height: 10),
              TextField(controller: priceC, decoration: const InputDecoration(labelText: 'Precio Total *'), keyboardType: TextInputType.number),
              const SizedBox(height: 10),
              TextField(controller: supplierC, decoration: const InputDecoration(labelText: 'Proveedor')),
            ]),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
            ElevatedButton(
              onPressed: () async {
                try {
                  await _api.post('/inventory/purchases', {
                    'itemId': int.tryParse(selectedItemId ?? '') ?? 0,
                    'quantity': double.tryParse(qtyC.text) ?? 0,
                    'totalAmount': double.tryParse(priceC.text) ?? 0,
                    'supplier': supplierC.text,
                  });
                  if (ctx.mounted) Navigator.pop(ctx);
                  _loadData();
                  if (mounted) showToast(context, 'Compra registrada', type: 'success');
                } catch (e) {
                  if (mounted) showToast(context, e.toString(), type: 'error');
                }
              },
              child: const Text('💾 Registrar'),
            ),
          ],
        ),
      ),
    );
  }
}

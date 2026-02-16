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

class ProductsScreen extends StatefulWidget {
  const ProductsScreen({super.key});

  @override
  State<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends State<ProductsScreen> {
  final ApiClient _api = ApiClient();
  List<Map<String, dynamic>> _products = [];
  List<Map<String, dynamic>> _categories = [];
  bool _isLoading = true;
  String _search = '';

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final results = await Future.wait([
        _api.get('/products'),
        _api.get('/products/categories'),
      ]);
      _products = List<Map<String, dynamic>>.from(results[0]['data'] ?? []);
      _categories = List<Map<String, dynamic>>.from(results[1]['data'] ?? []);
    } catch (e) {
      if (mounted) showToast(context, 'Error cargando datos', type: 'error');
    }
    if (mounted) setState(() => _isLoading = false);
  }

  List<Map<String, dynamic>> get _filtered {
    if (_search.isEmpty) return _products;
    return _products.where((p) =>
      (p['name']?.toString().toLowerCase().contains(_search.toLowerCase()) ?? false)
    ).toList();
  }

  @override
  Widget build(BuildContext context) {
    final user = context.read<AuthProvider>().user;
    final available = _products.where((p) => p['available'] == true || p['available'] == 1).length;

    return Scaffold(
      appBar: AppBar(title: const Text('📦 Productos')),
      drawer: AppDrawer(currentPage: 'products', user: user),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showProductForm(),
        child: const Icon(Icons.add),
      ),
      body: _isLoading
          ? const LoadingWidget(message: 'Cargando productos...')
          : RefreshIndicator(
              onRefresh: _loadData,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Stats
                  Row(
                    children: [
                      Expanded(child: StatCard(icon: '📦', value: '${_products.length}', label: 'Total Productos')),
                      const SizedBox(width: 10),
                      Expanded(child: StatCard(icon: '✅', value: '$available', label: 'Disponibles', valueColor: AppConstants.success)),
                      const SizedBox(width: 10),
                      Expanded(child: StatCard(icon: '📂', value: '${_categories.length}', label: 'Categorías', valueColor: AppConstants.info)),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Search
                  TextField(
                    decoration: const InputDecoration(
                      hintText: '🔍 Buscar producto...',
                      isDense: true,
                    ),
                    onChanged: (v) => setState(() => _search = v),
                  ),
                  const SizedBox(height: 16),

                  // Categories management
                  OutlinedButton.icon(
                    onPressed: _showCategoriesDialog,
                    icon: const Text('📂'),
                    label: const Text('Gestionar Categorías'),
                  ),
                  const SizedBox(height: 16),

                  // Products list
                  if (_filtered.isEmpty)
                    const EmptyStateWidget(icon: '📦', text: 'No hay productos')
                  else
                    ..._filtered.map(_buildProductTile),
                ],
              ),
            ),
    );
  }

  Widget _buildProductTile(Map<String, dynamic> product) {
    final price = toDouble(product['price'], 0);
    final available = product['available'] == true || product['available'] == 1;
    final categoryName = _categories
        .where((c) => c['id'] == product['category_id'])
        .map((c) => c['name']?.toString() ?? '')
        .firstOrNull ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppConstants.bgSecondary,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppConstants.borderColor),
      ),
      child: ListTile(
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: available ? AppConstants.success.withValues(alpha: 0.15) : AppConstants.danger.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Center(child: Text(available ? '✅' : '🚫', style: const TextStyle(fontSize: 16))),
        ),
        title: Text(product['name']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        subtitle: Text(
          '${categoryName.isNotEmpty ? '$categoryName · ' : ''}IVA: ${product['tax_rate'] ?? 0}%',
          style: const TextStyle(fontSize: 12, color: AppConstants.textMuted),
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text('\$${price.toStringAsFixed(2)}', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppConstants.accentPrimary)),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                GestureDetector(
                  onTap: () => _showProductForm(product: product),
                  child: const Text('✏️', style: TextStyle(fontSize: 16)),
                ),
                const SizedBox(width: 10),
                GestureDetector(
                  onTap: () => _deleteProduct(product['id']),
                  child: const Text('🗑️', style: TextStyle(fontSize: 16)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showProductForm({Map<String, dynamic>? product}) {
    final isEdit = product != null;
    final nameC = TextEditingController(text: product?['name']?.toString() ?? '');
    final priceC = TextEditingController(text: product?['price']?.toString() ?? '');
    final costC = TextEditingController(text: product?['cost']?.toString() ?? '0');
    String taxRate = (product?['tax_rate'] ?? 15).toString();
    String? categoryId = product?['category_id']?.toString();
    bool available = product?['available'] == true || product?['available'] == 1;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: Text(isEdit ? '✏️ Editar Producto' : '➕ Nuevo Producto'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(controller: nameC, decoration: const InputDecoration(labelText: 'Nombre *')),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: categoryId,
                  decoration: const InputDecoration(labelText: 'Categoría'),
                  items: _categories.map((c) => DropdownMenuItem(
                    value: c['id']?.toString(),
                    child: Text(c['name']?.toString() ?? ''),
                  )).toList(),
                  onChanged: (v) => categoryId = v,
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: priceC,
                  decoration: const InputDecoration(labelText: 'Precio PVP *'),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: costC,
                  decoration: const InputDecoration(labelText: 'Costo'),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: taxRate,
                  decoration: const InputDecoration(labelText: 'IVA'),
                  items: const [
                    DropdownMenuItem(value: '0', child: Text('0%')),
                    DropdownMenuItem(value: '12', child: Text('12%')),
                    DropdownMenuItem(value: '15', child: Text('15%')),
                  ],
                  onChanged: (v) => taxRate = v ?? '15',
                ),
                const SizedBox(height: 10),
                if (isEdit)
                  SwitchListTile(
                    title: const Text('Disponible'),
                    value: available,
                    onChanged: (v) => setDialogState(() => available = v),
                    contentPadding: EdgeInsets.zero,
                  ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
            ElevatedButton(
              onPressed: () async {
                final data = {
                  'name': nameC.text,
                  'price': double.tryParse(priceC.text) ?? 0,
                  'cost': double.tryParse(costC.text) ?? 0,
                  'taxRate': int.tryParse(taxRate) ?? 15,
                  if (categoryId != null) 'categoryId': int.tryParse(categoryId!) ?? 0,
                  'available': available,
                };
                try {
                  if (isEdit) {
                    await _api.put('/products/${product['id']}', data);
                  } else {
                    await _api.post('/products', data);
                  }
                  if (ctx.mounted) Navigator.pop(ctx);
                  _loadData();
                  if (mounted) showToast(context, isEdit ? 'Producto actualizado' : 'Producto creado', type: 'success');
                } catch (e) {
                  if (mounted) showToast(context, e.toString(), type: 'error');
                }
              },
              child: Text(isEdit ? '💾 Guardar' : '➕ Crear'),
            ),
          ],
        ),
      ),
    );
  }

  void _showCategoriesDialog() {
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) {
          final nameC = TextEditingController();
          return AlertDialog(
            title: const Text('📂 Categorías'),
            content: SizedBox(
              width: double.maxFinite,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: nameC,
                          decoration: const InputDecoration(hintText: 'Nueva categoría...', isDense: true),
                        ),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton(
                        onPressed: () async {
                          if (nameC.text.isEmpty) return;
                          try {
                            await _api.post('/products/categories', {'name': nameC.text});
                            nameC.clear();
                            await _loadData();
                            setDialogState(() {});
                          } catch (e) {
                            if (mounted) showToast(context, e.toString(), type: 'error');
                          }
                        },
                        child: const Text('➕'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  ..._categories.map((c) => ListTile(
                    dense: true,
                    title: Text(c['name']?.toString() ?? ''),
                    trailing: IconButton(
                      onPressed: () async {
                        try {
                          await _api.delete('/products/categories/${c['id']}');
                          await _loadData();
                          setDialogState(() {});
                        } catch (e) {
                          if (mounted) showToast(context, e.toString(), type: 'error');
                        }
                      },
                      icon: const Text('🗑️'),
                    ),
                  )),
                ],
              ),
            ),
            actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cerrar'))],
          );
        },
      ),
    );
  }

  void _deleteProduct(int? id) async {
    if (id == null) return;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('🗑️ Eliminar Producto'),
        content: const Text('¿Seguro que desea eliminar este producto?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppConstants.danger),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );
    if (confirm == true) {
      try {
        await _api.delete('/products/$id');
        _loadData();
        if (mounted) showToast(context, 'Producto eliminado', type: 'success');
      } catch (e) {
        if (mounted) showToast(context, e.toString(), type: 'error');
      }
    }
  }
}

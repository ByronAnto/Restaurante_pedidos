import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/api/api_client.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/widgets/app_drawer.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/toast_notification.dart';
import '../../auth/providers/auth_provider.dart';
import '../../../core/utils/parsers.dart';

class RecipesScreen extends StatefulWidget {
  const RecipesScreen({super.key});

  @override
  State<RecipesScreen> createState() => _RecipesScreenState();
}

class _RecipesScreenState extends State<RecipesScreen> {
  final ApiClient _api = ApiClient();
  List<Map<String, dynamic>> _inventoryItems = [];
  List<Map<String, dynamic>> _analysis = [];
  Map<String, dynamic>? _selectedProduct;
  Map<String, dynamic>? _currentRecipe;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final results = await Future.wait([
        _api.get('/inventory/items'),
        _api.get('/recipes/analysis'),
      ]);
      _inventoryItems = List<Map<String, dynamic>>.from(results[0]['data'] ?? []);
      _analysis = List<Map<String, dynamic>>.from(results[1]['data'] ?? []);
    } catch (e) {
      if (mounted) showToast(context, 'Error cargando recetas', type: 'error');
    }
    if (mounted) setState(() => _isLoading = false);
  }

  Future<void> _loadRecipe(int productId) async {
    try {
      final res = await _api.get('/recipes/$productId');
      setState(() {
        _currentRecipe = res['data'] as Map<String, dynamic>?;
      });
    } catch (e) {
      setState(() => _currentRecipe = {'ingredients': []});
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.read<AuthProvider>().user;

    return Scaffold(
      appBar: AppBar(title: const Text('📋 Recetas')),
      drawer: AppDrawer(currentPage: 'recipes', user: user),
      body: _isLoading
          ? const LoadingWidget(message: 'Cargando recetas...')
          : _selectedProduct != null
              ? _buildRecipeEditor()
              : _buildAnalysisList(),
    );
  }

  Widget _buildAnalysisList() {
    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('📊 Análisis de Margen por Producto', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          const Text('Toca un producto para ver/editar su receta', style: TextStyle(fontSize: 12, color: AppConstants.textMuted)),
          const SizedBox(height: 16),

          if (_analysis.isEmpty)
            const EmptyStateWidget(icon: '📋', text: 'No hay datos de recetas')
          else
            ..._analysis.map((item) {
              final margin = toDouble(item['margin_percentage'], 0);
              final cost = toDouble(item['total_cost'], 0);
              final price = toDouble(item['price'], 0);
              final marginColor = margin >= 60 ? AppConstants.success : margin >= 40 ? AppConstants.warning : AppConstants.danger;

              return GestureDetector(
                onTap: () {
                  setState(() => _selectedProduct = item);
                  _loadRecipe(item['id']);
                },
                child: Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppConstants.bgSecondary,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppConstants.borderColor),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item['name']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                            const SizedBox(height: 4),
                            Text('Costo: \$${cost.toStringAsFixed(2)} · PVP: \$${price.toStringAsFixed(2)}',
                              style: const TextStyle(fontSize: 12, color: AppConstants.textMuted)),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: marginColor.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          '${margin.toStringAsFixed(1)}%',
                          style: TextStyle(fontWeight: FontWeight.w800, color: marginColor),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _buildRecipeEditor() {
    final ingredients = List<Map<String, dynamic>>.from(_currentRecipe?['ingredients'] ?? []);
    final totalCost = ingredients.fold<double>(0, (sum, ing) => sum + (toDouble(ing['total_cost'], 0)));
    final price = toDouble(_selectedProduct?['price'], 0);
    final margin = price > 0 ? ((price - totalCost) / price * 100) : 0;

    return Column(
      children: [
        // Header
        Container(
          padding: const EdgeInsets.all(14),
          decoration: const BoxDecoration(
            color: AppConstants.bgSecondary,
            border: Border(bottom: BorderSide(color: AppConstants.borderColor)),
          ),
          child: Row(
            children: [
              IconButton(
                onPressed: () => setState(() { _selectedProduct = null; _currentRecipe = null; }),
                icon: const Icon(Icons.arrow_back, size: 20),
              ),
              Expanded(
                child: Text(
                  '📋 ${_selectedProduct?['name'] ?? ''}',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                ),
              ),
              IconButton(
                onPressed: _showAddIngredient,
                icon: const Icon(Icons.add_circle, color: AppConstants.accentPrimary),
              ),
            ],
          ),
        ),

        // Summary
        Container(
          margin: const EdgeInsets.all(12),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppConstants.bgSecondary,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppConstants.borderColor),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildSummaryItem('Costo', '\$${totalCost.toStringAsFixed(2)}', AppConstants.danger),
              _buildSummaryItem('PVP', '\$${price.toStringAsFixed(2)}', AppConstants.info),
              _buildSummaryItem('Margen', '${margin.toStringAsFixed(1)}%',
                margin >= 60 ? AppConstants.success : margin >= 40 ? AppConstants.warning : AppConstants.danger),
            ],
          ),
        ),

        // Ingredients
        Expanded(
          child: ingredients.isEmpty
              ? const EmptyStateWidget(icon: '🧪', text: 'Sin ingredientes', subtext: 'Toca + para agregar')
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  itemCount: ingredients.length,
                  itemBuilder: (context, i) {
                    final ing = ingredients[i];
                    return Container(
                      margin: const EdgeInsets.only(bottom: 6),
                      decoration: BoxDecoration(
                        color: AppConstants.bgSecondary,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppConstants.borderColor),
                      ),
                      child: ListTile(
                        dense: true,
                        title: Text(ing['item_name']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                        subtitle: Text('${ing['quantity']} ${ing['unit'] ?? 'u'}', style: const TextStyle(fontSize: 11, color: AppConstants.textMuted)),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text('\$${(toDouble(ing['total_cost'], 0)).toStringAsFixed(2)}',
                              style: const TextStyle(fontWeight: FontWeight.w700, color: AppConstants.accentPrimary)),
                            const SizedBox(width: 8),
                            GestureDetector(
                              onTap: () => _removeIngredient(ing['id']),
                              child: const Text('🗑️', style: TextStyle(fontSize: 14)),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildSummaryItem(String label, String value, Color color) {
    return Column(
      children: [
        Text(label, style: const TextStyle(fontSize: 11, color: AppConstants.textMuted)),
        const SizedBox(height: 2),
        Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: color)),
      ],
    );
  }

  void _showAddIngredient() {
    String? selectedItemId;
    final qtyC = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('🧪 Agregar Ingrediente'),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            DropdownButtonFormField<String>(
              initialValue: selectedItemId,
              decoration: const InputDecoration(labelText: 'Insumo *'),
              items: _inventoryItems.map((i) => DropdownMenuItem(
                value: i['id']?.toString(),
                child: Text('${i['name']} (${i['unit'] ?? 'u'})'),
              )).toList(),
              onChanged: (v) => setDialogState(() => selectedItemId = v),
            ),
            const SizedBox(height: 10),
            TextField(controller: qtyC, decoration: const InputDecoration(labelText: 'Cantidad *'), keyboardType: TextInputType.number),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
            ElevatedButton(
              onPressed: () async {
                try {
                  await _api.post('/recipes', {
                    'productId': _selectedProduct!['id'],
                    'inventoryItemId': int.tryParse(selectedItemId ?? '') ?? 0,
                    'quantity': double.tryParse(qtyC.text) ?? 0,
                  });
                  if (ctx.mounted) Navigator.pop(ctx);
                  _loadRecipe(_selectedProduct!['id']);
                  _loadData();
                  if (mounted) showToast(context, 'Ingrediente agregado', type: 'success');
                } catch (e) {
                  if (mounted) showToast(context, e.toString(), type: 'error');
                }
              },
              child: const Text('➕ Agregar'),
            ),
          ],
        ),
      ),
    );
  }

  void _removeIngredient(int? id) async {
    if (id == null) return;
    try {
      await _api.delete('/recipes/$id');
      _loadRecipe(_selectedProduct!['id']);
      _loadData();
      if (mounted) showToast(context, 'Ingrediente eliminado', type: 'success');
    } catch (e) {
      if (mounted) showToast(context, e.toString(), type: 'error');
    }
  }
}

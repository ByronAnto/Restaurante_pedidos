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

class InvestmentsScreen extends StatefulWidget {
  const InvestmentsScreen({super.key});

  @override
  State<InvestmentsScreen> createState() => _InvestmentsScreenState();
}

class _InvestmentsScreenState extends State<InvestmentsScreen> {
  final ApiClient _api = ApiClient();
  List<Map<String, dynamic>> _investments = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final res = await _api.get('/investments');
      _investments = List<Map<String, dynamic>>.from(res['data']?['investments'] ?? []);
    } catch (e) {
      if (mounted) showToast(context, 'Error cargando inversiones', type: 'error');
    }
    if (mounted) setState(() => _isLoading = false);
  }

  double get _total => _investments.fold(0.0, (s, i) => s + (toDouble(i['amount'], 0)));

  @override
  Widget build(BuildContext context) {
    final user = context.read<AuthProvider>().user;

    return Scaffold(
      appBar: AppBar(title: const Text('💰 Inversiones')),
      drawer: AppDrawer(currentPage: 'investments', user: user),
      floatingActionButton: FloatingActionButton(
        onPressed: _showForm,
        child: const Icon(Icons.add),
      ),
      body: _isLoading
          ? const LoadingWidget(message: 'Cargando inversiones...')
          : RefreshIndicator(
              onRefresh: _loadData,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Row(
                    children: [
                      Expanded(child: StatCard(icon: '💰', value: '\$${_total.toStringAsFixed(2)}', label: 'Total Invertido')),
                      const SizedBox(width: 10),
                      Expanded(child: StatCard(icon: '📝', value: '${_investments.length}', label: 'Registros')),
                    ],
                  ),
                  const SizedBox(height: 16),

                  if (_investments.isEmpty)
                    const EmptyStateWidget(icon: '💰', text: 'No hay inversiones registradas')
                  else
                    ..._investments.map(_buildInvestmentTile),
                ],
              ),
            ),
    );
  }

  Widget _buildInvestmentTile(Map<String, dynamic> inv) {
    final amount = toDouble(inv['amount'], 0);
    final date = inv['date']?.toString() ?? '';
    String formattedDate = date;
    try {
      formattedDate = DateFormat('dd/MM/yyyy').format(DateTime.parse(date));
    } catch (_) {}

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppConstants.bgSecondary, borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppConstants.borderColor),
      ),
      child: ListTile(
        leading: const Text('💰', style: TextStyle(fontSize: 20)),
        title: Text(inv['description']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        subtitle: Text(
          '$formattedDate · ${inv['category'] ?? ''} · ${inv['supplier'] ?? ''}',
          style: const TextStyle(fontSize: 11, color: AppConstants.textMuted),
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text('\$${amount.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w800, color: AppConstants.accentPrimary)),
            GestureDetector(
              onTap: () => _delete(inv['id']),
              child: const Text('🗑️', style: TextStyle(fontSize: 14)),
            ),
          ],
        ),
      ),
    );
  }

  void _showForm() {
    final descC = TextEditingController();
    final amountC = TextEditingController();
    final categoryC = TextEditingController();
    final supplierC = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('➕ Nueva Inversión'),
        content: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(controller: descC, decoration: const InputDecoration(labelText: 'Descripción *')),
            const SizedBox(height: 10),
            TextField(controller: amountC, decoration: const InputDecoration(labelText: 'Monto *'), keyboardType: TextInputType.number),
            const SizedBox(height: 10),
            TextField(controller: categoryC, decoration: const InputDecoration(labelText: 'Categoría')),
            const SizedBox(height: 10),
            TextField(controller: supplierC, decoration: const InputDecoration(labelText: 'Proveedor')),
          ]),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
          ElevatedButton(
            onPressed: () async {
              try {
                await _api.post('/investments', {
                  'description': descC.text,
                  'amount': double.tryParse(amountC.text) ?? 0,
                  'category': categoryC.text,
                  'supplier': supplierC.text,
                });
                if (ctx.mounted) Navigator.pop(ctx);
                _loadData();
                if (mounted) showToast(context, 'Inversión registrada', type: 'success');
              } catch (e) {
                if (mounted) showToast(context, e.toString(), type: 'error');
              }
            },
            child: const Text('💾 Guardar'),
          ),
        ],
      ),
    );
  }

  void _delete(int? id) async {
    if (id == null) return;
    try {
      await _api.delete('/investments/$id');
      _loadData();
      if (mounted) showToast(context, 'Inversión eliminada', type: 'success');
    } catch (e) {
      if (mounted) showToast(context, e.toString(), type: 'error');
    }
  }
}

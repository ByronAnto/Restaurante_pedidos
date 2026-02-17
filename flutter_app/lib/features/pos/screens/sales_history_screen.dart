import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../auth/providers/auth_provider.dart';
import '../../../core/api/api_client.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/widgets/app_drawer.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/toast_notification.dart';

class SalesHistoryScreen extends StatefulWidget {
  const SalesHistoryScreen({super.key});

  @override
  State<SalesHistoryScreen> createState() => _SalesHistoryScreenState();
}

class _SalesHistoryScreenState extends State<SalesHistoryScreen> {
  final ApiClient _api = ApiClient();
  bool _isLoading = true;
  List<Map<String, dynamic>> _sales = [];
  String _filter = 'today'; // 'today', 'yesterday'

  @override
  void initState() {
    super.initState();
    _loadSales();
  }

  Future<void> _loadSales() async {
    setState(() => _isLoading = true);
    try {
      // Simpler filter logic for now: query backend with date params if needed,
      // or just last 50 sales. Let's assume endpoint supports some filtering or just returns recent.
      // Based on pos.controller.js: getSales supports page, limit, startDate, endDate.
      
      String query = '?limit=50';
      if (_filter == 'today') {
        final now = DateTime.now();
        final start = DateTime(now.year, now.month, now.day).toIso8601String();
        query += '&startDate=$start';
      } else if (_filter == 'yesterday') {
        final now = DateTime.now();
        final start = DateTime(now.year, now.month, now.day - 1).toIso8601String();
        final end = DateTime(now.year, now.month, now.day).toIso8601String();
        query += '&startDate=$start&endDate=$end';
      }

      final res = await _api.get('/pos/sales$query');
      if (res['success'] == true) {
        setState(() {
          _sales = List<Map<String, dynamic>>.from(res['data']['sales'] ?? []);
        });
      }
    } catch (e) {
      if (mounted) showToast(context, 'Error cargando historial: $e', type: 'error');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _voidSale(Map<String, dynamic> sale) async {
    final saleId = sale['id'];
    final saleNumber = sale['sale_number'];

    // 1. Ask for reason
    final reasonController = TextEditingController();
    final userController = TextEditingController();
    final passController = TextEditingController();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Anular Venta #$saleNumber'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Esta acción es irreversible. Se requiere autorización de administrador.'),
              const SizedBox(height: 16),
              TextField(
                controller: reasonController,
                decoration: const InputDecoration(
                  labelText: 'Motivo de anulación',
                  prefixIcon: Icon(Icons.comment),
                ),
              ),
              const SizedBox(height: 16),
              const Divider(),
              const SizedBox(height: 8),
              const Text('Credenciales de Administrador', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              TextField(
                controller: userController,
                decoration: const InputDecoration(
                  labelText: 'Usuario Admin',
                  prefixIcon: Icon(Icons.person),
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: passController,
                decoration: const InputDecoration(
                  labelText: 'Contraseña',
                  prefixIcon: Icon(Icons.lock),
                ),
                obscureText: true,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppConstants.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('ANULAR VENTA'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    // 2. Process Void
    if (mounted) setState(() => _isLoading = true);
    try {
      final body = {
        'adminUsername': userController.text,
        'adminPassword': passController.text,
        'reason': reasonController.text,
      };

      await _api.post('/pos/sales/$saleId/void', body);
      
      if (mounted) {
        showToast(context, 'Venta anulada correctamente', type: 'success');
        _loadSales(); // Refresh list
      }
    } catch (e) {
      if (mounted) {
        // Extract error message if possible
        String msg = 'Error al anular venta';
        if (e.toString().contains('401') || e.toString().contains('403')) {
          msg = 'Credenciales inválidas o sin permisos';
        }
        showToast(context, msg, type: 'error');
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.read<AuthProvider>().user;

    return Scaffold(
      appBar: AppBar(
        title: const Text('📜 Historial de Ventas'),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.filter_list),
            onSelected: (v) {
              setState(() => _filter = v);
              _loadSales();
            },
            itemBuilder: (ctx) => [
              const PopupMenuItem(value: 'today', child: Text('Hoy')),
              const PopupMenuItem(value: 'yesterday', child: Text('Ayer')),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadSales,
          ),
        ],
      ),
      drawer: AppDrawer(currentPage: 'sales-history', user: user),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _sales.isEmpty
              ? const EmptyStateWidget(text: 'No hay ventas registradas en este período', icon: '📝')
              : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: _sales.length,
                  itemBuilder: (context, index) {
                    final sale = _sales[index];
                    final isVoided = sale['status'] == 'cancelled' || sale['status'] == 'voided';
                    final total = double.tryParse(sale['total'].toString()) ?? 0.0;
                    final date = DateTime.tryParse(sale['created_at'].toString()) ?? DateTime.now();
                    final formattedDate = DateFormat('HH:mm').format(date);

                    return Card(
                      color: isVoided ? AppConstants.bgPrimary.withOpacity(0.5) : AppConstants.bgSecondary,
                      margin: const EdgeInsets.only(bottom: 10),
                      child: ExpansionTile(
                        leading: CircleAvatar(
                          backgroundColor: isVoided ? Colors.grey : AppConstants.accentPrimary.withOpacity(0.2),
                          child: Text(isVoided ? '🚫' : '💰'),
                        ),
                        title: Text(
                          '${sale['sale_number']} - \$${total.toStringAsFixed(2)}',
                          style: TextStyle(
                            decoration: isVoided ? TextDecoration.lineThrough : null,
                            color: isVoided ? Colors.grey : AppConstants.textPrimary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        subtitle: Text(
                          '$formattedDate • ${sale['payment_method']?.toString().toUpperCase() ?? 'CASH'} • ${sale['customer_name'] ?? 'Consumidor Final'}',
                          style: const TextStyle(fontSize: 12),
                        ),
                        children: [
                          Padding(
                            padding: const EdgeInsets.all(16.0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                // Items list if available, or just details
                                Text('Estado: ${sale['status']?.toString().toUpperCase()}', 
                                  style: TextStyle(fontWeight: FontWeight.bold, color: isVoided ? AppConstants.danger : AppConstants.success)
                                ),
                                if (sale['notes'] != null && sale['notes'].toString().isNotEmpty)
                                  Text('Notas: ${sale['notes']}'),
                                
                                const SizedBox(height: 10),
                                
                                if (!isVoided)
                                  ElevatedButton.icon(
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppConstants.danger,
                                      foregroundColor: Colors.white,
                                    ),
                                    onPressed: () => _voidSale(sale),
                                    icon: const Icon(Icons.delete_forever),
                                    label: const Text('ANULAR VENTA'),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
    );
  }
}

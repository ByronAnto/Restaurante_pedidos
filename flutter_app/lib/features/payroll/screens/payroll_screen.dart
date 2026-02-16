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

class PayrollScreen extends StatefulWidget {
  const PayrollScreen({super.key});

  @override
  State<PayrollScreen> createState() => _PayrollScreenState();
}

class _PayrollScreenState extends State<PayrollScreen> {
  final ApiClient _api = ApiClient();
  List<Map<String, dynamic>> _employees = [];
  List<Map<String, dynamic>> _entries = [];
  Map<String, dynamic> _summary = {};
  bool _isLoading = true;
  String _range = 'month';

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final results = await Future.wait([
        _api.get('/payroll/employees'),
        _api.get('/payroll/entries?range=$_range'),
        _api.get('/payroll/summary?range=$_range'),
      ]);
      _employees = List<Map<String, dynamic>>.from(results[0]['data'] ?? []);
      _entries = List<Map<String, dynamic>>.from(results[1]['data'] ?? []);
      _summary = results[2]['data'] as Map<String, dynamic>? ?? {};
    } catch (e) {
      if (mounted) showToast(context, 'Error cargando nómina', type: 'error');
    }
    if (mounted) setState(() => _isLoading = false);
  }

  @override
  Widget build(BuildContext context) {
    final user = context.read<AuthProvider>().user;
    final totalPaid = toDouble(_summary['total_paid'], 0);
    final totalCash = toDouble(_summary['total_cash'], 0);
    final totalTransfer = toDouble(_summary['total_transfer'], 0);

    return Scaffold(
      appBar: AppBar(title: const Text('👥 Nómina')),
      drawer: AppDrawer(currentPage: 'payroll', user: user),
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FloatingActionButton.small(
            heroTag: 'employee',
            onPressed: _showEmployeeForm,
            backgroundColor: AppConstants.info,
            child: const Icon(Icons.person_add, size: 20),
          ),
          const SizedBox(height: 8),
          FloatingActionButton(
            heroTag: 'payment',
            onPressed: _showPaymentForm,
            child: const Icon(Icons.attach_money),
          ),
        ],
      ),
      body: _isLoading
          ? const LoadingWidget(message: 'Cargando nómina...')
          : RefreshIndicator(
              onRefresh: _loadData,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Range filter
                  Row(
                    children: [
                      _buildRangeChip('Hoy', 'today'),
                      const SizedBox(width: 6),
                      _buildRangeChip('Semana', 'week'),
                      const SizedBox(width: 6),
                      _buildRangeChip('Mes', 'month'),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Stats
                  Row(
                    children: [
                      Expanded(child: StatCard(icon: '💵', value: '\$${totalPaid.toStringAsFixed(2)}', label: 'Total Pagado')),
                      const SizedBox(width: 8),
                      Expanded(child: StatCard(icon: '💰', value: '\$${totalCash.toStringAsFixed(2)}', label: 'Efectivo', valueColor: AppConstants.success)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(child: StatCard(icon: '📱', value: '\$${totalTransfer.toStringAsFixed(2)}', label: 'Transferencia', valueColor: AppConstants.info)),
                      const SizedBox(width: 8),
                      Expanded(child: StatCard(icon: '👥', value: '${_employees.length}', label: 'Empleados')),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Employees
                  const Text('👥 Empleados', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 10),
                  if (_employees.isEmpty)
                    const EmptyStateWidget(icon: '👥', text: 'No hay empleados')
                  else
                    ..._employees.map(_buildEmployeeTile),

                  const SizedBox(height: 20),

                  // Recent payments
                  const Text('💵 Pagos Recientes', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 10),
                  if (_entries.isEmpty)
                    const EmptyStateWidget(icon: '💵', text: 'No hay pagos en este período')
                  else
                    ..._entries.take(20).map(_buildEntryTile),
                ],
              ),
            ),
    );
  }

  Widget _buildRangeChip(String label, String range) {
    final isActive = _range == range;
    return FilterChip(
      label: Text(label, style: const TextStyle(fontSize: 12)),
      selected: isActive,
      onSelected: (_) {
        setState(() => _range = range);
        _loadData();
      },
      selectedColor: AppConstants.accentPrimary.withValues(alpha: 0.2),
      checkmarkColor: AppConstants.accentPrimary,
    );
  }

  Widget _buildEmployeeTile(Map<String, dynamic> emp) {
    final salary = toDouble(emp['daily_salary'], 0);
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      decoration: BoxDecoration(
        color: AppConstants.bgSecondary, borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppConstants.borderColor),
      ),
      child: ListTile(
        dense: true,
        leading: const Text('👤', style: TextStyle(fontSize: 18)),
        title: Text(emp['name']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        subtitle: Text('${emp['position'] ?? ''} · \$${salary.toStringAsFixed(2)}/día',
          style: const TextStyle(fontSize: 11, color: AppConstants.textMuted)),
        trailing: IconButton(
          onPressed: () => _showEmployeeForm(employee: emp),
          icon: const Text('✏️'),
        ),
      ),
    );
  }

  Widget _buildEntryTile(Map<String, dynamic> entry) {
    final amount = toDouble(entry['amount'], 0);
    final date = entry['date']?.toString() ?? '';
    String formattedDate = date;
    try { formattedDate = DateFormat('dd/MM HH:mm').format(DateTime.parse(date)); } catch (_) {}

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      decoration: BoxDecoration(
        color: AppConstants.bgSecondary, borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppConstants.borderColor),
      ),
      child: ListTile(
        dense: true,
        leading: Text(entry['payment_method'] == 'cash' ? '💰' : '📱', style: const TextStyle(fontSize: 16)),
        title: Text(entry['employee_name']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
        subtitle: Text(formattedDate, style: const TextStyle(fontSize: 11, color: AppConstants.textMuted)),
        trailing: Text('\$${amount.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w800, color: AppConstants.accentPrimary)),
      ),
    );
  }

  void _showEmployeeForm({Map<String, dynamic>? employee}) {
    final isEdit = employee != null;
    final nameC = TextEditingController(text: employee?['name']?.toString() ?? '');
    final posC = TextEditingController(text: employee?['position']?.toString() ?? '');
    final salaryC = TextEditingController(text: employee?['daily_salary']?.toString() ?? '');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isEdit ? '✏️ Editar Empleado' : '➕ Nuevo Empleado'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: nameC, decoration: const InputDecoration(labelText: 'Nombre *')),
          const SizedBox(height: 10),
          TextField(controller: posC, decoration: const InputDecoration(labelText: 'Cargo')),
          const SizedBox(height: 10),
          TextField(controller: salaryC, decoration: const InputDecoration(labelText: 'Salario Diario *'), keyboardType: TextInputType.number),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
          ElevatedButton(
            onPressed: () async {
              final data = {
                'name': nameC.text,
                'position': posC.text,
                'dailySalary': double.tryParse(salaryC.text) ?? 0,
              };
              try {
                if (isEdit) {
                  await _api.put('/payroll/employees/${employee['id']}', data);
                } else {
                  await _api.post('/payroll/employees', data);
                }
                if (ctx.mounted) Navigator.pop(ctx);
                _loadData();
                if (mounted) showToast(context, isEdit ? 'Empleado actualizado' : 'Empleado creado', type: 'success');
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

  void _showPaymentForm() {
    String? selectedEmployeeId;
    final amountC = TextEditingController();
    String method = 'cash';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('💵 Registrar Pago'),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            DropdownButtonFormField<String>(
              initialValue: selectedEmployeeId,
              decoration: const InputDecoration(labelText: 'Empleado *'),
              items: _employees.map((e) => DropdownMenuItem(
                value: e['id']?.toString(),
                child: Text(e['name']?.toString() ?? ''),
              )).toList(),
              onChanged: (v) {
                setDialogState(() => selectedEmployeeId = v);
                // Auto-fill salary
                final emp = _employees.firstWhere((e) => e['id']?.toString() == v, orElse: () => {});
                if (emp.isNotEmpty) {
                  amountC.text = emp['daily_salary']?.toString() ?? '';
                }
              },
            ),
            const SizedBox(height: 10),
            TextField(controller: amountC, decoration: const InputDecoration(labelText: 'Monto *'), keyboardType: TextInputType.number),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              initialValue: method,
              decoration: const InputDecoration(labelText: 'Método de Pago'),
              items: const [
                DropdownMenuItem(value: 'cash', child: Text('💰 Efectivo')),
                DropdownMenuItem(value: 'transfer', child: Text('📱 Transferencia')),
              ],
              onChanged: (v) => method = v ?? 'cash',
            ),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
            ElevatedButton(
              onPressed: () async {
                try {
                  await _api.post('/payroll/entries', {
                    'employeeId': int.tryParse(selectedEmployeeId ?? '') ?? 0,
                    'amount': double.tryParse(amountC.text) ?? 0,
                    'paymentMethod': method,
                  });
                  if (ctx.mounted) Navigator.pop(ctx);
                  _loadData();
                  if (mounted) showToast(context, 'Pago registrado', type: 'success');
                } catch (e) {
                  if (mounted) showToast(context, e.toString(), type: 'error');
                }
              },
              child: const Text('💰 Pagar'),
            ),
          ],
        ),
      ),
    );
  }
}

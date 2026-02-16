import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/widgets/toast_notification.dart';
import '../providers/pos_provider.dart';
import '../../../core/utils/parsers.dart';

class PaymentModal extends StatefulWidget {
  const PaymentModal({super.key});

  @override
  State<PaymentModal> createState() => _PaymentModalState();
}

class _PaymentModalState extends State<PaymentModal> {
  String _method = 'cash';
  double _amountReceived = 0;
  final _customerNameController = TextEditingController();
  final _customerRucController = TextEditingController();
  bool _isProcessing = false;

  final List<double> _denominations = [1, 5, 10, 20, 50, 100];

  @override
  void dispose() {
    _customerNameController.dispose();
    _customerRucController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<PosProvider>(
      builder: (context, pos, _) {
        final total = pos.currentOrder != null
            ? toDouble(pos.currentOrder!['total'], pos.total)
            : pos.total;
        final change = _amountReceived - total;

        return Container(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.85,
          ),
          decoration: const BoxDecoration(
            color: AppConstants.bgSecondary,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Handle
              Container(
                margin: const EdgeInsets.only(top: 12),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppConstants.textMuted,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),

              // Header
              Padding(
                padding: const EdgeInsets.all(20),
                child: Row(
                  children: [
                    const Text(
                      '💰 Cobrar',
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                    ),
                    const Spacer(),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
              ),

              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Total
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              AppConstants.accentPrimary.withValues(alpha: 0.15),
                              AppConstants.accentPrimary.withValues(alpha: 0.05),
                            ],
                          ),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: AppConstants.accentPrimary.withValues(alpha: 0.3)),
                        ),
                        child: Column(
                          children: [
                            const Text('TOTAL A COBRAR', style: TextStyle(fontSize: 12, color: AppConstants.textMuted)),
                            const SizedBox(height: 4),
                            Text(
                              '\$${total.toStringAsFixed(2)}',
                              style: const TextStyle(
                                fontSize: 36,
                                fontWeight: FontWeight.w900,
                                color: AppConstants.accentPrimary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Payment method
                      const Text('Método de Pago', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: _buildMethodButton('💵 Efectivo', 'cash'),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _buildMethodButton('📱 Transferencia', 'transfer'),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),

                      // Cash denominations
                      if (_method == 'cash') ...[
                        const Text('Monto Recibido', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            // Exact amount button
                            _buildDenomButton('Exacto', total),
                            ..._denominations.map((d) => _buildDenomButton('\$$d', d)),
                          ],
                        ),
                        const SizedBox(height: 12),

                        // Amount display
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: AppConstants.bgTertiary,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Recibido:', style: TextStyle(color: AppConstants.textSecondary)),
                              Text(
                                '\$${_amountReceived.toStringAsFixed(2)}',
                                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 8),

                        // Change
                        if (_amountReceived >= total)
                          Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: AppConstants.success.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: AppConstants.success.withValues(alpha: 0.3)),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Text(
                                  '💰 Cambio:',
                                  style: TextStyle(fontWeight: FontWeight.w700, color: AppConstants.success),
                                ),
                                Text(
                                  '\$${change.toStringAsFixed(2)}',
                                  style: const TextStyle(
                                    fontSize: 22,
                                    fontWeight: FontWeight.w900,
                                    color: AppConstants.success,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        const SizedBox(height: 8),
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton(
                            onPressed: () => setState(() => _amountReceived = 0),
                            child: const Text('Limpiar', style: TextStyle(fontSize: 12)),
                          ),
                        ),
                      ],

                      if (_method == 'transfer')
                        Padding(
                          padding: const EdgeInsets.only(bottom: 16),
                          child: Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: AppConstants.info.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: AppConstants.info.withValues(alpha: 0.3)),
                            ),
                            child: const Row(
                              children: [
                                Text('📱', style: TextStyle(fontSize: 18)),
                                SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'Confirme la transferencia antes de completar',
                                    style: TextStyle(fontSize: 13, color: AppConstants.info),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),

                      // Customer info (optional)
                      ExpansionTile(
                        title: const Text('📝 Datos del Cliente (Opcional)', style: TextStyle(fontSize: 13)),
                        tilePadding: EdgeInsets.zero,
                        childrenPadding: const EdgeInsets.only(bottom: 12),
                        children: [
                          TextField(
                            controller: _customerNameController,
                            decoration: const InputDecoration(hintText: 'Nombre del cliente', isDense: true),
                          ),
                          const SizedBox(height: 10),
                          TextField(
                            controller: _customerRucController,
                            decoration: const InputDecoration(hintText: 'RUC / Cédula', isDense: true),
                            keyboardType: TextInputType.number,
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                    ],
                  ),
                ),
              ),

              // Process button
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                child: SafeArea(
                  top: false,
                  child: SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: _canProcess(total) && !_isProcessing
                          ? () => _processPayment(pos, total)
                          : null,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppConstants.success,
                        disabledBackgroundColor: AppConstants.bgTertiary,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      child: _isProcessing
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Text(
                              '✅ Completar Venta',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                            ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildMethodButton(String label, String method) {
    final isActive = _method == method;

    return GestureDetector(
      onTap: () {
        setState(() {
          _method = method;
          if (method == 'transfer') _amountReceived = 0;
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: isActive ? AppConstants.accentPrimary.withValues(alpha: 0.15) : AppConstants.bgTertiary,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isActive ? AppConstants.accentPrimary : AppConstants.borderColor,
            width: isActive ? 2 : 1,
          ),
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: isActive ? AppConstants.accentPrimary : AppConstants.textPrimary,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDenomButton(String label, double amount) {
    return ElevatedButton(
      onPressed: () => setState(() => _amountReceived += amount),
      style: ElevatedButton.styleFrom(
        backgroundColor: AppConstants.bgTertiary,
        foregroundColor: AppConstants.textPrimary,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: const BorderSide(color: AppConstants.borderColor),
        ),
      ),
      child: Text(label, style: const TextStyle(fontSize: 13)),
    );
  }

  bool _canProcess(double total) {
    if (_method == 'transfer') return true;
    return _amountReceived >= total;
  }

  void _processPayment(PosProvider pos, double total) async {
    setState(() => _isProcessing = true);

    try {
      final amount = _method == 'transfer' ? total : _amountReceived;

      if (pos.currentOrder != null) {
        // Close existing order
        await pos.closeOrder(
          orderId: pos.currentOrder!['id'],
          paymentMethod: _method,
          amountReceived: amount,
          customerName: _customerNameController.text.trim(),
          customerRuc: _customerRucController.text.trim(),
        );
      } else {
        // Process takeaway sale
        await pos.processTakeawaySale(
          paymentMethod: _method,
          amountReceived: amount,
          customerName: _customerNameController.text.trim(),
          customerRuc: _customerRucController.text.trim(),
        );
      }

      if (mounted) {
        Navigator.pop(context);
        showToast(context, '¡Venta completada exitosamente!', type: 'success');
      }
    } catch (e) {
      if (mounted) showToast(context, e.toString(), type: 'error');
    }

    setState(() => _isProcessing = false);
  }
}

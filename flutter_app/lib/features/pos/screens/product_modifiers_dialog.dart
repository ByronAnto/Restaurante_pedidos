import 'package:flutter/material.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/utils/parsers.dart';

class ProductModifiersDialog extends StatefulWidget {
  final Map<String, dynamic> product;
  final Function(List<String> modifiers, double priceAdjustment) onAddToCart;

  const ProductModifiersDialog({
    super.key,
    required this.product,
    required this.onAddToCart,
  });

  @override
  State<ProductModifiersDialog> createState() => _ProductModifiersDialogState();
}

class _ProductModifiersDialogState extends State<ProductModifiersDialog> {
  // Map<GroupId, Map<OptionId, Quantity>>
  final Map<String, Map<String, int>> _selections = {};
  double _totalAdjustment = 0.0;
  int _totalUnits = 0;

  @override
  void initState() {
    super.initState();
    _initializeSelections();
  }

  void _initializeSelections() {
    final groups = widget.product['modifier_groups'] as List? ?? [];
    for (var g in groups) {
      final groupId = g['id'].toString();
      _selections[groupId] = {};
    }
  }

  void _updateQuantity(String groupId, String optionId, int delta, bool isSingleSelect, double priceAdj) {
    setState(() {
      final groupSelections = _selections[groupId]!;

      if (isSingleSelect) {
        // Radio behavior: If selecting (delta > 0), clear others. If deselecting, just clear.
        if (delta > 0) {
          groupSelections.clear();
          groupSelections[optionId] = 1;
        } else {
          groupSelections.remove(optionId);
        }
      } else {
        // Multi-select with quantity
        final current = groupSelections[optionId] ?? 0;
        final newQty = current + delta;
        
        if (newQty <= 0) {
          groupSelections.remove(optionId);
        } else {
          groupSelections[optionId] = newQty;
        }
      }
      _calculateTotal();
    });
  }
  
  void _calculateTotal() {
    double totalAdj = 0.0;
    int units = 0;
    final groups = widget.product['modifier_groups'] as List? ?? [];
    
    for (var g in groups) {
      final groupId = g['id'].toString();
      final options = g['options'] as List? ?? [];
      final groupSelections = _selections[groupId] ?? {};
      
      for (var o in options) {
        final optionId = o['id'].toString();
        final qty = groupSelections[optionId] ?? 0;
        if (qty > 0) {
          totalAdj += (qty * toDouble(o['price_adjustment']));
          units += qty;
        }
      }
    }
    _totalAdjustment = totalAdj;
    _totalUnits = units;
  }

  bool _validate() {
    final groups = widget.product['modifier_groups'] as List? ?? [];
    for (var g in groups) {
      final isRequired = g['required'] == true || g['required'] == 1;
      if (isRequired) {
        final groupId = g['id'].toString();
        // Check if any option in this group has qty > 0
        final groupSelections = _selections[groupId] ?? {};
        if (groupSelections.isEmpty) {
          return false;
        }
      }
    }
    return true;
  }

  void _confirm() {
    if (!_validate()) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Por favor complete las opciones obligatorias (*)')),
      );
      return;
    }

    List<String> modifiersList = [];
    final groups = widget.product['modifier_groups'] as List? ?? [];

    for (var g in groups) {
      final groupId = g['id'].toString();
      final options = g['options'] as List? ?? [];
      final groupSelections = _selections[groupId] ?? {};

      for (var o in options) {
         final optionId = o['id'].toString();
         final qty = groupSelections[optionId] ?? 0;
         if (qty > 0) {
           final name = o['name'];
           // Format like: "2x Extra Cheese" or just "Extra Cheese"
           modifiersList.add(qty > 1 ? '${qty}x $name' : name);
         }
      }
    }

    widget.onAddToCart(modifiersList, _totalAdjustment);
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final groups = widget.product['modifier_groups'] as List? ?? [];
    final basePrice = toDouble(widget.product['price']);
    final finalPrice = basePrice + _totalAdjustment;

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 600, maxHeight: 800),
        child: Column(
          children: [
            // Header
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: AppConstants.bgSecondary,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(16),
                  topRight: Radius.circular(16),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.product['name'] ?? 'Producto',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          'Personaliza tu pedido',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppConstants.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),

            // Content
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: groups.length,
                separatorBuilder: (_, __) => const Divider(height: 32),
                itemBuilder: (context, index) {
                  final group = groups[index];
                  return _buildGroup(group);
                },
              ),
            ),

            // Footer
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: AppConstants.borderColor)),
              ),
              child: Row(
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Total',
                        style: TextStyle(fontSize: 12, color: AppConstants.textMuted),
                      ),
                      Text(
                        '\$${finalPrice.toStringAsFixed(2)}',
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: AppConstants.accentPrimary,
                        ),
                      ),
                    ],
                  ),
                  const Spacer(),
                  ElevatedButton.icon(
                    onPressed: _confirm,
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                    ),
                    icon: const Icon(Icons.check),
                    label: Text('Agregar ${_totalUnits > 0 ? "($_totalUnits)" : ""}'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGroup(Map<String, dynamic> group) {
    final groupId = group['id'].toString();
    final name = group['name'] ?? '';
    final isRequired = group['required'] == true || group['required'] == 1;
    final options = group['options'] as List? ?? [];
    final maxSelect = toInt(group['max_select'], 0);
    final isSingleSelect = (maxSelect == 1); 

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              name,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(width: 8),
            if (isRequired)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppConstants.danger,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text(
                  'REQUERIDO',
                  style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                ),
              )
            else
               Text(
                 '(Opcional)',
                 style: TextStyle(fontSize: 12, color: AppConstants.textMuted),
               ),
          ],
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: options.map((opt) {
            final optionId = opt['id'].toString();
            final optName = opt['name'];
            final priceAdj = toDouble(opt['price_adjustment']);
            final qty = _selections[groupId]?[optionId] ?? 0;
            final isSelected = qty > 0;

            return InkWell(
              onTap: () {
                if (isSingleSelect) {
                   _updateQuantity(groupId, optionId, 1, true, priceAdj);
                } else {
                   // If tapping the card, increment if 0, else do nothing (use controls)
                   if (qty == 0) _updateQuantity(groupId, optionId, 1, false, priceAdj);
                }
              },
              borderRadius: BorderRadius.circular(12),
              child: Container(
                width: isSingleSelect ? double.infinity : 160, // Cards for multiselect, rows for single
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                decoration: BoxDecoration(
                  color: isSelected ? AppConstants.accentPrimary.withValues(alpha: 0.1) : Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: isSelected ? AppConstants.accentPrimary : AppConstants.borderColor,
                    width: isSelected ? 1.5 : 1,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            optName,
                            style: TextStyle(
                              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                              color: isSelected ? AppConstants.accentPrimary : AppConstants.textPrimary,
                            ),
                          ),
                          if (priceAdj > 0)
                            Text(
                              '+ \$${priceAdj.toStringAsFixed(2)}',
                              style: const TextStyle(
                                fontSize: 11,
                                color: AppConstants.textMuted,
                              ),
                            ),
                        ],
                      ),
                    ),
                    
                    if (isSingleSelect)
                      Icon(
                        isSelected ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                        color: isSelected ? AppConstants.accentPrimary : AppConstants.textMuted,
                      )
                    else 
                      // Quantity controls for multi-select
                      Row(
                        children: [
                          if (qty > 0)
                            _qtyBtn(Icons.remove, () => _updateQuantity(groupId, optionId, -1, false, priceAdj)),
                          if (qty > 0)
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 8),
                              child: Text('$qty', style: const TextStyle(fontWeight: FontWeight.bold)),
                            ),
                          _qtyBtn(Icons.add, () => _updateQuantity(groupId, optionId, 1, false, priceAdj)),
                        ],
                      ),
                  ],
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _qtyBtn(IconData icon, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(4),
      child: Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          color: AppConstants.bgTertiary,
          borderRadius: BorderRadius.circular(4),
        ),
        child: Icon(icon, size: 16),
      ),
    );
  }
}

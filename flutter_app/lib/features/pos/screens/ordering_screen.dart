import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/widgets/toast_notification.dart';
import '../providers/pos_provider.dart';
import 'payment_modal.dart';
import '../../../core/utils/parsers.dart';

class OrderingScreen extends StatefulWidget {
  const OrderingScreen({super.key});

  @override
  State<OrderingScreen> createState() => _OrderingScreenState();
}

class _OrderingScreenState extends State<OrderingScreen> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<PosProvider>(
      builder: (context, pos, _) {
        return Column(
          children: [
            // Header
            _buildHeader(pos),

            // Products area
            Expanded(
              child: Column(
                children: [
                  // Categories + search
                  _buildFilters(pos),

                  // Product grid
                  Expanded(child: _buildProductGrid(pos)),
                ],
              ),
            ),

            // Cart summary bar
            if (pos.cart.isNotEmpty || pos.currentOrder != null) _buildCartBar(pos),
          ],
        );
      },
    );
  }

  Widget _buildHeader(PosProvider pos) {
    final isTable = pos.orderType == 'dine_in';
    final tableName = pos.currentTable?['name'] ?? '';
    final hasActiveOrder = pos.currentOrder != null;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: const BoxDecoration(
        color: AppConstants.bgSecondary,
        border: Border(bottom: BorderSide(color: AppConstants.borderColor)),
      ),
      child: Row(
        children: [
          IconButton(
            onPressed: () => pos.goBackToTables(),
            icon: const Icon(Icons.arrow_back, size: 20),
          ),
          Text(
            isTable ? '🍽️ $tableName' : '🛍️ Para Llevar',
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (hasActiveOrder) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: AppConstants.warning.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                'Orden #${pos.currentOrder!['id']}',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: AppConstants.warning,
                ),
              ),
            ),
          ],
          const Spacer(),
          if (pos.cart.isNotEmpty)
            TextButton(
              onPressed: () => pos.clearCart(),
              child: const Text(
                '🗑️ Limpiar',
                style: TextStyle(fontSize: 12, color: AppConstants.danger),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildFilters(PosProvider pos) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
      child: Column(
        children: [
          // Search
          TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: '🔍 Buscar producto...',
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              suffixIcon: _searchController.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, size: 18),
                      onPressed: () {
                        _searchController.clear();
                        pos.setSearchTerm('');
                      },
                    )
                  : null,
            ),
            onChanged: (v) => pos.setSearchTerm(v),
          ),
          const SizedBox(height: 8),

          // Category chips
          SizedBox(
            height: 36,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _buildCategoryChip('Todos', null, pos),
                ...pos.categories.map((c) => _buildCategoryChip(
                  c['name']?.toString() ?? '',
                  c['id']?.toString(),
                  pos,
                )),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryChip(String label, String? categoryId, PosProvider pos) {
    final isActive = pos.selectedCategory == categoryId;

    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: FilterChip(
        label: Text(label, style: const TextStyle(fontSize: 12)),
        selected: isActive,
        onSelected: (_) => pos.setCategory(categoryId),
        selectedColor: AppConstants.accentPrimary.withValues(alpha: 0.2),
        checkmarkColor: AppConstants.accentPrimary,
        padding: const EdgeInsets.symmetric(horizontal: 4),
        visualDensity: VisualDensity.compact,
      ),
    );
  }

  Widget _buildProductGrid(PosProvider pos) {
    final products = pos.filteredProducts;

    if (products.isEmpty) {
      return const Center(
        child: Text(
          'No hay productos disponibles',
          style: TextStyle(color: AppConstants.textMuted),
        ),
      );
    }

    return GridView.builder(
      padding: const EdgeInsets.all(10),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
        childAspectRatio: 0.85,
      ),
      itemCount: products.length,
      itemBuilder: (context, i) => _buildProductCard(products[i], pos),
    );
  }

  Widget _buildProductCard(Map<String, dynamic> product, PosProvider pos) {
    final name = product['name']?.toString() ?? '';
    final price = toDouble(product['price'], 0.0);

    // Check if already in cart
    final cartQty = pos.cart
        .where((c) => c['product_id'] == product['id'])
        .fold<int>(0, (sum, c) => sum + (toInt(c['quantity'], 0)));

    return GestureDetector(
      onTap: () => pos.addToCart(product),
      child: Container(
        decoration: BoxDecoration(
          color: AppConstants.bgSecondary,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: cartQty > 0 ? AppConstants.accentPrimary : AppConstants.borderColor,
            width: cartQty > 0 ? 1.5 : 1,
          ),
        ),
        padding: const EdgeInsets.all(8),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (cartQty > 0)
              Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  color: AppConstants.accentPrimary,
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Center(
                  child: Text(
                    '$cartQty',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: Colors.black,
                    ),
                  ),
                ),
              ),
            const Spacer(),
            Text(
              name,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppConstants.textPrimary,
              ),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),
            Text(
              '\$${price.toStringAsFixed(2)}',
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: AppConstants.accentPrimary,
              ),
            ),
            const Spacer(),
          ],
        ),
      ),
    );
  }

  Widget _buildCartBar(PosProvider pos) {
    final hasActiveOrder = pos.currentOrder != null;
    final orderTotal = hasActiveOrder
        ? toDouble(pos.currentOrder!['total'])
        : 0.0;
    final displayTotal = pos.cart.isNotEmpty ? pos.total : orderTotal;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: const BoxDecoration(
        color: AppConstants.bgSecondary,
        border: Border(top: BorderSide(color: AppConstants.borderColor)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Cart items summary
            if (pos.cart.isNotEmpty)
              SizedBox(
                height: 42,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  itemCount: pos.cart.length,
                  itemBuilder: (context, i) {
                    final item = pos.cart[i];
                    return Container(
                      margin: const EdgeInsets.only(right: 6),
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppConstants.bgTertiary,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            '${item['quantity']}x ${item['name']}',
                            style: const TextStyle(fontSize: 11),
                          ),
                          const SizedBox(width: 6),
                          GestureDetector(
                            onTap: () => pos.removeFromCart(i),
                            child: const Text('✕', style: TextStyle(fontSize: 12, color: AppConstants.danger)),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            const SizedBox(height: 8),

            // Actions
            Row(
              children: [
                // Total
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Total', style: TextStyle(fontSize: 11, color: AppConstants.textMuted)),
                    Text(
                      '\$${displayTotal.toStringAsFixed(2)}',
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: AppConstants.accentPrimary,
                      ),
                    ),
                  ],
                ),
                const Spacer(),

                // Buttons
                if (pos.orderType == 'dine_in') ...[
                  if (hasActiveOrder && pos.cart.isNotEmpty)
                    ElevatedButton(
                      onPressed: () => _addItems(pos),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppConstants.info,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                      child: const Text('➕ Agregar', style: TextStyle(fontSize: 13)),
                    ),
                  if (!hasActiveOrder && pos.cart.isNotEmpty)
                    ElevatedButton(
                      onPressed: () => _sendToKitchen(pos),
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                      child: const Text('👨‍🍳 Enviar', style: TextStyle(fontSize: 13)),
                    ),
                  if (hasActiveOrder) ...[
                    const SizedBox(width: 8),
                    ElevatedButton(
                      onPressed: () => _showPayment(pos),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppConstants.success,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                      child: const Text('💰 Cobrar', style: TextStyle(fontSize: 13)),
                    ),
                  ],
                ] else ...[
                  if (pos.cart.isNotEmpty)
                    ElevatedButton(
                      onPressed: () => _showPayment(pos),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppConstants.success,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      ),
                      child: const Text('💰 Cobrar', style: TextStyle(fontSize: 14)),
                    ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _sendToKitchen(PosProvider pos) async {
    try {
      await pos.sendToKitchen();
      if (mounted) showToast(context, 'Orden enviada a cocina', type: 'success');
    } catch (e) {
      if (mounted) showToast(context, e.toString(), type: 'error');
    }
  }

  void _addItems(PosProvider pos) async {
    try {
      await pos.addItemsToOrder(pos.currentOrder!['id']);
      if (mounted) showToast(context, 'Items agregados a la orden', type: 'success');
    } catch (e) {
      if (mounted) showToast(context, e.toString(), type: 'error');
    }
  }

  void _showPayment(PosProvider pos) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ChangeNotifierProvider.value(
        value: pos,
        child: const PaymentModal(),
      ),
    );
  }
}

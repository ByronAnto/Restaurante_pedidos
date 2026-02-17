import 'package:flutter/material.dart';
import '../../../core/api/api_client.dart';
import '../../../core/utils/parsers.dart';

class PosProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  List<Map<String, dynamic>> _products = [];
  List<Map<String, dynamic>> _categories = [];
  List<Map<String, dynamic>> _tables = [];
  List<Map<String, dynamic>> _cart = [];
  String? _selectedCategory;
  String _searchTerm = '';
  bool _isLoading = false;

  // Current order context
  Map<String, dynamic>? _currentTable;
  Map<String, dynamic>? _currentOrder;
  String _orderType = 'dine_in'; // 'dine_in' | 'takeaway'

  List<Map<String, dynamic>> get products => _products;
  List<Map<String, dynamic>> get categories => _categories;
  List<Map<String, dynamic>> get tables => _tables;
  List<Map<String, dynamic>> get cart => _cart;
  String? get selectedCategory => _selectedCategory;
  String get searchTerm => _searchTerm;
  bool get isLoading => _isLoading;
  Map<String, dynamic>? get currentTable => _currentTable;
  Map<String, dynamic>? get currentOrder => _currentOrder;
  String get orderType => _orderType;

  List<Map<String, dynamic>> get filteredProducts {
    return _products.where((p) {
      final matchCategory = _selectedCategory == null ||
          p['category_id']?.toString() == _selectedCategory;
      final matchSearch = _searchTerm.isEmpty ||
          (p['name']?.toString().toLowerCase().contains(_searchTerm.toLowerCase()) ?? false);
      return matchCategory && matchSearch;
    }).toList();
  }

  double get subtotal => _cart.fold(0.0, (sum, item) {
    final price = toDouble(item['price'], 0.0);
    final qty = toInt(item['quantity'], 1);
    return sum + (price * qty);
  });

  double get taxTotal => _cart.fold(0.0, (sum, item) {
    final price = toDouble(item['price'], 0.0);
    final qty = toInt(item['quantity'], 1);
    final taxRate = toDouble(item['tax_rate'], 0.0);
    return sum + (price * qty * taxRate / 100);
  });

  double get total => subtotal + taxTotal;

  int get cartItemCount => _cart.fold(0, (sum, item) => sum + (toInt(item['quantity'], 1)));

  // ─── Data Loading ───

  Future<void> loadData() async {
    _isLoading = true;
    notifyListeners();

    try {
      final results = await Future.wait([
        _api.get('/products?available=true'),
        _api.get('/products/categories'),
        _api.get('/tables/map'),
      ]);

      _products = List<Map<String, dynamic>>.from(results[0]['data'] ?? []);
      _categories = List<Map<String, dynamic>>.from(results[1]['data'] ?? []);
      // Fix: Access 'tables' property from map response
      final tablesData = results[2]['data'];
      _tables = List<Map<String, dynamic>>.from(
        (tablesData is Map && tablesData.containsKey('tables')) 
            ? tablesData['tables'] 
            : (tablesData ?? [])
      );
    } catch (e) {
      debugPrint('Error loading POS data: $e');
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<void> refreshTables() async {
    try {
      final res = await _api.get('/tables/map');
      // Fix: Access 'tables' property from map response
      final tablesData = res['data'];
      _tables = List<Map<String, dynamic>>.from(
        (tablesData is Map && tablesData.containsKey('tables')) 
            ? tablesData['tables'] 
            : (tablesData ?? [])
      );
      notifyListeners();
    } catch (e) {
      debugPrint('Error refreshing tables: $e');
    }
  }

  // ─── Category & Filters ───

  void setCategory(String? categoryId) {
    _selectedCategory = categoryId;
    notifyListeners();
  }

  void setSearchTerm(String term) {
    _searchTerm = term;
    notifyListeners();
  }

  // ─── Table Selection ───

  void selectTable(Map<String, dynamic> table) {
    _currentTable = table;
    _orderType = 'dine_in';

    // Fix: Parse active order from flat fields if nested object doesn't exist
    _currentOrder = _parseOrderFromTable(table);
    
    _cart = [];
    notifyListeners();
  }

  Map<String, dynamic>? _parseOrderFromTable(Map<String, dynamic> table) {
    if (table['active_order'] != null) {
      return Map<String, dynamic>.from(table['active_order']);
    }
    // Fallback for flat fields from /tables/map
    if (table['active_sale_id'] != null) {
      return {
        'id': table['active_sale_id'],
        'sale_number': table['active_sale_number'],
        'total': table['active_total'],
        'items': table['order_items'] ?? [],
      };
    }
    return null;
  }

  void startTakeaway() {
    _currentTable = null;
    _currentOrder = null;
    _orderType = 'takeaway';
    _cart = [];
    notifyListeners();
  }

  // ─── Cart ───

  void addToCart(Map<String, dynamic> product) {
    addToCartWithModifiers(product, [], 0.0);
  }

  void addToCartWithModifiers(Map<String, dynamic> product, List<String> modifiers, double priceAdjustment) {
    // Create a unique key for the cart item based on product ID and modifiers
    // Modifiers list should be sorted to ensure consistency if order doesn't matter, 
    // but usually they are added in order. simple join is fine for now.
    final modifiersStr = modifiers.join(', ');
    final cartKey = '${product['id']}_$modifiersStr';

    final existing = _cart.indexWhere((item) => item['cart_key'] == cartKey);

    if (existing != -1) {
      _cart[existing] = Map<String, dynamic>.from(_cart[existing]);
      _cart[existing]['quantity'] = toInt(_cart[existing]['quantity']) + 1;
    } else {
      final basePrice = toDouble(product['price']);
      final finalPrice = basePrice + priceAdjustment;
      
      _cart.add({
        'cart_key': cartKey,
        'product_id': product['id'],
        'name': product['name'],
        'price': finalPrice, // Unit price with modifiers
        'original_price': basePrice,
        'tax_rate': product['tax_rate'] ?? 0,
        'quantity': 1,
        'notes': modifiersStr, // Storing modifiers in notes for now as per backend expectation or simple display
        'modifiers': modifiers, // Store raw list if needed for UI
      });
    }
    notifyListeners();
  }

  void updateQuantity(int index, int delta) {
    if (index < 0 || index >= _cart.length) return;
    _cart[index] = Map<String, dynamic>.from(_cart[index]);
    final newQty = toInt(_cart[index]['quantity']) + delta;
    if (newQty <= 0) {
      _cart.removeAt(index);
    } else {
      _cart[index]['quantity'] = newQty;
    }
    notifyListeners();
  }

  void removeFromCart(int index) {
    if (index < 0 || index >= _cart.length) return;
    _cart.removeAt(index);
    notifyListeners();
  }

  void updateItemNotes(int index, String notes) {
    if (index < 0 || index >= _cart.length) return;
    _cart[index] = Map<String, dynamic>.from(_cart[index]);
    _cart[index]['notes'] = notes;
    notifyListeners();
  }

  void clearCart() {
    _cart = [];
    notifyListeners();
  }

  // ─── Order Actions ───

  Future<Map<String, dynamic>?> sendToKitchen() async {
    if (_cart.isEmpty) return null;

    try {
      final body = {
        'items': _cart.map((item) => {
          'productId': item['product_id'],
          'productName': item['name'],
          'quantity': item['quantity'],
          'unitPrice': item['price'],
          'taxRate': item['tax_rate'],
          'notes': item['notes'] ?? '',
        }).toList(),
        'orderType': _orderType,
      };

      if (_orderType == 'dine_in' && _currentTable != null) {
        body['tableId'] = _currentTable!['id'];
      }

      final res = await _api.post('/pos/sales', body);
      _cart = [];
      await refreshTables();
      
      // Fix: Update current table/order reference to show "Charge" button
      if (_orderType == 'dine_in' && _currentTable != null) {
        final updatedTable = _tables.firstWhere(
          (t) => t['id'] == _currentTable!['id'],
          orElse: () => _currentTable!,
        );
        _currentTable = updatedTable;
        _currentTable = updatedTable;
        _currentOrder = _parseOrderFromTable(updatedTable);
      }

      notifyListeners();
      return res;
    } catch (e) {
      rethrow;
    }
  }

  Future<Map<String, dynamic>?> addItemsToOrder(int orderId) async {
    if (_cart.isEmpty) return null;

    try {
      final body = {
        'items': _cart.map((item) => {
          'productId': item['product_id'],
          'productName': item['name'],
          'quantity': item['quantity'],
          'unitPrice': item['price'],
          'taxRate': item['tax_rate'],
          'notes': item['notes'] ?? '',
        }).toList(),
      };

      final res = await _api.post('/pos/orders/$orderId/items', body);
      _cart = [];
      await refreshTables();

      // Fix: Update current table/order reference
      if (_orderType == 'dine_in' && _currentTable != null) {
        final updatedTable = _tables.firstWhere(
          (t) => t['id'] == _currentTable!['id'],
          orElse: () => _currentTable!,
        );
        _currentTable = updatedTable;
        if (updatedTable['active_order'] != null) {
          _currentOrder = Map<String, dynamic>.from(updatedTable['active_order']);
        }
      }

      notifyListeners();
      return res;
    } catch (e) {
      rethrow;
    }
  }

  Future<Map<String, dynamic>?> closeOrder({
    required int orderId,
    required String paymentMethod,
    required double amountReceived,
    String? customerName,
    String? customerRuc,
  }) async {
    try {
      final body = {
        'paymentMethod': paymentMethod,
        'amountReceived': amountReceived,
        if (customerName != null && customerName.isNotEmpty) 'customerName': customerName,
        if (customerRuc != null && customerRuc.isNotEmpty) 'customerRuc': customerRuc,
      };

      final res = await _api.post('/pos/orders/$orderId/close', body);
      _currentOrder = null;
      _currentTable = null;
      _cart = [];
      await refreshTables();
      notifyListeners();
      return res;
    } catch (e) {
      rethrow;
    }
  }

  Future<Map<String, dynamic>?> processTakeawaySale({
    required String paymentMethod,
    required double amountReceived,
    String? customerName,
    String? customerRuc,
  }) async {
    if (_cart.isEmpty) return null;

    try {
      final body = {
        'items': _cart.map((item) => {
          'productId': item['product_id'],
          'productName': item['name'],
          'quantity': item['quantity'],
          'unitPrice': item['price'],
          'taxRate': item['tax_rate'],
          'notes': item['notes'] ?? '',
        }).toList(),
        'orderType': 'takeaway',
        'paymentMethod': paymentMethod,
        'amountReceived': amountReceived,
        if (customerName != null && customerName.isNotEmpty) 'customerName': customerName,
        if (customerRuc != null && customerRuc.isNotEmpty) 'customerRuc': customerRuc,
      };

      final res = await _api.post('/pos/sales', body);
      _cart = [];
      notifyListeners();
      return res;
    } catch (e) {
      rethrow;
    }
  }

  void goBackToTables() {
    _currentTable = null;
    _currentOrder = null;
    _cart = [];
    _orderType = 'dine_in';
    notifyListeners();
  }
}

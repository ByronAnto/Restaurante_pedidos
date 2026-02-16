import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/api/api_client.dart';

class KitchenProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();
  List<Map<String, dynamic>> _orders = [];
  bool _isLoading = false;
  Timer? _pollingTimer;

  List<Map<String, dynamic>> get orders => _orders;
  bool get isLoading => _isLoading;

  List<Map<String, dynamic>> get pendingOrders =>
      _orders.where((o) => o['status'] == 'pending').toList();
  List<Map<String, dynamic>> get preparingOrders =>
      _orders.where((o) => o['status'] == 'preparing').toList();
  List<Map<String, dynamic>> get readyOrders =>
      _orders.where((o) => o['status'] == 'ready').toList();

  Future<void> loadOrders() async {
    _isLoading = true;
    notifyListeners();

    try {
      final res = await _api.get('/kitchen/orders/active');
      _orders = List<Map<String, dynamic>>.from(res['data'] ?? []);
    } catch (e) {
      debugPrint('Error loading kitchen orders: $e');
    }

    _isLoading = false;
    notifyListeners();
  }

  void startPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = Timer.periodic(const Duration(seconds: 10), (_) => loadOrders());
  }

  void stopPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = null;
  }

  Future<void> updateStatus(int orderId, String newStatus) async {
    try {
      await _api.patch('/kitchen/orders/$orderId/status', {'status': newStatus});
      await loadOrders();
    } catch (e) {
      rethrow;
    }
  }

  @override
  void dispose() {
    stopPolling();
    super.dispose();
  }
}

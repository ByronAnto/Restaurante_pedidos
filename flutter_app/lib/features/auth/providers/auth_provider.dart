import 'package:flutter/material.dart';
import '../../../core/api/api_client.dart';

class AuthProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();
  final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();
  bool _isLoading = false;
  String? _error;
  Map<String, dynamic>? _user;


  bool get isLoading => _isLoading;
  String? get error => _error;
  Map<String, dynamic>? get user => _user;
  bool get isLoggedIn => _user != null;

  AuthProvider() {
    _initSession();
  }

  Future<void> _initSession() async {
    final configured = await ApiClient.isServerConfigured();
    if (!configured) return;

    // Check if we have a stored token
    final isAuth = await _api.isAuthenticated();
    if (!isAuth) {
      _user = null;
      notifyListeners();
      return;
    }

    // Validate token against backend
    try {
      final res = await _api.get('/auth/me');
      if (res['success'] == true && res['data'] != null) {
        _user = res['data'];
        await _api.setUser(_user!);
      } else {
        await _api.clearSession();
        _user = null;
      }
    } catch (e) {
      // Token invalid or server unreachable — clear session
      await _api.clearSession();
      _user = null;
    }
    notifyListeners();
  }

  Future<void> loadUser() async {
    _user = await _api.getUser();
    notifyListeners();
  }

  Future<bool> login(String username, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final res = await _api.login(username, password);
      if (res['success'] == true) {
        _user = res['data']?['user'];
        _isLoading = false;
        notifyListeners();
        return true;
      }
      _error = res['message'] ?? 'Error al iniciar sesión';
    } catch (e) {
      _error = e.toString();
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  Future<void> logout(BuildContext context) async {
    _user = null;
    await _api.logout(context);
    notifyListeners();
  }
}

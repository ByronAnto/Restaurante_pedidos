import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;
  ApiClient._internal();

  String _baseUrl = '';

  // ─── Server URL Management ───

  static Future<bool> isServerConfigured() async {
    final prefs = await SharedPreferences.getInstance();
    final url = prefs.getString('server_url');
    return url != null && url.isNotEmpty;
  }

  static Future<String?> getBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('server_url');
  }

  static Future<void> setBaseUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('server_url', url);
    _instance._baseUrl = url;
  }

  Future<void> initBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    _baseUrl = prefs.getString('server_url') ?? '';
  }

  // ─── Token Management ───

  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('token');
  }

  Future<void> setToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('token', token);
  }

  Future<Map<String, dynamic>?> getUser() async {
    final prefs = await SharedPreferences.getInstance();
    final user = prefs.getString('user');
    return user != null ? jsonDecode(user) : null;
  }

  Future<void> setUser(Map<String, dynamic> user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('user', jsonEncode(user));
  }

  Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('user');
  }

  Future<bool> isAuthenticated() async {
    final token = await getToken();
    return token != null && token.isNotEmpty;
  }

  // ─── HTTP Methods ───

  Future<Map<String, String>> _headers() async {
    final token = await getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<Map<String, dynamic>> get(String endpoint) async {
    return _request('GET', endpoint);
  }

  Future<Map<String, dynamic>> post(String endpoint, [Map<String, dynamic>? body]) async {
    return _request('POST', endpoint, body: body);
  }

  Future<Map<String, dynamic>> put(String endpoint, [Map<String, dynamic>? body]) async {
    return _request('PUT', endpoint, body: body);
  }

  Future<Map<String, dynamic>> patch(String endpoint, [Map<String, dynamic>? body]) async {
    return _request('PATCH', endpoint, body: body);
  }

  Future<Map<String, dynamic>> delete(String endpoint) async {
    return _request('DELETE', endpoint);
  }

  Future<Map<String, dynamic>> _request(
    String method,
    String endpoint, {
    Map<String, dynamic>? body,
  }) async {
    final url = Uri.parse('$_baseUrl$endpoint');
    final headers = await _headers();

    try {
      http.Response response;

      switch (method) {
        case 'GET':
          response = await http.get(url, headers: headers);
          break;
        case 'POST':
          response = await http.post(url, headers: headers, body: body != null ? jsonEncode(body) : null);
          break;
        case 'PUT':
          response = await http.put(url, headers: headers, body: body != null ? jsonEncode(body) : null);
          break;
        case 'PATCH':
          response = await http.patch(url, headers: headers, body: body != null ? jsonEncode(body) : null);
          break;
        case 'DELETE':
          response = await http.delete(url, headers: headers);
          break;
        default:
          throw Exception('Método HTTP no soportado: $method');
      }

      final data = jsonDecode(response.body) as Map<String, dynamic>;

      if (response.statusCode == 401) {
        await clearSession();
        throw ApiException(401, 'Sesión expirada');
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw ApiException(
          response.statusCode,
          data['message']?.toString() ?? 'Error en la petición',
        );
      }

      return data;
    } on ApiException {
      rethrow;
    } catch (e) {
      if (e is FormatException) {
        throw ApiException(0, 'Respuesta inválida del servidor');
      }
      throw ApiException(0, 'Error de conexión con el servidor');
    }
  }

  // ─── Auth ───

  Future<Map<String, dynamic>> login(String username, String password) async {
    final res = await post('/auth/login', {
      'username': username,
      'password': password,
    });

    if (res['success'] == true && res['data'] != null) {
      await setToken(res['data']['token']);
      await setUser(res['data']['user']);
    }

    return res;
  }

  Future<void> logout(BuildContext context) async {
    await clearSession();
    if (context.mounted) {
      Navigator.of(context).pushNamedAndRemoveUntil('/login', (route) => false);
    }
  }
}

class ApiException implements Exception {
  final int status;
  final String message;

  ApiException(this.status, this.message);

  @override
  String toString() => message;
}

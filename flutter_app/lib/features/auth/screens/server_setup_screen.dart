import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../../../core/api/api_client.dart';

class ServerSetupScreen extends StatefulWidget {
  const ServerSetupScreen({super.key});

  @override
  State<ServerSetupScreen> createState() => _ServerSetupScreenState();
}

class _ServerSetupScreenState extends State<ServerSetupScreen> {
  final _urlController = TextEditingController();
  bool _testing = false;
  String? _status;
  bool _isSuccess = false;

  @override
  void initState() {
    super.initState();
    _loadSaved();
  }

  Future<void> _loadSaved() async {
    final saved = await ApiClient.getBaseUrl();
    if (saved != null && saved.isNotEmpty) {
      _urlController.text = saved.replaceAll('/api', '');
    }
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  Future<void> _testConnection() async {
    final raw = _urlController.text.trim();
    if (raw.isEmpty) {
      setState(() {
        _status = 'Ingresa la dirección del servidor';
        _isSuccess = false;
      });
      return;
    }

    // Normalize URL
    String url = raw;
    if (!url.startsWith('http')) url = 'http://$url';
    url = url.replaceAll(RegExp(r'/+$'), ''); // Remove trailing slashes
    final apiUrl = '$url/api';

    setState(() {
      _testing = true;
      _status = 'Probando conexión...';
      _isSuccess = false;
    });

    try {
      final response = await http
          .get(Uri.parse('$apiUrl/health'))
          .timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        // Save and proceed
        await ApiClient.setBaseUrl(apiUrl);
        await ApiClient().initBaseUrl();

        if (mounted) {
          setState(() {
            _status = '✅ Conexión exitosa';
            _isSuccess = true;
          });

          // Navigate after brief delay
          await Future.delayed(const Duration(milliseconds: 600));
          if (mounted) {
            Navigator.pushReplacementNamed(context, '/login');
          }
        }
      } else {
        setState(() {
          _status = '❌ El servidor respondió con error (${response.statusCode})';
          _isSuccess = false;
        });
      }
    } catch (e) {
      // Even if /health fails, the server might not have that endpoint
      // Try saving and let the user proceed
      await ApiClient.setBaseUrl(apiUrl);
      await ApiClient().initBaseUrl();

      if (mounted) {
        setState(() {
          _status = '⚠️ No se pudo verificar, pero se guardó la URL.\nPuedes intentar iniciar sesión.';
          _isSuccess = true;
        });
      }
    }

    if (mounted) setState(() => _testing = false);
  }

  void _proceed() {
    Navigator.pushReplacementNamed(context, '/login');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Logo
                const Text('🍽️', style: TextStyle(fontSize: 64)),
                const SizedBox(height: 16),
                const Text(
                  'RestaurantePOS',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFFf59e0b),
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Configuración del Servidor',
                  style: TextStyle(fontSize: 14, color: Color(0xFF9aa0a6)),
                ),
                const SizedBox(height: 40),

                // Instructions
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1a1f2e),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFF2d3748)),
                  ),
                  child: const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '📡 Dirección del Backend',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                      ),
                      SizedBox(height: 8),
                      Text(
                        'Ingresa la IP o dominio donde está instalado el servidor del restaurante.',
                        style: TextStyle(fontSize: 12, color: Color(0xFF9aa0a6)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // URL Input
                TextField(
                  controller: _urlController,
                  decoration: InputDecoration(
                    labelText: 'URL del Servidor',
                    hintText: 'Ej: 192.168.1.100:3000',
                    prefixIcon: const Icon(Icons.dns, size: 20),
                    helperText: 'Ejemplo: http://192.168.1.100:3000',
                    helperStyle: const TextStyle(fontSize: 11, color: Color(0xFF5f6368)),
                    filled: true,
                    fillColor: const Color(0xFF1a1f2e),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFF2d3748)),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFF2d3748)),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFFf59e0b), width: 2),
                    ),
                  ),
                  keyboardType: TextInputType.url,
                  textInputAction: TextInputAction.go,
                  onSubmitted: (_) => _testConnection(),
                ),
                const SizedBox(height: 20),

                // Status message
                if (_status != null)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: _isSuccess
                          ? const Color(0xFF10b981).withValues(alpha: 0.1)
                          : const Color(0xFFef4444).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: _isSuccess
                            ? const Color(0xFF10b981).withValues(alpha: 0.3)
                            : const Color(0xFFef4444).withValues(alpha: 0.3),
                      ),
                    ),
                    child: Text(
                      _status!,
                      style: TextStyle(
                        fontSize: 13,
                        color: _isSuccess ? const Color(0xFF10b981) : const Color(0xFFef4444),
                        fontWeight: FontWeight.w600,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),

                const SizedBox(height: 24),

                // Connect button
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    onPressed: _testing ? null : _testConnection,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFf59e0b),
                      foregroundColor: Colors.black,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                    ),
                    child: _testing
                        ? const SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.black),
                          )
                        : const Text('🔗 Conectar'),
                  ),
                ),

                // Skip if already configured
                if (_isSuccess) ...[
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: _proceed,
                    child: const Text(
                      'Ir al Login →',
                      style: TextStyle(color: Color(0xFFf59e0b), fontWeight: FontWeight.w600),
                    ),
                  ),
                ],

                const SizedBox(height: 40),

                // Help
                const Text(
                  '💡 Si no conoces la dirección, consulta con\nel administrador del sistema.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 11, color: Color(0xFF5f6368)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

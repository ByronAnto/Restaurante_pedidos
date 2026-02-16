import 'package:flutter/material.dart';

class AppConstants {
  // ─── API ───
  // Cambiar esta URL a la IP/dominio de tu backend
  static const String baseUrl = 'http://10.0.2.2:3000/api'; // Android emulator → localhost
  // Para dispositivo físico en red local: 'http://192.168.1.X:3000/api'

  // ─── Colors (Dark Theme) ───
  static const Color bgPrimary = Color(0xFF0f1419);
  static const Color bgSecondary = Color(0xFF1a1f2e);
  static const Color bgTertiary = Color(0xFF242936);
  static const Color accentPrimary = Color(0xFFf59e0b);
  static const Color accentSecondary = Color(0xFFd97706);
  static const Color textPrimary = Color(0xFFe8eaed);
  static const Color textSecondary = Color(0xFF9aa0a6);
  static const Color textMuted = Color(0xFF5f6368);
  static const Color borderColor = Color(0xFF2d3748);
  static const Color success = Color(0xFF10b981);
  static const Color danger = Color(0xFFef4444);
  static const Color warning = Color(0xFFf59e0b);
  static const Color info = Color(0xFF3b82f6);

  // ─── Roles ───
  static const List<String> adminOnlyPages = [
    'products', 'inventory', 'recipes', 'investments',
    'payroll', 'reports', 'users', 'config',
  ];
}

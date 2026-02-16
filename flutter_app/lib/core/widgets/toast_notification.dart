import 'package:flutter/material.dart';
import '../constants/app_constants.dart';

void showToast(BuildContext context, String message, {String type = 'info'}) {
  final icons = {
    'success': '✅',
    'error': '❌',
    'warning': '⚠️',
    'info': 'ℹ️',
  };

  final colors = {
    'success': AppConstants.success,
    'error': AppConstants.danger,
    'warning': AppConstants.warning,
    'info': AppConstants.info,
  };

  if (!context.mounted) return;

  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Row(
        children: [
          Text(icons[type] ?? 'ℹ️', style: const TextStyle(fontSize: 18)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(color: AppConstants.textPrimary),
            ),
          ),
        ],
      ),
      backgroundColor: AppConstants.bgTertiary,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      margin: const EdgeInsets.all(12),
      duration: Duration(milliseconds: type == 'error' ? 5000 : 3500),
      action: SnackBarAction(
        label: '✕',
        textColor: colors[type] ?? AppConstants.info,
        onPressed: () {
          ScaffoldMessenger.of(context).hideCurrentSnackBar();
        },
      ),
    ),
  );
}

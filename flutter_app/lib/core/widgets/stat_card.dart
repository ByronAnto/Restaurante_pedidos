import 'package:flutter/material.dart';
import '../constants/app_constants.dart';

class StatCard extends StatelessWidget {
  final String icon;
  final String value;
  final String label;
  final Color? iconBgColor;
  final Color? iconColor;
  final Color? valueColor;
  final Color? borderColor;

  const StatCard({
    super.key,
    required this.icon,
    required this.value,
    required this.label,
    this.iconBgColor,
    this.iconColor,
    this.valueColor,
    this.borderColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppConstants.bgSecondary,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: borderColor ?? AppConstants.borderColor,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: iconBgColor ?? AppConstants.accentPrimary.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(
              child: Text(icon, style: const TextStyle(fontSize: 20)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: valueColor ?? AppConstants.textPrimary,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppConstants.textSecondary,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

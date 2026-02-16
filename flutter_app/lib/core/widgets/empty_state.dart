import 'package:flutter/material.dart';
import '../constants/app_constants.dart';

class EmptyStateWidget extends StatelessWidget {
  final String icon;
  final String text;
  final String? subtext;

  const EmptyStateWidget({
    super.key,
    required this.icon,
    required this.text,
    this.subtext,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(icon, style: const TextStyle(fontSize: 48)),
            const SizedBox(height: 12),
            Text(
              text,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppConstants.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),
            if (subtext != null) ...[
              const SizedBox(height: 6),
              Text(
                subtext!,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppConstants.textMuted,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class LoadingWidget extends StatelessWidget {
  final String? message;

  const LoadingWidget({super.key, this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(color: AppConstants.accentPrimary),
          if (message != null) ...[
            const SizedBox(height: 12),
            Text(
              message!,
              style: const TextStyle(color: AppConstants.textMuted),
            ),
          ],
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../constants/app_constants.dart';

class AppDrawer extends StatelessWidget {
  final String currentPage;
  final Map<String, dynamic>? user;

  const AppDrawer({super.key, required this.currentPage, this.user});

  @override
  Widget build(BuildContext context) {
    final role = user?['role'] ?? '';
    final fullName = user?['fullName'] ?? 'Usuario';
    final initial = fullName.isNotEmpty ? fullName[0].toUpperCase() : 'U';

    return Drawer(
      child: Column(
        children: [
          // ─── Brand ───
          Container(
            padding: const EdgeInsets.fromLTRB(20, 50, 20, 20),
            decoration: const BoxDecoration(
              color: AppConstants.bgPrimary,
              border: Border(bottom: BorderSide(color: AppConstants.borderColor)),
            ),
            child: Row(
              children: [
                const Text('🍽️', style: TextStyle(fontSize: 32)),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'RestaurantePOS',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: AppConstants.accentPrimary,
                      ),
                    ),
                    const Text(
                      'Sistema de Gestión',
                      style: TextStyle(fontSize: 12, color: AppConstants.textMuted),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // ─── Navigation Items ───
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 8),
              children: [
                _buildSectionTitle('Principal'),
                if (role != 'kitchen') ...[
                  _buildNavItem(context, '🛒', 'Punto de Venta', 'pos'),
                  _buildNavItem(context, '📜', 'Historial Ventas', 'sales-history'),
                ],
                _buildNavItem(context, '👨‍🍳', 'Comandera', 'kitchen'),

                if (role == 'admin') ...[
                  const Divider(height: 16),
                  _buildSectionTitle('Gestión'),
                  _buildNavItem(context, '📦', 'Productos', 'products'),
                  _buildNavItem(context, '🏪', 'Inventario', 'inventory'),
                  _buildNavItem(context, '📋', 'Recetas', 'recipes'),
                  _buildNavItem(context, '💰', 'Inversiones', 'investments'),
                  _buildNavItem(context, '👥', 'Nómina', 'payroll'),
                  _buildNavItem(context, '📊', 'Reportes', 'reports'),

                  const Divider(height: 16),
                  _buildSectionTitle('Sistema'),
                  _buildNavItem(context, '🔐', 'Usuarios', 'users'),
                  _buildNavItem(context, '⚙️', 'Configuración', 'config'),
                ],
              ],
            ),
          ),

          // ─── User Footer ───
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: AppConstants.borderColor)),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 18,
                  backgroundColor: AppConstants.accentPrimary,
                  child: Text(
                    initial,
                    style: const TextStyle(
                      color: Colors.black,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        fullName,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppConstants.textPrimary,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        role,
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppConstants.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => _logout(context),
                  icon: const Text('🚪', style: TextStyle(fontSize: 18)),
                  tooltip: 'Cerrar Sesión',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
      child: Text(
        title.toUpperCase(),
        style: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: AppConstants.textMuted,
          letterSpacing: 1.5,
        ),
      ),
    );
  }

  Widget _buildNavItem(BuildContext context, String icon, String label, String page) {
    final isActive = currentPage == page;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 1),
      child: ListTile(
        leading: Text(icon, style: const TextStyle(fontSize: 18)),
        title: Text(
          label,
          style: TextStyle(
            fontSize: 14,
            fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
            color: isActive ? AppConstants.accentPrimary : AppConstants.textPrimary,
          ),
        ),
        selected: isActive,
        selectedTileColor: AppConstants.accentPrimary.withValues(alpha: 0.1),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        dense: true,
        visualDensity: const VisualDensity(vertical: -1),
        onTap: () {
          Navigator.pop(context); // Close drawer
          if (!isActive) {
            Navigator.pushReplacementNamed(context, '/$page');
          }
        },
      ),
    );
  }

  void _logout(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('🚪 Cerrar Sesión'),
        content: const Text('¿Seguro que desea cerrar sesión?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Salir')),
        ],
      ),
    );

    if (confirmed == true && context.mounted) {
      await ApiClient().logout(context);
    }
  }
}

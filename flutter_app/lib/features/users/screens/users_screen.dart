import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../../core/api/api_client.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/widgets/app_drawer.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/toast_notification.dart';
import '../../auth/providers/auth_provider.dart';

class UsersScreen extends StatefulWidget {
  const UsersScreen({super.key});

  @override
  State<UsersScreen> createState() => _UsersScreenState();
}

class _UsersScreenState extends State<UsersScreen> {
  final ApiClient _api = ApiClient();
  List<Map<String, dynamic>> _users = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadUsers();
  }

  Future<void> _loadUsers() async {
    setState(() => _isLoading = true);
    try {
      final res = await _api.get('/auth/users');
      _users = List<Map<String, dynamic>>.from(res['data'] ?? []);
    } catch (e) {
      if (mounted) showToast(context, 'Error cargando usuarios', type: 'error');
    }
    if (mounted) setState(() => _isLoading = false);
  }

  @override
  Widget build(BuildContext context) {
    final user = context.read<AuthProvider>().user;
    final currentUserId = user?['id'];

    return Scaffold(
      appBar: AppBar(title: const Text('🔐 Usuarios')),
      drawer: AppDrawer(currentPage: 'users', user: user),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showUserForm(),
        child: const Icon(Icons.person_add),
      ),
      body: _isLoading
          ? const LoadingWidget(message: 'Cargando usuarios...')
          : RefreshIndicator(
              onRefresh: _loadUsers,
              child: _users.isEmpty
                  ? const EmptyStateWidget(icon: '👥', text: 'No hay usuarios')
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _users.length,
                      itemBuilder: (context, i) => _buildUserTile(_users[i], currentUserId),
                    ),
            ),
    );
  }

  Widget _buildUserTile(Map<String, dynamic> u, int? currentUserId) {
    final isSelf = u['id'] == currentUserId;
    final isActive = u['active'] == true || u['active'] == 1;
    final roleBadge = _getRoleBadge(u['role']?.toString() ?? '');
    final created = u['created_at']?.toString() ?? '';
    try { DateFormat('dd/MM/yyyy').format(DateTime.parse(created)); } catch (_) {}

    return Opacity(
      opacity: isActive ? 1 : 0.5,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: AppConstants.bgSecondary,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppConstants.borderColor),
        ),
        child: ListTile(
          leading: CircleAvatar(
            backgroundColor: AppConstants.accentPrimary,
            child: Text(
              (u['username']?.toString() ?? 'U')[0].toUpperCase(),
              style: const TextStyle(color: Colors.black, fontWeight: FontWeight.w700),
            ),
          ),
          title: Row(
            children: [
              Flexible(child: Text(u['full_name']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14))),
              if (isSelf) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: AppConstants.info.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(6)),
                  child: const Text('Tú', style: TextStyle(fontSize: 10, color: AppConstants.info, fontWeight: FontWeight.w700)),
                ),
              ],
            ],
          ),
          subtitle: Row(
            children: [
              Text('@${u['username'] ?? ''}', style: const TextStyle(fontSize: 12, color: AppConstants.textMuted)),
              const SizedBox(width: 8),
              roleBadge,
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: (isActive ? AppConstants.success : AppConstants.danger).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  isActive ? 'Activo' : 'Inactivo',
                  style: TextStyle(fontSize: 10, color: isActive ? AppConstants.success : AppConstants.danger, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          trailing: isSelf
              ? null
              : PopupMenuButton<String>(
                  onSelected: (v) => _handleAction(v, u),
                  itemBuilder: (_) => [
                    const PopupMenuItem(value: 'edit', child: Text('✏️ Editar')),
                    const PopupMenuItem(value: 'password', child: Text('🔑 Contraseña')),
                    PopupMenuItem(value: 'toggle', child: Text(isActive ? '🚫 Desactivar' : '✅ Activar')),
                    const PopupMenuItem(value: 'delete', child: Text('🗑️ Eliminar')),
                  ],
                ),
        ),
      ),
    );
  }

  Widget _getRoleBadge(String role) {
    final roles = {
      'admin': ('Admin', AppConstants.accentPrimary),
      'cashier': ('Cajero', AppConstants.info),
      'waiter': ('Mesero', AppConstants.warning),
      'kitchen': ('Cocina', AppConstants.success),
    };
    final info = roles[role] ?? (role, AppConstants.textMuted);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(color: info.$2.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(6)),
      child: Text(info.$1, style: TextStyle(fontSize: 10, color: info.$2, fontWeight: FontWeight.w700)),
    );
  }

  void _handleAction(String action, Map<String, dynamic> u) {
    switch (action) {
      case 'edit': _showUserForm(user: u); break;
      case 'password': _showPasswordForm(u); break;
      case 'toggle': _toggleActive(u['id']); break;
      case 'delete': _deleteUser(u); break;
    }
  }

  void _showUserForm({Map<String, dynamic>? user}) {
    final isEdit = user != null;
    final usernameC = TextEditingController(text: user?['username']?.toString() ?? '');
    final fullNameC = TextEditingController(text: user?['full_name']?.toString() ?? '');
    final emailC = TextEditingController(text: user?['email']?.toString() ?? '');
    final passwordC = TextEditingController();
    String role = user?['role']?.toString() ?? 'cashier';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: Text(isEdit ? '✏️ Editar Usuario' : '➕ Nuevo Usuario'),
          content: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextField(controller: usernameC, decoration: const InputDecoration(labelText: 'Usuario *'), enabled: !isEdit),
              const SizedBox(height: 10),
              TextField(controller: fullNameC, decoration: const InputDecoration(labelText: 'Nombre Completo *')),
              const SizedBox(height: 10),
              TextField(controller: emailC, decoration: const InputDecoration(labelText: 'Email')),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: role,
                decoration: const InputDecoration(labelText: 'Rol *'),
                items: const [
                  DropdownMenuItem(value: 'cashier', child: Text('Cajero')),
                  DropdownMenuItem(value: 'waiter', child: Text('Mesero')),
                  DropdownMenuItem(value: 'kitchen', child: Text('Cocina')),
                  DropdownMenuItem(value: 'admin', child: Text('Administrador')),
                ],
                onChanged: (v) => role = v ?? 'cashier',
              ),
              if (!isEdit) ...[
                const SizedBox(height: 10),
                TextField(controller: passwordC, decoration: const InputDecoration(labelText: 'Contraseña *'), obscureText: true),
              ],
            ]),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
            ElevatedButton(
              onPressed: () async {
                final data = {
                  'username': usernameC.text,
                  'fullName': fullNameC.text,
                  'email': emailC.text,
                  'role': role,
                  if (!isEdit) 'password': passwordC.text,
                };
                try {
                  if (isEdit) {
                    await _api.put('/auth/users/${user['id']}', data);
                  } else {
                    await _api.post('/auth/register', data);
                  }
                  if (ctx.mounted) Navigator.pop(ctx);
                  _loadUsers();
                  if (mounted) showToast(context, isEdit ? 'Usuario actualizado' : 'Usuario creado', type: 'success');
                } catch (e) {
                  if (mounted) showToast(context, e.toString(), type: 'error');
                }
              },
              child: Text(isEdit ? '💾 Guardar' : '➕ Crear'),
            ),
          ],
        ),
      ),
    );
  }

  void _showPasswordForm(Map<String, dynamic> u) {
    final pwC = TextEditingController();
    final confirmC = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('🔑 Cambiar Contraseña'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          Text('Usuario: ${u['username']}', style: const TextStyle(color: AppConstants.textMuted)),
          const SizedBox(height: 16),
          TextField(controller: pwC, decoration: const InputDecoration(labelText: 'Nueva Contraseña *'), obscureText: true),
          const SizedBox(height: 10),
          TextField(controller: confirmC, decoration: const InputDecoration(labelText: 'Confirmar *'), obscureText: true),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
          ElevatedButton(
            onPressed: () async {
              if (pwC.text != confirmC.text) {
                showToast(context, 'Las contraseñas no coinciden', type: 'error');
                return;
              }
              try {
                await _api.patch('/auth/users/${u['id']}/password', {'password': pwC.text});
                if (ctx.mounted) Navigator.pop(ctx);
                if (mounted) showToast(context, 'Contraseña actualizada', type: 'success');
              } catch (e) {
                if (mounted) showToast(context, e.toString(), type: 'error');
              }
            },
            child: const Text('🔑 Cambiar'),
          ),
        ],
      ),
    );
  }

  void _toggleActive(int? id) async {
    if (id == null) return;
    try {
      await _api.patch('/auth/users/$id/toggle');
      _loadUsers();
    } catch (e) {
      if (mounted) showToast(context, e.toString(), type: 'error');
    }
  }

  void _deleteUser(Map<String, dynamic> u) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('🗑️ Eliminar Usuario'),
        content: Text('¿Eliminar a "${u['username']}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppConstants.danger),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );
    if (confirm == true) {
      try {
        await _api.delete('/auth/users/${u['id']}');
        _loadUsers();
        if (mounted) showToast(context, 'Usuario eliminado', type: 'success');
      } catch (e) {
        if (mounted) showToast(context, e.toString(), type: 'error');
      }
    }
  }
}

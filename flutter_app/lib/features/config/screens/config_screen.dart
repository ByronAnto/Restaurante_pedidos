import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/api/api_client.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/widgets/app_drawer.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/toast_notification.dart';
import '../../auth/providers/auth_provider.dart';

class ConfigScreen extends StatefulWidget {
  const ConfigScreen({super.key});

  @override
  State<ConfigScreen> createState() => _ConfigScreenState();
}

class _ConfigScreenState extends State<ConfigScreen> {
  final ApiClient _api = ApiClient();
  Map<String, dynamic> _config = {};
  List<Map<String, dynamic>> _tables = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final results = await Future.wait([
        _api.get('/config'),
        _api.get('/tables'),
      ]);
      _config = results[0]['data']?['grouped'] as Map<String, dynamic>? ?? {};
      _tables = List<Map<String, dynamic>>.from(results[1]['data'] ?? []);
    } catch (e) {
      if (mounted) showToast(context, 'Error cargando configuración', type: 'error');
    }
    if (mounted) setState(() => _isLoading = false);
  }

  // Config value helpers
  final Map<String, TextEditingController> _controllers = {};

  String _getVal(String group, String key) {
    final g = _config[group] as Map<String, dynamic>? ?? {};
    return g[key]?.toString() ?? '';
  }

  TextEditingController _ctrl(String group, String key) {
    final id = '$group.$key';
    _controllers.putIfAbsent(id, () => TextEditingController(text: _getVal(group, key)));
    return _controllers[id]!;
  }

  @override
  void dispose() {
    for (final c in _controllers.values) { c.dispose(); }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = context.read<AuthProvider>().user;

    return Scaffold(
      appBar: AppBar(
        title: const Text('⚙️ Configuración'),
        actions: [
          TextButton.icon(
            onPressed: _saveAll,
            icon: const Text('💾'),
            label: const Text('Guardar', style: TextStyle(color: AppConstants.accentPrimary)),
          ),
        ],
      ),
      drawer: AppDrawer(currentPage: 'config', user: user),
      body: _isLoading
          ? const LoadingWidget(message: 'Cargando configuración...')
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _buildSection('🏪 General', [
                  _buildTextField('Nombre del Restaurante', 'general', 'restaurant_name'),
                  _buildTextField('RUC', 'general', 'restaurant_ruc'),
                  _buildTextField('Dirección', 'general', 'restaurant_address'),
                  _buildTextField('Teléfono', 'general', 'restaurant_phone'),
                  _buildDropdown('IVA por defecto', 'general', 'default_tax_rate', ['0', '12', '15']),
                ]),

                _buildSection('🍽️ Servicio & Mesas', [
                  _buildDropdown('Modo POS', 'pos', 'pos_mode', ['fast_food', 'full_service', 'hybrid']),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      const Text('Mesas del Local', style: TextStyle(fontWeight: FontWeight.w700)),
                      const Spacer(),
                      ElevatedButton.icon(
                        onPressed: _showTableForm,
                        icon: const Icon(Icons.add, size: 16),
                        label: const Text('Nueva Mesa', style: TextStyle(fontSize: 12)),
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          visualDensity: VisualDensity.compact,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ..._buildTablesList(),
                ]),

                _buildSection('🖨️ Impresión', [
                  _buildDropdown('Impresión Habilitada', 'printing', 'print_enabled', ['true', 'false']),
                  _buildTextField('URL Servicio', 'printing', 'print_service_url'),
                  _buildDropdown('Ticket Cocina', 'printing', 'print_kitchen_ticket', ['true', 'false']),
                  _buildDropdown('Recibo', 'printing', 'print_receipt', ['true', 'false']),
                ]),

                _buildSection('👨‍🍳 Comandera Digital', [
                  _buildDropdown('Habilitada', 'kitchen', 'kitchen_display_enabled', ['true', 'false']),
                ]),

                _buildSection('🏛️ SRI Ecuador', [
                  _buildDropdown('Modo SRI', 'sri', 'sri_mode', ['offline', 'online']),
                  _buildDropdown('Ambiente', 'sri', 'sri_environment', ['test', 'production']),
                  _buildTextField('RUC SRI', 'sri', 'sri_ruc'),
                ]),

                const SizedBox(height: 20),
              ],
            ),
    );
  }

  Widget _buildSection(String title, List<Widget> children) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: AppConstants.bgSecondary,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppConstants.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(children: children),
          ),
        ],
      ),
    );
  }

  Widget _buildTextField(String label, String group, String key) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: _ctrl(group, key),
        decoration: InputDecoration(
          labelText: label,
          isDense: true,
        ),
      ),
    );
  }

  Widget _buildDropdown(String label, String group, String key, List<String> options) {
    final current = _getVal(group, key);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: DropdownButtonFormField<String>(
        initialValue: options.contains(current) ? current : options.first,
        decoration: InputDecoration(labelText: label, isDense: true),
        items: options.map((o) => DropdownMenuItem(value: o, child: Text(o))).toList(),
        onChanged: (v) {
          if (v != null) {
            final g = _config.putIfAbsent(group, () => {}) as Map<String, dynamic>;
            g[key] = v;
          }
        },
      ),
    );
  }

  List<Widget> _buildTablesList() {
    if (_tables.isEmpty) {
      return [const EmptyStateWidget(icon: '🍽️', text: 'No hay mesas configuradas')];
    }

    final zones = <String>{};
    for (var t in _tables) {
      zones.add(t['zone']?.toString() ?? 'General');
    }

    return zones.map((zone) {
      final zoneTables = _tables.where((t) => (t['zone']?.toString() ?? 'General') == zone).toList();
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Text(zone, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppConstants.textSecondary)),
          ),
          ...zoneTables.map((table) => Container(
            margin: const EdgeInsets.only(bottom: 6),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: AppConstants.bgTertiary,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                Expanded(child: Text(table['name']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
                Text('👥 ${table['capacity'] ?? 4}', style: const TextStyle(fontSize: 11, color: AppConstants.textMuted)),
                const SizedBox(width: 10),
                GestureDetector(onTap: () => _showTableForm(table: table), child: const Text('✏️', style: TextStyle(fontSize: 14))),
                const SizedBox(width: 8),
                GestureDetector(onTap: () => _deleteTable(table['id']), child: const Text('🗑️', style: TextStyle(fontSize: 14))),
              ],
            ),
          )),
          const SizedBox(height: 4),
        ],
      );
    }).toList();
  }

  void _saveAll() async {
    final configs = <Map<String, String>>[];
    for (final entry in _controllers.entries) {
      final parts = entry.key.split('.');
      if (parts.length == 2) {
        configs.add({'key': parts[1], 'value': entry.value.text});
      }
    }

    // Also save dropdown values from _config
    for (final group in _config.entries) {
      if (group.value is Map<String, dynamic>) {
        for (final kv in (group.value as Map<String, dynamic>).entries) {
          if (!configs.any((c) => c['key'] == kv.key)) {
            configs.add({'key': kv.key, 'value': kv.value.toString()});
          }
        }
      }
    }

    try {
      await _api.put('/config', {'configs': configs});
      if (mounted) showToast(context, 'Configuración guardada exitosamente', type: 'success');
    } catch (e) {
      if (mounted) showToast(context, e.toString(), type: 'error');
    }
  }

  void _showTableForm({Map<String, dynamic>? table}) {
    final isEdit = table != null;
    final nameC = TextEditingController(text: table?['name']?.toString() ?? '');
    final capC = TextEditingController(text: (table?['capacity'] ?? 4).toString());
    final zoneC = TextEditingController(text: table?['zone']?.toString() ?? 'Salón');
    String shape = table?['shape']?.toString() ?? 'square';

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isEdit ? '✏️ Editar Mesa' : '➕ Nueva Mesa'),
        content: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(controller: nameC, decoration: const InputDecoration(labelText: 'Nombre *')),
            const SizedBox(height: 10),
            TextField(controller: capC, decoration: const InputDecoration(labelText: 'Capacidad'), keyboardType: TextInputType.number),
            const SizedBox(height: 10),
            TextField(controller: zoneC, decoration: const InputDecoration(labelText: 'Zona')),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              initialValue: shape,
              decoration: const InputDecoration(labelText: 'Forma'),
              items: const [
                DropdownMenuItem(value: 'square', child: Text('◼️ Cuadrada')),
                DropdownMenuItem(value: 'round', child: Text('⚫ Redonda')),
                DropdownMenuItem(value: 'rect', child: Text('▬ Rectangular')),
              ],
              onChanged: (v) => shape = v ?? 'square',
            ),
          ]),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
          ElevatedButton(
            onPressed: () async {
              final data = {
                'name': nameC.text,
                'capacity': int.tryParse(capC.text) ?? 4,
                'zone': zoneC.text,
                'shape': shape,
                'positionX': table?['position_x'] ?? 0,
                'positionY': table?['position_y'] ?? 0,
              };
              try {
                if (isEdit) {
                  await _api.put('/tables/${table['id']}', data);
                } else {
                  await _api.post('/tables', data);
                }
                if (ctx.mounted) Navigator.pop(ctx);
                _loadData();
                if (mounted) showToast(context, isEdit ? 'Mesa actualizada' : 'Mesa creada', type: 'success');
              } catch (e) {
                if (mounted) showToast(context, e.toString(), type: 'error');
              }
            },
            child: Text(isEdit ? '💾 Guardar' : '➕ Crear'),
          ),
        ],
      ),
    );
  }

  void _deleteTable(int? id) async {
    if (id == null) return;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('🗑️ Eliminar Mesa'),
        content: const Text('¿Eliminar esta mesa?'),
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
        await _api.delete('/tables/$id');
        _loadData();
        if (mounted) showToast(context, 'Mesa eliminada', type: 'success');
      } catch (e) {
        if (mounted) showToast(context, e.toString(), type: 'error');
      }
    }
  }
}

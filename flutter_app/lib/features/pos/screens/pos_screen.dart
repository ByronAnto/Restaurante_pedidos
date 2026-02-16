import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/widgets/app_drawer.dart';
import '../../auth/providers/auth_provider.dart';
import '../providers/pos_provider.dart';
import 'table_map_screen.dart';
import 'ordering_screen.dart';

/// Root POS screen that swaps between table map and ordering views
class PosScreen extends StatelessWidget {
  const PosScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.read<AuthProvider>().user;

    return Consumer<PosProvider>(
      builder: (context, pos, _) {
        final showOrdering = pos.currentTable != null || pos.orderType == 'takeaway' && pos.cart.isNotEmpty;

        // Show ordering if a table is selected or takeaway is active
        if (pos.currentTable != null || (pos.orderType == 'takeaway' && showOrdering)) {
          return Scaffold(
            body: const OrderingScreen(),
            drawer: AppDrawer(currentPage: 'pos', user: user),
          );
        }

        // Otherwise show table map
        return const TableMapScreen();
      },
    );
  }
}

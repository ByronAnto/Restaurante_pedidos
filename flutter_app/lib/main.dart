import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

// Core
import 'core/api/api_client.dart';
import 'core/theme/app_theme.dart';

// Providers
import 'features/auth/providers/auth_provider.dart';
import 'features/pos/providers/pos_provider.dart';
import 'features/kitchen/providers/kitchen_provider.dart';

// Screens
import 'features/auth/screens/server_setup_screen.dart';
import 'features/auth/screens/login_screen.dart';
import 'features/pos/screens/pos_screen.dart';
import 'features/pos/screens/sales_history_screen.dart';
import 'features/kitchen/screens/kitchen_screen.dart';
import 'features/products/screens/products_screen.dart';
import 'features/inventory/screens/inventory_screen.dart';
import 'features/recipes/screens/recipes_screen.dart';
import 'features/investments/screens/investments_screen.dart';
import 'features/payroll/screens/payroll_screen.dart';
import 'features/reports/screens/reports_screen.dart';
import 'features/users/screens/users_screen.dart';
import 'features/config/screens/config_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize ApiClient base URL from saved preferences
  await ApiClient().initBaseUrl();
  final serverConfigured = await ApiClient.isServerConfigured();

  runApp(RestaurantePosApp(serverConfigured: serverConfigured));
}

class RestaurantePosApp extends StatelessWidget {
  final bool serverConfigured;

  const RestaurantePosApp({super.key, required this.serverConfigured});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => PosProvider()),
        ChangeNotifierProvider(create: (_) => KitchenProvider()),
      ],
      child: Consumer<AuthProvider>(
        builder: (context, auth, _) {
          // Determine the home screen based on server config and auth state
          Widget home;
          if (!serverConfigured) {
            home = const ServerSetupScreen();
          } else if (auth.isLoggedIn) {
            home = const PosScreen();
          } else {
            home = const LoginScreen();
          }

          return MaterialApp(
            title: 'RestaurantePOS',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.darkTheme,
            navigatorKey: auth.navigatorKey,
            home: home,
            routes: {
              '/server-setup': (_) => const ServerSetupScreen(),
              '/login': (_) => const LoginScreen(),
              '/pos': (_) => const PosScreen(),
              '/sales-history': (_) => const SalesHistoryScreen(),
              '/kitchen': (_) => const KitchenScreen(),
              '/products': (_) => const ProductsScreen(),
              '/inventory': (_) => const InventoryScreen(),
              '/recipes': (_) => const RecipesScreen(),
              '/investments': (_) => const InvestmentsScreen(),
              '/payroll': (_) => const PayrollScreen(),
              '/reports': (_) => const ReportsScreen(),
              '/users': (_) => const UsersScreen(),
              '/config': (_) => const ConfigScreen(),
            },
          );
        },
      ),
    );
  }
}

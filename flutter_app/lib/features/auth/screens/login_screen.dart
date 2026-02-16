import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_constants.dart';
import '../providers/auth_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  late AnimationController _animController;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.15),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animController, curve: Curves.easeOutCubic));
    _animController.forward();
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppConstants.bgPrimary,
              AppConstants.bgSecondary,
              AppConstants.bgPrimary.withValues(alpha: 0.95),
            ],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 28),
              child: FadeTransition(
                opacity: _fadeAnim,
                child: SlideTransition(
                  position: _slideAnim,
                  child: _buildLoginCard(),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLoginCard() {
    return Container(
      constraints: const BoxConstraints(maxWidth: 400),
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: AppConstants.bgSecondary,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppConstants.borderColor),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 30,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Logo
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppConstants.accentPrimary, AppConstants.accentSecondary],
                ),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: AppConstants.accentPrimary.withValues(alpha: 0.3),
                    blurRadius: 20,
                  ),
                ],
              ),
              child: const Center(
                child: Text('🍽️', style: TextStyle(fontSize: 36)),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'RestaurantePOS',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w800,
                color: AppConstants.accentPrimary,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Sistema de Gestión',
              style: TextStyle(fontSize: 13, color: AppConstants.textMuted),
            ),
            const SizedBox(height: 32),

            // Username
            TextFormField(
              controller: _usernameController,
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.person_outline, color: AppConstants.textMuted),
                hintText: 'Usuario',
              ),
              validator: (v) => (v == null || v.isEmpty) ? 'Requerido' : null,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 16),

            // Password
            TextFormField(
              controller: _passwordController,
              obscureText: _obscurePassword,
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.lock_outline, color: AppConstants.textMuted),
                hintText: 'Contraseña',
                suffixIcon: IconButton(
                  onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                  icon: Icon(
                    _obscurePassword ? Icons.visibility_off : Icons.visibility,
                    color: AppConstants.textMuted,
                  ),
                ),
              ),
              validator: (v) => (v == null || v.isEmpty) ? 'Requerido' : null,
              onFieldSubmitted: (_) => _submit(),
            ),
            const SizedBox(height: 8),

            // Error
            Consumer<AuthProvider>(
              builder: (_, auth, __) {
                if (auth.error != null) {
                  return Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppConstants.danger.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppConstants.danger.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        children: [
                          const Text('❌', style: TextStyle(fontSize: 14)),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              auth.error!,
                              style: const TextStyle(
                                fontSize: 13,
                                color: AppConstants.danger,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }
                return const SizedBox.shrink();
              },
            ),
            const SizedBox(height: 24),

            // Button
            Consumer<AuthProvider>(
              builder: (_, auth, __) {
                return SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: auth.isLoading ? null : _submit,
                    child: auth.isLoading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.black,
                            ),
                          )
                        : const Text(
                            '🔑 Iniciar Sesión',
                            style: TextStyle(fontSize: 16),
                          ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  void _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final auth = context.read<AuthProvider>();
    final success = await auth.login(
      _usernameController.text.trim(),
      _passwordController.text,
    );

    if (success && mounted) {
      Navigator.pushReplacementNamed(context, '/pos');
    }
  }
}

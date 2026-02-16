import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../constants/app_constants.dart';

class AppTheme {
  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: AppConstants.bgPrimary,
      primaryColor: AppConstants.accentPrimary,
      colorScheme: const ColorScheme.dark(
        primary: AppConstants.accentPrimary,
        secondary: AppConstants.accentSecondary,
        surface: AppConstants.bgSecondary,
        error: AppConstants.danger,
        onPrimary: Colors.black,
        onSecondary: Colors.black,
        onSurface: AppConstants.textPrimary,
        onError: Colors.white,
      ),
      textTheme: GoogleFonts.interTextTheme(
        ThemeData.dark().textTheme,
      ).apply(
        bodyColor: AppConstants.textPrimary,
        displayColor: AppConstants.textPrimary,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppConstants.bgSecondary,
        foregroundColor: AppConstants.textPrimary,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: GoogleFonts.inter(
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: AppConstants.textPrimary,
        ),
      ),
      drawerTheme: const DrawerThemeData(
        backgroundColor: AppConstants.bgSecondary,
      ),
      cardTheme: CardThemeData(
        color: AppConstants.bgSecondary,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: AppConstants.borderColor),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppConstants.bgTertiary,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppConstants.borderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppConstants.borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppConstants.accentPrimary, width: 2),
        ),
        hintStyle: const TextStyle(color: AppConstants.textMuted),
        labelStyle: const TextStyle(color: AppConstants.textSecondary),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppConstants.accentPrimary,
          foregroundColor: Colors.black,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          textStyle: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 14),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppConstants.textPrimary,
          side: const BorderSide(color: AppConstants.borderColor),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: AppConstants.accentPrimary,
        foregroundColor: Colors.black,
      ),
      dividerTheme: const DividerThemeData(
        color: AppConstants.borderColor,
        thickness: 1,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppConstants.bgTertiary,
        contentTextStyle: GoogleFonts.inter(color: AppConstants.textPrimary),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        behavior: SnackBarBehavior.floating,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppConstants.bgSecondary,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppConstants.bgSecondary,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppConstants.bgTertiary,
        selectedColor: AppConstants.accentPrimary.withValues(alpha: 0.2),
        labelStyle: GoogleFonts.inter(color: AppConstants.textPrimary, fontSize: 13),
        side: const BorderSide(color: AppConstants.borderColor),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: AppConstants.accentPrimary,
        unselectedLabelColor: AppConstants.textMuted,
        indicatorColor: AppConstants.accentPrimary,
        labelStyle: GoogleFonts.inter(fontWeight: FontWeight.w700),
      ),
    );
  }
}

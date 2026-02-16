/// Safe numeric parsing helpers for JSON values that may be num or String.

double toDouble(dynamic value, [double fallback = 0.0]) {
  if (value == null) return fallback;
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? fallback;
  return fallback;
}

int toInt(dynamic value, [int fallback = 0]) {
  if (value == null) return fallback;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? double.tryParse(value)?.toInt() ?? fallback;
  return fallback;
}

import 'package:flutter_test/flutter_test.dart';
import 'package:restaurante_pos_app/main.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const RestaurantePosApp(serverConfigured: false));
    expect(find.text('RestaurantePOS'), findsOneWidget);
  });
}

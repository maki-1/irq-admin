// Audit of the existing Flutter signup widget. Flutter's test HTTP client
// returns 400: no requests are sent to a live API. Availability checks currently
// treat that error as available, which this audit intentionally records.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:irequestd/signup_screen.dart';

Future<void> fillSignup(WidgetTester tester, String username, String password,
    {String phone = '09999999999'}) async {
  tester.view.physicalSize = const Size(600, 1200);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(const MaterialApp(home: SignUpScreen()));
  final fields = find.byType(TextField);
  await tester.enterText(fields.at(0), username);
  await tester.enterText(fields.at(1), phone);
  await tester.enterText(fields.at(3), password);
  await tester.enterText(fields.at(4), password);
  await tester.pump(const Duration(seconds: 1));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('App rejects a three-character username allowed by web', (tester) async {
    await fillSignup(tester, 'abc', 'Registration-QA-123!');
    expect(tester.widget<ElevatedButton>(find.byType(ElevatedButton)).onPressed, isNull);
  });

  testWidgets('App enables registration with short Ab1 and failed availability checks', (tester) async {
    await fillSignup(tester, 'qa_user', 'Ab1');
    expect(tester.widget<ElevatedButton>(find.byType(ElevatedButton)).onPressed, isNotNull);
  });

  testWidgets('App enables a password without a special character', (tester) async {
    await fillSignup(tester, 'qa_user', 'Abc12345');
    expect(tester.widget<ElevatedButton>(find.byType(ElevatedButton)).onPressed, isNotNull);
  });

  testWidgets('App normalizes a +63 phone number to local 09 format', (tester) async {
    await fillSignup(tester, 'qa_user', 'Registration-QA-123!', phone: '+639999999999');
    final field = tester.widget<TextField>(find.byType(TextField).at(1));
    expect(field.controller!.text.replaceAll(' ', ''), '09999999999');
  });
}

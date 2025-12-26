import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

final db = FirebaseFirestore.instance;
final auth = FirebaseAuth.instance;

String get uid => auth.currentUser!.uid;

Future<void> ensureUserDoc() async {
  final user = auth.currentUser;
  if (user == null) return;

  final ref = db.collection('users').doc(user.uid);
  final snap = await ref.get();
  if (snap.exists) return;

  await ref.set({
    'displayName': user.displayName,
    'email': user.email,
    'photoURL': user.photoURL,
    'createdAt': FieldValue.serverTimestamp(),
  });
}

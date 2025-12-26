import 'package:cloud_firestore/cloud_firestore.dart';
import '../firebase_init.dart';
import '../models/todo.dart';

CollectionReference<Map<String, dynamic>> _todoCol() =>
    db.collection('users').doc(uid).collection('todos');

Stream<List<Todo>> watchTodosByDate(DateTime date) {
  final start = DateTime(date.year, date.month, date.day);
  final end = start.add(const Duration(days: 1));

  return _todoCol()
      .where('date', isGreaterThanOrEqualTo: Timestamp.fromDate(start))
      .where('date', isLessThan: Timestamp.fromDate(end))
      .orderBy('date')
      .orderBy('priority', descending: true)
      .orderBy('createdAt', descending: true)
      .snapshots()
      .map((s) => s.docs.map(Todo.fromDoc).toList());
}

Future<void> addTodo({required String title, required DateTime date, int priority = 0}) async {
  await _todoCol().add({
    'title': title,
    'date': Timestamp.fromDate(DateTime(date.year, date.month, date.day)),
    'isDone': false,
    'priority': priority,
    'createdAt': FieldValue.serverTimestamp(),
    'updatedAt': FieldValue.serverTimestamp(),
  });
}

Future<void> toggleDone(Todo todo) async {
  await _todoCol().doc(todo.id).update({
    'isDone': !todo.isDone,
    'updatedAt': FieldValue.serverTimestamp(),
  });
}

Future<void> deleteTodo(String id) async {
  await _todoCol().doc(id).delete();
}

Future<void> updateTitle(String id, String title) async {
  await _todoCol().doc(id).update({
    'title': title,
    'updatedAt': FieldValue.serverTimestamp(),
  });
}

import 'package:cloud_firestore/cloud_firestore.dart';

class Todo {
  final String id;
  final String title;
  final DateTime date; // 날짜별 캘린더용
  final bool isDone;
  final int priority; // 0=low,1=mid,2=high
  final DateTime? createdAt;
  final DateTime? updatedAt;

  Todo({
    required this.id,
    required this.title,
    required this.date,
    required this.isDone,
    required this.priority,
    this.createdAt,
    this.updatedAt,
  });

  Map<String, dynamic> toMap() => {
    'title': title,
    'date': Timestamp.fromDate(DateTime(date.year, date.month, date.day)),
    'isDone': isDone,
    'priority': priority,
    'createdAt': createdAt == null ? FieldValue.serverTimestamp() : Timestamp.fromDate(createdAt!),
    'updatedAt': FieldValue.serverTimestamp(),
  };

  static Todo fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data()!;
    final ts = data['date'] as Timestamp;
    return Todo(
      id: doc.id,
      title: (data['title'] ?? '') as String,
      date: ts.toDate(),
      isDone: (data['isDone'] ?? false) as bool,
      priority: (data['priority'] ?? 0) as int,
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
      updatedAt: (data['updatedAt'] as Timestamp?)?.toDate(),
    );
  }
}

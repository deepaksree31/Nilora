class User {
  final int id;
  final String name;
  final String email;
  final String role;

  User({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] is int ? json['id'] as int : int.tryParse(json['id'].toString()) ?? 0,
      name: json['name'] as String? ?? 'User',
      email: json['email'] as String? ?? '',
      role: json['role'] as String? ?? 'user',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'email': email,
    'role': role,
  };
}

class AuthSession {
  final String accessToken;
  final String? refreshToken;
  final int expiresIn;
  final String role; // 'guest', 'user', or 'admin'
  final User? user;

  AuthSession({
    required this.accessToken,
    this.refreshToken,
    required this.expiresIn,
    required this.role,
    this.user,
  });

  bool get isGuest => role == 'guest';
  bool get isAuthenticated => !isGuest && user != null;

  factory AuthSession.fromJson(Map<String, dynamic> json) {
    return AuthSession(
      accessToken: json['accessToken'] as String? ?? '',
      refreshToken: json['refreshToken'] as String?,
      expiresIn: json['expiresIn'] is int ? json['expiresIn'] as int : 900,
      role: json['role'] as String? ?? (json['user'] != null ? 'user' : 'guest'),
      user: json['user'] != null ? User.fromJson(json['user'] as Map<String, dynamic>) : null,
    );
  }
}

import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';
import '../models/song.dart';
import '../models/user.dart';

class ApiException implements Exception {
  final String message;
  final String? code;
  final int statusCode;

  ApiException(this.message, {this.code, required this.statusCode});

  @override
  String toString() => 'ApiException($statusCode): $message (code: $code)';
}

class LoginRequiredException extends ApiException {
  LoginRequiredException(String message) : super(message, code: 'LOGIN_REQUIRED', statusCode: 401);
}

class ApiService {
  final String baseUrl;
  String? _authToken;

  ApiService({String? baseUrl}) : baseUrl = baseUrl ?? AppConfig.defaultApiUrl;

  void setAuthToken(String? token) {
    _authToken = token;
  }

  String? get currentToken => _authToken;

  Map<String, String> _headers({bool json = true}) {
    final map = <String, String>{};
    if (json) map['Content-Type'] = 'application/json';
    if (_authToken != null && _authToken!.isNotEmpty) {
      map['Authorization'] = 'Bearer $_authToken';
    }
    return map;
  }

  dynamic _processResponse(http.Response response) {
    dynamic body;
    try {
      body = jsonDecode(response.body);
    } catch (_) {
      body = null;
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body;
    }

    final code = body is Map ? body['code'] as String? : null;
    final message = body is Map && body['error'] != null
        ? body['error'] as String
        : 'Request failed with status ${response.statusCode}';

    if (code == 'LOGIN_REQUIRED' || (response.statusCode == 401 && code == 'LOGIN_REQUIRED')) {
      throw LoginRequiredException(message);
    }

    throw ApiException(message, code: code, statusCode: response.statusCode);
  }

  // --- Session & Auth ---

  Future<AuthSession> getGuestSession() async {
    final res = await http.post(
      Uri.parse('$baseUrl/v1/session/guest'),
      headers: _headers(),
    );
    final data = _processResponse(res) as Map<String, dynamic>;
    final session = AuthSession.fromJson(data);
    setAuthToken(session.accessToken);
    return session;
  }

  Future<Map<String, dynamic>> signup({
    required String name,
    required String email,
    required String password,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/v1/auth/signup'),
      headers: _headers(),
      body: jsonEncode({'name': name, 'email': email, 'password': password}),
    );
    return _processResponse(res) as Map<String, dynamic>;
  }

  Future<AuthSession> verify({
    required String email,
    required String code,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/v1/auth/verify'),
      headers: _headers(),
      body: jsonEncode({'email': email, 'code': code}),
    );
    final data = _processResponse(res) as Map<String, dynamic>;
    final session = AuthSession.fromJson(data);
    setAuthToken(session.accessToken);
    return session;
  }

  Future<AuthSession> login({
    required String email,
    required String password,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/v1/auth/login'),
      headers: _headers(),
      body: jsonEncode({'email': email, 'password': password}),
    );
    final data = _processResponse(res) as Map<String, dynamic>;
    final session = AuthSession.fromJson(data);
    setAuthToken(session.accessToken);
    return session;
  }

  Future<AuthSession> refreshToken(String refreshToken) async {
    final res = await http.post(
      Uri.parse('$baseUrl/v1/auth/refresh'),
      headers: _headers(),
      body: jsonEncode({'refreshToken': refreshToken}),
    );
    final data = _processResponse(res) as Map<String, dynamic>;
    final session = AuthSession.fromJson(data);
    setAuthToken(session.accessToken);
    return session;
  }

  Future<void> logout(String refreshToken) async {
    await http.post(
      Uri.parse('$baseUrl/v1/auth/logout'),
      headers: _headers(),
      body: jsonEncode({'refreshToken': refreshToken}),
    );
    setAuthToken(null);
  }

  // --- Catalog & Media ---

  Future<List<Map<String, dynamic>>> getHome() async {
    final res = await http.get(
      Uri.parse('$baseUrl/v1/home'),
      headers: _headers(json: false),
    );
    final data = _processResponse(res) as Map<String, dynamic>;
    final rawSections = data['sections'] as List? ?? [];
    return rawSections.map((sec) {
      final title = sec['title'] as String? ?? 'Featured';
      final songsList = (sec['songs'] as List? ?? [])
          .whereType<Map<String, dynamic>>()
          .map((s) => Song.fromJson(s))
          .toList();
      return {'title': title, 'songs': songsList};
    }).toList();
  }

  Future<List<Song>> searchSongs(String query) async {
    if (query.trim().length < 2) return [];
    final res = await http.get(
      Uri.parse('$baseUrl/v1/search?q=${Uri.encodeQueryComponent(query.trim())}'),
      headers: _headers(json: false),
    );
    final data = _processResponse(res) as Map<String, dynamic>;
    final raw = data['songs'] as List? ?? [];
    return raw.whereType<Map<String, dynamic>>().map((s) => Song.fromJson(s)).toList();
  }

  Future<List<Song>> getSongs({String? category, int limit = 50, int offset = 0}) async {
    final uri = Uri.parse('$baseUrl/v1/songs').replace(queryParameters: {
      if (category != null && category.isNotEmpty) 'category': category,
      'limit': limit.toString(),
      'offset': offset.toString(),
    });
    final res = await http.get(uri, headers: _headers(json: false));
    final data = _processResponse(res) as Map<String, dynamic>;
    final raw = data['songs'] as List? ?? [];
    return raw.whereType<Map<String, dynamic>>().map((s) => Song.fromJson(s)).toList();
  }

  Future<Song> getSong(int id) async {
    final res = await http.get(
      Uri.parse('$baseUrl/v1/songs/$id'),
      headers: _headers(json: false),
    );
    final data = _processResponse(res) as Map<String, dynamic>;
    return Song.fromJson(data);
  }

  // --- Tickets ---

  Future<String> getPlayTicketUrl(int songId) async {
    final res = await http.post(
      Uri.parse('$baseUrl/v1/songs/$songId/play-ticket'),
      headers: _headers(),
    );
    final data = _processResponse(res) as Map<String, dynamic>;
    return data['url'] as String;
  }

  Future<String> getDownloadTicketUrl(int songId) async {
    final res = await http.post(
      Uri.parse('$baseUrl/v1/songs/$songId/download-ticket'),
      headers: _headers(),
    );
    final data = _processResponse(res) as Map<String, dynamic>;
    return data['url'] as String;
  }

  // --- Likes ---

  Future<bool> likeSong(int songId) async {
    final res = await http.post(
      Uri.parse('$baseUrl/v1/songs/$songId/like'),
      headers: _headers(),
    );
    return res.statusCode == 200 || res.statusCode == 204;
  }

  Future<bool> unlikeSong(int songId) async {
    final res = await http.delete(
      Uri.parse('$baseUrl/v1/songs/$songId/like'),
      headers: _headers(),
    );
    return res.statusCode == 200 || res.statusCode == 204;
  }

  Future<Map<String, dynamic>> getMe() async {
    final res = await http.get(
      Uri.parse('$baseUrl/v1/me'),
      headers: _headers(json: false),
    );
    return _processResponse(res) as Map<String, dynamic>;
  }
}

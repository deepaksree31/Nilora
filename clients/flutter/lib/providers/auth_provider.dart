import 'package:flutter/foundation.dart';
import '../models/user.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';

class AuthProvider extends ChangeNotifier {
  final ApiService _apiService;
  final StorageService _storageService;

  AuthSession? _session;
  bool _isLoading = false;
  String? _errorMessage;

  AuthProvider({
    required ApiService apiService,
    required StorageService storageService,
  })  : _apiService = apiService,
        _storageService = storageService;

  AuthSession? get session => _session;
  User? get user => _session?.user;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  bool get isGuest => _session == null || _session!.isGuest;
  bool get isAuthenticated => _session != null && _session!.isAuthenticated;

  Future<void> initialize() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await _storageService.init();
      final accessToken = await _storageService.getAccessToken();
      final refreshToken = await _storageService.getRefreshToken();
      final savedUser = await _storageService.getUser();

      if (accessToken != null && savedUser != null) {
        _session = AuthSession(
          accessToken: accessToken,
          refreshToken: refreshToken,
          expiresIn: 900,
          role: savedUser.role,
          user: savedUser,
        );
        _apiService.setAuthToken(accessToken);
      } else {
        // Fallback or default: Obtain anonymous guest session
        await createGuestSession();
      }
    } catch (e) {
      _errorMessage = e.toString();
      // Ensure we at least have guest access
      try {
        await createGuestSession();
      } catch (_) {}
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> createGuestSession() async {
    final guestSession = await _apiService.getGuestSession();
    _session = guestSession;
    _apiService.setAuthToken(guestSession.accessToken);
    await _storageService.saveAuthSession(guestSession);
    notifyListeners();
  }

  Future<Map<String, dynamic>> signup({
    required String name,
    required String email,
    required String password,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final res = await _apiService.signup(name: name, email: email, password: password);
      return res;
    } catch (e) {
      _errorMessage = e.toString();
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> verify({
    required String email,
    required String code,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final newSession = await _apiService.verify(email: email, code: code);
      _session = newSession;
      await _storageService.saveAuthSession(newSession);
    } catch (e) {
      _errorMessage = e.toString();
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> login({
    required String email,
    required String password,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final newSession = await _apiService.login(email: email, password: password);
      _session = newSession;
      await _storageService.saveAuthSession(newSession);
    } catch (e) {
      _errorMessage = e.toString();
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();
    try {
      if (_session?.refreshToken != null) {
        await _apiService.logout(_session!.refreshToken!);
      }
      await _storageService.clearUserSession();
      await createGuestSession();
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}

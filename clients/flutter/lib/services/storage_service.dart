import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';

class StorageService {
  static const _keyAccessToken = 'nilora_access_token';
  static const _keyRefreshToken = 'nilora_refresh_token';
  static const _keyUser = 'nilora_user_data';
  static const _keyGuestToken = 'nilora_guest_token';
  static const _keyLocalLikes = 'nilora_guest_likes';
  static const _keyRecentSongs = 'nilora_recent_songs';

  SharedPreferences? _prefs;

  Future<void> init() async {
    _prefs ??= await SharedPreferences.getInstance();
  }

  Future<void> saveAuthSession(AuthSession session) async {
    await init();
    if (session.isGuest) {
      await _prefs?.setString(_keyGuestToken, session.accessToken);
    } else {
      await _prefs?.setString(_keyAccessToken, session.accessToken);
      if (session.refreshToken != null) {
        await _prefs?.setString(_keyRefreshToken, session.refreshToken!);
      }
      if (session.user != null) {
        await _prefs?.setString(_keyUser, jsonEncode(session.user!.toJson()));
      }
    }
  }

  Future<String?> getAccessToken() async {
    await init();
    return _prefs?.getString(_keyAccessToken);
  }

  Future<String?> getRefreshToken() async {
    await init();
    return _prefs?.getString(_keyRefreshToken);
  }

  Future<String?> getGuestToken() async {
    await init();
    return _prefs?.getString(_keyGuestToken);
  }

  Future<User?> getUser() async {
    await init();
    final userJson = _prefs?.getString(_keyUser);
    if (userJson == null) return null;
    try {
      return User.fromJson(jsonDecode(userJson) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> clearUserSession() async {
    await init();
    await _prefs?.remove(_keyAccessToken);
    await _prefs?.remove(_keyRefreshToken);
    await _prefs?.remove(_keyUser);
  }

  // Local likes for guests
  Future<Set<int>> getGuestLikes() async {
    await init();
    final list = _prefs?.getStringList(_keyLocalLikes) ?? [];
    return list.map((e) => int.tryParse(e) ?? 0).where((id) => id > 0).toSet();
  }

  Future<void> toggleGuestLike(int songId) async {
    final current = await getGuestLikes();
    if (current.contains(songId)) {
      current.remove(songId);
    } else {
      current.add(songId);
    }
    await _prefs?.setStringList(_keyLocalLikes, current.map((e) => e.toString()).toList());
  }

  Future<void> addRecentSong(int songId) async {
    await init();
    var list = _prefs?.getStringList(_keyRecentSongs) ?? [];
    list.remove(songId.toString());
    list.insert(0, songId.toString());
    if (list.length > 30) list = list.sublist(0, 30);
    await _prefs?.setStringList(_keyRecentSongs, list);
  }

  Future<List<int>> getRecentSongIds() async {
    await init();
    final list = _prefs?.getStringList(_keyRecentSongs) ?? [];
    return list.map((e) => int.tryParse(e) ?? 0).where((id) => id > 0).toList();
  }
}

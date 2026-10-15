import 'package:flutter/foundation.dart';
import '../models/song.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';

class MusicProvider extends ChangeNotifier {
  final ApiService _apiService;
  final StorageService _storageService;

  List<Map<String, dynamic>> _homeSections = [];
  List<Song> _searchResults = [];
  Set<int> _likedSongIds = {};
  bool _isLoadingHome = false;
  bool _isSearching = false;
  String? _errorMessage;

  MusicProvider({
    required ApiService apiService,
    required StorageService storageService,
  })  : _apiService = apiService,
        _storageService = storageService;

  List<Map<String, dynamic>> get homeSections => _homeSections;
  List<Song> get searchResults => _searchResults;
  Set<int> get likedSongIds => _likedSongIds;
  bool get isLoadingHome => _isLoadingHome;
  bool get isSearching => _isSearching;
  String? get errorMessage => _errorMessage;

  bool isLiked(int songId) => _likedSongIds.contains(songId);

  Future<void> loadHome() async {
    _isLoadingHome = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _homeSections = await _apiService.getHome();
      await syncLikes();
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoadingHome = false;
      notifyListeners();
    }
  }

  Future<void> search(String query) async {
    if (query.trim().length < 2) {
      _searchResults = [];
      _isSearching = false;
      notifyListeners();
      return;
    }

    _isSearching = true;
    notifyListeners();

    try {
      _searchResults = await _apiService.searchSongs(query);
    } catch (e) {
      _errorMessage = e.toString();
      _searchResults = [];
    } finally {
      _isSearching = false;
      notifyListeners();
    }
  }

  Future<void> syncLikes({bool isAuthenticated = false}) async {
    if (isAuthenticated) {
      try {
        final me = await _apiService.getMe();
        final rawLikes = me['likes'] as List? ?? [];
        _likedSongIds = rawLikes.map((e) => int.tryParse(e.toString()) ?? 0).where((id) => id > 0).toSet();
      } catch (_) {
        _likedSongIds = await _storageService.getGuestLikes();
      }
    } else {
      _likedSongIds = await _storageService.getGuestLikes();
    }
    notifyListeners();
  }

  Future<void> toggleLike(int songId, {required bool isAuthenticated}) async {
    final alreadyLiked = isLiked(songId);

    // Optimistic UI update
    if (alreadyLiked) {
      _likedSongIds.remove(songId);
    } else {
      _likedSongIds.add(songId);
    }
    notifyListeners();

    try {
      if (isAuthenticated) {
        if (alreadyLiked) {
          await _apiService.unlikeSong(songId);
        } else {
          await _apiService.likeSong(songId);
        }
      } else {
        await _storageService.toggleGuestLike(songId);
      }
    } catch (e) {
      // Revert if failed
      if (alreadyLiked) {
        _likedSongIds.add(songId);
      } else {
        _likedSongIds.remove(songId);
      }
      notifyListeners();
    }
  }
}

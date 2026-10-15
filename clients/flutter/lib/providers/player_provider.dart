import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/song.dart';
import '../services/audio_player_service.dart';
import '../services/storage_service.dart';

class PlayerProvider extends ChangeNotifier {
  final AudioPlayerService _audioService;
  final StorageService _storageService;

  List<Song> _queue = [];
  int _currentIndex = -1;

  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  PlaybackStatus _status = PlaybackStatus.idle;

  StreamSubscription? _posSub;
  StreamSubscription? _durSub;
  StreamSubscription? _statSub;

  PlayerProvider({
    required AudioPlayerService audioService,
    required StorageService storageService,
  })  : _audioService = audioService,
        _storageService = storageService {
    _init();
  }

  void _init() {
    _posSub = _audioService.positionStream.listen((p) {
      _position = p;
      notifyListeners();
    });

    _durSub = _audioService.durationStream.listen((d) {
      if (d != null) {
        _duration = d;
        notifyListeners();
      }
    });

    _statSub = _audioService.statusStream.listen((s) {
      _status = s;
      if (s == PlaybackStatus.completed) {
        playNext();
      }
      notifyListeners();
    });
  }

  Song? get currentSong => _audioService.currentSong;
  PlaybackStatus get status => _status;
  bool get isPlaying => _status == PlaybackStatus.playing;
  bool get isLoading => _status == PlaybackStatus.loading;
  Duration get position => _position;
  Duration get duration => _duration;
  List<Song> get queue => _queue;
  int get currentIndex => _currentIndex;

  Future<void> playSong(Song song, {List<Song>? contextQueue}) async {
    if (contextQueue != null && contextQueue.isNotEmpty) {
      _queue = List.from(contextQueue);
      _currentIndex = _queue.indexWhere((s) => s.id == song.id);
    } else {
      if (!_queue.any((s) => s.id == song.id)) {
        _queue.add(song);
      }
      _currentIndex = _queue.indexWhere((s) => s.id == song.id);
    }

    await _storageService.addRecentSong(song.id);
    await _audioService.playSong(song);
    notifyListeners();
  }

  Future<void> togglePlayPause() async {
    await _audioService.togglePlayPause();
    notifyListeners();
  }

  Future<void> seek(Duration pos) async {
    await _audioService.seek(pos);
  }

  Future<void> playNext() async {
    if (_queue.isEmpty || _currentIndex == -1) return;
    if (_currentIndex + 1 < _queue.length) {
      _currentIndex++;
      await playSong(_queue[_currentIndex]);
    }
  }

  Future<void> playPrevious() async {
    if (_queue.isEmpty || _currentIndex == -1) return;
    if (_position.inSeconds > 3) {
      await seek(Duration.zero);
      return;
    }
    if (_currentIndex - 1 >= 0) {
      _currentIndex--;
      await playSong(_queue[_currentIndex]);
    }
  }

  @override
  void dispose() {
    _posSub?.cancel();
    _durSub?.cancel();
    _statSub?.cancel();
    _audioService.dispose();
    super.dispose();
  }
}

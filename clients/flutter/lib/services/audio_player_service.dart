import 'dart:async';
import 'package:just_audio/just_audio.dart';
import '../models/song.dart';
import 'api_service.dart';

enum PlaybackStatus {
  idle,
  loading,
  playing,
  paused,
  completed,
  error,
}

class AudioPlayerService {
  final AudioPlayer _player = AudioPlayer();
  final ApiService _apiService;

  Song? _currentSong;
  PlaybackStatus _status = PlaybackStatus.idle;
  String? _errorMessage;

  final _statusController = StreamController<PlaybackStatus>.broadcast();
  final _songController = StreamController<Song?>.broadcast();

  AudioPlayerService({required ApiService apiService}) : _apiService = apiService {
    _initListeners();
  }

  void _initListeners() {
    _player.playerStateStream.listen((state) {
      if (state.processingState == ProcessingState.loading ||
          state.processingState == ProcessingState.buffering) {
        _setStatus(PlaybackStatus.loading);
      } else if (state.processingState == ProcessingState.completed) {
        _setStatus(PlaybackStatus.completed);
      } else if (state.playing) {
        _setStatus(PlaybackStatus.playing);
      } else {
        _setStatus(PlaybackStatus.paused);
      }
    });

    _player.playbackEventStream.listen(
      (_) {},
      onError: (Object e, StackTrace st) {
        _errorMessage = e.toString();
        _setStatus(PlaybackStatus.error);
      },
    );
  }

  void _setStatus(PlaybackStatus s) {
    _status = s;
    if (!_statusController.isClosed) {
      _statusController.add(s);
    }
  }

  Song? get currentSong => _currentSong;
  PlaybackStatus get status => _status;
  bool get isPlaying => _status == PlaybackStatus.playing;
  String? get errorMessage => _errorMessage;

  Stream<PlaybackStatus> get statusStream => _statusController.stream;
  Stream<Song?> get songStream => _songController.stream;
  Stream<Duration> get positionStream => _player.positionStream;
  Stream<Duration?> get durationStream => _player.durationStream;

  Duration get currentPosition => _player.position;
  Duration? get totalDuration => _player.duration;

  Future<void> playSong(Song song) async {
    try {
      _currentSong = song;
      _errorMessage = null;
      if (!_songController.isClosed) _songController.add(song);
      _setStatus(PlaybackStatus.loading);

      // 1. Fetch short-lived HMAC signed play ticket
      final ticketUrl = await _apiService.getPlayTicketUrl(song.id);

      // 2. Load audio stream with Range support
      await _player.setUrl(ticketUrl);
      await _player.play();
    } catch (e) {
      _errorMessage = 'Playback error: $e';
      _setStatus(PlaybackStatus.error);
    }
  }

  Future<void> resume() async {
    if (_status == PlaybackStatus.paused) {
      await _player.play();
    }
  }

  Future<void> pause() async {
    if (_status == PlaybackStatus.playing) {
      await _player.pause();
    }
  }

  Future<void> togglePlayPause() async {
    if (isPlaying) {
      await pause();
    } else {
      await resume();
    }
  }

  Future<void> seek(Duration position) async {
    await _player.seek(position);
  }

  Future<void> stop() async {
    await _player.stop();
    _currentSong = null;
    _setStatus(PlaybackStatus.idle);
    if (!_songController.isClosed) _songController.add(null);
  }

  void dispose() {
    _player.dispose();
    _statusController.close();
    _songController.close();
  }
}

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config.dart';
import '../models/song.dart';
import '../providers/auth_provider.dart';
import '../providers/music_provider.dart';
import '../providers/player_provider.dart';
import '../services/api_service.dart';
import '../widgets/auth_dialog.dart';

class NowPlayingScreen extends StatelessWidget {
  const NowPlayingScreen({super.key});

  String _formatDuration(Duration d) {
    final m = d.inMinutes;
    final s = d.inSeconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  Future<void> _handleDownload(BuildContext context, Song song) async {
    final auth = context.read<AuthProvider>();
    if (auth.isGuest) {
      await AuthDialog.show(
        context,
        title: 'Sign In to Download',
        subtitle: 'Guests can stream unlimited full songs, but downloading requires a free account.',
      );
      return;
    }

    try {
      final api = context.read<ApiService>();
      final downloadUrl = await api.getDownloadTicketUrl(song.id);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Download ticket ready! Fetching "${song.title}"...'),
            backgroundColor: const Color(0xFF6366F1),
          ),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Download failed: $e'), backgroundColor: Colors.redAccent),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final player = context.watch<PlayerProvider>();
    final music = context.watch<MusicProvider>();
    final auth = context.watch<AuthProvider>();
    final song = player.currentSong;

    if (song == null) {
      return const Scaffold(
        backgroundColor: Color(0xFF0F0F14),
        body: Center(child: Text('No song playing', style: TextStyle(color: Colors.white70))),
      );
    }

    final isLiked = music.isLiked(song.id);
    final coverUrl = song.coverUrl ?? AppConfig.defaultCoverPlaceholder;

    return Scaffold(
      backgroundColor: const Color(0xFF0F0F14),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.keyboard_arrow_down, color: Colors.white, size: 30),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text('NOW PLAYING', style: TextStyle(color: Colors.white70, fontSize: 13, letterSpacing: 2)),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              // Cover Artwork
              Center(
                child: Hero(
                  tag: 'cover_${song.id}',
                  child: Container(
                    width: 280,
                    height: 280,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: (song.bgColor != null
                                  ? Color(int.tryParse('0xFF${song.bgColor!.replaceAll('#', '')}') ?? 0xFF6366F1)
                                  : const Color(0xFF6366F1))
                              .withOpacity(0.3),
                          blurRadius: 30,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Image.network(
                      coverUrl,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Container(
                        color: const Color(0xFF282836),
                        child: const Icon(Icons.music_note, color: Colors.white54, size: 80),
                      ),
                    ),
                  ),
                ),
              ),

              // Title, Artist, Like, and Download
              Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              song.title,
                              style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              song.artistsDisplay,
                              style: const TextStyle(color: Colors.white60, fontSize: 15),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: Icon(
                          isLiked ? Icons.favorite : Icons.favorite_border,
                          color: isLiked ? Colors.redAccent : Colors.white70,
                          size: 28,
                        ),
                        onPressed: () => music.toggleLike(song.id, isAuthenticated: auth.isAuthenticated),
                      ),
                      IconButton(
                        icon: const Icon(Icons.download_for_offline_outlined, color: Colors.white70, size: 28),
                        onPressed: () => _handleDownload(context, song),
                      ),
                    ],
                  ),
                ],
              ),

              // Scrub Slider
              Column(
                children: [
                  SliderTheme(
                    data: SliderTheme.of(context).copyWith(
                      thumbColor: Colors.white,
                      activeTrackColor: const Color(0xFF6366F1),
                      inactiveTrackColor: Colors.white24,
                      trackHeight: 4,
                      thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                    ),
                    child: Slider(
                      min: 0,
                      max: player.duration.inMilliseconds > 0
                          ? player.duration.inMilliseconds.toDouble()
                          : (song.durationSec * 1000).toDouble(),
                      value: player.position.inMilliseconds
                          .clamp(
                            0,
                            player.duration.inMilliseconds > 0
                                ? player.duration.inMilliseconds
                                : song.durationSec * 1000,
                          )
                          .toDouble(),
                      onChanged: (val) {
                        player.seek(Duration(milliseconds: val.toInt()));
                      },
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          _formatDuration(player.position),
                          style: const TextStyle(color: Colors.white54, fontSize: 12),
                        ),
                        Text(
                          _formatDuration(
                            player.duration.inSeconds > 0
                                ? player.duration
                                : Duration(seconds: song.durationSec),
                          ),
                          style: const TextStyle(color: Colors.white54, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              // Controls: Prev, Play/Pause, Next
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  IconButton(
                    icon: const Icon(Icons.skip_previous, color: Colors.white, size: 36),
                    onPressed: () => player.playPrevious(),
                  ),
                  const SizedBox(width: 24),
                  Container(
                    width: 70,
                    height: 70,
                    decoration: const BoxDecoration(
                      color: Color(0xFF6366F1),
                      shape: BoxShape.circle,
                    ),
                    child: player.isLoading
                        ? const Center(
                            child: SizedBox(
                              width: 28,
                              height: 28,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 3),
                            ),
                          )
                        : IconButton(
                            icon: Icon(
                              player.isPlaying ? Icons.pause : Icons.play_arrow,
                              color: Colors.white,
                              size: 40,
                            ),
                            onPressed: () => player.togglePlayPause(),
                          ),
                  ),
                  const SizedBox(width: 24),
                  IconButton(
                    icon: const Icon(Icons.skip_next, color: Colors.white, size: 36),
                    onPressed: () => player.playNext(),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config.dart';
import '../models/song.dart';
import '../providers/auth_provider.dart';
import '../providers/music_provider.dart';
import '../providers/player_provider.dart';
import '../widgets/auth_dialog.dart';
import '../widgets/mini_player.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _searchController = TextEditingController();
  bool _isSearchActive = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AuthProvider>().initialize().then((_) {
        context.read<MusicProvider>().loadHome();
      });
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    context.read<MusicProvider>().search(query);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final music = context.watch<MusicProvider>();
    final player = context.watch<PlayerProvider>();

    return Scaffold(
      backgroundColor: const Color(0xFF0F0F14),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F0F14),
        elevation: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFF6366F1),
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Text(
                'NILORA',
                style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.5, fontSize: 16, color: Colors.white),
              ),
            ),
            const SizedBox(width: 8),
            const Text(
              'Music',
              style: TextStyle(color: Colors.white70, fontSize: 16, fontWeight: FontWeight.w500),
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12.0),
            child: auth.isGuest
                ? ActionChip(
                    avatar: const Icon(Icons.person_outline, size: 16, color: Colors.white70),
                    label: const Text('Guest • Sign In', style: TextStyle(color: Colors.white, fontSize: 12)),
                    backgroundColor: const Color(0xFF282836),
                    onPressed: () => AuthDialog.show(context),
                  )
                : PopupMenuButton<String>(
                    color: const Color(0xFF1E1E28),
                    child: Chip(
                      avatar: CircleAvatar(
                        backgroundColor: const Color(0xFF6366F1),
                        child: Text(
                          auth.user?.name.substring(0, 1).toUpperCase() ?? 'U',
                          style: const TextStyle(fontSize: 12, color: Colors.white),
                        ),
                      ),
                      label: Text(auth.user?.name ?? 'Account', style: const TextStyle(color: Colors.white, fontSize: 12)),
                      backgroundColor: const Color(0xFF282836),
                    ),
                    itemBuilder: (_) => [
                      PopupMenuItem(
                        value: 'logout',
                        child: const Row(
                          children: [
                            Icon(Icons.logout, color: Colors.redAccent, size: 18),
                            SizedBox(width: 8),
                            Text('Sign Out', style: TextStyle(color: Colors.redAccent)),
                          ],
                        ),
                      ),
                    ],
                    onSelected: (val) {
                      if (val == 'logout') auth.logout();
                    },
                  ),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Search Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
              child: TextField(
                controller: _searchController,
                onChanged: (q) {
                  setState(() => _isSearchActive = q.trim().isNotEmpty);
                  _onSearchChanged(q);
                },
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'Search songs, artists, albums...',
                  hintStyle: const TextStyle(color: Colors.white38),
                  prefixIcon: const Icon(Icons.search, color: Colors.white54),
                  suffixIcon: _isSearchActive
                      ? IconButton(
                          icon: const Icon(Icons.clear, color: Colors.white54),
                          onPressed: () {
                            _searchController.clear();
                            setState(() => _isSearchActive = false);
                            _onSearchChanged('');
                          },
                        )
                      : null,
                  filled: true,
                  fillColor: const Color(0xFF1E1E28),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 0),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
            ),

            // Content: Search Results OR Home Sections
            Expanded(
              child: _isSearchActive
                  ? _buildSearchResults(music, player)
                  : _buildHomeContent(music, player),
            ),

            // Bottom Mini Player
            const MiniPlayer(),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchResults(MusicProvider music, PlayerProvider player) {
    if (music.isSearching) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF6366F1)));
    }
    if (music.searchResults.isEmpty) {
      return const Center(
        child: Text('No tracks found', style: TextStyle(color: Colors.white54)),
      );
    }
    return ListView.builder(
      itemCount: music.searchResults.length,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemBuilder: (ctx, idx) {
        final song = music.searchResults[idx];
        return _buildSongTile(song, player, contextQueue: music.searchResults);
      },
    );
  }

  Widget _buildHomeContent(MusicProvider music, PlayerProvider player) {
    if (music.isLoadingHome) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF6366F1)));
    }
    if (music.errorMessage != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, color: Colors.redAccent, size: 48),
            const SizedBox(height: 12),
            Text('Could not load songs: ${music.errorMessage}',
                style: const TextStyle(color: Colors.white70), textAlign: TextAlign.center),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: () => music.loadHome(),
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (music.homeSections.isEmpty) {
      return const Center(
        child: Text('No songs in catalog yet.\nUse Admin to upload audio.',
            style: TextStyle(color: Colors.white54), textAlign: TextAlign.center),
      );
    }

    return RefreshIndicator(
      onRefresh: () => music.loadHome(),
      color: const Color(0xFF6366F1),
      child: ListView.builder(
        itemCount: music.homeSections.length,
        padding: const EdgeInsets.only(bottom: 24),
        itemBuilder: (ctx, idx) {
          final sec = music.homeSections[idx];
          final title = sec['title'] as String;
          final songs = sec['songs'] as List<Song>;
          if (songs.isEmpty) return const SizedBox.shrink();

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 12),
                child: Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 18,
                  ),
                ),
              ),
              SizedBox(
                height: 210,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  itemCount: songs.length,
                  itemBuilder: (ctx, sIdx) {
                    final song = songs[sIdx];
                    return _buildSongCard(song, player, contextQueue: songs);
                  },
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildSongCard(Song song, PlayerProvider player, {required List<Song> contextQueue}) {
    final coverUrl = song.coverUrl ?? AppConfig.defaultCoverPlaceholder;
    final isCurrent = player.currentSong?.id == song.id;

    return GestureDetector(
      onTap: () => player.playSong(song, contextQueue: contextQueue),
      child: Container(
        width: 140,
        margin: const EdgeInsets.symmetric(horizontal: 6),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.network(
                    coverUrl,
                    width: 140,
                    height: 140,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      width: 140,
                      height: 140,
                      color: const Color(0xFF282836),
                      child: const Icon(Icons.music_note, color: Colors.white54, size: 40),
                    ),
                  ),
                ),
                if (isCurrent)
                  Positioned.fill(
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.black45,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Center(
                        child: Icon(Icons.equalizer, color: Color(0xFF6366F1), size: 36),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              song.title,
              style: TextStyle(
                color: isCurrent ? const Color(0xFF818CF8) : Colors.white,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 2),
            Text(
              song.artistsDisplay,
              style: const TextStyle(color: Colors.white54, fontSize: 11),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSongTile(Song song, PlayerProvider player, {required List<Song> contextQueue}) {
    final coverUrl = song.coverUrl ?? AppConfig.defaultCoverPlaceholder;
    final isCurrent = player.currentSong?.id == song.id;

    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      leading: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Image.network(
          coverUrl,
          width: 48,
          height: 48,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Container(
            width: 48,
            height: 48,
            color: const Color(0xFF282836),
            child: const Icon(Icons.music_note, color: Colors.white54),
          ),
        ),
      ),
      title: Text(
        song.title,
        style: TextStyle(
          color: isCurrent ? const Color(0xFF818CF8) : Colors.white,
          fontWeight: FontWeight.w600,
        ),
      ),
      subtitle: Text(song.artistsDisplay, style: const TextStyle(color: Colors.white54)),
      trailing: Text(song.formattedDuration, style: const TextStyle(color: Colors.white38, fontSize: 12)),
      onTap: () => player.playSong(song, contextQueue: contextQueue),
    );
  }
}

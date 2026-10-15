class Artist {
  final String name;
  final String? type;

  Artist({required this.name, this.type});

  factory Artist.fromJson(Map<String, dynamic> json) {
    return Artist(
      name: json['name'] as String? ?? 'Unknown Artist',
      type: json['type'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'name': name,
    'type': type,
  };
}

class CategoryRef {
  final String name;
  final String? sub;

  CategoryRef({required this.name, this.sub});

  factory CategoryRef.fromJson(Map<String, dynamic> json) {
    return CategoryRef(
      name: json['name'] as String? ?? 'General',
      sub: json['sub'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'name': name,
    'sub': sub,
  };
}

class Song {
  final int id;
  final String title;
  final String? album;
  final int durationSec;
  final String? bgColor;
  final String? logo;
  final String? logoColor;
  final List<Artist> artists;
  final List<CategoryRef> categories;
  final String? coverUrl;
  final bool hasAudio;

  Song({
    required this.id,
    required this.title,
    this.album,
    this.durationSec = 0,
    this.bgColor,
    this.logo,
    this.logoColor,
    this.artists = const [],
    this.categories = const [],
    this.coverUrl,
    this.hasAudio = true,
  });

  factory Song.fromJson(Map<String, dynamic> json) {
    var rawArtists = json['artists'] as List? ?? [];
    var artistsList = rawArtists
        .whereType<Map<String, dynamic>>()
        .map((a) => Artist.fromJson(a))
        .toList();

    var rawCategories = json['categories'] as List? ?? [];
    var catList = rawCategories
        .whereType<Map<String, dynamic>>()
        .map((c) => CategoryRef.fromJson(c))
        .toList();

    return Song(
      id: json['id'] is int ? json['id'] as int : int.tryParse(json['id'].toString()) ?? 0,
      title: json['title'] as String? ?? 'Untitled',
      album: json['album'] as String?,
      durationSec: json['durationSec'] is int
          ? json['durationSec'] as int
          : int.tryParse(json['durationSec']?.toString() ?? '0') ?? 0,
      bgColor: json['bgColor'] as String?,
      logo: json['logo'] as String?,
      logoColor: json['logoColor'] as String?,
      artists: artistsList,
      categories: catList,
      coverUrl: json['coverUrl'] as String?,
      hasAudio: json['hasAudio'] as bool? ?? true,
    );
  }

  String get artistsDisplay {
    if (artists.isEmpty) return 'Various Artists';
    return artists.map((a) => a.name).join(', ');
  }

  String get formattedDuration {
    final minutes = durationSec ~/ 60;
    final seconds = durationSec % 60;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }
}

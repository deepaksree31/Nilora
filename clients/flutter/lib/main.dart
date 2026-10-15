import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'config.dart';
import 'providers/auth_provider.dart';
import 'providers/music_provider.dart';
import 'providers/player_provider.dart';
import 'screens/home_screen.dart';
import 'services/api_service.dart';
import 'services/audio_player_service.dart';
import 'services/storage_service.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  final storageService = StorageService();
  final apiService = ApiService();
  final audioService = AudioPlayerService(apiService: apiService);

  runApp(
    MultiProvider(
      providers: [
        Provider<StorageService>.value(value: storageService),
        Provider<ApiService>.value(value: apiService),
        ChangeNotifierProvider(
          create: (_) => AuthProvider(
            apiService: apiService,
            storageService: storageService,
          ),
        ),
        ChangeNotifierProvider(
          create: (_) => MusicProvider(
            apiService: apiService,
            storageService: storageService,
          ),
        ),
        ChangeNotifierProvider(
          create: (_) => PlayerProvider(
            audioService: audioService,
            storageService: storageService,
          ),
        ),
      ],
      child: const NiloraApp(),
    ),
  );
}

class NiloraApp extends StatelessWidget {
  const NiloraApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppConfig.appTitle,
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0F0F14),
        primaryColor: const Color(0xFF6366F1),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF6366F1),
          secondary: Color(0xFF818CF8),
          surface: Color(0xFF1E1E28),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF0F0F14),
          elevation: 0,
        ),
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}

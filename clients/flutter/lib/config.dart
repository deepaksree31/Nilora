class AppConfig {
  static const String defaultApiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://localhost:8080',
  );

  static const String appTitle = 'NILORA';
  static const String defaultCoverPlaceholder = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60';
}

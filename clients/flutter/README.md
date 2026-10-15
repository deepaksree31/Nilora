# NILORA Flutter Client

Cross-platform music streaming app for NILORA (Android, iOS, Windows, macOS, Linux, and Web).

## Features
- **Guest-first experience:** Instant streaming without logging in. The app automatically fetches an anonymous guest session (`POST /v1/session/guest`).
- **Ticket-based audio playback:** Plays audio via short-lived HMAC signed play tickets (`POST /v1/songs/:id/play-ticket`) with HTTP Range seeking.
- **Login gating:** Tapping "Download" or "Like" presents an authentication prompt (`AuthDialog`) to sign in or register before downloading.
- **Dark aesthetic:** Modern dark design matching NILORA's design system.
- **Local persistence:** Stores tokens and guest favorites locally with `SharedPreferences`.

## Prerequisites
- Flutter SDK (3.0+)
- NILORA backend running (default `http://localhost:8080`)

## Running the App

1. Install dependencies:
   ```bash
   flutter pub get
   ```

2. Run on your target platform:
   - **Web:** `flutter run -d chrome`
   - **Windows:** `flutter run -d windows`
   - **Android emulator/device:** `flutter run -d android`
   - **iOS simulator:** `flutter run -d ios`

3. Custom API URL (optional):
   ```bash
   flutter run --dart-define=API_URL=http://192.168.1.100:8080
   ```

## Directory Structure
- `lib/config.dart`: App configuration and API host defaults.
- `lib/models/`: Strongly-typed `Song`, `Artist`, `User`, `AuthSession` models.
- `lib/services/`:
  - `api_service.dart`: HTTP calls for NILORA API v1.
  - `audio_player_service.dart`: `just_audio` player integration with ticket resolution.
  - `storage_service.dart`: Token and local guest likes persistence.
- `lib/providers/`: State management for Auth, Catalog/Search, and Player queue.
- `lib/screens/`:
  - `home_screen.dart`: Guest home, search, section carousels.
  - `now_playing_screen.dart`: Full-screen player with scrub slider, controls, download, and like.
- `lib/widgets/`:
  - `mini_player.dart`: Floating player bar.
  - `auth_dialog.dart`: Sign In / Sign Up / OTP Verification modal.

-- =====================================================================
-- NILORA database (MySQL 8 / MariaDB 10.5+)
-- Run:  mysql -u root -p < schema.sql
-- =====================================================================
CREATE DATABASE IF NOT EXISTS nilora CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE nilora;

-- ---------- 1. USERS (email + password) ----------
-- Passwords are NEVER stored as plain text. The backend stores a bcrypt hash.
CREATE TABLE IF NOT EXISTS users (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(80)  NOT NULL,
  email          VARCHAR(254) NOT NULL UNIQUE,
  password_hash  VARCHAR(100) NOT NULL,
  email_verified TINYINT(1)   NOT NULL DEFAULT 0,
  avatar_path    VARCHAR(255) NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 6-digit email codes (signup verification + forgot password). Code is stored hashed.
CREATE TABLE IF NOT EXISTS email_otps (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email       VARCHAR(254) NOT NULL,
  purpose     ENUM('verify','reset') NOT NULL,
  code_hash   VARCHAR(100) NOT NULL,
  -- signup data waits here until the email is verified
  pending_name VARCHAR(80)  NULL,
  pending_hash VARCHAR(100) NULL,
  attempts    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at  DATETIME NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_otp_email (email, purpose)
) ENGINE=InnoDB;

-- ---------- 2. ADMINS (admin panel login) ----------
CREATE TABLE IF NOT EXISTS admins (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- 3. MUSIC (uploaded in the admin panel) ----------
-- Audio and image FILES are saved in the /uploads folder on the server.
-- The database stores only the file path (e.g. "audio/17123-song.mp3").

CREATE TABLE IF NOT EXISTS categories (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(30) NOT NULL UNIQUE,
  bg_color    CHAR(7)     NULL,            -- "#1e3264"
  image_path  VARCHAR(255) NULL,
  sort_order  INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS subcategories (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id INT UNSIGNED NOT NULL,
  name        VARCHAR(30)  NOT NULL,
  UNIQUE KEY uq_sub (category_id, name),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Admin panel has 3 artist columns: Male / Female / Music
CREATE TABLE IF NOT EXISTS artists (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(60) NOT NULL,
  type        ENUM('male','female','music') NOT NULL,
  image_path  VARCHAR(255) NULL,
  UNIQUE KEY uq_artist (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS songs (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title         VARCHAR(150) NOT NULL,
  album         VARCHAR(150) NOT NULL DEFAULT 'Single',
  duration_sec  INT UNSIGNED NOT NULL DEFAULT 180,
  bg_color      CHAR(7)      NULL,          -- card background colour
  logo          VARCHAR(16)  NOT NULL DEFAULT '♪',   -- emoji / letters
  logo_color    CHAR(7)      NULL,
  cover_path    VARCHAR(255) NULL,          -- uploaded image
  audio_path    VARCHAR(255) NULL,          -- uploaded audio
  audio_mime    VARCHAR(60)  NULL,
  audio_size    BIGINT UNSIGNED NULL,
  is_hidden     TINYINT(1)   NOT NULL DEFAULT 0,   -- "Hide" button in admin
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_song_title (title)
) ENGINE=InnoDB;

-- A song can have many artists (male + female + music)
CREATE TABLE IF NOT EXISTS song_artists (
  song_id   INT UNSIGNED NOT NULL,
  artist_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (song_id, artist_id),
  FOREIGN KEY (song_id)   REFERENCES songs(id)   ON DELETE CASCADE,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- A song can be in many categories (and optionally a subcategory)
CREATE TABLE IF NOT EXISTS song_categories (
  song_id        INT UNSIGNED NOT NULL,
  category_id    INT UNSIGNED NOT NULL,
  subcategory_id INT UNSIGNED NOT NULL DEFAULT 0,   -- 0 = whole category
  PRIMARY KEY (song_id, category_id, subcategory_id),
  FOREIGN KEY (song_id)     REFERENCES songs(id)       ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id)  ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- 4. USER ACTIVITY ----------
CREATE TABLE IF NOT EXISTS user_likes (
  user_id INT UNSIGNED NOT NULL,
  song_id INT UNSIGNED NOT NULL,
  liked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, song_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_downloads (
  user_id INT UNSIGNED NOT NULL,
  song_id INT UNSIGNED NOT NULL,
  downloaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, song_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS play_history (
  id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id   INT UNSIGNED NOT NULL,
  song_id   INT UNSIGNED NOT NULL,
  played_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_hist (user_id, played_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- 5. STARTER DATA (same 4 categories + 12 songs as your HTML) ----------
INSERT IGNORE INTO categories (name, sort_order) VALUES
 ('Synthwave',1),('Chill',2),('Workout',3),('Indie',4);

INSERT IGNORE INTO artists (name, type) VALUES
 ('Neon Echo','music'),('Luna Park','female'),('The Voltage','music'),
 ('Aria Moon','female'),('Kid Atlas','male'),('Wanderers','music');

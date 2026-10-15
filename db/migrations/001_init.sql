-- NILORA schema v1 (MySQL 8). Runs automatically on the first start of the mysql container.
-- The database itself is created by the container from MYSQL_DATABASE.
-- Song FILES live in MinIO; this database stores only keys (audio_key, cover_key), never URLs.

CREATE TABLE users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(80)  NOT NULL,
  email         VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,           -- bcrypt hash, never the password
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE admins (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE categories (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(30) NOT NULL UNIQUE,
  bg_color   CHAR(7) NULL,
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE subcategories (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id INT UNSIGNED NOT NULL,
  name        VARCHAR(30) NOT NULL,
  UNIQUE KEY uq_sub (category_id, name),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE artists (
  id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE,
  type ENUM('male','female','music') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE songs (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title        VARCHAR(150) NOT NULL,
  album        VARCHAR(150) NOT NULL DEFAULT 'Single',
  duration_sec INT UNSIGNED NOT NULL DEFAULT 180,
  bg_color     CHAR(7) NULL,
  logo         VARCHAR(16) NOT NULL DEFAULT '♪',
  logo_color   CHAR(7) NULL,
  audio_key    VARCHAR(255) NULL,   -- e.g. audio/17/original   (bucket nilora-audio)
  audio_mime   VARCHAR(60)  NULL,
  audio_size   BIGINT UNSIGNED NULL,
  cover_key    VARCHAR(255) NULL,   -- e.g. images/17/cover     (bucket nilora-images)
  is_hidden    TINYINT(1) NOT NULL DEFAULT 0,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_song_title (title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE song_artists (
  song_id   INT UNSIGNED NOT NULL,
  artist_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (song_id, artist_id),
  FOREIGN KEY (song_id)   REFERENCES songs(id)   ON DELETE CASCADE,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE song_categories (
  song_id        INT UNSIGNED NOT NULL,
  category_id    INT UNSIGNED NOT NULL,
  subcategory_id INT UNSIGNED NOT NULL DEFAULT 0,   -- 0 = the whole category
  PRIMARY KEY (song_id, category_id, subcategory_id),
  FOREIGN KEY (song_id)     REFERENCES songs(id)      ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_likes (
  user_id INT UNSIGNED NOT NULL,
  song_id INT UNSIGNED NOT NULL,
  liked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, song_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_downloads (
  user_id INT UNSIGNED NOT NULL,
  song_id INT UNSIGNED NOT NULL,
  downloaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, song_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE play_history (
  id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id   INT UNSIGNED NOT NULL,
  song_id   INT UNSIGNED NOT NULL,
  played_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_hist (user_id, played_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO categories (name, sort_order) VALUES ('Synthwave',1),('Chill',2),('Workout',3),('Indie',4);

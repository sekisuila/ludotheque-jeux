-- V6.24 — Abalone multijoueur : pendules, Elo et archives

CREATE TABLE IF NOT EXISTS abalone_ratings (
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 1200,
  games INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id, category),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_abalone_ratings_category
ON abalone_ratings(category, rating DESC);

CREATE TABLE IF NOT EXISTS abalone_results (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL,
  game_number INTEGER NOT NULL DEFAULT 1,
  black_user_id TEXT NOT NULL,
  white_user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  rated INTEGER NOT NULL DEFAULT 1,
  result TEXT NOT NULL,
  reason TEXT,
  black_rating_before INTEGER,
  white_rating_before INTEGER,
  black_rating_after INTEGER,
  white_rating_after INTEGER,
  black_delta INTEGER,
  white_delta INTEGER,
  game_json TEXT,
  time_initial_seconds INTEGER,
  time_increment_seconds INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(room_code, game_number),
  FOREIGN KEY(black_user_id) REFERENCES users(id),
  FOREIGN KEY(white_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_abalone_results_black ON abalone_results(black_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_abalone_results_white ON abalone_results(white_user_id, created_at DESC);

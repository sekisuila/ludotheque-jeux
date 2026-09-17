-- V6.18 — Dames multijoueur : Elo + archive/relecture

CREATE TABLE IF NOT EXISTS checkers_ratings (
  user_id TEXT NOT NULL,
  variant TEXT NOT NULL CHECK (variant IN ('international','english')),
  category TEXT NOT NULL CHECK (category IN ('bullet','blitz','rapid','classical')),
  rating INTEGER NOT NULL DEFAULT 1200,
  games INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, variant, category),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_checkers_ratings_board
ON checkers_ratings(variant, category, rating DESC, games DESC);

CREATE TABLE IF NOT EXISTS checkers_results (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL,
  game_number INTEGER NOT NULL,
  variant TEXT NOT NULL CHECK (variant IN ('international','english')),
  side0_user_id TEXT NOT NULL,
  side1_user_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('bullet','blitz','rapid','classical')),
  rated INTEGER NOT NULL DEFAULT 0,
  result TEXT NOT NULL,
  reason TEXT NOT NULL,
  side0_rating_before INTEGER,
  side1_rating_before INTEGER,
  side0_rating_after INTEGER,
  side1_rating_after INTEGER,
  side0_delta INTEGER,
  side1_delta INTEGER,
  game_json TEXT,
  time_initial_seconds INTEGER,
  time_increment_seconds INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(room_code, game_number),
  FOREIGN KEY (side0_user_id) REFERENCES users(id),
  FOREIGN KEY (side1_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_checkers_results_side0 ON checkers_results(side0_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkers_results_side1 ON checkers_results(side1_user_id, created_at DESC);

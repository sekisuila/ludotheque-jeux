-- V6.28 — 421 : classement Elo et archives multijoueurs
CREATE TABLE IF NOT EXISTS jeu421_ratings (
  user_id TEXT PRIMARY KEY,
  rating INTEGER NOT NULL DEFAULT 1200,
  games INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_jeu421_ratings_rating ON jeu421_ratings(rating DESC);

CREATE TABLE IF NOT EXISTS jeu421_results (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL,
  game_number INTEGER NOT NULL DEFAULT 1,
  player0_user_id TEXT NOT NULL,
  player1_user_id TEXT NOT NULL,
  rated INTEGER NOT NULL DEFAULT 1,
  result TEXT NOT NULL,
  reason TEXT,
  player0_tokens INTEGER,
  player1_tokens INTEGER,
  player0_rating_before INTEGER,
  player1_rating_before INTEGER,
  player0_rating_after INTEGER,
  player1_rating_after INTEGER,
  player0_delta INTEGER,
  player1_delta INTEGER,
  game_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(room_code, game_number),
  FOREIGN KEY(player0_user_id) REFERENCES users(id),
  FOREIGN KEY(player1_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_jeu421_results_p0 ON jeu421_results(player0_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jeu421_results_p1 ON jeu421_results(player1_user_id, created_at DESC);

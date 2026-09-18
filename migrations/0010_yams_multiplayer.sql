-- V6.26 — Yams : classement Elo et archives multijoueurs

CREATE TABLE IF NOT EXISTS yams_ratings (
  user_id TEXT PRIMARY KEY,
  rating INTEGER NOT NULL DEFAULT 1200,
  games INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_yams_ratings_rating ON yams_ratings(rating DESC);

CREATE TABLE IF NOT EXISTS yams_results (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL,
  game_number INTEGER NOT NULL DEFAULT 1,
  player0_user_id TEXT NOT NULL,
  player1_user_id TEXT NOT NULL,
  rated INTEGER NOT NULL DEFAULT 1,
  result TEXT NOT NULL,
  reason TEXT,
  player0_score INTEGER,
  player1_score INTEGER,
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

CREATE INDEX IF NOT EXISTS idx_yams_results_p0 ON yams_results(player0_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_yams_results_p1 ON yams_results(player1_user_id, created_at DESC);

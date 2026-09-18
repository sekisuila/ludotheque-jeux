-- V6.21 — Go multijoueur : paramètres de salle, Elo et archive/relecture

ALTER TABLE rooms ADD COLUMN go_size INTEGER;
ALTER TABLE rooms ADD COLUMN go_komi REAL;
ALTER TABLE rooms ADD COLUMN go_scoring TEXT;

CREATE TABLE IF NOT EXISTS go_ratings (
  user_id TEXT NOT NULL,
  board_size INTEGER NOT NULL CHECK (board_size IN (9,13,19)),
  category TEXT NOT NULL CHECK (category IN ('bullet','blitz','rapid','classical')),
  rating INTEGER NOT NULL DEFAULT 1200,
  games INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, board_size, category),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_go_ratings_board ON go_ratings(board_size, category, rating DESC, games DESC);

CREATE TABLE IF NOT EXISTS go_results (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL,
  game_number INTEGER NOT NULL,
  board_size INTEGER NOT NULL CHECK (board_size IN (9,13,19)),
  black_user_id TEXT NOT NULL,
  white_user_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('bullet','blitz','rapid','classical')),
  rated INTEGER NOT NULL DEFAULT 0,
  result TEXT NOT NULL,
  reason TEXT NOT NULL,
  black_rating_before INTEGER,
  white_rating_before INTEGER,
  black_rating_after INTEGER,
  white_rating_after INTEGER,
  black_delta INTEGER,
  white_delta INTEGER,
  komi REAL,
  scoring TEXT,
  game_json TEXT,
  time_initial_seconds INTEGER,
  time_increment_seconds INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(room_code, game_number),
  FOREIGN KEY (black_user_id) REFERENCES users(id),
  FOREIGN KEY (white_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_go_results_black ON go_results(black_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_go_results_white ON go_results(white_user_id, created_at DESC);

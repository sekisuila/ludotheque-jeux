-- V6.5 — Pendules, cadences et classement Elo pour les Échecs.
-- À exécuter une seule fois dans la console D1.

ALTER TABLE rooms ADD COLUMN time_initial_seconds INTEGER NOT NULL DEFAULT 600;
ALTER TABLE rooms ADD COLUMN time_increment_seconds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rooms ADD COLUMN rated INTEGER NOT NULL DEFAULT 1;
ALTER TABLE rooms ADD COLUMN rating_category TEXT NOT NULL DEFAULT 'rapid';

CREATE TABLE IF NOT EXISTS chess_ratings (
  user_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('bullet','blitz','rapid','classical')),
  rating INTEGER NOT NULL DEFAULT 1200,
  games INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id, category),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chess_ratings_category_rating
ON chess_ratings(category, rating DESC, games DESC);

CREATE TABLE IF NOT EXISTS chess_results (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL,
  game_number INTEGER NOT NULL,
  white_user_id TEXT NOT NULL,
  black_user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  rated INTEGER NOT NULL DEFAULT 1,
  result TEXT NOT NULL CHECK(result IN ('1-0','0-1','1/2-1/2')),
  reason TEXT NOT NULL,
  white_rating_before INTEGER,
  black_rating_before INTEGER,
  white_rating_after INTEGER,
  black_rating_after INTEGER,
  white_delta INTEGER,
  black_delta INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(room_code, game_number),
  FOREIGN KEY(white_user_id) REFERENCES users(id),
  FOREIGN KEY(black_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_chess_results_players
ON chess_results(white_user_id, black_user_id, created_at DESC);

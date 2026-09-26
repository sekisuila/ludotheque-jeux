-- Elo personnel aux Échecs contre Stockfish.
-- Ce classement reste séparé de l'Elo multijoueur.

CREATE TABLE IF NOT EXISTS chess_ai_ratings (
  user_id TEXT PRIMARY KEY,
  rating INTEGER NOT NULL DEFAULT 1200,
  games INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chess_ai_results (
  id TEXT PRIMARY KEY,
  client_game_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  engine_level TEXT NOT NULL,
  engine_elo INTEGER NOT NULL,
  player_color TEXT NOT NULL CHECK(player_color IN ('w','b')),
  result TEXT NOT NULL CHECK(result IN ('win','draw','loss')),
  reason TEXT NOT NULL,
  rating_before INTEGER NOT NULL,
  rating_after INTEGER NOT NULL,
  rating_delta INTEGER NOT NULL,
  move_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, client_game_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chess_ai_results_user_created
ON chess_ai_results(user_id, created_at DESC);

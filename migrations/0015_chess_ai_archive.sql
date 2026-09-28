-- Archive des parties d'Échecs contre l'IA pour relecture et analyse Stockfish.

CREATE TABLE IF NOT EXISTS chess_ai_games (
  id TEXT PRIMARY KEY,
  client_game_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  engine_level TEXT NOT NULL,
  engine_label TEXT NOT NULL,
  player_color TEXT NOT NULL CHECK(player_color IN ('w','b')),
  result TEXT NOT NULL CHECK(result IN ('win','draw','loss')),
  reason TEXT NOT NULL,
  game_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, client_game_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chess_ai_games_user_created
ON chess_ai_games(user_id, created_at DESC);

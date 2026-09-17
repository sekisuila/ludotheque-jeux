-- V6.6 — Archivage et relecture des parties d’Échecs
-- À exécuter une seule fois dans la console D1.

ALTER TABLE chess_results ADD COLUMN game_json TEXT;
ALTER TABLE chess_results ADD COLUMN time_initial_seconds INTEGER;
ALTER TABLE chess_results ADD COLUMN time_increment_seconds INTEGER;

CREATE INDEX IF NOT EXISTS idx_chess_results_white_created
ON chess_results(white_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chess_results_black_created
ON chess_results(black_user_id, created_at DESC);

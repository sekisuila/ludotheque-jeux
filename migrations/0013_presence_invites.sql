-- Présence des joueurs et invitations directes.
-- La présence est volontairement éphémère : le client envoie un heartbeat régulier.
CREATE TABLE IF NOT EXISTS online_presence (
  user_id TEXT PRIMARY KEY,
  last_seen INTEGER NOT NULL,
  page TEXT,
  game TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_online_presence_last_seen
  ON online_presence(last_seen);

CREATE TABLE IF NOT EXISTS game_invites (
  id TEXT PRIMARY KEY,
  inviter_id TEXT NOT NULL,
  invitee_id TEXT NOT NULL,
  game TEXT NOT NULL,
  room_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','accepted','declined','expired','cancelled')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  responded_at INTEGER,
  FOREIGN KEY(inviter_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(invitee_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_game_invites_invitee_status
  ON game_invites(invitee_id,status,expires_at);

CREATE INDEX IF NOT EXISTS idx_game_invites_inviter_status
  ON game_invites(inviter_id,status,expires_at);

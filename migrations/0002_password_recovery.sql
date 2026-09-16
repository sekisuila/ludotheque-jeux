-- V6.2 : clé de récupération de mot de passe.
-- À exécuter UNE SEULE FOIS dans Cloudflare D1 > Console.

ALTER TABLE users ADD COLUMN recovery_key_hash TEXT;
ALTER TABLE users ADD COLUMN recovery_key_created_at TEXT;

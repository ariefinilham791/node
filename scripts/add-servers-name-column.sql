-- Add optional "Name" / "Host name" field for server info (run once)
ALTER TABLE servers ADD COLUMN name VARCHAR(255) NULL AFTER hostname;

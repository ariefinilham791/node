-- Add optional "Name" / "Host name" field for server info.
-- Run once di database Anda. Jika kolom belum ada, aplikasi tetap jalan tapi field Name
-- akan kosong; setelah script ini dijalankan, field Name akan tersimpan dan tampil.
ALTER TABLE servers ADD COLUMN name VARCHAR(255) NULL AFTER hostname;

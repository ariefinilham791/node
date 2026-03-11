-- Jalankan di database db_server untuk membuat tabel users
-- Contoh: mysql -h 103.150.226.141 -P 3306 -u app_user -p db_server < scripts/init-users-table.sql

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contoh user untuk testing (password: admin123)
-- Untuk production, gunakan password yang di-hash dengan bcrypt
INSERT INTO users (username, password, email) VALUES ('admin', 'admin123', 'admin@example.com')
ON DUPLICATE KEY UPDATE username = username;

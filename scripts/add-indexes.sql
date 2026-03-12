-- Rekomendasi index untuk mempercepat query Weekly Monitoring & dashboard.
-- Jalankan di MySQL (dc_monitoring). Jika index sudah ada, akan error; bisa diabaikan atau DROP INDEX dulu.

-- monitoring_schedules: filter week_start (6 bulan), location_id, status
CREATE INDEX idx_ms_week_start ON monitoring_schedules(week_start);
CREATE INDEX idx_ms_location_id ON monitoring_schedules(location_id);
CREATE INDEX idx_ms_status ON monitoring_schedules(status);

-- monitoring_sessions: lookup by schedule_id (get/create session), by id
CREATE INDEX idx_msess_schedule_id ON monitoring_sessions(schedule_id);
-- id biasanya PRIMARY KEY, tidak perlu index terpisah

-- server_snapshots: filter by session_id (load draft, export)
CREATE INDEX idx_ss_session_id ON server_snapshots(session_id);
-- UNIQUE (session_id, server_id) diperlukan untuk ON DUPLICATE KEY; pastikan ada:
-- ALTER TABLE server_snapshots ADD UNIQUE KEY uq_ss_session_server (session_id, server_id);

-- component_readings: filter by snapshot_id (load draft)
CREATE INDEX idx_cr_snapshot_id ON component_readings(snapshot_id);
-- UNIQUE (snapshot_id, server_component_id) untuk ON DUPLICATE KEY:
-- ALTER TABLE component_readings ADD UNIQUE KEY uq_cr_snap_comp (snapshot_id, server_component_id);

-- servers: filter by location_id + physical_status (jadwal, subquery)
CREATE INDEX idx_servers_location_status ON servers(location_id, physical_status);

-- locations: JOIN by id (biasanya PK)
-- users: JOIN by id (biasanya PK)

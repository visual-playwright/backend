CREATE TABLE IF NOT EXISTS templates (
  id VARCHAR(8) PRIMARY KEY,
  title VARCHAR(64) NOT NULL,
  content_md MEDIUMTEXT NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id CHAR(36) PRIMARY KEY,
  result_name VARCHAR(255) NOT NULL UNIQUE,
  domain VARCHAR(128) NOT NULL,
  url VARCHAR(512) NOT NULL,
  username VARCHAR(255) NOT NULL,
  -- Password target uji dipakai worker saat run saja dan jangan diexpose via API
  password TEXT NOT NULL,
  scenario_id VARCHAR(8) NOT NULL,
  status ENUM('QUEUED','RUNNING','DONE','FAILED') NOT NULL DEFAULT 'QUEUED',
  rendered_prompt MEDIUMTEXT,
  opencode_session VARCHAR(64) NULL,
  token_input INT DEFAULT 0,
  token_output INT DEFAULT 0,
  token_reasoning INT DEFAULT 0,
  token_total INT DEFAULT 0,
  cost_usd DECIMAL(10,4) DEFAULT 0,
  total_steps INT DEFAULT 0,
  steps_passed INT DEFAULT 0,
  executable_rate DECIMAL(5,2) DEFAULT 0,
  goal_achieved BOOLEAN DEFAULT FALSE,
  dynamic_reasoning_count INT DEFAULT 0,
  entity_name VARCHAR(255),
  data_contoh TEXT,
  started_at DATETIME,
  finished_at DATETIME,
  INDEX idx_runs_domain (domain),
  INDEX idx_runs_scenario (scenario_id)
);

CREATE TABLE IF NOT EXISTS run_steps (
  id CHAR(36) PRIMARY KEY,
  run_id CHAR(36) NOT NULL,
  no INT NOT NULL,
  instruction TEXT,
  visual_element TEXT,
  status ENUM('PASS','FAIL','SKIPPED') NOT NULL,
  dynamic_reasoning ENUM('NONE','REDIRECT','ADD','SKIP','EXPAND') NOT NULL DEFAULT 'NONE',
  notes TEXT,
  screenshot_path VARCHAR(512),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE,
  INDEX idx_steps_run (run_id)
);

CREATE TABLE IF NOT EXISTS app_users (
  id CHAR(36) PRIMARY KEY,
  username VARCHAR(128) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

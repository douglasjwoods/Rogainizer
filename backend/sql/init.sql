CREATE DATABASE IF NOT EXISTS rogainizer;
USE rogainizer;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_name_email (name, email)
);

CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  year INT NULL,
  series VARCHAR(255) NULL,
  date DATE NOT NULL,
  organiser VARCHAR(255) NULL,
  duration_hours DECIMAL(6,2) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_events_year_series_name (year, series, name)
);

CREATE TABLE IF NOT EXISTS results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  team_name VARCHAR(255) NOT NULL,
  team_member VARCHAR(255) NOT NULL,
  final_score_raw DECIMAL(10,2) NULL,
  final_score_scaled DECIMAL(10,2) NULL,
  mj_raw DECIMAL(10,2) NULL,
  mj_scaled DECIMAL(10,2) NULL,
  wj_raw DECIMAL(10,2) NULL,
  wj_scaled DECIMAL(10,2) NULL,
  xj_raw DECIMAL(10,2) NULL,
  xj_scaled DECIMAL(10,2) NULL,
  mo_raw DECIMAL(10,2) NULL,
  mo_scaled DECIMAL(10,2) NULL,
  wo_raw DECIMAL(10,2) NULL,
  wo_scaled DECIMAL(10,2) NULL,
  xo_raw DECIMAL(10,2) NULL,
  xo_scaled DECIMAL(10,2) NULL,
  mv_raw DECIMAL(10,2) NULL,
  mv_scaled DECIMAL(10,2) NULL,
  wv_raw DECIMAL(10,2) NULL,
  wv_scaled DECIMAL(10,2) NULL,
  xv_raw DECIMAL(10,2) NULL,
  xv_scaled DECIMAL(10,2) NULL,
  msv_raw DECIMAL(10,2) NULL,
  msv_scaled DECIMAL(10,2) NULL,
  wsv_raw DECIMAL(10,2) NULL,
  wsv_scaled DECIMAL(10,2) NULL,
  xsv_raw DECIMAL(10,2) NULL,
  xsv_scaled DECIMAL(10,2) NULL,
  muv_raw DECIMAL(10,2) NULL,
  muv_scaled DECIMAL(10,2) NULL,
  wuv_raw DECIMAL(10,2) NULL,
  wuv_scaled DECIMAL(10,2) NULL,
  xuv_raw DECIMAL(10,2) NULL,
  xuv_scaled DECIMAL(10,2) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_results_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  INDEX idx_results_event_id (event_id)
);

CREATE TABLE IF NOT EXISTS teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  competitors TEXT NOT NULL,
  course VARCHAR(100) NOT NULL,
  category VARCHAR(100) NOT NULL,
  score DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_teams_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  INDEX idx_teams_event_id (event_id)
);

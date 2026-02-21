CREATE DATABASE IF NOT EXISTS rogainizer;
USE rogainizer;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_name_email (name, email)
);

SET @users_email_unique_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = 'rogainizer'
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'email'
    AND NON_UNIQUE = 0
);

SET @drop_users_email_unique_sql = IF(
  @users_email_unique_exists > 0,
  'ALTER TABLE users DROP INDEX email',
  'SELECT 1'
);

PREPARE drop_users_email_unique_stmt FROM @drop_users_email_unique_sql;
EXECUTE drop_users_email_unique_stmt;
DEALLOCATE PREPARE drop_users_email_unique_stmt;

SET @users_name_email_unique_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = 'rogainizer'
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'uq_users_name_email'
    AND NON_UNIQUE = 0
);

SET @add_users_name_email_unique_sql = IF(
  @users_name_email_unique_exists = 0,
  'ALTER TABLE users ADD CONSTRAINT uq_users_name_email UNIQUE (name, email)',
  'SELECT 1'
);

PREPARE add_users_name_email_unique_stmt FROM @add_users_name_email_unique_sql;
EXECUTE add_users_name_email_unique_stmt;
DEALLOCATE PREPARE add_users_name_email_unique_stmt;

CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  event_date DATE NOT NULL,
  location VARCHAR(255) NOT NULL,
  courses TEXT NOT NULL DEFAULT ('[]'),
  categories TEXT NOT NULL DEFAULT ('[]'),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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

SET @team_score_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'rogainizer'
    AND TABLE_NAME = 'teams'
    AND COLUMN_NAME = 'score'
);

SET @add_team_score_sql = IF(
  @team_score_exists = 0,
  'ALTER TABLE teams ADD COLUMN score DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER category',
  'SELECT 1'
);

PREPARE add_team_score_stmt FROM @add_team_score_sql;
EXECUTE add_team_score_stmt;
DEALLOCATE PREPARE add_team_score_stmt;

SET @courses_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'rogainizer'
    AND TABLE_NAME = 'events'
    AND COLUMN_NAME = 'courses'
);

SET @add_courses_sql = IF(
  @courses_exists = 0,
  'ALTER TABLE events ADD COLUMN courses TEXT NOT NULL DEFAULT (''[]'') AFTER location',
  'SELECT 1'
);

PREPARE add_courses_stmt FROM @add_courses_sql;
EXECUTE add_courses_stmt;
DEALLOCATE PREPARE add_courses_stmt;

SET @categories_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'rogainizer'
    AND TABLE_NAME = 'events'
    AND COLUMN_NAME = 'categories'
);

SET @add_categories_sql = IF(
  @categories_exists = 0,
  'ALTER TABLE events ADD COLUMN categories TEXT NOT NULL DEFAULT (''[]'') AFTER courses',
  'SELECT 1'
);

PREPARE add_categories_stmt FROM @add_categories_sql;
EXECUTE add_categories_stmt;
DEALLOCATE PREPARE add_categories_stmt;

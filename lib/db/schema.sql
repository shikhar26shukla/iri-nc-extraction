CREATE TABLE IF NOT EXISTS companies (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  auto_learn_iris TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS iris_entries (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL,
  particular VARCHAR(512) NOT NULL,
  iris_code VARCHAR(128) NOT NULL DEFAULT '',
  iris_codes JSON NULL,
  type VARCHAR(128) NULL,
  notes TEXT NULL,
  CONSTRAINT fk_iris_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY uq_iris_company_particular (company_id, particular(255)),
  KEY idx_iris_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS nc_entries (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL,
  details VARCHAR(512) NOT NULL,
  nc VARCHAR(128) NOT NULL DEFAULT '',
  nc_codes JSON NULL,
  CONSTRAINT fk_nc_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY uq_nc_company_details (company_id, details(255)),
  KEY idx_nc_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS skill_base_versions (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL,
  skill_type ENUM('iris', 'nc') NOT NULL,
  version INT NOT NULL,
  source VARCHAR(32) NOT NULL,
  file_name VARCHAR(255) NULL,
  entry_count INT NOT NULL DEFAULT 0,
  merge_stats JSON NULL,
  entries JSON NOT NULL,
  in_index TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_version_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY uq_version (company_id, skill_type, version),
  KEY idx_version_company (company_id, skill_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

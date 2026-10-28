import mysql from 'mysql2/promise';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { COMPLAINT_TAXONOMY } from './src/data/complaintTaxonomy.ts';
import { parseBoundaryGeometry } from './src/services/boundaryGeometry.ts';

let pool: mysql.Pool;

async function ensureSchema() {
  if (!pool) return;

  const connection = await pool.getConnection();

  try {
    const [userColumns] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT COLUMN_NAME as column_name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'"
    );
    const hasLegacyUsers = userColumns.length > 0;
    const userColumnNames = new Set(userColumns.map((column: any) => column.column_name));

    if (hasLegacyUsers && !userColumnNames.has('is_resident')) {
      console.log('Adding missing users.is_resident column...');
      await connection.query("ALTER TABLE users ADD COLUMN is_resident ENUM('Resident', 'Non Resident') NOT NULL DEFAULT 'Resident' AFTER role");
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS account_sequence (
        id TINYINT PRIMARY KEY,
        next_id INT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS residents (
        user_id INT PRIMARY KEY,
        address VARCHAR(500) NULL,
        verified_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS non_residents (
        user_id INT PRIMARY KEY,
        address VARCHAR(500) NULL,
        verified_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS administrators (
        user_id INT PRIMARY KEY,
        role ENUM('admin', 'official') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS password_reset_otps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        otp_hash CHAR(64) NOT NULL,
        expires_at DATETIME NOT NULL,
        attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
        used_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_password_reset_email (email),
        INDEX idx_password_reset_expiry (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS google_login_otps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        challenge_hash CHAR(64) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL,
        otp_hash CHAR(64) NOT NULL,
        expires_at DATETIME NOT NULL,
        attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
        used_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_google_login_email (email),
        INDEX idx_google_login_expiry (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS account_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        document_type VARCHAR(100) NOT NULL,
        front_path VARCHAR(500) NOT NULL,
        back_path VARCHAR(500) NOT NULL,
        verified_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_account_documents_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS registration_verifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(64) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password_hash TEXT NOT NULL,
        profile_data JSON NOT NULL,
        is_resident ENUM('Resident','Non Resident') NULL,
        verification_token_hash CHAR(64) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        verified_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_registration_verification_username (username),
        UNIQUE KEY uq_registration_verification_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    const [registrationColumns] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT COLUMN_NAME, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'registration_verifications'"
    );
    if (!registrationColumns.some((column: any) => column.COLUMN_NAME === 'attempts')) {
      await connection.query('ALTER TABLE registration_verifications ADD COLUMN attempts TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER verified_at');
    }
    const residencyColumn = registrationColumns.find((column: any) => column.COLUMN_NAME === 'is_resident');
    if (residencyColumn?.IS_NULLABLE === 'NO') {
      await connection.query("ALTER TABLE registration_verifications MODIFY COLUMN is_resident ENUM('Resident','Non Resident') NULL");
    }

    const [complaintTypeColumns] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'complaint_types'"
    );
    const complaintTypeColumnNames = new Set(complaintTypeColumns.map((column: any) => column.COLUMN_NAME));
    if (!complaintTypeColumnNames.has('category')) {
      await connection.query("ALTER TABLE complaint_types ADD COLUMN category VARCHAR(150) NOT NULL DEFAULT 'Social & Safety Concerns' AFTER name");
    }
    if (!complaintTypeColumnNames.has('description')) {
      await connection.query('ALTER TABLE complaint_types ADD COLUMN description TEXT NULL AFTER category');
    }

    const legacyComplaintTypes = [
      ['Ingay / Disturbo', 'Environmental & Public Nuisance', 'Noise Complaints'],
      ['Basura / Kalinisan', 'Environmental & Public Nuisance', 'Waste and Sanitation'],
      ['Away / Gulo', 'Social & Safety Concerns', 'Anti-Social Behavior (ASB)'],
      ['Ilegal na Paradahan', 'Traffic & Parking', 'Illegal Parking'],
      ['Sirang Pasilidad', 'Social & Safety Concerns', 'Safety Hazards'],
      ['Iba pa', 'Social & Safety Concerns', 'Other Concerns'],
    ];
    for (const [legacyName, category, name] of legacyComplaintTypes) {
      const taxonomyType = COMPLAINT_TAXONOMY.find((item) => item.name === name)!;
      const [legacyRows] = await connection.query<mysql.RowDataPacket[]>(
        'SELECT id, is_active FROM complaint_types WHERE name = ?', [legacyName]
      );
      await connection.query(
        'UPDATE complaints SET uri_ng_reklamo = ? WHERE uri_ng_reklamo = ?',
        [name, legacyName]
      );
      if (legacyRows.length) {
        const [englishRows] = await connection.query<mysql.RowDataPacket[]>(
          'SELECT id FROM complaint_types WHERE name = ?', [name]
        );
        if (englishRows.length) {
          await connection.query(
            'UPDATE complaint_types SET category = ?, description = ?, is_active = GREATEST(is_active, ?) WHERE id = ?',
            [category, taxonomyType.description, legacyRows[0].is_active, englishRows[0].id]
          );
          await connection.query('DELETE FROM complaint_types WHERE id = ?', [legacyRows[0].id]);
        } else {
          await connection.query(
            'UPDATE complaint_types SET category = ?, name = ?, description = ? WHERE id = ?',
            [category, name, taxonomyType.description, legacyRows[0].id]
          );
        }
      }
    }

    await connection.query("UPDATE complaint_types SET is_active = 0 WHERE name = 'Other Concerns'");
    for (const complaintType of COMPLAINT_TAXONOMY) {
      await connection.query(
        'INSERT INTO complaint_types (category, name, description, is_active) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE category = VALUES(category), description = VALUES(description)',
        [complaintType.category, complaintType.name, complaintType.description]
      );
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        mensahe TEXT NOT NULL,
        nabasa TINYINT(1) NOT NULL DEFAULT 0,
        notification_type VARCHAR(40) NOT NULL DEFAULT 'general',
        target_path VARCHAR(500) NOT NULL DEFAULT '/complaints',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_notifications_user_created (user_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    const [notificationColumns] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications'"
    );
    const notificationColumnNames = new Set(notificationColumns.map((column: any) => column.COLUMN_NAME));
    if (!notificationColumnNames.has('notification_type')) {
      await connection.query("ALTER TABLE notifications ADD COLUMN notification_type VARCHAR(40) NOT NULL DEFAULT 'general'");
    }
    if (!notificationColumnNames.has('target_path')) {
      await connection.query("ALTER TABLE notifications ADD COLUMN target_path VARCHAR(500) NOT NULL DEFAULT '/complaints'");
    }
    await connection.query(`
      UPDATE notifications SET mensahe = REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(
                REPLACE(mensahe, 'Ingay / Disturbo', 'Noise Complaints'),
                'Basura / Kalinisan', 'Waste and Sanitation'
              ),
              'Away / Gulo', 'Anti-Social Behavior (ASB)'
            ),
            'Ilegal na Paradahan', 'Illegal Parking'
          ),
          'Sirang Pasilidad', 'Safety Hazards'
        ),
        'Iba pa', 'Other Concerns'
      )
      WHERE mensahe REGEXP 'Ingay / Disturbo|Basura / Kalinisan|Away / Gulo|Ilegal na Paradahan|Sirang Pasilidad|Iba pa'
    `);
    await connection.query(`
      UPDATE notifications SET notification_type = CASE
        WHEN mensahe LIKE 'New complaint submitted:%' THEN 'new_complaint'
        WHEN mensahe LIKE 'Your complaint (%status was updated%' OR mensahe LIKE 'The complaint involving you (%status was updated%' THEN 'status_update'
        WHEN mensahe LIKE 'New message from %' THEN 'new_message'
        WHEN mensahe LIKE '%mediation%' OR mensahe LIKE '%Mediation%' THEN 'mediation_update'
        ELSE notification_type
      END
      WHERE notification_type = 'general'
    `);
    await connection.query(`
      UPDATE notifications n
      SET n.target_path = CONCAT('/complaints/', (
        SELECT c.id
        FROM complaints c
        WHERE (
          c.user_id = n.user_id
          OR c.nireklamo_user_id = n.user_id
          OR n.notification_type = 'new_complaint'
        )
          AND (
            n.mensahe LIKE CONCAT('%', c.uri_ng_reklamo, '%')
            OR (c.blotter_number IS NOT NULL AND n.mensahe LIKE CONCAT('%', c.blotter_number, '%'))
            OR n.notification_type IN ('mediation_scheduled', 'mediation_summon', 'mediation_outcome', 'mediation_update', 'new_message')
          )
        ORDER BY ABS(TIMESTAMPDIFF(SECOND, c.updated_at, n.created_at)) ASC, c.id DESC
        LIMIT 1
      ))
      WHERE n.target_path = '/complaints'
        AND EXISTS (
          SELECT 1 FROM complaints c
          WHERE (
            c.user_id = n.user_id
            OR c.nireklamo_user_id = n.user_id
            OR n.notification_type = 'new_complaint'
          )
            AND (
              n.mensahe LIKE CONCAT('%', c.uri_ng_reklamo, '%')
              OR (c.blotter_number IS NOT NULL AND n.mensahe LIKE CONCAT('%', c.blotter_number, '%'))
              OR n.notification_type IN ('mediation_scheduled', 'mediation_summon', 'mediation_outcome', 'mediation_update', 'new_message')
            )
        )
    `);
    await connection.query(`
        UPDATE notifications SET mensahe = REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(
                REPLACE(
                  REPLACE(
                    REPLACE(mensahe, 'Ilegal na Paradahan', 'Illegal Parking'),
                    'Bagong reklamo: ', 'New complaint submitted: '
                  ),
                  'Ang status ng iyong reklamo (', 'Your complaint ('
                ),
                ') ay in-update sa ', ') status was updated to '
              ),
              'sinusuri', 'Under Review'
            ),
            'naka-assign', 'Assigned'
          ),
          'sa-mediation', 'In Mediation'
        )
        WHERE mensahe LIKE '%Ilegal na Paradahan%'
          OR mensahe LIKE 'Bagong reklamo:%'
          OR mensahe LIKE 'Ang status ng iyong reklamo (%'
          OR mensahe LIKE 'Naka-iskedyul ang iyong reklamo%'
      `);
    await connection.query(`
        UPDATE notifications SET mensahe = REPLACE(
          REPLACE(mensahe, 'Naka-iskedyul ang iyong reklamo para sa mediation sa ', 'Your complaint is scheduled for mediation on '),
          '. Paraan: ', '. Delivery method: '
        )
        WHERE mensahe LIKE 'Naka-iskedyul ang iyong reklamo%'
      `);

    const [siteSettingsTable] = await connection.query<mysql.RowDataPacket[]>("SHOW TABLES LIKE 'site_settings'");
    if (siteSettingsTable.length) {
      await connection.query("DELETE FROM site_settings WHERE setting_key IN ('hotspot_red_threshold', 'hotspot_orange_threshold', 'hotspot_yellow_threshold')");
      await connection.query(`
        UPDATE site_settings
        SET setting_value = CASE setting_key
          WHEN 'hero_title' THEN 'Community Voices, <br /> <span class="text-primary">Barangay Action.</span>'
          WHEN 'hero_subtitle' THEN 'A modern system for the fast, safe, and transparent reporting of concerns in Barangay San Andres.'
          WHEN 'about_text' THEN 'Designed for fast and effective public service.'
        END
        WHERE (setting_key = 'hero_title' AND setting_value LIKE '%Boses ng%')
          OR (setting_key = 'hero_subtitle' AND setting_value LIKE '%Isang modernong sistema%')
          OR (setting_key = 'about_text' AND setting_value LIKE '%Dinisenyo para%')
      `);
    }

    const subtypeColumns = [
      ['residents', 'pangalan', 'VARCHAR(255) NULL'],
      ['residents', 'email', 'VARCHAR(255) NULL'],
      ['residents', 'password', 'TEXT NULL'],
      ['residents', 'username', 'VARCHAR(64) NULL'],
      ['residents', 'email_verified', 'TINYINT(1) NOT NULL DEFAULT 1'],
      ['residents', 'profile_completed', 'TINYINT(1) NOT NULL DEFAULT 1'],
      ['residents', 'first_name', 'VARCHAR(100) NULL'],
      ['residents', 'last_name', 'VARCHAR(100) NULL'],
      ['residents', 'middle_name', 'VARCHAR(100) NULL'],
      ['residents', 'suffix', 'VARCHAR(20) NULL'],
      ['residents', 'date_of_birth', 'DATE NULL'],
      ['residents', 'sex', 'VARCHAR(30) NULL'],
      ['residents', 'place_of_birth', 'VARCHAR(255) NULL'],
      ['residents', 'civil_status', 'VARCHAR(30) NULL'],
      ['residents', 'phone_number', 'VARCHAR(30) NULL'],
      ['residents', 'occupation', 'VARCHAR(100) NULL'],
      ['residents', 'religion', 'VARCHAR(100) NULL'],
      ['residents', 'registered_voter', 'VARCHAR(5) NULL'],
      ['residents', 'terms_agreed_at', 'TIMESTAMP NULL'],
      ['non_residents', 'pangalan', 'VARCHAR(255) NULL'],
      ['non_residents', 'email', 'VARCHAR(255) NULL'],
      ['non_residents', 'password', 'TEXT NULL'],
      ['non_residents', 'username', 'VARCHAR(64) NULL'],
      ['non_residents', 'email_verified', 'TINYINT(1) NOT NULL DEFAULT 1'],
      ['non_residents', 'profile_completed', 'TINYINT(1) NOT NULL DEFAULT 1'],
      ['non_residents', 'first_name', 'VARCHAR(100) NULL'],
      ['non_residents', 'last_name', 'VARCHAR(100) NULL'],
      ['non_residents', 'middle_name', 'VARCHAR(100) NULL'],
      ['non_residents', 'suffix', 'VARCHAR(20) NULL'],
      ['non_residents', 'date_of_birth', 'DATE NULL'],
      ['non_residents', 'sex', 'VARCHAR(30) NULL'],
      ['non_residents', 'place_of_birth', 'VARCHAR(255) NULL'],
      ['non_residents', 'civil_status', 'VARCHAR(30) NULL'],
      ['non_residents', 'phone_number', 'VARCHAR(30) NULL'],
      ['non_residents', 'occupation', 'VARCHAR(100) NULL'],
      ['non_residents', 'religion', 'VARCHAR(100) NULL'],
      ['non_residents', 'registered_voter', 'VARCHAR(5) NULL'],
      ['non_residents', 'terms_agreed_at', 'TIMESTAMP NULL'],
      ['administrators', 'pangalan', 'VARCHAR(255) NULL'],
      ['administrators', 'email', 'VARCHAR(255) NULL'],
      ['administrators', 'password', 'TEXT NULL']
    ];
    for (const [table, column, definition] of subtypeColumns) {
      const [existing] = await connection.query<mysql.RowDataPacket[]>(
        'SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
        [table, column]
      );
      if (!existing.length) {
        await connection.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      }
    }

    for (const [table, indexName] of [['residents', 'uq_residents_username'], ['non_residents', 'uq_non_residents_username']]) {
      const [existingIndex] = await connection.query<mysql.RowDataPacket[]>(
        'SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?',
        [table, indexName]
      );
      if (!existingIndex.length) {
        await connection.query(`CREATE UNIQUE INDEX ${indexName} ON ${table} (username)`);
      }
    }

    if (hasLegacyUsers) await connection.query(`
      INSERT IGNORE INTO residents (user_id)
      SELECT id FROM users WHERE role = 'mamamayan' AND is_resident = 'Resident'
    `);
    if (hasLegacyUsers) await connection.query(`
      INSERT IGNORE INTO non_residents (user_id)
      SELECT id FROM users WHERE role = 'mamamayan' AND is_resident = 'Non Resident'
    `);
    if (hasLegacyUsers) await connection.query(`
      INSERT IGNORE INTO administrators (user_id, role)
      SELECT id, role FROM users WHERE role IN ('admin', 'official')
    `);
    if (hasLegacyUsers) await connection.query(`
      UPDATE residents r JOIN users u ON u.id = r.user_id
      SET r.pangalan = u.pangalan, r.email = u.email, r.password = u.password
      WHERE r.email IS NULL
    `);
    if (hasLegacyUsers) await connection.query(`
      UPDATE non_residents r JOIN users u ON u.id = r.user_id
      SET r.pangalan = u.pangalan, r.email = u.email, r.password = u.password
      WHERE r.email IS NULL
    `);
    if (hasLegacyUsers) await connection.query(`
      UPDATE administrators a JOIN users u ON u.id = a.user_id
      SET a.pangalan = u.pangalan, a.email = u.email, a.password = u.password
      WHERE a.email IS NULL
    `);
    if (hasLegacyUsers) {
      const [legacyForeignKeys] = await connection.query<mysql.RowDataPacket[]>(`
        SELECT TABLE_NAME, CONSTRAINT_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = 'users'
      `);
      for (const foreignKey of legacyForeignKeys) {
        await connection.query(`ALTER TABLE \`${foreignKey.TABLE_NAME}\` DROP FOREIGN KEY \`${foreignKey.CONSTRAINT_NAME}\``);
      }
      await connection.query('DROP TABLE users');
    }
    await connection.query(`
      INSERT INTO account_sequence (id, next_id)
      SELECT 1, COALESCE(MAX(account_id), 0) + 1 FROM (
        SELECT user_id AS account_id FROM residents
        UNION ALL SELECT user_id FROM non_residents
        UNION ALL SELECT user_id FROM administrators
      ) account_ids
      ON DUPLICATE KEY UPDATE next_id = GREATEST(next_id, VALUES(next_id))
    `);
    await connection.query('DROP VIEW IF EXISTS account_profiles');
    await connection.query(`
      CREATE VIEW account_profiles AS
            SELECT user_id AS id, pangalan, email, password, username, email_verified, profile_completed, 'mamamayan' AS role,
              'Resident' AS is_resident, 'Resident' AS account_type
      FROM residents
      UNION ALL
            SELECT user_id, pangalan, email, password, username, email_verified, profile_completed, 'mamamayan',
              'Non Resident', 'Non Resident'
      FROM non_residents
      UNION ALL
            SELECT user_id, pangalan, email, password, NULL, 1, 1, role,
              'Resident', 'Administrator'
      FROM administrators
    `);

    const [complaintColumns] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT COLUMN_NAME as column_name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'complaints'"
    );
    const complaintColumnNames = new Set(complaintColumns.map((column: any) => column.column_name));

    if (!complaintColumnNames.has('is_resident')) {
      console.log('Adding missing complaints.is_resident column...');
      await connection.query("ALTER TABLE complaints ADD COLUMN is_resident ENUM('Resident', 'Non Resident') NOT NULL DEFAULT 'Resident' AFTER nireklamo_user_id");
    }

    if (!complaintColumnNames.has('zone')) {
      console.log('Adding missing complaints.zone column...');
      await connection.query("ALTER TABLE complaints ADD COLUMN zone VARCHAR(100) NULL AFTER is_resident");
    }
    const newComplaintColumns: Array<[string, string]> = [
      ['street_name', 'VARCHAR(255) NULL'],
      ['complainant_name', 'VARCHAR(255) NULL'],
      ['complainant_email', 'VARCHAR(255) NULL'],
      ['truthfulness_acknowledged_at', 'DATETIME NULL'],
      ['edit_count', 'TINYINT UNSIGNED NOT NULL DEFAULT 0'],
      ['deleted_at', 'DATETIME NULL'],
      ['mediation_eligible', 'TINYINT(1) NOT NULL DEFAULT 0'],
      ['mediation_eligibility_notes', 'TEXT NULL'],
      ['mediation_eligibility_verified_by', 'INT NULL'],
      ['mediation_eligibility_verified_at', 'DATETIME NULL'],
      ['is_anonymous', 'TINYINT(1) NOT NULL DEFAULT 0'],
      ['address_details', 'TEXT NULL'],
    ];
    for (const [column, definition] of newComplaintColumns) {
      if (!complaintColumnNames.has(column)) {
        await connection.query(`ALTER TABLE complaints ADD COLUMN ${column} ${definition}`);
      }
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS complaint_history (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        complaint_id INT NOT NULL,
        actor_user_id INT NOT NULL,
        action_type VARCHAR(30) NOT NULL,
        snapshot JSON NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_complaint_history_complaint (complaint_id, created_at),
        INDEX idx_complaint_history_actor (actor_user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS complaint_audit (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        complaint_id INT NOT NULL,
        previous_status VARCHAR(30) NULL,
        new_status VARCHAR(30) NULL,
        action_type VARCHAR(60) NOT NULL,
        remarks TEXT NOT NULL,
        actor_user_id INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_complaint_audit_case (complaint_id, created_at, id),
        INDEX idx_complaint_audit_actor (actor_user_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS case_dispositions (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        complaint_id INT NOT NULL,
        action_type ENUM('resolved', 'archived') NOT NULL,
        complaint_date DATETIME NOT NULL,
        disposition_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        staff_user_id INT NOT NULL,
        resolution_details TEXT NOT NULL,
        evidence_path VARCHAR(500) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_case_dispositions_case (complaint_id, disposition_date, id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS mediation_audit (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        complaint_id INT NOT NULL,
        schedule_id INT NULL,
        action_type VARCHAR(60) NOT NULL,
        details JSON NOT NULL,
        actor_user_id INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_mediation_audit_case (complaint_id, created_at, id),
        INDEX idx_mediation_audit_schedule (schedule_id, created_at, id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS case_history_email_log (
        complaint_id INT NOT NULL,
        user_id INT NOT NULL,
        last_sent_at DATETIME NOT NULL,
        PRIMARY KEY (complaint_id, user_id),
        INDEX idx_case_history_email_last_sent (last_sent_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    const [scheduleColumns] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT COLUMN_NAME as column_name, EXTRA as extra FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schedules'"
    );
    const scheduleColumnNames = new Set(scheduleColumns.map((column: any) => column.column_name));
    const scheduleDateColumn = scheduleColumns.find((column: any) => column.column_name === 'petsa');
    if (scheduleDateColumn?.extra?.toLowerCase().includes('on update')) {
      await connection.query("ALTER TABLE schedules MODIFY COLUMN petsa DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
    }
    const newScheduleColumns: Array<[string, string]> = [
      ['staff_user_id', 'INT NULL'],
      ['assigned_personnel', 'TEXT NULL'],
      ['attendees', 'TEXT NULL'],
      ['updated_at', 'DATETIME NULL'],
      ['summons_details', 'JSON NULL'],
    ];
    for (const [column, definition] of newScheduleColumns) {
      if (scheduleColumnNames.size > 0 && !scheduleColumnNames.has(column)) {
        await connection.query(`ALTER TABLE schedules ADD COLUMN ${column} ${definition}`);
      }
    }
    await connection.query(`
      CREATE TABLE IF NOT EXISTS complaint_reads (
        complaint_id INT NOT NULL,
        user_id INT NOT NULL,
        read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (complaint_id, user_id),
        INDEX idx_complaint_reads_user (user_id, read_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      INSERT INTO complaint_history (complaint_id, actor_user_id, action_type, snapshot, created_at)
      SELECT c.id, c.user_id, 'filed', JSON_OBJECT(
        'uri_ng_reklamo', c.uri_ng_reklamo,
        'category', COALESCE(ct.category, ''),
        'complainant_name', COALESCE(c.complainant_name, u.pangalan),
        'complainant_email', COALESCE(c.complainant_email, u.email),
        'nireklamo_pangalan', COALESCE(c.nireklamo_pangalan, ''),
        'nireklamo_email', COALESCE(c.nireklamo_email, ''),
        'detalye', c.detalye,
        'zone', COALESCE(c.zone, ''),
        'street_name', COALESCE(c.street_name, '')
      ), c.created_at
      FROM complaints c
      JOIN account_profiles u ON u.id = c.user_id
      LEFT JOIN complaint_types ct ON ct.name = c.uri_ng_reklamo
      WHERE NOT EXISTS (
        SELECT 1 FROM complaint_history h WHERE h.complaint_id = c.id AND h.action_type = 'filed'
      )
    `);

    const [zoneTable] = await connection.query<mysql.RowDataPacket[]>(
      "SHOW TABLES LIKE 'complaint_zones'"
    );

    if (!zoneTable.length) {
      console.log('Creating complaint_zones table...');
      await connection.query(`
        CREATE TABLE complaint_zones (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          description VARCHAR(255) DEFAULT '',
          lat DECIMAL(10, 7) NOT NULL,
          lng DECIMAL(10, 7) NOT NULL,
          color VARCHAR(20) NOT NULL DEFAULT 'red',
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    }

    const defaultZones = [
      ['West Floodway', 'Flood-prone and traffic-heavy corridor in San Andres', 14.5758, 121.1136, 'red'],
      ['Bermai', 'High-density residential and complaint cluster near the barangay core', 14.5742, 121.1108, 'orange'],
      ['Midtown', 'Central community zone in San Andres with mixed traffic and services', 14.5706, 121.1120, 'yellow'],
      ['Rivera', 'Residential village with routine barangay concerns', 14.5679, 121.1069, 'green'],
      ['Parola', 'Community zone along San Andres boundary corridor', 14.5768, 121.1145, 'yellow'],
      ['Greenland', 'Residential village community in San Andres', 14.5735, 121.1130, 'red'],
      ['Mercedes', 'Subdivision community in San Andres', 14.5665, 121.1045, 'green'],
      ['Pag-Ibig', 'Residential zone in San Andres', 14.5620, 121.0980, 'red'],
      ['Greenwoods', 'San Andres residential section', 14.5580, 121.0990, 'yellow'],
      ['Plantation', 'San Andres southern sector subdivision', 14.5520, 121.1060, 'orange']
    ];

    for (const [name, description, lat, lng, color] of defaultZones) {
      await connection.query(
        `INSERT INTO complaint_zones (name, description, lat, lng, color) VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description), lat = VALUES(lat), lng = VALUES(lng), color = VALUES(color), is_active = 1`,
        [name, description, lat, lng, color]
      );
    }

    for (const table of ['residents', 'non_residents', 'complaints']) {
      const [columns] = await connection.query<mysql.RowDataPacket[]>(
        'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
        [table]
      );
      const names = new Set(columns.map((column: any) => column.COLUMN_NAME));
      for (const [column, definition] of [
        ['latitude', 'DECIMAL(10, 7) NULL'],
        ['longitude', 'DECIMAL(10, 7) NULL'],
        ['detected_boundary_ids', 'JSON NULL'],
      ]) {
        if (!names.has(column)) await connection.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      }
      await connection.query(`
        UPDATE ${table}
        SET detected_boundary_ids = JSON_EXTRACT(JSON_UNQUOTE(detected_boundary_ids), '$')
        WHERE JSON_TYPE(detected_boundary_ids) = 'STRING'
      `);
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS boundary_types (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(64) NOT NULL UNIQUE,
        color CHAR(7) NOT NULL DEFAULT '#2563eb',
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    for (const [name, color] of [
      ['Barangay', '#dc2626'], ['Subdivision', '#2563eb'], ['Block', '#16a34a'],
      ['Street', '#eab308'], ['Zone', '#9333ea'], ['District', '#0891b2'], ['Custom Area', '#64748b'],
    ]) {
      await connection.query(
        'INSERT INTO boundary_types (name, color) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
        [name, color]
      );
    }
    await connection.query(`
      CREATE TABLE IF NOT EXISTS boundaries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        code VARCHAR(64) NULL UNIQUE,
        type_id INT NOT NULL,
        parent_id INT NULL,
        geometry JSON NOT NULL,
        color CHAR(7) NOT NULL DEFAULT '#2563eb',
        fill_color CHAR(7) NOT NULL DEFAULT '#2563eb',
        fill_opacity DECIMAL(3, 2) NOT NULL DEFAULT 0.15,
        border_width DECIMAL(4, 1) NOT NULL DEFAULT 2,
        description TEXT NULL,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        created_by INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL,
        INDEX idx_boundaries_type_status (type_id, status, deleted_at),
        INDEX idx_boundaries_parent (parent_id),
        CONSTRAINT fk_boundaries_type FOREIGN KEY (type_id) REFERENCES boundary_types(id),
        CONSTRAINT fk_boundaries_parent FOREIGN KEY (parent_id) REFERENCES boundaries(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      UPDATE boundaries
      SET geometry = JSON_EXTRACT(JSON_UNQUOTE(geometry), '$')
      WHERE JSON_TYPE(geometry) = 'STRING'
    `);
    const officialBoundaryPath = path.join(process.cwd(), 'public', 'data', 'san-andres-cainta.geojson');
    if (existsSync(officialBoundaryPath)) {
      try {
        const dataset = JSON.parse(readFileSync(officialBoundaryPath, 'utf8'));
        const officialFeature = dataset.features?.find((feature: any) => feature.properties?.psgc === '0405805014');
        if (officialFeature?.geometry) {
          const existing = await connection.query<mysql.RowDataPacket[]>(
            'SELECT id FROM boundaries WHERE code = ? LIMIT 1', ['PSGC-0405805014']
          );
          if (!existing[0].length) {
            const type = await connection.query<mysql.RowDataPacket[]>(
              'SELECT id FROM boundary_types WHERE name = ? LIMIT 1', ['Barangay']
            );
            if (type[0][0]) {
              const geometry = parseBoundaryGeometry(officialFeature.geometry);
              await connection.query(
                'INSERT INTO boundaries (name, code, type_id, geometry, color, fill_color, fill_opacity, border_width, description) VALUES (?, ?, ?, JSON_EXTRACT(?, \'$\'), ?, ?, ?, ?, ?)',
                ['Barangay San Andres', 'PSGC-0405805014', type[0][0].id, JSON.stringify(geometry), '#dc2626', '#dc2626', 0.03, 3, 'Official verified administrative boundary (PSGC 0405805014).']
              );
            }
          }
        }
      } catch (error) {
        console.error('Unable to seed the verified San Andres boundary:', error);
      }
    }
    await connection.query(`
      CREATE TABLE IF NOT EXISTS boundary_audit (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        boundary_id INT NULL,
        user_id INT NOT NULL,
        action VARCHAR(40) NOT NULL,
        old_value JSON NULL,
        new_value JSON NULL,
        ip_address VARCHAR(45) NULL,
        user_agent VARCHAR(500) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_boundary_audit_boundary (boundary_id, created_at),
        INDEX idx_boundary_audit_user (user_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch (error) {
    console.error('Schema verification failed:', error);
    throw error;
  } finally {
    connection.release();
  }
}

export async function initDb() {
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'san_andres_complaint_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Railway (and most managed MySQL providers) require SSL. Set DB_SSL=true to enable.
    ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  // Test the connection
  try {
    const connection = await pool.getConnection();
    console.log('Successfully connected to the MySQL database.');
    connection.release();
    await ensureSchema();
  } catch (error) {
    console.error('Error connecting to the MySQL database. Please ensure MySQL is running and the san_andres_complaint_system database exists.');
    console.error(error);
  }

  return getDb();
}

// Wrapper object to maintain compatibility with SQLite syntax
export function getDb() {
  if (!pool) {
    throw new Error('Database pool has not been initialized. Call initDb() first.');
  }

  return {
    async get(sql: string, params: any[] = []) {
      const [rows] = await pool.query<mysql.RowDataPacket[]>(sql, params);
      return rows[0]; // Returns the first row or undefined
    },

    async all(sql: string, params: any[] = []) {
      const [rows] = await pool.query<mysql.RowDataPacket[]>(sql, params);
      return rows; // Returns an array of rows
    },

    async run(sql: string, params: any[] = []) {
      const [result] = await pool.execute<mysql.ResultSetHeader>(sql, params);
      return {
        lastID: result.insertId,
        changes: result.affectedRows
      };
    },

    async transaction<T>(callback: (transactionDb: {
      get: (sql: string, params?: any[]) => Promise<any>;
      all: (sql: string, params?: any[]) => Promise<any[]>;
      run: (sql: string, params?: any[]) => Promise<{ lastID: number; changes: number }>;
    }) => Promise<T>): Promise<T> {
      const connection = await pool.getConnection();
      await connection.beginTransaction();
      try {
        const transactionDb = {
          async get(sql: string, params: any[] = []) {
            const [rows] = await connection.query<mysql.RowDataPacket[]>(sql, params);
            return rows[0];
          },
          async all(sql: string, params: any[] = []) {
            const [rows] = await connection.query<mysql.RowDataPacket[]>(sql, params);
            return rows;
          },
          async run(sql: string, params: any[] = []) {
            const [result] = await connection.execute<mysql.ResultSetHeader>(sql, params);
            return { lastID: result.insertId, changes: result.affectedRows };
          },
        };
        const result = await callback(transactionDb);
        await connection.commit();
        return result;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
  };
}

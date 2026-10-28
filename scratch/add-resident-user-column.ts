import { initDb } from '../db.ts';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function migrate() {
  const db = await initDb();
  try {
    console.log('Adding is_resident column to users table...');
    await db.run("ALTER TABLE users ADD COLUMN is_resident ENUM('Resident', 'Non Resident') DEFAULT 'Resident' AFTER role");
    console.log('Migration successful!');
  } catch (error: any) {
    if (error.code === 'ER_DUP_COLUMN_NAME' || error.message.includes('Duplicate column name')) {
      console.log('Column is_resident already exists.');
    } else {
      console.error('Migration failed:', error);
    }
  }
  process.exit(0);
}

migrate();

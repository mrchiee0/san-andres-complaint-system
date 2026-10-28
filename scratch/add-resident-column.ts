import { initDb } from '../db.ts';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function migrate() {
  const db = await initDb();
  try {
    console.log('Adding is_resident column to complaints table...');
    await db.run("ALTER TABLE complaints ADD COLUMN is_resident ENUM('Resident', 'Non Resident') DEFAULT 'Resident' AFTER nireklamo_email");
    console.log('Migration successful!');
  } catch (error: any) {
    if (error.code === 'ER_DUP_COLUMN_NAME') {
      console.log('Column is_resident already exists.');
    } else {
      console.error('Migration failed:', error);
    }
  }
  process.exit(0);
}

migrate();

import { initDb } from '../db.ts';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkSchema() {
  const db = await initDb();
  try {
    const rows = await db.all("DESCRIBE users");
    console.log('--- USERS TABLE ---');
    rows.forEach(row => console.log(`${row.Field}: ${row.Type}`));
    
    const complaintRows = await db.all("DESCRIBE complaints");
    console.log('\n--- COMPLAINTS TABLE ---');
    complaintRows.forEach(row => console.log(`${row.Field}: ${row.Type}`));

    const types = await db.all("SELECT * FROM complaint_types");
    console.log('\n--- COMPLAINT TYPES ---');
    types.forEach(t => console.log(`${t.id}: ${t.name}`));
  } catch (error) {
    console.error('Error checking schema:', error);
  }
  process.exit(0);
}

checkSchema();

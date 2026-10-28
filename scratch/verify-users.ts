import { initDb } from '../db.ts';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function check() {
  const db = await initDb();
  const accounts = await db.all('SELECT id, pangalan, email, account_type FROM account_profiles LIMIT 10');
  console.log('Accounts:', JSON.stringify(accounts, null, 2));
  process.exit(0);
}

check();

import { sendComplaintCreatedEmail } from './src/services/emailService.ts';

async function test() {
  console.log('Sending test email...');
  try {
    await sendComplaintCreatedEmail('cieloberongoy16@gmail.com', 'Test User', 'B-2024-9999', 'Ingay / Disturbo');
    console.log('Test email script completed.');
  } catch (error) {
    console.error('Test script error:', error);
  }
}

test();

import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';
import { initDb, getDb } from './db.ts';
import { searchKnowledgeBase, learnToKnowledgeBase } from './src/services/kbService.ts';
import { sendComplaintCreatedEmail, sendStatusUpdateEmail, sendMediationScheduledEmail, sendMediationOutcomeEmail, sendCaseHistoryEmail, sendPasswordResetOtpEmail, sendGoogleLoginOtpEmail, sendRegistrationVerificationOtpEmail, sendQuickRegistrationOtpEmail } from './src/services/emailService.ts';
import multer from 'multer';
import os from 'os';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { COMPLAINT_CATEGORIES } from './src/data/complaintTaxonomy.ts';
import { boundaryContains, boundaryIntersects, buildBoundaryClassification, detectBoundaryMatches, parseBoundaryGeometry } from './src/services/boundaryGeometry.ts';
import { generateCaseClosureReportDocx } from './src/services/caseClosureReportDocx.ts';
import Ably from 'ably';
import { uploadToCloudinary } from './src/services/cloudinaryService.ts';

// JWT_SECRET check removed per request
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-supersecretkey-forsanandres-2024';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

function listenOnAvailablePort(server: http.Server, startPort: number, attempts = 20): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryListen = (port: number) => {
      const handleError = (error: NodeJS.ErrnoException) => {
        server.removeListener('listening', handleListening);
        if (error.code === 'EADDRINUSE' && port < startPort + attempts - 1) {
          console.warn(`Port ${port} is already in use; trying ${port + 1}.`);
          tryListen(port + 1);
          return;
        }
        reject(error);
      };
      const handleListening = () => {
        server.removeListener('error', handleError);
        resolve(port);
      };

      server.once('error', handleError);
      server.once('listening', handleListening);
      server.listen(port, '0.0.0.0');
    };

    tryListen(startPort);
  });
}


async function startServer() {
  await initDb();
  const db = await getDb();

  const app = express();
  app.set('trust proxy', 1);
  const server = http.createServer(app);

  // Ably Realtime client — replaces Socket.IO server for Vercel compatibility.
  // Frontend connects via the Ably Socket.IO-compatible client wrapper (see Layout.tsx).
  // Only instantiate when a key is configured; the emit helpers already guard against missing keys.
  const ablyClient = process.env.ABLY_API_KEY
    ? new Ably.Realtime({ key: process.env.ABLY_API_KEY })
    : null;

  // Publish an event to a user-specific or complaint-specific Ably channel.
  // Equivalent to: io.to(room).emit(event, data)
  function ablyEmit(channel: string, event: string, data: unknown) {
    if (!ablyClient) return;
    ablyClient.channels.get(channel).publish(event, data).catch((err: Error) => {
      console.error(`[Ably] publish error on "${channel}":`, err.message);
    });
  }

  // Broadcast an event to all clients subscribed to the 'broadcast' channel.
  // Equivalent to: io.emit(event, data)
  function ablyBroadcast(event: string, data: unknown) {
    ablyEmit('broadcast', event, data);
  }

  const configuredPort = Number(process.env.PORT || 3000);
  const PORT = Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort < 65536 ? configuredPort : 3000;

  // Security Middlewares
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "unsafe-none" }
  }));
  app.use(cors());
  app.use(express.json());

  // Logging Middleware to debug 403s
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // Rate Limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Masyadong maraming request mula sa IP na ito. Subukan muli mamaya.' }
  });
  app.use('/api/', limiter);

  // Multer memory storage — files are held in req.file.buffer / req.files[n].buffer
  // and uploaded directly to Cloudinary. No local disk writes.
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for videos
    fileFilter: (req, file, cb) => {
      if (file.fieldname === 'evidence' && req.path.startsWith('/api/complaints') && !file.mimetype.startsWith('image/')) {
        return cb(new Error('Only photo evidence is accepted.'));
      }
      const filetypes = /jpeg|jpg|png|pdf|mp4|mov|avi|mkv/;
      const mimetype = filetypes.test(file.mimetype);
      const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
      if (mimetype && extname) return cb(null, true);
      cb(new Error('This file type is not allowed.'));
    }
  });

  // --- SECURITY LOGGING ---
  app.all('/api/admin/hidden-access', async (req, res) => {
    const ip = req.ip;
    console.warn(`[SECURITY ALERT] Honeypot accessed by IP: ${ip}`);
    await db.run('INSERT INTO logs (aksyon, detalye, ip_address) VALUES (?, ?, ?)', 
      ['HONEYPOT_ACCESS', `Attempted access to hidden-access endpoint`, ip]);
    res.status(404).json({ error: 'Not found.' });
  });

// --- AUTH ROUTES ---

  app.post('/api/auth/resident/register/start', async (req, res) => {
    const normalizedEmail = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (normalizedEmail.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Enter a valid email address that you can access.' });
    }
    if (req.body.terms_agreed !== true) {
      return res.status(400).json({ error: 'Accept the Terms and Conditions before continuing.' });
    }

    try {
      const existing = await db.get('SELECT id FROM account_profiles WHERE email = ? LIMIT 1', [normalizedEmail]);
      if (existing) return res.status(409).json({ error: 'An account already uses this email. Please sign in instead.' });
      await db.run('DELETE FROM registration_verifications WHERE expires_at <= NOW()');

      const pending = await db.get(
        'SELECT id, username, password_hash, profile_data, created_at FROM registration_verifications WHERE email = ? LIMIT 1',
        [normalizedEmail]
      );
      if (pending) {
        const existingProfile = typeof pending.profile_data === 'string' ? JSON.parse(pending.profile_data) : pending.profile_data;
        if (existingProfile.quick_signup !== true) {
          return res.status(409).json({ error: 'A full registration is already in progress for this email. Continue that registration or try again after it expires.' });
        }
      }
      if (pending && (Date.now() - new Date(pending.created_at).getTime()) < 60_000) {
        return res.status(429).json({ error: 'A verification code was just sent. Please wait one minute before requesting another.' });
      }

      const username = pending?.username || `account_${crypto.randomBytes(8).toString('hex')}`;
      const passwordHash = pending?.password_hash || await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
      const codeHash = crypto.createHash('sha256').update(code).digest('hex');
      const profileData = JSON.stringify({
        pangalan: 'New account',
        quick_signup: true,
        terms_agreed: true,
      });

      if (pending) {
        await db.run(`
          UPDATE registration_verifications
          SET username = ?, password_hash = ?, profile_data = ?, is_resident = NULL,
              verification_token_hash = ?, expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE),
              verified_at = NULL, attempts = 0, created_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [username, passwordHash, profileData, codeHash, pending.id]);
      } else {
        await db.run(`
          INSERT INTO registration_verifications
            (username, email, password_hash, profile_data, is_resident, verification_token_hash, expires_at)
          VALUES (?, ?, ?, ?, NULL, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))
        `, [username, normalizedEmail, passwordHash, profileData, codeHash]);
      }
      await sendQuickRegistrationOtpEmail(normalizedEmail, code);
      res.status(202).json({ message: 'A six-digit verification code has been sent to your email.' });
    } catch (error) {
      console.error('Quick resident registration error:', error);
      res.status(503).json({ error: 'Unable to send your verification code. Please try again later.' });
    }
  });


  app.post('/api/auth/register/start', async (req, res) => {
    const { username, email, password, pangalan, first_name, last_name, middle_name, suffix, date_of_birth, sex, place_of_birth, civil_status, phone_number, occupation, religion, address, registered_voter, is_resident, latitude, longitude } = req.body;
    let failureStage: 'database' | 'email' = 'database';
    try {
      const fullName = [first_name, middle_name, last_name, suffix].filter(Boolean).join(' ').trim() || pangalan?.trim();
      const normalizedUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';
      const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      if (!/^[a-z0-9._-]{3,32}$/.test(normalizedUsername)) {
        return res.status(400).json({ error: 'Username must be 3–32 characters and may contain letters, numbers, dots, underscores, or hyphens.' });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || !password || password.length < 8 || !fullName || !['Resident', 'Non Resident'].includes(is_resident)) {
        return res.status(400).json({ error: 'Enter a valid email, a password of at least 8 characters, your full name, and a valid residency status.' });
      }
      const locationLatitude = latitude == null || latitude === '' ? null : Number(latitude);
      const locationLongitude = longitude == null || longitude === '' ? null : Number(longitude);
      if ((locationLatitude == null) !== (locationLongitude == null) ||
          (locationLatitude != null && (!Number.isFinite(locationLatitude) || locationLatitude < -90 || locationLatitude > 90)) ||
          (locationLongitude != null && (!Number.isFinite(locationLongitude) || locationLongitude < -180 || locationLongitude > 180))) {
        return res.status(400).json({ error: 'Choose a valid map location or leave both coordinates empty.' });
      }
      const existingAccount = await db.get('SELECT id FROM account_profiles WHERE email = ? OR username = ?', [normalizedEmail, normalizedUsername]);
      if (existingAccount) return res.status(409).json({ error: 'That email address or username is already in use.' });
      await db.run('DELETE FROM registration_verifications WHERE expires_at <= NOW()');
      const pendingConflict = await db.get('SELECT id, email, username FROM registration_verifications WHERE email = ? OR username = ?', [normalizedEmail, normalizedUsername]);
      if (pendingConflict && pendingConflict.email !== normalizedEmail) {
        return res.status(409).json({ error: 'That username is already being used for a pending registration.' });
      }

      const verificationCode = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
      const verificationCodeHash = crypto.createHash('sha256').update(verificationCode).digest('hex');
      const passwordHash = await bcrypt.hash(password, 10);
      const profileData = {
        pangalan: fullName, first_name, last_name, middle_name, suffix, date_of_birth: date_of_birth || null,
        sex, place_of_birth, civil_status, phone_number, occupation, religion, address, registered_voter,
        latitude: locationLatitude, longitude: locationLongitude,
      };
      if (pendingConflict) {
        await db.run(`UPDATE registration_verifications SET username = ?, email = ?, password_hash = ?, profile_data = ?, is_resident = ?, verification_token_hash = ?, expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE), verified_at = NULL, attempts = 0 WHERE id = ?`,
          [normalizedUsername, normalizedEmail, passwordHash, JSON.stringify(profileData), is_resident, verificationCodeHash, pendingConflict.id]);
      } else {
        await db.run(`INSERT INTO registration_verifications (username, email, password_hash, profile_data, is_resident, verification_token_hash, expires_at) VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
          [normalizedUsername, normalizedEmail, passwordHash, JSON.stringify(profileData), is_resident, verificationCodeHash]);
      }
      failureStage = 'email';
      await sendRegistrationVerificationOtpEmail(normalizedEmail, normalizedUsername, verificationCode);
      res.status(202).json({ message: 'Verification code sent. Enter it here to continue to the Terms and Conditions.' });
    } catch (error) {
      console.error('Registration error:', error);
      if (failureStage === 'email') {
        const errorCode = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
        const message = errorCode === 'EAUTH'
          ? 'Gmail rejected the sender credentials. Check SMTP_USER and use a valid Google App Password in SMTP_PASS.'
          : errorCode === 'EENVELOPE'
            ? 'Gmail rejected the recipient address. Check that the email address is valid.'
            : 'Unable to send the verification email. Check the Gmail connection and email service settings, then try again.';
        return res.status(503).json({ error: message });
      }
      return res.status(503).json({ error: 'Unable to prepare your registration. Please try again, and contact support if the problem continues.' });
    }
  });

  app.post('/api/auth/register/verify-email', async (req, res) => {
    const token = typeof req.body.token === 'string' ? req.body.token : '';
    const code = typeof req.body.code === 'string' ? req.body.code.trim() : '';
    const registrationEmail = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (code && !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Enter the six-digit verification code from your email.' });
    if (!code && !/^[a-f0-9]{64}$/.test(token)) return res.status(400).json({ error: 'Enter a valid email verification code.' });

    try {
      const submittedValue = code || token;
      const submittedHash = crypto.createHash('sha256').update(submittedValue).digest('hex');
      const pending = code && registrationEmail
        ? await db.get(`
          SELECT id, username, email, verified_at, attempts, verification_token_hash
          FROM registration_verifications
          WHERE email = ? AND expires_at > NOW()
          ORDER BY created_at DESC
          LIMIT 1
        `, [registrationEmail])
        : await db.get(
          'SELECT id, username, email, verified_at, attempts, verification_token_hash FROM registration_verifications WHERE verification_token_hash = ? AND expires_at > NOW() LIMIT 1',
          [submittedHash]
        );
      if (!pending || pending.attempts >= 5 || (code && pending.verified_at)) {
        return res.status(400).json({ error: 'This verification code is invalid or expired. Request a new code and try again.' });
      }
      if (code && submittedHash !== pending.verification_token_hash) {
        await db.run('UPDATE registration_verifications SET attempts = attempts + 1 WHERE id = ?', [pending.id]);
        return res.status(400).json({ error: 'This verification code is invalid or expired. Request a new code and try again.' });
      }

      if (code || !pending.verified_at) {
        const continuationToken = crypto.randomBytes(32).toString('hex');
        const continuationHash = crypto.createHash('sha256').update(continuationToken).digest('hex');
        await db.run(
          `UPDATE registration_verifications SET verification_token_hash = ?, verified_at = NOW(), expires_at = DATE_ADD(NOW(), INTERVAL 30 MINUTE), attempts = 0 WHERE id = ?`,
          [continuationHash, pending.id]
        );
        return res.json({ verified: true, username: pending.username, email: pending.email, token: continuationToken });
      }

      res.json({ verified: true, username: pending.username, email: pending.email, token });
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(503).json({ error: 'Unable to verify the email code right now. Please try again.' });
    }
  });

  app.post('/api/auth/register/complete', async (req, res) => {
    const token = typeof req.body.token === 'string' ? req.body.token : '';
    const requestedResidency = req.body.is_resident;
    if (!/^[a-f0-9]{64}$/.test(token) || req.body.terms_agreed !== true) {
      return res.status(400).json({ error: 'Verify your email and accept the Terms and Conditions to activate your account.' });
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    try {
      const pending = await db.get('SELECT * FROM registration_verifications WHERE verification_token_hash = ? AND verified_at IS NOT NULL AND expires_at > NOW() LIMIT 1', [tokenHash]);
      if (!pending) return res.status(400).json({ error: 'Your verified registration has expired. Please register again.' });
      const profile = typeof pending.profile_data === 'string' ? JSON.parse(pending.profile_data) : pending.profile_data;
      if (profile.quick_signup === true) {
        if (profile.terms_agreed !== true) {
          return res.status(400).json({ error: 'Accept the Terms and Conditions before activating your account.' });
        }
        if (!['Resident', 'Non Resident'].includes(requestedResidency)) {
          return res.status(400).json({ error: 'Choose whether you are a Resident or Non-Resident before creating your account.' });
        }
        const created = await db.transaction(async (transactionDb) => {
          const lockedPending = await transactionDb.get(`
            SELECT * FROM registration_verifications
            WHERE id = ? AND verification_token_hash = ? AND verified_at IS NOT NULL AND expires_at > NOW()
            FOR UPDATE
          `, [pending.id, tokenHash]);
          if (!lockedPending) return null;
          const existingAccount = await transactionDb.get(
            'SELECT id FROM account_profiles WHERE email = ? OR username = ? LIMIT 1',
            [lockedPending.email, lockedPending.username]
          );
          if (existingAccount) return null;

          await transactionDb.run('UPDATE account_sequence SET next_id = next_id + 1 WHERE id = 1');
          const account = await transactionDb.get('SELECT next_id - 1 AS id FROM account_sequence WHERE id = 1');
          const table = requestedResidency === 'Resident' ? 'residents' : 'non_residents';
          await transactionDb.run(`
            INSERT INTO ${table}
              (user_id, pangalan, email, password, username, email_verified, profile_completed, terms_agreed_at)
            VALUES (?, ?, ?, ?, ?, 1, 0, CURRENT_TIMESTAMP)
          `, [account.id, profile.pangalan, lockedPending.email, lockedPending.password_hash, lockedPending.username]);
          await transactionDb.run('DELETE FROM registration_verifications WHERE id = ?', [lockedPending.id]);
          return transactionDb.get(`
            SELECT id, pangalan, email, role, is_resident, account_type, profile_completed
            FROM account_profiles WHERE id = ?
          `, [account.id]);
        });
        if (!created) return res.status(409).json({ error: 'This registration has already been completed or the email is now in use. Please sign in.' });
        const sessionToken = jwt.sign(
          { id: created.id, role: created.role, account_type: created.is_resident },
          JWT_SECRET,
          { expiresIn: '24h' }
        );
        return res.status(201).json({
          token: sessionToken,
          user: { ...created, profile_completed: Boolean(created.profile_completed) },
          message: 'Your email is verified and your account is ready.',
        });
      }
      const existing = await db.get('SELECT id FROM account_profiles WHERE email = ? OR username = ?', [pending.email, pending.username]);
      if (existing) return res.status(409).json({ error: 'That email address or username is already registered.' });

      const hasCoordinates = Number.isFinite(Number(profile.latitude)) && Number.isFinite(Number(profile.longitude)) && profile.latitude != null && profile.longitude != null;
      const boundaryMatches = hasCoordinates
        ? detectBoundaryMatches(Number(profile.latitude), Number(profile.longitude), await getBoundaryRows())
        : [];
      await db.run('UPDATE account_sequence SET next_id = next_id + 1 WHERE id = 1');
      const account = await db.get('SELECT next_id - 1 AS id FROM account_sequence WHERE id = 1');
      const table = pending.is_resident === 'Resident' ? 'residents' : 'non_residents';
      await db.run(`INSERT INTO ${table} (user_id, pangalan, email, password, username, email_verified, first_name, last_name, middle_name, suffix, date_of_birth, sex, place_of_birth, civil_status, phone_number, occupation, religion, address, registered_voter, latitude, longitude, detected_boundary_ids, terms_agreed_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, JSON_EXTRACT(?, '$'), CURRENT_TIMESTAMP)`,
        [account.id, profile.pangalan, pending.email, pending.password_hash, pending.username, profile.first_name || null, profile.last_name || null, profile.middle_name || null, profile.suffix || null, profile.date_of_birth || null, profile.sex || null, profile.place_of_birth || null, profile.civil_status || null, profile.phone_number || null, profile.occupation || null, profile.religion || null, profile.address || null, profile.registered_voter || null, hasCoordinates ? Number(profile.latitude) : null, hasCoordinates ? Number(profile.longitude) : null, JSON.stringify(boundaryMatches.map((boundary) => boundary.id))]);
      await db.run('DELETE FROM registration_verifications WHERE id = ?', [pending.id]);
      res.status(201).json({ message: 'Your email is verified and your account is active. You can now sign in with your username.' });
    } catch (error) {
      console.error('Account activation error:', error);
      res.status(500).json({ error: 'Unable to activate the account. Please try again.' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, username, password } = req.body;
    const identifier = typeof username === 'string' ? username.trim().toLowerCase() : (typeof email === 'string' ? email.trim().toLowerCase() : '');
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Enter your username and password.' });
    }

    const user = await db.get(`
      SELECT id, pangalan, email, username, password, role, is_resident, account_type, profile_completed
      FROM account_profiles
      WHERE email = ? OR username = ?
      LIMIT 1
    `, [identifier, identifier]);
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    const token = jwt.sign({ id: user.id, role: user.role, account_type: user.role === 'mamamayan' ? user.is_resident : 'Administrator' }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        pangalan: user.pangalan, 
        email: user.email, 
        role: user.role, 
        is_resident: user.is_resident,
        account_type: user.role === 'mamamayan' ? user.is_resident : 'Administrator',
        profile_completed: Boolean(user.profile_completed)
      } 
    });
  });

  app.post('/api/auth/forgot-password', async (req, res) => {
    const normalizedEmail = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const genericResponse = { message: 'Kung may account ang email na ito, makakatanggap ka ng OTP.' };
    if (!normalizedEmail) return res.json(genericResponse);

    try {
      const user = await db.get(`
        SELECT id, pangalan, email
        FROM account_profiles
        WHERE email = ?
        LIMIT 1
      `, [normalizedEmail]);

      if (user) {
        const otp = String(crypto.randomInt(100000, 1000000));
        const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
        await db.run('UPDATE password_reset_otps SET used_at = NOW() WHERE email = ? AND used_at IS NULL', [normalizedEmail]);
        await db.run(
          'INSERT INTO password_reset_otps (email, otp_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))',
          [normalizedEmail, otpHash]
        );
        await sendPasswordResetOtpEmail(normalizedEmail, user.pangalan, otp);
      }
    } catch (error) {
      console.error('Password reset request error:', error);
      return res.status(503).json({ error: 'Unable to send the OTP. Check the email service settings and try again.' });
    }

    res.json(genericResponse);
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    const { email, otp, password } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalizedEmail || !/^\d{6}$/.test(otp || '') || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Enter a valid email, a 6-digit OTP, and a password with at least 8 characters.' });
    }

    try {
      const reset = await db.get(`
        SELECT id, otp_hash, attempts
        FROM password_reset_otps
        WHERE email = ? AND used_at IS NULL AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
      `, [normalizedEmail]);
      if (!reset || reset.attempts >= 5) {
        return res.status(400).json({ error: 'The OTP is invalid or expired. Request a new OTP.' });
      }

      const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
      if (otpHash !== reset.otp_hash) {
        await db.run('UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = ?', [reset.id]);
        return res.status(400).json({ error: 'Mali ang OTP.' });
      }

      const user = await db.get('SELECT id, role, is_resident FROM account_profiles WHERE email = ? LIMIT 1', [normalizedEmail]);
      if (!user) return res.status(400).json({ error: 'Account not found.' });

      const passwordHash = await bcrypt.hash(password, 10);
      const table = user.role === 'mamamayan'
        ? (user.is_resident === 'Resident' ? 'residents' : 'non_residents')
        : 'administrators';
      await db.run(`UPDATE ${table} SET password = ? WHERE user_id = ?`, [passwordHash, user.id]);
      await db.run('UPDATE password_reset_otps SET used_at = NOW() WHERE id = ?', [reset.id]);
      res.json({ message: 'Password reset successfully. You can now sign in.' });
    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({ error: 'Unable to reset the password. Please try again.' });
    }
  });

  app.post('/api/auth/google', async (req, res) => {
    const { credential } = req.body;
    if (!googleClient || !GOOGLE_CLIENT_ID) {
      return res.status(503).json({ error: 'Google sign-in is not configured.' });
    }
    if (!credential) {
      return res.status(400).json({ error: 'Google credentials are missing.' });
    }

    try {
      const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email || !payload.email_verified) {
        return res.status(401).json({ error: 'Unable to verify the Google account.' });
      }

      const normalizedEmail = payload.email.toLowerCase();
      let user: any = await db.get(`
        SELECT id, pangalan, email, password, role, is_resident, account_type, profile_completed
        FROM account_profiles
        WHERE email = ?
        LIMIT 1
      `, [normalizedEmail]);

      if (!user) {
        await db.run('UPDATE account_sequence SET next_id = next_id + 1 WHERE id = 1');
        const account = await db.get('SELECT next_id - 1 AS id FROM account_sequence WHERE id = 1');
        const pangalan = payload.name?.trim() || normalizedEmail.split('@')[0];
        const password = await bcrypt.hash(`google:${payload.sub}:${crypto.randomUUID()}`, 10);
        await db.run(
          'INSERT INTO residents (user_id, pangalan, email, password, profile_completed) VALUES (?, ?, ?, ?, 0)',
          [account.id, pangalan, normalizedEmail, password]
        );
        user = {
          id: account.id,
          pangalan,
          email: normalizedEmail,
          role: 'mamamayan',
          is_resident: 'Resident',
          account_type: 'Resident'
        };
      }

      const otp = String(crypto.randomInt(100000, 1000000));
      const challenge = crypto.randomBytes(32).toString('hex');
      const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
      const challengeHash = crypto.createHash('sha256').update(challenge).digest('hex');
      await db.run('UPDATE google_login_otps SET used_at = NOW() WHERE email = ? AND used_at IS NULL', [normalizedEmail]);
      await db.run(
        'INSERT INTO google_login_otps (challenge_hash, email, otp_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))',
        [challengeHash, normalizedEmail, otpHash]
      );
      await sendGoogleLoginOtpEmail(normalizedEmail, user.pangalan, otp);
      res.json({ challenge, email: normalizedEmail });
    } catch (error) {
      console.error('Google login error:', error);
      res.status(401).json({ error: 'Unable to verify the Google account or send the OTP.' });
    }
  });

  app.post('/api/auth/google/verify-otp', async (req, res) => {
    const { challenge, otp } = req.body;
    if (typeof challenge !== 'string' || !/^[a-f0-9]{64}$/.test(challenge) || !/^\d{6}$/.test(otp || '')) {
      return res.status(400).json({ error: 'Enter a valid 6-digit OTP.' });
    }

    try {
      const challengeHash = crypto.createHash('sha256').update(challenge).digest('hex');
      const loginOtp = await db.get(`
        SELECT id, email, otp_hash, attempts
        FROM google_login_otps
        WHERE challenge_hash = ? AND used_at IS NULL AND expires_at > NOW()
        LIMIT 1
      `, [challengeHash]);
      if (!loginOtp || loginOtp.attempts >= 5) {
        return res.status(400).json({ error: 'The OTP is invalid or expired. Sign in with Google again.' });
      }

      const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
      if (otpHash !== loginOtp.otp_hash) {
        await db.run('UPDATE google_login_otps SET attempts = attempts + 1 WHERE id = ?', [loginOtp.id]);
        return res.status(400).json({ error: 'Mali ang OTP.' });
      }

      const user = await db.get(`
        SELECT id, pangalan, email, role, is_resident, account_type, profile_completed
        FROM account_profiles
        WHERE email = ?
        LIMIT 1
      `, [loginOtp.email]);
      if (!user) return res.status(400).json({ error: 'Account not found.' });

      await db.run('UPDATE google_login_otps SET used_at = NOW() WHERE id = ?', [loginOtp.id]);
      const token = jwt.sign(
        {
          id: user.id,
          role: user.role,
          account_type: user.role === 'mamamayan' ? user.is_resident : 'Administrator'
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      res.json({
        token,
        user: {
          id: user.id,
          pangalan: user.pangalan,
          email: user.email,
          role: user.role,
          is_resident: user.is_resident,
          account_type: user.account_type || (user.role === 'mamamayan' ? user.is_resident : 'Administrator'),
          profile_completed: Boolean(user.profile_completed)
        }
      });
    } catch (error) {
      console.error('Google OTP verification error:', error);
      res.status(500).json({ error: 'Unable to verify the OTP. Please try again.' });
    }
  });

const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication is required.' });
  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) return res.status(403).json({ error: 'Invalid token.' });
    req.user = decoded;
    next();
  });
};

  const maskEmail = (email: unknown) => {
    if (typeof email !== 'string' || !email.trim()) return '';
    const trimmed = email.trim();
    const atIndex = trimmed.indexOf('@');
    if (atIndex <= 0) return trimmed;
    const localPart = trimmed.slice(0, atIndex);
    const domain = trimmed.slice(atIndex);
    if (localPart.length <= 2) return `${localPart}***${domain}`;
    if (localPart.length === 3) return `${localPart.slice(0, 2)}*${domain}`;
    const firstTwo = localPart.slice(0, 2);
    const lastChar = localPart.slice(-1);
    const asterisks = '*'.repeat(Math.max(3, localPart.length - 3));
    return `${firstTwo}${asterisks}${lastChar}${domain}`;
  };

  const getBoundaryRows = async (includeInactive = false) => {
    const rows = await db.all(`
      SELECT b.*, bt.name AS type_name, bt.color AS type_color, p.name AS parent_name
      FROM boundaries b
      JOIN boundary_types bt ON bt.id = b.type_id
      LEFT JOIN boundaries p ON p.id = b.parent_id
      WHERE b.deleted_at IS NULL ${includeInactive ? '' : "AND b.status = 'active' AND bt.is_active = 1"}
      ORDER BY b.name ASC
    `);
    return rows.map((row: any) => ({ ...row, geometry: parseBoundaryGeometry(row.geometry) }));
  };
  const requireBoundaryAdmin = (req: any, res: any) => {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Administrator access is required to manage geographic boundaries.' });
      return false;
    }
    return true;
  };
  const auditBoundary = (req: any, boundaryId: number | null, action: string, oldValue: unknown, newValue: unknown) =>
    db.run(
      'INSERT INTO boundary_audit (boundary_id, user_id, action, old_value, new_value, ip_address, user_agent) VALUES (?, ?, ?, JSON_EXTRACT(?, \'$\'), JSON_EXTRACT(?, \'$\'), ?, ?)',
      [boundaryId, req.user.id, action, oldValue == null ? null : JSON.stringify(oldValue), newValue == null ? null : JSON.stringify(newValue), req.ip || null, String(req.get('user-agent') || '').slice(0, 500) || null]
    );
  const validateBoundaryParent = async (parentId: number | null, boundaryId?: number, geometry?: ReturnType<typeof parseBoundaryGeometry>) => {
    if (parentId == null) return;
    if (!Number.isInteger(parentId) || parentId < 1 || parentId === boundaryId) throw new Error('Choose a valid parent boundary.');
    let currentId: number | null = parentId;
    const visited = new Set<number>();
    while (currentId) {
      if (currentId === boundaryId) throw new Error('This parent assignment would create a hierarchy cycle.');
      if (visited.has(currentId)) throw new Error('The existing parent hierarchy contains a cycle.');
      visited.add(currentId);
      const current = await db.get('SELECT id, parent_id, geometry FROM boundaries WHERE id = ? AND status = \'active\' AND deleted_at IS NULL', [currentId]);
      if (!current) throw new Error('Choose an active parent boundary.');
      if (currentId === parentId && geometry && !boundaryContains(parseBoundaryGeometry(current.geometry), geometry)) {
        throw new Error('The child boundary must fit inside its selected parent.');
      }
      currentId = current.parent_id == null ? null : Number(current.parent_id);
    }
  };
  const findBoundaryOverlaps = async (geometry: ReturnType<typeof parseBoundaryGeometry>, typeId: number, excludeId?: number) => {
    const candidates = await db.all("SELECT id, name, geometry FROM boundaries WHERE type_id = ? AND status = 'active' AND deleted_at IS NULL AND id <> COALESCE(?, 0)", [typeId, excludeId || null]);
    return candidates.filter((candidate: any) => {
      try {
        return boundaryIntersects(geometry, parseBoundaryGeometry(candidate.geometry));
      } catch {
        return false;
      }
    }).map((candidate: any) => ({ id: Number(candidate.id), name: candidate.name }));
  };
  const resolveBoundaryLocation = async (latitudeValue: unknown, longitudeValue: unknown) => {
    const hasLatitude = latitudeValue != null && latitudeValue !== '';
    const hasLongitude = longitudeValue != null && longitudeValue !== '';
    if (!hasLatitude && !hasLongitude) return { latitude: null, longitude: null, ids: [] as number[] };
    const latitude = Number(latitudeValue);
    const longitude = Number(longitudeValue);
    if (!hasLatitude || !hasLongitude || !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new Error('Choose a valid map location or leave both coordinates empty.');
    }
    const matches = detectBoundaryMatches(latitude, longitude, await getBoundaryRows());
    return { latitude, longitude, ids: matches.map((boundary) => boundary.id) };
  };

  app.get('/api/boundaries', async (_req, res) => {
    try {
      res.json(await getBoundaryRows());
    } catch (error) {
      console.error('Boundary list error:', error);
      res.status(500).json({ error: 'Unable to load geographic boundaries.' });
    }
  });

  app.get('/api/admin/boundaries', authenticate, async (req: any, res) => {
    if (!requireBoundaryAdmin(req, res)) return;
    try {
      res.json(await getBoundaryRows(true));
    } catch (error) {
      console.error('Admin boundary list error:', error);
      res.status(500).json({ error: 'Unable to load geographic boundaries.' });
    }
  });

  app.get('/api/boundaries/types', async (_req, res) => {
    try {
      res.json(await db.all('SELECT id, name, color FROM boundary_types WHERE is_active = 1 ORDER BY name ASC'));
    } catch (error) {
      console.error('Boundary type list error:', error);
      res.status(500).json({ error: 'Unable to load boundary types.' });
    }
  });

  app.get('/api/boundaries/:id', async (req, res) => {
    try {
      const boundary = await db.get(`
        SELECT b.*, bt.name AS type_name, bt.color AS type_color, p.name AS parent_name
        FROM boundaries b
        JOIN boundary_types bt ON bt.id = b.type_id
        LEFT JOIN boundaries p ON p.id = b.parent_id
        WHERE b.id = ? AND b.status = 'active' AND b.deleted_at IS NULL AND bt.is_active = 1
      `, [req.params.id]);
      if (!boundary) return res.status(404).json({ error: 'Boundary not found.' });
      res.json({ ...boundary, geometry: parseBoundaryGeometry(boundary.geometry) });
    } catch (error) {
      res.status(500).json({ error: 'Unable to load this boundary.' });
    }
  });

  app.post('/api/boundaries/types', authenticate, async (req: any, res) => {
    if (!requireBoundaryAdmin(req, res)) return;
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const color = typeof req.body.color === 'string' ? req.body.color : '';
    if (!name || name.length > 64 || !/^#[0-9a-fA-F]{6}$/.test(color)) return res.status(400).json({ error: 'Enter a boundary type name and a valid color.' });
    try {
      const result = await db.run('INSERT INTO boundary_types (name, color) VALUES (?, ?)', [name, color]);
      await auditBoundary(req, null, 'type_created', null, { id: result.lastID, name, color });
      res.status(201).json({ id: result.lastID, name, color });
    } catch (error) {
      res.status(409).json({ error: 'That boundary type already exists.' });
    }
  });

  app.patch('/api/boundaries/types/:id', authenticate, async (req: any, res) => {
    if (!requireBoundaryAdmin(req, res)) return;
    const id = Number(req.params.id);
    const color = typeof req.body.color === 'string' ? req.body.color : '';
    if (!Number.isInteger(id) || id < 1 || (color && !/^#[0-9a-fA-F]{6}$/.test(color))) return res.status(400).json({ error: 'Choose a valid boundary type and color.' });
    try {
      const previous = await db.get('SELECT id, name, color, is_active FROM boundary_types WHERE id = ?', [id]);
      if (!previous) return res.status(404).json({ error: 'Boundary type not found.' });
      const isActive = req.body.is_active == null ? previous.is_active : req.body.is_active ? 1 : 0;
      await db.run('UPDATE boundary_types SET color = ?, is_active = ? WHERE id = ?', [color || previous.color, isActive, id]);
      const updated = { ...previous, color: color || previous.color, is_active: isActive };
      await auditBoundary(req, null, 'type_updated', previous, updated);
      res.json(updated);
    } catch (error) {
      console.error('Boundary type update error:', error);
      res.status(500).json({ error: 'Unable to update the boundary type.' });
    }
  });

  app.post('/api/boundaries', authenticate, async (req: any, res) => {
    if (!requireBoundaryAdmin(req, res)) return;
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const code = typeof req.body.code === 'string' && req.body.code.trim() ? req.body.code.trim() : null;
    const typeId = Number(req.body.type_id);
    const parentId = req.body.parent_id == null || req.body.parent_id === '' ? null : Number(req.body.parent_id);
    const color = typeof req.body.color === 'string' ? req.body.color : '';
    const fillColor = typeof req.body.fill_color === 'string' ? req.body.fill_color : color;
    const fillOpacity = Number(req.body.fill_opacity ?? 0.15);
    const borderWidth = Number(req.body.border_width ?? 2);
    if (!name || name.length > 150 || (code && code.length > 64) || !Number.isInteger(typeId) ||
        !/^#[0-9a-fA-F]{6}$/.test(color) || !/^#[0-9a-fA-F]{6}$/.test(fillColor) ||
        !Number.isFinite(fillOpacity) || fillOpacity < 0 || fillOpacity > 0.7 ||
        !Number.isFinite(borderWidth) || borderWidth < 0.5 || borderWidth > 8) {
      return res.status(400).json({ error: 'Check the name, type, color, fill opacity, and border width.' });
    }
    let geometry;
    try {
      geometry = parseBoundaryGeometry(req.body.geometry);
      await validateBoundaryParent(parentId, undefined, geometry);
      const type = await db.get('SELECT id FROM boundary_types WHERE id = ? AND is_active = 1', [typeId]);
      if (!type) return res.status(400).json({ error: 'Choose an active boundary type.' });
      const overlaps = await findBoundaryOverlaps(geometry, typeId);
      if (overlaps.length && req.body.allow_overlap !== true) {
        return res.status(409).json({ error: 'This boundary overlaps active boundaries of the same type.', overlaps });
      }
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Boundary data is invalid.' });
    }
    try {
      const result = await db.run(
        'INSERT INTO boundaries (name, code, type_id, parent_id, geometry, color, fill_color, fill_opacity, border_width, description, created_by) VALUES (?, ?, ?, ?, JSON_EXTRACT(?, \'$\'), ?, ?, ?, ?, ?, ?)',
        [name, code, typeId, parentId, JSON.stringify(geometry), color, fillColor, fillOpacity, borderWidth, typeof req.body.description === 'string' ? req.body.description.trim().slice(0, 5000) : null, req.user.id]
      );
      const created = await db.get('SELECT * FROM boundaries WHERE id = ?', [result.lastID]);
      await auditBoundary(req, result.lastID, 'created', null, created);
      res.status(201).json(created);
    } catch (error) {
      console.error('Boundary create error:', error);
      res.status(409).json({ error: 'That boundary code is already in use or the boundary could not be saved.' });
    }
  });

  app.put('/api/boundaries/:id', authenticate, async (req: any, res) => {
    if (!requireBoundaryAdmin(req, res)) return;
    const id = Number(req.params.id);
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const code = typeof req.body.code === 'string' && req.body.code.trim() ? req.body.code.trim() : null;
    const typeId = Number(req.body.type_id);
    const parentId = req.body.parent_id == null || req.body.parent_id === '' ? null : Number(req.body.parent_id);
    const color = typeof req.body.color === 'string' ? req.body.color : '';
    const fillColor = typeof req.body.fill_color === 'string' ? req.body.fill_color : color;
    const fillOpacity = Number(req.body.fill_opacity);
    const borderWidth = Number(req.body.border_width);
    if (!Number.isInteger(id) || id < 1 || !name || name.length > 150 || (code && code.length > 64) || !Number.isInteger(typeId) ||
        !/^#[0-9a-fA-F]{6}$/.test(color) || !/^#[0-9a-fA-F]{6}$/.test(fillColor) ||
        !Number.isFinite(fillOpacity) || fillOpacity < 0 || fillOpacity > 0.7 ||
        !Number.isFinite(borderWidth) || borderWidth < 0.5 || borderWidth > 8) {
      return res.status(400).json({ error: 'Check the name, type, color, fill opacity, and border width.' });
    }
    try {
      const previous = await db.get('SELECT * FROM boundaries WHERE id = ? AND deleted_at IS NULL', [id]);
      if (!previous) return res.status(404).json({ error: 'Boundary not found.' });
      await validateBoundaryParent(parentId, id, parseBoundaryGeometry(previous.geometry));
      const type = await db.get('SELECT id FROM boundary_types WHERE id = ? AND is_active = 1', [typeId]);
      if (!type) return res.status(400).json({ error: 'Choose an active boundary type.' });
      const overlaps = await findBoundaryOverlaps(parseBoundaryGeometry(previous.geometry), typeId, id);
      if (overlaps.length && req.body.allow_overlap !== true) {
        return res.status(409).json({ error: 'This boundary overlaps active boundaries of the same type.', overlaps });
      }
      await db.run(
        'UPDATE boundaries SET name = ?, code = ?, type_id = ?, parent_id = ?, color = ?, fill_color = ?, fill_opacity = ?, border_width = ?, description = ? WHERE id = ?',
        [name, code, typeId, parentId, color, fillColor, fillOpacity, borderWidth, typeof req.body.description === 'string' ? req.body.description.trim().slice(0, 5000) : null, id]
      );
      const updated = await db.get('SELECT * FROM boundaries WHERE id = ?', [id]);
      await auditBoundary(req, id, 'updated', previous, updated);
      res.json(updated);
    } catch (error) {
      console.error('Boundary update error:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : 'Boundary could not be updated.' });
    }
  });

  app.put('/api/boundaries/:id/geometry', authenticate, async (req: any, res) => {
    if (!requireBoundaryAdmin(req, res)) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Choose a valid boundary.' });
    try {
      const geometry = parseBoundaryGeometry(req.body.geometry);
      const previous = await db.get('SELECT geometry, parent_id, type_id FROM boundaries WHERE id = ? AND deleted_at IS NULL', [id]);
      if (!previous) return res.status(404).json({ error: 'Boundary not found.' });
      const oldGeometry = parseBoundaryGeometry(previous.geometry);
      await validateBoundaryParent(previous.parent_id == null ? null : Number(previous.parent_id), id, geometry);
      const children = await db.all("SELECT id, name, geometry FROM boundaries WHERE parent_id = ? AND status = 'active' AND deleted_at IS NULL", [id]);
      for (const child of children) {
        if (!boundaryContains(geometry, parseBoundaryGeometry(child.geometry))) {
          return res.status(400).json({ error: `The edited shape would exclude child boundary "${child.name}".` });
        }
      }
      const overlaps = await findBoundaryOverlaps(geometry, Number(previous.type_id), id);
      if (overlaps.length && req.body.allow_overlap !== true) {
        return res.status(409).json({ error: 'This boundary overlaps active boundaries of the same type.', overlaps });
      }
      await db.run("UPDATE boundaries SET geometry = JSON_EXTRACT(?, '$') WHERE id = ?", [JSON.stringify(geometry), id]);
      await auditBoundary(req, id, 'geometry_updated', oldGeometry, geometry);
      res.json({ message: 'Boundary shape updated.' });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Boundary geometry is invalid.' });
    }
  });

  app.put('/api/boundaries/:id/status', authenticate, async (req: any, res) => {
    if (!requireBoundaryAdmin(req, res)) return;
    const id = Number(req.params.id);
    const status = req.body.status;
    if (!Number.isInteger(id) || id < 1 || !['active', 'inactive'].includes(status)) return res.status(400).json({ error: 'Choose a valid boundary status.' });
    try {
      const previous = await db.get('SELECT id, name, status FROM boundaries WHERE id = ? AND deleted_at IS NULL', [id]);
      if (!previous) return res.status(404).json({ error: 'Boundary not found.' });
      if (status === 'inactive') {
        const children = await db.all("SELECT id, name FROM boundaries WHERE parent_id = ? AND status = 'active' AND deleted_at IS NULL", [id]);
        if (children.length) return res.status(409).json({ error: 'Deactivate child boundaries first.', children });
      }
      await db.run('UPDATE boundaries SET status = ? WHERE id = ?', [status, id]);
      await auditBoundary(req, id, status === 'active' ? 'activated' : 'deactivated', previous, { ...previous, status });
      res.json({ message: `Boundary ${status}.` });
    } catch (error) {
      console.error('Boundary status update error:', error);
      res.status(500).json({ error: 'Unable to update boundary status.' });
    }
  });

  app.delete('/api/boundaries/:id', authenticate, async (req: any, res) => {
    if (!requireBoundaryAdmin(req, res)) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Choose a valid boundary.' });
    try {
      const boundary = await db.get('SELECT id, name, status FROM boundaries WHERE id = ? AND deleted_at IS NULL', [id]);
      if (!boundary) return res.status(404).json({ error: 'Boundary not found.' });
      const children = await db.all('SELECT id, name FROM boundaries WHERE parent_id = ? AND status = \'active\' AND deleted_at IS NULL', [id]);
      if (children.length) return res.status(409).json({ error: 'Deactivate child boundaries before archiving this boundary.', children });
      await db.run("UPDATE boundaries SET status = 'inactive', deleted_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
      await auditBoundary(req, id, 'archived', boundary, { ...boundary, status: 'inactive', deleted_at: new Date().toISOString() });
      res.json({ message: 'Boundary archived. Its geometry and audit history are preserved.' });
    } catch (error) {
      console.error('Boundary archive error:', error);
      res.status(500).json({ error: 'Unable to archive this boundary.' });
    }
  });

  app.get('/api/boundaries/:id/children', authenticate, async (req: any, res) => {
    if (!requireBoundaryAdmin(req, res)) return;
    try {
      res.json(await db.all("SELECT id, name, code, status FROM boundaries WHERE parent_id = ? AND deleted_at IS NULL ORDER BY name ASC", [req.params.id]));
    } catch (error) {
      res.status(500).json({ error: 'Unable to load child boundaries.' });
    }
  });

  app.post('/api/location/detect-boundaries', async (req, res) => {
    const latitude = Number(req.body.latitude);
    const longitude = Number(req.body.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Enter valid latitude and longitude values.' });
    }
    try {
      const boundaries = await getBoundaryRows();
      const matches = detectBoundaryMatches(latitude, longitude, boundaries);
      res.json({ latitude, longitude, matches, boundaries: buildBoundaryClassification(matches) });
    } catch (error) {
      console.error('Boundary detection error:', error);
      res.status(500).json({ error: 'Unable to classify this location.' });
    }
  });

  const locationSearchCache = new Map<string, { timestamp: number; data: any }>();

  app.get('/api/location/search', async (req, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      if (!q || q.length < 2) return res.json({ results: [] });

      const cacheKey = q.toLowerCase();
      const cached = locationSearchCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 60000) {
        return res.json({ results: cached.data });
      }

      const allBoundaries = await getBoundaryRows();
      const results: Array<{
        address: string;
        short_name: string;
        latitude: number;
        longitude: number;
        is_in_san_andres: boolean;
        matched_zone: string | null;
      }> = [];

      // 1. Search local active boundaries (subdivisions, zones, streets, landmarks in San Andres)
      const qLower = q.toLowerCase();
      for (const b of allBoundaries) {
        const nameMatch = b.name.toLowerCase().includes(qLower);
        const descMatch = b.description && b.description.toLowerCase().includes(qLower);
        if (nameMatch || descMatch) {
          try {
            const geom = b.geometry;
            const ring = geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0][0];
            if (Array.isArray(ring) && ring.length > 0) {
              const avgLng = ring.reduce((sum: number, p: any) => sum + p[0], 0) / ring.length;
              const avgLat = ring.reduce((sum: number, p: any) => sum + p[1], 0) / ring.length;
              const matches = detectBoundaryMatches(avgLat, avgLng, allBoundaries);
              const isInSanAndres = matches.some((m) => m.type.toLowerCase() === 'barangay' || m.name.toLowerCase().includes('san andres'));
              const matchedZone = matches.find((m) => m.type.toLowerCase() !== 'barangay' && !m.name.toLowerCase().includes('barangay san andres'))?.name || (b.type_name !== 'Barangay' ? b.name : null);
              results.push({
                address: `${b.name}, Barangay San Andres, Cainta, Rizal`,
                short_name: b.name,
                latitude: avgLat,
                longitude: avgLng,
                is_in_san_andres: isInSanAndres,
                matched_zone: matchedZone,
              });
            }
          } catch {
            // Ignore parsing errors for custom geometries
          }
        }
      }

      // 2. Query external places search (Photon / OSM) for real streets and landmarks
      try {
        const queryWithContext = qLower.includes('cainta') || qLower.includes('san andres') || qLower.includes('rizal')
          ? q
          : `${q}, Cainta, Rizal`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        const externalRes = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(queryWithContext)}&lat=14.568&lon=121.108&limit=8`,
          { signal: controller.signal, headers: { 'User-Agent': 'BarangaySanAndresComplaintSystem/1.0' } }
        );
        clearTimeout(timeout);
        if (externalRes.ok) {
          const externalData = (await externalRes.json()) as any;
          if (Array.isArray(externalData.features)) {
            for (const f of externalData.features) {
              const coords = f.geometry?.coordinates;
              if (Array.isArray(coords) && coords.length >= 2) {
                const lng = Number(coords[0]);
                const lat = Number(coords[1]);
                if (Number.isFinite(lat) && Number.isFinite(lng)) {
                  const p = f.properties || {};
                  const name = p.name || p.street || q;
                  const parts = [
                    name,
                    p.street && p.street !== name ? p.street : null,
                    p.district || p.suburb || p.city || 'Cainta',
                    p.state || 'Rizal',
                  ].filter(Boolean);
                  const fullAddress = parts.join(', ');
                  const matches = detectBoundaryMatches(lat, lng, allBoundaries);
                  const isInSanAndres = matches.some((m) => m.type.toLowerCase() === 'barangay' || m.name.toLowerCase().includes('san andres'));
                  const matchedZone = matches.find((m) => m.type.toLowerCase() !== 'barangay' && !m.name.toLowerCase().includes('barangay san andres'))?.name || null;

                  if (!results.some((r) => Math.abs(r.latitude - lat) < 0.0001 && Math.abs(r.longitude - lng) < 0.0001)) {
                    results.push({
                      address: fullAddress,
                      short_name: name,
                      latitude: lat,
                      longitude: lng,
                      is_in_san_andres: isInSanAndres,
                      matched_zone: matchedZone,
                    });
                  }
                }
              }
            }
          }
        }
      } catch {
        // Fallback gracefully to local matches if external provider fails
      }

      results.sort((a, b) => (b.is_in_san_andres ? 1 : 0) - (a.is_in_san_andres ? 1 : 0));
      const finalResults = results.slice(0, 10);
      locationSearchCache.set(cacheKey, { timestamp: Date.now(), data: finalResults });
      res.json({ results: finalResults });
    } catch (error) {
      console.error('Location search error:', error);
      res.status(500).json({ error: 'Unable to search locations.' });
    }
  });

  app.post('/api/location/validate', async (req, res) => {
    try {
      let { latitude, longitude, address } = req.body;
      let lat = Number(latitude);
      let lng = Number(longitude);

      const allBoundaries = await getBoundaryRows();

      // 1. If address string contains coordinates (e.g. copied from Google Maps: "14.5682, 121.1078"), extract them
      if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && typeof address === 'string') {
        const coordMatch = address.match(/(-?\d+\.\d{3,})\s*,\s*(-?\d+\.\d{3,})/);
        if (coordMatch) {
          lat = Number(coordMatch[1]);
          lng = Number(coordMatch[2]);
        }
      }

      // 2. If coordinates missing, match against local San Andres boundaries (subdivisions, zones, landmarks)
      if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && typeof address === 'string' && address.trim()) {
        const qLower = address.toLowerCase();
        for (const b of allBoundaries) {
          const bLower = b.name.toLowerCase();
          if (bLower.includes(qLower) || qLower.includes(bLower)) {
            try {
              const geom = b.geometry;
              const ring = geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0][0];
              if (Array.isArray(ring) && ring.length > 0) {
                lng = ring.reduce((sum: number, p: any) => sum + p[0], 0) / ring.length;
                lat = ring.reduce((sum: number, p: any) => sum + p[1], 0) / ring.length;
                break;
              }
            } catch {
              // ignore geometry parsing error
            }
          }
        }
      }

      // 3. If coordinates still missing, geocode via Photon/OSM
      if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && typeof address === 'string' && address.trim()) {
        try {
          const q = address.trim();
          const queryWithContext = q.toLowerCase().includes('cainta') || q.toLowerCase().includes('san andres') || q.toLowerCase().includes('rizal')
            ? q
            : `${q}, San Andres, Cainta, Rizal`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 2500);
          const photonRes = await fetch(
            `https://photon.komoot.io/api/?q=${encodeURIComponent(queryWithContext)}&lat=14.568&lon=121.108&limit=1`,
            { signal: controller.signal, headers: { 'User-Agent': 'BarangaySanAndresComplaintSystem/1.0' } }
          );
          clearTimeout(timeout);
          if (photonRes.ok) {
            const photonData = (await photonRes.json()) as any;
            const firstCoord = photonData?.features?.[0]?.geometry?.coordinates;
            if (Array.isArray(firstCoord) && firstCoord.length >= 2) {
              lng = Number(firstCoord[0]);
              lat = Number(firstCoord[1]);
            }
          }
        } catch {
          // ignore external fetch failures
        }
      }

      // 4. Fallback: If still no coordinates, default to San Andres center if address mentions San Andres, Cainta, or a local street/area
      if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && typeof address === 'string' && address.trim()) {
        const qLower = address.toLowerCase();
        const outsideKnown = ['quezon city', 'manila', 'makati', 'pasig', 'taguig', 'marikina', 'antipolo', 'taytay', 'caloocan', 'cebu', 'davao'];
        const isExplicitlyOutside = outsideKnown.some(city => qLower.includes(city));
        if (!isExplicitlyOutside) {
          lat = 14.5682;
          lng = 121.1078;
        }
      }

      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({ valid: false, insideSanAndres: false, message: 'Valid location address or coordinates are required.' });
      }
      const matches = detectBoundaryMatches(lat, lng, allBoundaries);
      const isInSanAndres = matches.some((m) => m.type.toLowerCase() === 'barangay' || m.name.toLowerCase().includes('san andres'));
      const matchedZone = matches.find((m) => m.type.toLowerCase() !== 'barangay' && !m.name.toLowerCase().includes('barangay san andres'))?.name || null;

      if (!isInSanAndres) {
        return res.json({
          valid: false,
          in_san_andres: false,
          insideSanAndres: false,
          latitude: lat,
          longitude: lng,
          matched_zone: null,
          zone: null,
          message: 'The selected location is outside the coverage of Barangay San Andres, Cainta, Rizal. Only complaints within Barangay San Andres coverage can be accepted.',
        });
      }

      return res.json({
        valid: true,
        in_san_andres: true,
        insideSanAndres: true,
        latitude: lat,
        longitude: lng,
        matched_zone: matchedZone,
        zone: matchedZone,
        message: matchedZone
          ? `Verified inside Barangay San Andres (${matchedZone}).`
          : 'Verified inside Barangay San Andres.',
      });
    } catch (error) {
      console.error('Location validate error:', error);
      res.status(500).json({ valid: false, insideSanAndres: false, message: 'Unable to verify location at this time.' });
    }
  });

// Move AUTH ROUTES after authenticate definition
app.get('/api/auth/verify', authenticate, async (req: any, res) => {
  try {
    const user = await db.get(`
            SELECT id, pangalan, email, role, is_resident, account_type, profile_completed
            FROM account_profiles
            WHERE id = ?
    `, [req.user.id]);
    res.json({ valid: true, user: user ? { ...user, profile_completed: Boolean(user.profile_completed) } : null });
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.get('/api/auth/profile/details', authenticate, async (req: any, res) => {
  try {
    if (req.user.role !== 'mamamayan') return res.status(403).json({ error: 'Only resident accounts can view this profile.' });
    const profile = await db.get(`
      SELECT p.pangalan, p.email, p.is_resident, p.account_type, p.profile_completed, r.phone_number, r.address
      FROM account_profiles p
      JOIN ${req.user.account_type === 'Non Resident' ? 'non_residents' : 'residents'} r ON r.user_id = p.id
      WHERE p.id = ?
    `, [req.user.id]);
    if (!profile) return res.status(404).json({ error: 'Account not found.' });
    res.json(profile);
  } catch (error) {
    console.error('Profile details error:', error);
    res.status(500).json({ error: 'Unable to load your profile details.' });
  }
});

app.get('/api/admin/verified-accounts', authenticate, async (req: any, res) => {
  try {
    if (!['admin', 'official'].includes(req.user.role)) return res.status(403).json({ error: 'Staff access is required.' });
    const accounts = await db.all(`
      SELECT id, pangalan, email, username, is_resident, account_type
      FROM account_profiles
      WHERE role = 'mamamayan' AND email_verified = 1
      ORDER BY is_resident ASC, pangalan ASC
    `);
    res.json(accounts.map((a: any) => ({ ...a, email: maskEmail(a.email) })));
  } catch (error) {
    console.error('Verified accounts error:', error);
    res.status(500).json({ error: 'Unable to load verified accounts.' });
  }
});

app.patch('/api/auth/profile', authenticate, async (req: any, res) => {
  try {
    if (req.user.role !== 'mamamayan') return res.status(403).json({ error: 'Only resident accounts can update this profile.' });
    const fullName = typeof req.body.pangalan === 'string' ? req.body.pangalan.trim() : '';
    const phoneNumber = typeof req.body.phone_number === 'string' ? req.body.phone_number.trim() : '';
    const address = typeof req.body.address === 'string' ? req.body.address.trim() : '';
    if (!fullName || fullName.length > 255) return res.status(400).json({ error: 'Enter a name of no more than 255 characters.' });
    if (phoneNumber.length > 30 || address.length > 500) return res.status(400).json({ error: 'Phone number or address is too long.' });

    const profile = await db.get('SELECT is_resident FROM account_profiles WHERE id = ? AND role = ?', [req.user.id, 'mamamayan']);
    if (!profile) return res.status(404).json({ error: 'Account not found.' });
    const table = profile.is_resident === 'Non Resident' ? 'non_residents' : 'residents';
    await db.run(`UPDATE ${table} SET pangalan = ?, phone_number = ?, address = ?, profile_completed = 1 WHERE user_id = ?`, [fullName, phoneNumber || null, address || null, req.user.id]);
    const user = await db.get('SELECT id, pangalan, email, role, is_resident, account_type, profile_completed FROM account_profiles WHERE id = ?', [req.user.id]);
    res.json({ message: 'Profile updated.', user: user ? { ...user, profile_completed: Boolean(user.profile_completed) } : null });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Unable to update your profile right now.' });
  }
});

  // --- NOTIFICATION ROUTES ---
  app.get('/api/notifications', authenticate, async (req: any, res) => {
    try {
      const visibleTypes = req.user.role === 'mamamayan'
        ? ['status_update', 'mediation_scheduled', 'mediation_summon', 'mediation_outcome', 'mediation_update']
        : ['new_complaint'];
      const placeholders = visibleTypes.map(() => '?').join(', ');
      const notifications = await db.all(
        `SELECT * FROM notifications WHERE user_id = ? AND notification_type IN (${placeholders}) ORDER BY created_at DESC LIMIT 50`,
        [req.user.id, ...visibleTypes]
      );
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch notifications.' });
    }
  });

  app.patch('/api/notifications/:id/read', authenticate, async (req: any, res) => {
    try {
      await db.run('UPDATE notifications SET nabasa = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
      res.json({ message: 'Notification marked as read.' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update notification.' });
    }
  });

  app.patch('/api/notifications/read-all', authenticate, async (req: any, res) => {
    try {
      const visibleTypes = req.user.role === 'mamamayan'
        ? ['status_update', 'mediation_scheduled', 'mediation_summon', 'mediation_outcome', 'mediation_update']
        : ['new_complaint'];
      const placeholders = visibleTypes.map(() => '?').join(', ');
      await db.run(
        `UPDATE notifications SET nabasa = 1 WHERE user_id = ? AND notification_type IN (${placeholders})`,
        [req.user.id, ...visibleTypes]
      );
      res.json({ message: 'All notifications marked as read.' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update notifications.' });
    }
  });

  // --- COMPLAINT ROUTES ---

  app.post('/api/complaints', authenticate, upload.array('evidence', 5), async (req: any, res) => {
    try {
      const { uri_ng_reklamo, category, complainant_name, complainant_email, is_anonymous, detalye, nireklamo_pangalan, is_resident, zone, street_name, address_details, truthfulness_acknowledged } = req.body;
      const profile = await db.get('SELECT pangalan, email, is_resident FROM account_profiles WHERE id = ?', [req.user.id]);
      if (!profile) return res.status(401).json({ error: 'Account not found.' });
      if (req.user.role === 'mamamayan' && truthfulness_acknowledged !== '1') {
        return res.status(400).json({ error: 'Acknowledge the truthful-reporting notice before submitting.' });
      }
      const complaintType = await db.get('SELECT category FROM complaint_types WHERE name = ? AND is_active = 1', [uri_ng_reklamo]);
      if (!complaintType || complaintType.category !== category) return res.status(400).json({ error: 'Choose a valid category and complaint type.' });

      const isAnon = is_anonymous === '1' || is_anonymous === 1 || is_anonymous === true || is_anonymous === 'true';
      const normalizedName = isAnon ? 'Anonymous' : (profile.pangalan || (typeof complainant_name === 'string' && complainant_name.trim() ? complainant_name.trim().slice(0, 255) : 'Resident'));
      const rawEmail = typeof complainant_email === 'string' && complainant_email.trim() ? complainant_email.trim() : (profile.email || '');
      const normalizedEmail = rawEmail.slice(0, 255);
      if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({ error: 'Enter a valid email address.' });
      }
      if (typeof detalye !== 'string' || detalye.trim().length < 10 || detalye.length > 10000) {
        return res.status(400).json({ error: 'Complaint details must be between 10 and 10,000 characters.' });
      }

      let location;
      try {
        location = await resolveBoundaryLocation(req.body.latitude, req.body.longitude);
      } catch (error) {
        return res.status(400).json({ error: error instanceof Error ? error.message : 'Choose a valid map location.' });
      }
      if (location.latitude == null || location.longitude == null) {
        return res.status(400).json({ error: 'Please search and select an incident address within Barangay San Andres.' });
      }

      const allBoundaries = await getBoundaryRows();
      const matches = detectBoundaryMatches(location.latitude, location.longitude, allBoundaries);
      const isInSanAndres = matches.some((b) => b.type.toLowerCase() === 'barangay' || b.name.toLowerCase().includes('san andres'));
      if (!isInSanAndres) {
        return res.status(400).json({ error: 'The selected incident location is outside the coverage of Barangay San Andres, Cainta, Rizal. Only complaints within Barangay San Andres coverage can be accepted.' });
      }

      // Automatically match to configured admin heatmap area if one contains the location
      const matchedArea = matches.find((b) => b.type.toLowerCase() !== 'barangay' && !b.name.toLowerCase().includes('barangay san andres'));
      const normalizedZone = matchedArea ? matchedArea.name : (typeof zone === 'string' && zone.trim() ? zone.trim() : null);

      const files = Array.isArray(req.files) ? req.files : [];
      if (files.some((file: any) => !file.mimetype.startsWith('image/'))) return res.status(400).json({ error: 'Only photo evidence is accepted.' });

      // Match respondent by name if account exists
      let nireklamo_user_id = null;
      if (typeof nireklamo_pangalan === 'string' && nireklamo_pangalan.trim()) {
        const foundUser = await db.get('SELECT id FROM account_profiles WHERE pangalan = ? LIMIT 1', [nireklamo_pangalan.trim()]);
        if (foundUser) nireklamo_user_id = foundUser.id;
      }

      const isResValue = req.user.role === 'mamamayan' ? profile.is_resident : (is_resident || profile.is_resident || 'Resident');
      const normalizedStreetName = typeof street_name === 'string' ? street_name.trim().slice(0, 255) : '';
      const normalizedAddressDetails = typeof address_details === 'string' && address_details.trim() ? address_details.trim().slice(0, 2000) : null;

      const blotter_number = `B-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`;
      const result = await db.run(
        'INSERT INTO complaints (blotter_number, user_id, uri_ng_reklamo, complainant_name, complainant_email, is_anonymous, detalye, nireklamo_pangalan, nireklamo_email, nireklamo_user_id, is_resident, zone, street_name, address_details, latitude, longitude, detected_boundary_ids, truthfulness_acknowledged_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, JSON_EXTRACT(?, \'$\'), ?)',
        [blotter_number, req.user.id, uri_ng_reklamo, normalizedName, normalizedEmail || null, isAnon ? 1 : 0, detalye.trim(), nireklamo_pangalan || null, nireklamo_user_id, isResValue, normalizedZone, normalizedStreetName || null, normalizedAddressDetails, location.latitude, location.longitude, JSON.stringify(location.ids), req.user.role === 'mamamayan' ? new Date() : null]
      );

      const complaintId = result.lastID;

      // Upload evidence files to Cloudinary and save the returned URLs
      if (req.files && Array.isArray(req.files)) {
        for (const file of req.files) {
          const cloudinaryUrl = await uploadToCloudinary(file.buffer, {
            folder: 'complaints/evidence',
            resource_type: 'image',
          });
          await db.run(
            'INSERT INTO evidence (complaint_id, file_path, file_type, original_name) VALUES (?, ?, ?, ?)',
            [complaintId, cloudinaryUrl, file.mimetype, file.originalname]
          );
        }
      }

      await db.run('INSERT INTO complaint_history (complaint_id, actor_user_id, action_type, snapshot) VALUES (?, ?, ?, ?)', [
        complaintId,
        req.user.id,
        'filed',
        JSON.stringify({
          uri_ng_reklamo,
          category,
          complainant_name: normalizedName,
          complainant_email: isAnon ? '' : normalizedEmail,
          is_anonymous: isAnon ? 1 : 0,
          nireklamo_pangalan: nireklamo_pangalan || '',
          detalye: detalye.trim(),
          zone: normalizedZone || '',
          street_name: normalizedStreetName,
          address_details: normalizedAddressDetails || '',
          latitude: location.latitude,
          longitude: location.longitude,
          detected_boundary_ids: location.ids,
          truthfulness_acknowledged: req.user.role === 'mamamayan',
          evidence_added: files.map((file: any) => file.originalname),
        }),
      ]);
      
      // Notify admins via socket and DB
      const admins = await db.all('SELECT user_id AS id FROM administrators');
      for (const admin of admins) {
        const msg = `New complaint submitted: ${uri_ng_reklamo}`;
        const targetPath = `/complaints/${complaintId}`;
        const result = await db.run('INSERT INTO notifications (user_id, mensahe, notification_type, target_path) VALUES (?, ?, ?, ?)', [admin.id, msg, 'new_complaint', targetPath]);
        ablyEmit(`user_${admin.id}`, 'notification', { 
          id: result.lastID, 
          mensahe: msg, 
          notification_type: 'new_complaint',
          target_path: targetPath,
          nabasa: 0,
          created_at: new Date()
        });
      }
      
      ablyBroadcast('new_complaint', { id: complaintId, uri_ng_reklamo });
      
      // Send Email Notification
      const reporter = await db.get('SELECT pangalan, email FROM account_profiles WHERE id = ?', [req.user.id]);
      if (reporter && reporter.email) {
        sendComplaintCreatedEmail(reporter.email, reporter.pangalan, blotter_number, uri_ng_reklamo);
      }
      
      res.status(201).json({ id: complaintId });
    } catch (error) {
      console.error('Error creating complaint:', error);
      res.status(500).json({ error: 'Unable to submit the complaint.' });
    }
  });

  app.patch('/api/complaints/:id', authenticate, upload.array('evidence', 5), async (req: any, res) => {
    try {
      if (req.user.role !== 'mamamayan') return res.status(403).json({ error: 'Only the complainant can update this complaint.' });
      const current = await db.get('SELECT * FROM complaints WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [req.params.id, req.user.id]);
      if (!current) return res.status(404).json({ error: 'Complaint not found.' });

      const { uri_ng_reklamo, category, complainant_name, complainant_email, is_anonymous, nireklamo_pangalan, detalye, zone, street_name, address_details } = req.body;
      const complaintType = await db.get('SELECT category FROM complaint_types WHERE name = ? AND is_active = 1', [uri_ng_reklamo]);
      if (!complaintType || complaintType.category !== category) return res.status(400).json({ error: 'Choose a valid category and complaint type.' });

      const isAnon = is_anonymous === '1' || is_anonymous === 1 || is_anonymous === true || is_anonymous === 'true' || (is_anonymous === undefined && current.is_anonymous === 1);
      const userProfile = await db.get('SELECT pangalan, email FROM account_profiles WHERE id = ?', [req.user.id]);
      const normalizedName = isAnon ? 'Anonymous' : (userProfile?.pangalan || (typeof complainant_name === 'string' && complainant_name.trim() ? complainant_name.trim().slice(0, 255) : current.complainant_name));
      const rawEmail = typeof complainant_email === 'string' && complainant_email.trim() ? complainant_email.trim() : (userProfile?.email || current.complainant_email || '');
      const normalizedEmail = rawEmail.slice(0, 255);
      if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({ error: 'Enter a valid email address.' });
      }

      if (typeof detalye !== 'string' || detalye.trim().length < 10 || detalye.length > 10000) return res.status(400).json({ error: 'Complaint details must be between 10 and 10,000 characters.' });

      let location;
      try {
        location = await resolveBoundaryLocation(req.body.latitude, req.body.longitude);
      } catch (error) {
        return res.status(400).json({ error: error instanceof Error ? error.message : 'Choose a valid map location.' });
      }
      if (location.latitude == null || location.longitude == null) {
        return res.status(400).json({ error: 'Please search and select an incident address within Barangay San Andres.' });
      }

      const allBoundaries = await getBoundaryRows();
      const matches = detectBoundaryMatches(location.latitude, location.longitude, allBoundaries);
      const isInSanAndres = matches.some((b) => b.type.toLowerCase() === 'barangay' || b.name.toLowerCase().includes('san andres'));
      if (!isInSanAndres) {
        return res.status(400).json({ error: 'The selected incident location is outside the coverage of Barangay San Andres, Cainta, Rizal.' });
      }

      // Match to configured admin heatmap area if applicable
      const matchedArea = matches.find((b) => b.type.toLowerCase() !== 'barangay' && !b.name.toLowerCase().includes('barangay san andres'));
      const normalizedZone = matchedArea ? matchedArea.name : (typeof zone === 'string' && zone.trim() ? zone.trim() : current.zone);

      const files = Array.isArray(req.files) ? req.files : [];
      if (files.some((file: any) => !file.mimetype.startsWith('image/'))) return res.status(400).json({ error: 'Only photo evidence is accepted.' });

      let nireklamo_user_id = null;
      if (typeof nireklamo_pangalan === 'string' && nireklamo_pangalan.trim()) {
        const foundUser = await db.get('SELECT id FROM account_profiles WHERE pangalan = ? LIMIT 1', [nireklamo_pangalan.trim()]);
        if (foundUser) nireklamo_user_id = foundUser.id;
      }

      const normalizedStreetName = typeof street_name === 'string' ? street_name.trim().slice(0, 255) : current.street_name;
      const normalizedAddressDetails = typeof address_details === 'string' ? (address_details.trim() ? address_details.trim().slice(0, 2000) : null) : current.address_details;

      const snapshot = {
        uri_ng_reklamo,
        category,
        complainant_name: normalizedName,
        complainant_email: isAnon ? '' : normalizedEmail,
        is_anonymous: isAnon ? 1 : 0,
        nireklamo_pangalan: nireklamo_pangalan || '',
        detalye: detalye.trim(),
        zone: normalizedZone,
        street_name: normalizedStreetName || '',
        address_details: normalizedAddressDetails || '',
        latitude: location.latitude,
        longitude: location.longitude,
        detected_boundary_ids: location.ids,
        evidence_added: files.map((file: any) => file.originalname)
      };

      const updated = await db.transaction(async (transactionDb) => {
        const update = await transactionDb.run(
          `UPDATE complaints SET uri_ng_reklamo = ?, complainant_name = ?, complainant_email = ?, is_anonymous = ?, nireklamo_pangalan = ?, nireklamo_email = NULL, nireklamo_user_id = ?, detalye = ?, zone = ?, street_name = ?, address_details = ?, latitude = ?, longitude = ?, detected_boundary_ids = JSON_EXTRACT(?, '$'), edit_count = edit_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
          [uri_ng_reklamo, normalizedName, normalizedEmail || null, isAnon ? 1 : 0, nireklamo_pangalan || null, nireklamo_user_id, detalye.trim(), normalizedZone, normalizedStreetName || null, normalizedAddressDetails, location.latitude, location.longitude, JSON.stringify(location.ids), req.params.id, req.user.id]
        );
        if (!update.changes) return false;
        for (const file of files) {
          const cloudinaryUrl = await uploadToCloudinary(file.buffer, {
            folder: 'complaints/evidence',
            resource_type: 'image',
          });
          await transactionDb.run('INSERT INTO evidence (complaint_id, file_path, file_type, original_name) VALUES (?, ?, ?, ?)', [req.params.id, cloudinaryUrl, file.mimetype, file.originalname]);
        }
        await transactionDb.run('INSERT INTO complaint_history (complaint_id, actor_user_id, action_type, snapshot) VALUES (?, ?, ?, ?)', [req.params.id, req.user.id, 'edited', JSON.stringify(snapshot)]);
        await transactionDb.run('INSERT INTO actions (complaint_id, user_id, paglalarawan) VALUES (?, ?, ?)', [req.params.id, req.user.id, 'Complainant updated the complaint details or added evidence.']);
        return true;
      });
      if (!updated) return res.status(404).json({ error: 'Complaint not found.' });
      res.json({ message: 'Complaint update saved.', id: Number(req.params.id) });
    } catch (error) {
      console.error('Error updating complaint:', error);
      res.status(500).json({ error: 'Unable to save the complaint update.' });
    }
  });

  app.get('/api/complaints', authenticate, async (req: any, res) => {
    try {
      const recycleBin = req.query.recycle_bin === '1';
      if (recycleBin && req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access is required.' });
      let complaints: any[];
      if (req.user.role === 'mamamayan') {
        complaints = req.query.scope === 'mine'
          ? await db.all(`
              SELECT c.*, 
                     (SELECT COUNT(*) FROM messages m WHERE m.complaint_id = c.id AND m.user_id != ? AND m.nabasa = 0) AS unread_message_count,
                     (SELECT m.mensahe FROM messages m WHERE m.complaint_id = c.id AND m.user_id != ? AND m.nabasa = 0 ORDER BY m.petsa DESC LIMIT 1) AS last_unread_message,
                     (SELECT u.pangalan FROM messages m JOIN account_profiles u ON u.id = m.user_id WHERE m.complaint_id = c.id AND m.user_id != ? AND m.nabasa = 0 ORDER BY m.petsa DESC LIMIT 1) AS last_unread_sender,
                     (SELECT COUNT(*) FROM messages m WHERE m.complaint_id = c.id) AS message_count,
                     (SELECT MAX(m.petsa) FROM messages m WHERE m.complaint_id = c.id) AS last_message_at,
                     (SELECT m.mensahe FROM messages m WHERE m.complaint_id = c.id ORDER BY m.petsa DESC LIMIT 1) AS last_message,
                     (SELECT u.pangalan FROM messages m JOIN account_profiles u ON u.id = m.user_id WHERE m.complaint_id = c.id ORDER BY m.petsa DESC LIMIT 1) AS last_message_sender
              FROM complaints c
              WHERE c.deleted_at IS NULL AND c.user_id = ?
              ORDER BY c.created_at DESC
            `, [req.user.id, req.user.id, req.user.id, req.user.id])
          : await db.all(`
              SELECT c.*, 
                     (SELECT COUNT(*) FROM messages m WHERE m.complaint_id = c.id AND m.user_id != ? AND m.nabasa = 0) AS unread_message_count,
                     (SELECT m.mensahe FROM messages m WHERE m.complaint_id = c.id AND m.user_id != ? AND m.nabasa = 0 ORDER BY m.petsa DESC LIMIT 1) AS last_unread_message,
                     (SELECT u.pangalan FROM messages m JOIN account_profiles u ON u.id = m.user_id WHERE m.complaint_id = c.id AND m.user_id != ? AND m.nabasa = 0 ORDER BY m.petsa DESC LIMIT 1) AS last_unread_sender,
                     (SELECT COUNT(*) FROM messages m WHERE m.complaint_id = c.id) AS message_count,
                     (SELECT MAX(m.petsa) FROM messages m WHERE m.complaint_id = c.id) AS last_message_at,
                     (SELECT m.mensahe FROM messages m WHERE m.complaint_id = c.id ORDER BY m.petsa DESC LIMIT 1) AS last_message,
                     (SELECT u.pangalan FROM messages m JOIN account_profiles u ON u.id = m.user_id WHERE m.complaint_id = c.id ORDER BY m.petsa DESC LIMIT 1) AS last_message_sender
              FROM complaints c
              WHERE c.deleted_at IS NULL AND (c.user_id = ? OR c.nireklamo_user_id = ?)
              ORDER BY c.created_at DESC
            `, [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]);
      } else {
        complaints = await db.all(`
          SELECT c.*, 
                 IF(c.is_anonymous = 1, 'Anonymous', u.pangalan) AS reporter, 
                 IF(cr.read_at IS NULL, 0, 1) AS is_read,
                 (SELECT COUNT(*) FROM messages m WHERE m.complaint_id = c.id AND m.user_id != ? AND m.nabasa = 0) AS unread_message_count,
                 (SELECT m.mensahe FROM messages m WHERE m.complaint_id = c.id AND m.user_id != ? AND m.nabasa = 0 ORDER BY m.petsa DESC LIMIT 1) AS last_unread_message,
                 (SELECT sender.pangalan FROM messages m JOIN account_profiles sender ON sender.id = m.user_id WHERE m.complaint_id = c.id AND m.user_id != ? AND m.nabasa = 0 ORDER BY m.petsa DESC LIMIT 1) AS last_unread_sender,
                 (SELECT COUNT(*) FROM messages m WHERE m.complaint_id = c.id) AS message_count,
                 (SELECT MAX(m.petsa) FROM messages m WHERE m.complaint_id = c.id) AS last_message_at,
                 (SELECT m.mensahe FROM messages m WHERE m.complaint_id = c.id ORDER BY m.petsa DESC LIMIT 1) AS last_message,
                 (SELECT sender.pangalan FROM messages m JOIN account_profiles sender ON sender.id = m.user_id WHERE m.complaint_id = c.id ORDER BY m.petsa DESC LIMIT 1) AS last_message_sender
          FROM complaints c JOIN account_profiles u ON c.user_id = u.id
          LEFT JOIN complaint_reads cr ON cr.complaint_id = c.id AND cr.user_id = ?
          WHERE c.deleted_at IS ${recycleBin ? 'NOT NULL' : 'NULL'}
          ORDER BY c.created_at DESC
        `, [req.user.id, req.user.id, req.user.id, req.user.id]);
      }

      // Enforce anonymity and email masking rules consistently
      const sanitized = complaints.map((c) => {
        const item = { ...c };
        item.nireklamo_email = null;
        if (item.is_anonymous == 1) {
          item.reporter = 'Anonymous';
          item.complainant_name = 'Anonymous';
          item.complainant_email = null;
        } else if (req.user.role !== 'mamamayan') {
          item.complainant_email = maskEmail(item.complainant_email);
        }
        return item;
      });

      res.json(sanitized);
    } catch (error) {
      console.error('Error fetching complaints:', error);
      res.status(500).json({ error: 'Unable to load complaints.' });
    }
  });

  app.delete('/api/admin/complaints/:id', authenticate, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access is required.' });
    try {
      const result = await db.transaction(async (transactionDb) => {
        const complaint = await transactionDb.get(
          'SELECT id, status FROM complaints WHERE id = ? AND deleted_at IS NULL FOR UPDATE',
          [req.params.id]
        );
        if (!complaint) return false;
        const updated = await transactionDb.run(
          'UPDATE complaints SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL',
          [req.params.id]
        );
        if (!updated.changes) return false;
        await transactionDb.run(`
          INSERT INTO complaint_audit (complaint_id, previous_status, new_status, action_type, remarks, actor_user_id)
          VALUES (?, ?, ?, 'complaint_deleted', 'Complaint moved to the recycle bin.', ?)
        `, [req.params.id, complaint.status, complaint.status, req.user.id]);
        return true;
      });
      if (!result) return res.status(404).json({ error: 'Complaint not found or already deleted.' });
      res.json({ message: 'Complaint moved to the recycle bin.' });
    } catch (error) {
      console.error('Unable to move complaint to recycle bin:', error);
      res.status(500).json({ error: 'Unable to delete complaint.' });
    }
  });

  app.patch('/api/admin/complaints/:id/restore', authenticate, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access is required.' });
    try {
      const result = await db.transaction(async (transactionDb) => {
        const complaint = await transactionDb.get(
          'SELECT id, status FROM complaints WHERE id = ? AND deleted_at IS NOT NULL FOR UPDATE',
          [req.params.id]
        );
        if (!complaint) return false;
        const updated = await transactionDb.run(
          'UPDATE complaints SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL',
          [req.params.id]
        );
        if (!updated.changes) return false;
        await transactionDb.run(`
          INSERT INTO complaint_audit (complaint_id, previous_status, new_status, action_type, remarks, actor_user_id)
          VALUES (?, ?, ?, 'complaint_restored', 'Complaint restored from the recycle bin.', ?)
        `, [req.params.id, complaint.status, complaint.status, req.user.id]);
        return true;
      });
      if (!result) return res.status(404).json({ error: 'Deleted complaint not found.' });
      res.json({ message: 'Complaint restored.' });
    } catch (error) {
      console.error('Unable to restore complaint:', error);
      res.status(500).json({ error: 'Unable to restore complaint.' });
    }
  });

  app.patch('/api/complaints/:id/read', authenticate, async (req: any, res) => {
    if (req.user.role === 'mamamayan') return res.status(403).json({ error: 'Staff access is required.' });
    try {
      const complaint = await db.get('SELECT id FROM complaints WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
      if (!complaint) return res.status(404).json({ error: 'Complaint not found.' });
      await db.run(`
        INSERT INTO complaint_reads (complaint_id, user_id, read_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE read_at = VALUES(read_at)
      `, [req.params.id, req.user.id]);
      res.json({ message: 'Complaint marked as read.' });
    } catch (error) {
      console.error('Unable to mark complaint as read:', error);
      res.status(500).json({ error: 'Unable to mark complaint as read.' });
    }
  });

  const getIncidentDotsHandler = async (req: any, res: any) => {
    try {
      const dots = await db.all(`
        SELECT c.id, c.blotter_number, c.uri_ng_reklamo, ct.category, c.status,
               c.street_name, c.address_details, c.zone,
               c.latitude, c.longitude, c.created_at
        FROM complaints c
        LEFT JOIN complaint_types ct ON ct.name = c.uri_ng_reklamo
        WHERE c.deleted_at IS NULL
          AND c.status NOT IN ('natapos', 'archived')
          AND c.latitude IS NOT NULL
          AND c.longitude IS NOT NULL
        ORDER BY c.created_at DESC
      `);
      res.json(dots);
    } catch (error) {
      console.error('Error fetching incident dots:', error);
      res.status(500).json({ error: 'Unable to load incident dots.' });
    }
  };

  app.get('/api/complaints/incident-dots', getIncidentDotsHandler);
  app.get('/api/incident-dots', getIncidentDotsHandler);
  app.get('/api/complaint-dots', getIncidentDotsHandler);

  app.get('/api/complaints/:id', authenticate, async (req: any, res) => {
    try {
      const residentFilter = req.user.role === 'mamamayan' ? ' AND (c.user_id = ? OR c.nireklamo_user_id = ?)' : '';
      const deletedFilter = req.user.role === 'admin' ? '' : ' AND c.deleted_at IS NULL';
      const queryParams = req.user.role === 'mamamayan' ? [req.params.id, req.user.id, req.user.id] : [req.params.id];
      const complaint = await db.get(`
        SELECT c.*, u.pangalan AS reporter, ct.category AS category,
               verifier.pangalan AS mediation_eligibility_verified_by_name
        FROM complaints c
        JOIN account_profiles u ON c.user_id = u.id
        LEFT JOIN complaint_types ct ON ct.name = c.uri_ng_reklamo
        LEFT JOIN account_profiles verifier ON verifier.id = c.mediation_eligibility_verified_by
        WHERE c.id = ?${deletedFilter}${residentFilter}
      `, queryParams);
      if (!complaint) return res.status(404).json({ error: 'Complaint not found.' });

      const isComplainant = req.user.id === complaint.user_id;
      const isStaff = req.user.role !== 'mamamayan';
      const isAnon = complaint.is_anonymous == 1;

      if (isAnon) {
        complaint.reporter = 'Anonymous';
        complaint.complainant_name = 'Anonymous';
        complaint.complainant_email = null;
      } else if (isStaff) {
        complaint.complainant_email = maskEmail(complaint.complainant_email);
      }
      complaint.nireklamo_email = null;

      const actions = await db.all('SELECT a.*, u.pangalan as actor FROM actions a JOIN account_profiles u ON a.user_id = u.id WHERE a.complaint_id = ? ORDER BY a.petsa ASC', [req.params.id]);
      const messages = await db.all('SELECT m.*, u.pangalan as sender FROM messages m JOIN account_profiles u ON m.user_id = u.id WHERE m.complaint_id = ? ORDER BY m.petsa ASC', [req.params.id]);
      const evidence = await db.all('SELECT * FROM evidence WHERE complaint_id = ?', [req.params.id]);
      const mediation = await db.all('SELECT * FROM schedules WHERE complaint_id = ? ORDER BY petsa DESC', [req.params.id]);
      const witnesses = await db.all('SELECT * FROM witnesses WHERE complaint_id = ?', [req.params.id]);
      const lupon = await db.all('SELECT lm.* FROM lupon_members lm JOIN case_lupon cl ON lm.id = cl.lupon_id WHERE cl.complaint_id = ?', [req.params.id]);
      const history = await db.all(`
        SELECT h.*, COALESCE(u.pangalan, 'System') AS actor
        FROM complaint_history h
        LEFT JOIN account_profiles u ON u.id = h.actor_user_id
        WHERE h.complaint_id = ?
        ORDER BY h.created_at ASC, h.id ASC
      `, [req.params.id]);
      const audit = await db.all(`
        SELECT a.*, COALESCE(u.pangalan, 'System') AS actor
        FROM complaint_audit a
        LEFT JOIN account_profiles u ON u.id = a.actor_user_id
        WHERE a.complaint_id = ?
        ORDER BY a.created_at ASC, a.id ASC
      `, [req.params.id]);
      const mediationAudit = await db.all(`
        SELECT a.*, COALESCE(u.pangalan, 'System') AS actor
        FROM mediation_audit a
        LEFT JOIN account_profiles u ON u.id = a.actor_user_id
        WHERE a.complaint_id = ?
        ORDER BY a.created_at ASC, a.id ASC
      `, [req.params.id]);
      const dispositions = await db.all(`
        SELECT d.*, u.pangalan AS staff_name
        FROM case_dispositions d
        JOIN account_profiles u ON u.id = d.staff_user_id
        WHERE d.complaint_id = ?
        ORDER BY d.disposition_date ASC, d.id ASC
      `, [req.params.id]);

      // If anonymous, mask complainant actor names and snapshot details in history/audit
      const sanitizeActor = (actorId: number, currentActorName: string) => {
        if (isAnon && actorId === complaint.user_id) return 'Anonymous';
        return currentActorName;
      };

      const sanitizedActions = actions.map((a: any) => ({
        ...a,
        actor: sanitizeActor(a.user_id, a.actor),
      }));

      const sanitizedHistory = history.map((h: any) => {
        let snap = h.snapshot;
        if (typeof snap === 'string') {
          try {
            snap = JSON.parse(snap);
          } catch {
            // Keep as string
          }
        }
        if (snap && typeof snap === 'object') {
          delete snap.nireklamo_email;
          if (isAnon) {
            snap.complainant_name = 'Anonymous';
            snap.complainant_email = '';
          } else if (isStaff && snap.complainant_email) {
            snap.complainant_email = maskEmail(snap.complainant_email);
          }
        }
        return {
          ...h,
          actor: sanitizeActor(h.actor_user_id, h.actor),
          snapshot: snap,
        };
      });

      const sanitizedAudit = audit.map((a: any) => ({
        ...a,
        actor: sanitizeActor(a.actor_user_id, a.actor),
      }));

      res.json({
        ...complaint,
        actions: sanitizedActions,
        messages,
        evidence,
        mediation,
        witnesses,
        lupon,
        history: sanitizedHistory,
        audit: sanitizedAudit,
        mediationAudit,
        dispositions
      });
    } catch (error) {
      console.error('Error fetching complaint detail:', error);
      res.status(500).json({ error: 'Unable to load complaint details.' });
    }
  });

  app.get('/api/complaints/:id/report/docx', authenticate, async (req: any, res) => {
    try {
      if (req.user.role === 'mamamayan') {
        return res.status(403).json({ error: 'Staff access is required to generate official case closure reports.' });
      }

      const complaint = await db.get(`
        SELECT c.*, u.pangalan AS reporter, ct.category AS category,
               assigned.pangalan AS assigned_name
        FROM complaints c
        JOIN account_profiles u ON c.user_id = u.id
        LEFT JOIN complaint_types ct ON ct.name = c.uri_ng_reklamo
        LEFT JOIN account_profiles assigned ON assigned.id = c.assigned_to
        WHERE c.id = ? AND c.deleted_at IS NULL
      `, [req.params.id]);

      if (!complaint) return res.status(404).json({ error: 'Complaint not found.' });

      // Case must be closed or resolved
      if (!['natapos', 'archived'].includes(complaint.status)) {
        return res.status(400).json({ error: 'Official closure reports can only be generated for closed or resolved cases.' });
      }

      const isAnon = complaint.is_anonymous == 1;
      if (isAnon) {
        complaint.reporter = 'Anonymous';
        complaint.complainant_name = 'Anonymous';
        complaint.complainant_email = '';
      }
      complaint.nireklamo_email = null;

      const actions = await db.all('SELECT a.*, u.pangalan as actor FROM actions a JOIN account_profiles u ON a.user_id = u.id WHERE a.complaint_id = ? ORDER BY a.petsa ASC', [req.params.id]);
      const messages = await db.all('SELECT m.*, u.pangalan as sender FROM messages m JOIN account_profiles u ON m.user_id = u.id WHERE m.complaint_id = ? ORDER BY m.petsa ASC', [req.params.id]);
      const evidence = await db.all('SELECT * FROM evidence WHERE complaint_id = ?', [req.params.id]);
      const mediation = await db.all('SELECT * FROM schedules WHERE complaint_id = ? ORDER BY petsa DESC', [req.params.id]);
      const lupon = await db.all('SELECT lm.* FROM lupon_members lm JOIN case_lupon cl ON lm.id = cl.lupon_id WHERE cl.complaint_id = ?', [req.params.id]);
      const history = await db.all(`
        SELECT h.*, COALESCE(u.pangalan, 'System') AS actor
        FROM complaint_history h
        LEFT JOIN account_profiles u ON u.id = h.actor_user_id
        WHERE h.complaint_id = ?
        ORDER BY h.created_at ASC, h.id ASC
      `, [req.params.id]);
      const audit = await db.all(`
        SELECT a.*, COALESCE(u.pangalan, 'System') AS actor
        FROM complaint_audit a
        LEFT JOIN account_profiles u ON u.id = a.actor_user_id
        WHERE a.complaint_id = ?
        ORDER BY a.created_at ASC, a.id ASC
      `, [req.params.id]);
      const dispositions = await db.all(`
        SELECT d.*, u.pangalan AS staff_name
        FROM case_dispositions d
        JOIN account_profiles u ON u.id = d.staff_user_id
        WHERE d.complaint_id = ?
        ORDER BY d.disposition_date ASC, d.id ASC
      `, [req.params.id]);

      // Officials lookup for footer (Barangay Captain and Secretary)
      const captainMember = await db.get(`
        SELECT pangalan, posisyon FROM lupon_members 
        WHERE LOWER(posisyon) LIKE '%captain%' OR LOWER(posisyon) LIKE '%punong%' OR id = 1 
        ORDER BY id ASC LIMIT 1
      `);
      const secretaryMember = await db.get(`
        SELECT pangalan, posisyon FROM lupon_members 
        WHERE LOWER(posisyon) LIKE '%secretary%' OR id = 2 
        ORDER BY id ASC LIMIT 1
      `);

      const officials = {
        captainName: captainMember?.pangalan || 'Hon. Josefina Dela Cruz',
        captainTitle: captainMember?.posisyon || 'Punong Barangay / Lupon Chairperson',
        secretaryName: secretaryMember?.pangalan || 'Bernardo Ramos',
        secretaryTitle: secretaryMember?.posisyon || 'Lupon Secretary',
      };

      const docxBuffer = await generateCaseClosureReportDocx({
        complaint: complaint as any,
        actions: actions as any,
        messages: messages as any,
        evidence: evidence as any,
        mediation: mediation as any,
        history: history as any,
        audit: audit as any,
        dispositions: dispositions as any,
        luponMembers: lupon as any,
        officials,
      });

      const blotterRef = complaint.blotter_number ? complaint.blotter_number.replace(/[^a-zA-Z0-9_-]/g, '_') : `Case-${complaint.id}`;
      const filename = `Case_Closure_Report_${blotterRef}.docx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', docxBuffer.length);
      res.send(docxBuffer);
    } catch (error) {
      console.error('Error generating case closure DOCX report:', error);
      res.status(500).json({ error: 'Unable to generate case closure report.' });
    }
  });

  const getComplaintCaseHistory = async (complaintId: string | number) => {
    const [audits, mediationEvents, legacyActions, dispositionEvents, complaintChanges] = await Promise.all([
      db.all(`
        SELECT a.id, a.previous_status, a.new_status, a.action_type, a.remarks,
               a.created_at, COALESCE(u.pangalan, 'System') AS actor
        FROM complaint_audit a
        LEFT JOIN account_profiles u ON u.id = a.actor_user_id
        WHERE a.complaint_id = ?
      `, [complaintId]),
      db.all(`
        SELECT a.id, a.action_type, a.details, a.created_at,
               COALESCE(u.pangalan, 'System') AS actor
        FROM mediation_audit a
        LEFT JOIN account_profiles u ON u.id = a.actor_user_id
        WHERE a.complaint_id = ?
      `, [complaintId]),
      db.all(`
        SELECT a.id, a.paglalarawan AS remarks, a.petsa AS created_at,
               COALESCE(u.pangalan, 'System') AS actor
        FROM actions a
        LEFT JOIN account_profiles u ON u.id = a.user_id
        WHERE a.complaint_id = ?
      `, [complaintId]),
      db.all(`
        SELECT d.id, d.action_type, d.resolution_details AS remarks,
               d.disposition_date AS created_at, u.pangalan AS actor
        FROM case_dispositions d
        JOIN account_profiles u ON u.id = d.staff_user_id
        WHERE d.complaint_id = ?
      `, [complaintId]),
      db.all(`
        SELECT h.id, h.action_type, h.snapshot, h.created_at,
               COALESCE(u.pangalan, 'System') AS actor
        FROM complaint_history h
        LEFT JOIN account_profiles u ON u.id = h.actor_user_id
        WHERE h.complaint_id = ?
      `, [complaintId]),
    ]);
    const complaintSnapshotText = (rawSnapshot: unknown) => {
      let snapshot = rawSnapshot;
      if (typeof rawSnapshot === 'string') {
        try {
          snapshot = JSON.parse(rawSnapshot);
        } catch {
          return rawSnapshot;
        }
      }
      if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return String(snapshot ?? '');
      const labels: Record<string, string> = {
        uri_ng_reklamo: 'Complaint type',
        category: 'Category',
        complainant_name: 'Complainant',
        complainant_email: 'Complainant email',
        nireklamo_pangalan: 'Person involved',
        nireklamo_email: 'Person involved email',
        detalye: 'Incident details',
        zone: 'Area',
        street_name: 'Address or nearby landmark',
        latitude: 'Latitude',
        longitude: 'Longitude',
        evidence_added: 'Evidence added',
      };
      return Object.entries(snapshot as Record<string, unknown>)
        .filter(([key, value]) => !['detected_boundary_ids', 'truthfulness_acknowledged'].includes(key) && value !== null && value !== '')
        .map(([key, value]) => {
          const label = labels[key] || key.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
          const formattedValue = Array.isArray(value)
            ? value.length ? value.join(', ') : 'None'
            : typeof value === 'object' ? JSON.stringify(value) : String(value);
          return `${label}: ${formattedValue}`;
        })
        .join('\n');
    };
    const mediationDetailsText = (rawDetails: unknown) => {
      let details = rawDetails;
      if (typeof details === 'string') {
        try {
          details = JSON.parse(details);
        } catch {
          return details;
        }
      }
      if (!details || typeof details !== 'object' || Array.isArray(details)) return String(details ?? '');
      return Object.entries(details as Record<string, unknown>)
        .filter(([key, value]) => key !== 'remarks' && value !== null && value !== '')
        .map(([key, value]) => `${key.replaceAll('_', ' ')}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
        .join('; ');
    };
    const matchedMediationEventIds = new Set<number>();
    const auditEvents = audits.map((event: any) => {
      const matchingEvent = mediationEvents.find((mediationEvent: any) =>
        !matchedMediationEventIds.has(mediationEvent.id)
        && mediationEvent.action_type === event.action_type
        && Math.abs(new Date(mediationEvent.created_at).getTime() - new Date(event.created_at).getTime()) < 2000
      );
      if (!matchingEvent) return event;
      matchedMediationEventIds.add(matchingEvent.id);
      const details = mediationDetailsText(matchingEvent.details);
      return { ...event, remarks: details ? `${event.remarks}; ${details}` : event.remarks };
    });
    const events = [
      ...auditEvents,
      ...complaintChanges.map((event: any) => ({
        ...event,
        previous_status: null,
        new_status: null,
        remarks: complaintSnapshotText(event.snapshot),
      })),
      ...dispositionEvents.map((event: any) => ({
        ...event,
        previous_status: null,
        new_status: null,
      })),
      ...mediationEvents.filter((event: any) => !matchedMediationEventIds.has(event.id)).map((event: any) => ({
        ...event,
        previous_status: null,
        new_status: null,
        remarks: mediationDetailsText(event.details),
      })),
      ...legacyActions.filter((event: any) => !audits.some((auditEvent: any) =>
        auditEvent.remarks === event.remarks
        || `${auditEvent.previous_status} → ${auditEvent.new_status}: ${auditEvent.remarks}` === event.remarks
      )).map((event: any) => ({
        ...event,
        previous_status: null,
        new_status: null,
        action_type: 'administrative_action',
      })),
    ];
    return events.sort((left: any, right: any) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime() || Number(left.id) - Number(right.id));
  };

  app.patch('/api/complaints/:id/status', authenticate, upload.single('disposition_document'), async (req: any, res) => {
    try {
      if (req.user.role === 'mamamayan') return res.status(403).json({ error: 'You are not authorized to perform this action.' });
      const { status, remarks, resolution_details } = req.body;
      const statusLabels: Record<string, string> = ({
        bago: 'New', sinusuri: 'Under Review', 'naka-assign': 'Assigned', iniimbestigahan: 'Under Investigation',
        'naka-iskedyul': 'Scheduled', 'sa-mediation': 'In Mediation', natapos: 'Resolved', archived: 'Archived',
      });
      if (!Object.prototype.hasOwnProperty.call(statusLabels, status) || status === 'sa-mediation') {
        return res.status(400).json({ error: 'Choose a valid status. Mediation status is set only when a verified case is scheduled.' });
      }
      const cleanRemarks = typeof remarks === 'string' ? remarks.trim().slice(0, 2000) : '';
      const dispositionDetails = typeof resolution_details === 'string' ? resolution_details.trim().slice(0, 10000) : '';
      if (cleanRemarks.length < 3) return res.status(400).json({ error: 'Enter remarks explaining this status update.' });
      if (['natapos', 'archived'].includes(status) && dispositionDetails.length < 10) {
        return res.status(400).json({ error: 'Resolution or archival details are required to complete this case action.' });
      }
      const evidencePath = req.file
        ? await uploadToCloudinary(req.file.buffer, { folder: 'complaints/dispositions', resource_type: 'auto' })
        : null;
      const transition = await db.transaction(async (transactionDb) => {
        const current = await transactionDb.get(`
          SELECT c.id, c.status, c.created_at, c.user_id, c.nireklamo_user_id, c.nireklamo_email,
                 c.nireklamo_pangalan, c.uri_ng_reklamo, c.blotter_number,
                 u.email AS reporter_email, u.pangalan AS reporter_name
          FROM complaints c
          JOIN account_profiles u ON u.id = c.user_id
          WHERE c.id = ? AND c.deleted_at IS NULL
          FOR UPDATE
        `, [req.params.id]);
        if (!current) return { error: 'Complaint not found.', statusCode: 404 };
        if (current.status === status) return { error: 'The complaint already has this status.', statusCode: 409 };
        if (['natapos', 'archived'].includes(current.status)) {
          return { error: 'A resolved or archived complaint cannot be moved to another status.', statusCode: 409 };
        }
        const updated = await transactionDb.run(
          'UPDATE complaints SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = ?',
          [status, req.params.id, current.status]
        );
        if (!updated.changes) return { error: 'The complaint status changed; refresh and try again.', statusCode: 409 };
        const actionType = status === 'natapos' ? 'case_resolved' : status === 'archived' ? 'case_archived' : 'status_updated';
        await transactionDb.run(`
          INSERT INTO complaint_audit (complaint_id, previous_status, new_status, action_type, remarks, actor_user_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [req.params.id, current.status, status, actionType, cleanRemarks, req.user.id]);
        const prevLabel = statusLabels[current.status] || current.status;
        const newLabel = statusLabels[status] || status;
        await transactionDb.run(
          'INSERT INTO actions (complaint_id, user_id, paglalarawan) VALUES (?, ?, ?)',
          [req.params.id, req.user.id, `${prevLabel} → ${newLabel}: ${cleanRemarks}`]
        );
        if (['natapos', 'archived'].includes(status)) {
          await transactionDb.run(`
            INSERT INTO case_dispositions
              (complaint_id, action_type, complaint_date, staff_user_id, resolution_details, evidence_path)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [req.params.id, status === 'natapos' ? 'resolved' : 'archived', current.created_at, req.user.id, dispositionDetails, evidencePath || null]);
        }
        return { complaint: current };
      });
      if (transition.error) return res.status(transition.statusCode).json({ error: transition.error });
      const complaint = transition.complaint;
      const statusLabel = statusLabels[status];

      const reporterMsg = `Your complaint (${complaint.uri_ng_reklamo}) status was updated to ${statusLabel}`;
      const targetPath = `/complaints/${req.params.id}`;
      const rNotif = await db.run('INSERT INTO notifications (user_id, mensahe, notification_type, target_path) VALUES (?, ?, ?, ?)', [complaint.user_id, reporterMsg, 'status_update', targetPath]);
      ablyEmit(`user_${complaint.user_id}`, 'notification', { 
        id: rNotif.lastID, 
        mensahe: reporterMsg, 
        notification_type: 'status_update',
        target_path: targetPath,
        nabasa: 0,
        created_at: new Date()
      });
      ablyEmit(`user_${complaint.user_id}`, 'status_update', { id: req.params.id, status });

      if (complaint.nireklamo_user_id && complaint.nireklamo_user_id !== complaint.user_id) {
        const respondentMsg = `The complaint involving you (${complaint.uri_ng_reklamo}) status was updated to ${statusLabel}`;
        const resNotif = await db.run('INSERT INTO notifications (user_id, mensahe, notification_type, target_path) VALUES (?, ?, ?, ?)', [complaint.nireklamo_user_id, respondentMsg, 'status_update', targetPath]);
        ablyEmit(`user_${complaint.nireklamo_user_id}`, 'notification', { 
          id: resNotif.lastID, 
          mensahe: respondentMsg, 
          notification_type: 'status_update',
          target_path: targetPath,
          nabasa: 0,
          created_at: new Date()
        });
        ablyEmit(`user_${complaint.nireklamo_user_id}`, 'status_update', { id: req.params.id, status });
      }
      
      // Send Email to Reporter
      if (complaint.reporter_email) {
        void sendStatusUpdateEmail(complaint.reporter_email, complaint.reporter_name, complaint.blotter_number, status, cleanRemarks, new Date());
      }
      
      res.json({ message: 'Status updated.' });
    } catch (error) {
      console.error('Error updating status:', error);
      res.status(500).json({ error: 'Unable to update the complaint status.' });
    }
  });

  app.patch('/api/complaints/:id/mediation-eligibility', authenticate, async (req: any, res) => {
    if (req.user.role === 'mamamayan') return res.status(403).json({ error: 'Staff access is required.' });
    const eligible = req.body.eligible;
    const remarks = typeof req.body.remarks === 'string' ? req.body.remarks.trim().slice(0, 2000) : '';
    if (typeof eligible !== 'boolean' || remarks.length < 10) {
      return res.status(400).json({ error: 'Choose an eligibility decision and enter the supporting reason (at least 10 characters).' });
    }
    try {
      const result = await db.transaction(async (transactionDb) => {
        const complaint = await transactionDb.get(`
          SELECT id, status, mediation_eligible, mediation_eligibility_notes FROM complaints
          WHERE id = ? AND deleted_at IS NULL FOR UPDATE
        `, [req.params.id]);
        if (!complaint) return { error: 'Complaint not found.', statusCode: 404 };
        if (Boolean(complaint.mediation_eligible) === eligible && complaint.mediation_eligibility_notes === remarks) {
          return { unchanged: true };
        }
        if (!eligible && complaint.mediation_eligible) {
          const activeSchedule = await transactionDb.get(
            "SELECT id FROM schedules WHERE complaint_id = ? AND status = 'naka-iskedyul' LIMIT 1",
            [req.params.id]
          );
          if (activeSchedule) return { error: 'Eligibility cannot be withdrawn while an active mediation is scheduled.', statusCode: 409 };
        }
        await transactionDb.run(`
          UPDATE complaints
          SET mediation_eligible = ?, mediation_eligibility_notes = ?,
              mediation_eligibility_verified_by = ?, mediation_eligibility_verified_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [eligible ? 1 : 0, remarks, req.user.id, req.params.id]);
        const actionType = eligible ? 'mediation_eligibility_verified' : 'mediation_eligibility_declined';
        await transactionDb.run(`
          INSERT INTO complaint_audit (complaint_id, previous_status, new_status, action_type, remarks, actor_user_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [req.params.id, complaint.status, complaint.status, actionType, remarks, req.user.id]);
        await transactionDb.run(`
          INSERT INTO mediation_audit (complaint_id, action_type, details, actor_user_id)
          VALUES (?, ?, JSON_OBJECT('eligible', ?, 'remarks', ?), ?)
        `, [req.params.id, actionType, eligible ? 1 : 0, remarks, req.user.id]);
        return { eligible };
      });
      if (result.error) return res.status(result.statusCode).json({ error: result.error });
      if (result.unchanged) return res.json({ message: 'This mediation eligibility decision is already recorded.', eligible });
      res.json({ message: 'Mediation eligibility recorded.', eligible: result.eligible });
    } catch (error) {
      console.error('Unable to record mediation eligibility:', error);
      res.status(500).json({ error: 'Unable to save the mediation eligibility decision.' });
    }
  });

  app.get('/api/complaints/:id/history', authenticate, async (req: any, res) => {
    try {
      const accessFilter = req.user.role === 'mamamayan' ? ' AND (c.user_id = ? OR c.nireklamo_user_id = ?)' : '';
      const params = req.user.role === 'mamamayan' ? [req.params.id, req.user.id, req.user.id] : [req.params.id];
      const complaint = await db.get(`
        SELECT c.id, c.blotter_number, c.uri_ng_reklamo, c.created_at
        FROM complaints c
        WHERE c.id = ? AND c.deleted_at IS NULL${accessFilter}
      `, params);
      if (!complaint) return res.status(404).json({ error: 'Complaint not found.' });
      res.json({ complaint, events: await getComplaintCaseHistory(req.params.id) });
    } catch (error) {
      console.error('Unable to load complaint case history:', error);
      res.status(500).json({ error: 'Unable to load case history.' });
    }
  });

  app.post('/api/complaints/:id/history/email', authenticate, async (req: any, res) => {
    try {
      const complaint = await db.get(`
        SELECT c.id, c.blotter_number, c.uri_ng_reklamo, c.created_at,
               u.email AS recipient_email, u.pangalan AS recipient_name
        FROM complaints c
        JOIN account_profiles u ON u.id = ?
        WHERE c.id = ? AND c.deleted_at IS NULL
          AND (c.user_id = ? OR c.nireklamo_user_id = ? OR ? <> 'mamamayan')
      `, [req.user.id, req.params.id, req.user.id, req.user.id, req.user.role]);
      if (!complaint) return res.status(404).json({ error: 'Complaint not found.' });
      if (!complaint.recipient_email) return res.status(400).json({ error: 'There is no email address on your account.' });

      await db.run(`
        INSERT IGNORE INTO case_history_email_log (complaint_id, user_id, last_sent_at)
        VALUES (?, ?, DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 MINUTE))
      `, [req.params.id, req.user.id]);
      const maySend = await db.transaction(async (transactionDb) => {
        const row = await transactionDb.get(`
          SELECT last_sent_at FROM case_history_email_log
          WHERE complaint_id = ? AND user_id = ? FOR UPDATE
        `, [req.params.id, req.user.id]);
        const elapsedSeconds = (Date.now() - new Date(row.last_sent_at).getTime()) / 1000;
        if (elapsedSeconds < 60) return false;
        await transactionDb.run(`
          UPDATE case_history_email_log SET last_sent_at = CURRENT_TIMESTAMP
          WHERE complaint_id = ? AND user_id = ?
        `, [req.params.id, req.user.id]);
        return true;
      });
      if (!maySend) return res.status(429).json({ error: 'Please wait one minute before requesting this case history by email again.' });
      try {
        await sendCaseHistoryEmail(
          complaint.recipient_email,
          complaint.recipient_name,
          complaint.blotter_number || `Case ${complaint.id}`,
          complaint.uri_ng_reklamo,
          complaint.created_at,
          await getComplaintCaseHistory(req.params.id)
        );
      } catch (error) {
        console.error('Unable to email complaint case history:', error);
        return res.status(502).json({ error: 'The email could not be sent. Please try again later.' });
      }
      res.json({ message: 'Case history sent to the email address on your account.' });
    } catch (error) {
      console.error('Unable to process case history email request:', error);
      res.status(500).json({ error: 'Unable to send case history.' });
    }
  });

  app.post('/api/complaints/:id/certificate-to-file-action', authenticate, async (req: any, res) => {
    if (req.user.role === 'mamamayan') return res.status(403).json({ error: 'Staff access is required to prepare this document.' });
    const basis = typeof req.body.basis === 'string' ? req.body.basis.trim().slice(0, 5000) : '';
    const officialName = typeof req.body.official_name === 'string' ? req.body.official_name.trim().slice(0, 255) : '';
    const officialPosition = typeof req.body.official_position === 'string' ? req.body.official_position.trim().slice(0, 150) : '';
    if (basis.length < 20 || !officialName || !officialPosition) {
      return res.status(400).json({ error: 'Enter the verified procedural basis and the issuing official name and position.' });
    }
    try {
      const result = await db.transaction(async (transactionDb) => {
        const complaint = await transactionDb.get(
          'SELECT id, status FROM complaints WHERE id = ? AND deleted_at IS NULL FOR UPDATE',
          [req.params.id]
        );
        if (!complaint) return { error: 'Complaint not found.', statusCode: 404 };
        const remarks = `Certificate to File Action prepared. Procedural basis: ${basis} Issuing official: ${officialName}, ${officialPosition}.`;
        const existing = await transactionDb.get(`
          SELECT id FROM complaint_audit
          WHERE complaint_id = ? AND action_type = 'certificate_to_file_action_prepared' AND remarks = ?
          LIMIT 1
        `, [req.params.id, remarks]);
        if (existing) return { unchanged: true };
        await transactionDb.run(`
          INSERT INTO complaint_audit (complaint_id, previous_status, new_status, action_type, remarks, actor_user_id)
          VALUES (?, ?, ?, 'certificate_to_file_action_prepared', ?, ?)
        `, [req.params.id, complaint.status, complaint.status, remarks, req.user.id]);
        await transactionDb.run(
          'INSERT INTO actions (complaint_id, user_id, paglalarawan) VALUES (?, ?, ?)',
          [req.params.id, req.user.id, remarks]
        );
        return { prepared: true };
      });
      if (result.error) return res.status(result.statusCode).json({ error: result.error });
      res.json({ message: result.unchanged ? 'This document preparation is already recorded.' : 'Document preparation recorded in the case history.' });
    } catch (error) {
      console.error('Unable to record Certificate to File Action preparation:', error);
      res.status(500).json({ error: 'Unable to record document preparation.' });
    }
  });

  // --- MEDIATION ROUTES ---
  app.post('/api/complaints/:id/mediation', authenticate, async (req: any, res) => {
    try {
      if (req.user.role === 'mamamayan') return res.status(403).json({ error: 'You are not authorized to perform this action.' });
      const { petsa, lokasyon, detalye, paraan_ng_pagpapadala, paraan_detalye, assigned_personnel } = req.body;
      const scheduledAt = typeof petsa === 'string' ? new Date(petsa) : new Date('');
      const venue = typeof lokasyon === 'string' ? lokasyon.trim().slice(0, 500) : '';
      const personnel = typeof assigned_personnel === 'string' ? assigned_personnel.trim().slice(0, 1000) : '';
      const deliveryMethod = ['system', 'telepono', 'personal'].includes(paraan_ng_pagpapadala) ? paraan_ng_pagpapadala : '';
      const deliveryDetails = typeof paraan_detalye === 'string' ? paraan_detalye.trim().slice(0, 1000) : '';
      if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now() || !venue || !personnel || !deliveryMethod) {
        return res.status(400).json({ error: 'Provide a future mediation date, venue, assigned personnel, and valid summons delivery method.' });
      }
      if (deliveryMethod !== 'system' && !deliveryDetails) {
        return res.status(400).json({ error: 'Enter delivery details for the selected summons delivery method.' });
      }
      const transactionResult = await db.transaction(async (transactionDb) => {
        const complaint = await transactionDb.get(`
          SELECT c.id, c.status, c.mediation_eligible, c.mediation_eligibility_notes,
                 c.user_id, c.nireklamo_user_id, c.nireklamo_email, c.nireklamo_pangalan,
                 c.uri_ng_reklamo, c.blotter_number, u.email AS reporter_email, u.pangalan AS reporter_name
          FROM complaints c JOIN account_profiles u ON u.id = c.user_id
          WHERE c.id = ? AND c.deleted_at IS NULL FOR UPDATE
        `, [req.params.id]);
        if (!complaint) return { error: 'Complaint not found.', statusCode: 404 };
        if (!complaint.mediation_eligible) return { error: 'This complaint has not been verified as eligible for mediation by staff.', statusCode: 403 };
        if (['natapos', 'archived'].includes(complaint.status)) return { error: 'Resolved or archived complaints cannot be scheduled for mediation.', statusCode: 409 };
        const activeSchedule = await transactionDb.get(
          "SELECT id FROM schedules WHERE complaint_id = ? AND status = 'naka-iskedyul' LIMIT 1",
          [req.params.id]
        );
        if (activeSchedule) return { error: 'An active mediation schedule already exists for this complaint.', statusCode: 409 };
        const schedule = await transactionDb.run(`
          INSERT INTO schedules
            (complaint_id, petsa, lokasyon, detalye, paraan_ng_pagpapadala, paraan_detalye, staff_user_id, assigned_personnel)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [req.params.id, scheduledAt, venue, String(detalye || '').trim().slice(0, 2000), deliveryMethod, deliveryDetails, req.user.id, personnel]);
        await transactionDb.run(
          "UPDATE complaints SET status = 'sa-mediation', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [req.params.id]
        );
        const remarks = `Mediation scheduled for ${scheduledAt.toISOString()} at ${venue}; assigned personnel: ${personnel}. Summons delivery: ${deliveryMethod}${deliveryDetails ? ` (${deliveryDetails})` : ''}.`;
        await transactionDb.run(`
          INSERT INTO complaint_audit (complaint_id, previous_status, new_status, action_type, remarks, actor_user_id)
          VALUES (?, ?, 'sa-mediation', 'mediation_scheduled', ?, ?)
        `, [req.params.id, complaint.status, remarks, req.user.id]);
        await transactionDb.run(
          'INSERT INTO actions (complaint_id, user_id, paglalarawan) VALUES (?, ?, ?)',
          [req.params.id, req.user.id, remarks]
        );
        await transactionDb.run(`
          INSERT INTO mediation_audit (complaint_id, schedule_id, action_type, details, actor_user_id)
          VALUES (?, ?, 'mediation_scheduled', JSON_OBJECT('case_reference', ?, 'complainant', ?, 'respondent', ?, 'scheduled_at', ?, 'venue', ?, 'assigned_personnel', ?, 'delivery_method', ?, 'delivery_details', ?, 'remarks', ?), ?)
        `, [req.params.id, schedule.lastID, complaint.blotter_number || `Case ${complaint.id}`, complaint.reporter_name, complaint.nireklamo_pangalan || '', scheduledAt.toISOString(), venue, personnel, deliveryMethod, deliveryDetails, String(detalye || '').trim(), req.user.id]);
        return { complaint, mediationId: schedule.lastID };
      });
      if (transactionResult.error) return res.status(transactionResult.statusCode).json({ error: transactionResult.error });
      const complaint = transactionResult.complaint;
      const msg = `Your complaint has been scheduled for mediation on ${scheduledAt.toISOString()}. Delivery method: ${deliveryMethod}.`;
      const targetPath = `/complaints/${req.params.id}`;
      const mNotif = await db.run('INSERT INTO notifications (user_id, mensahe, notification_type, target_path) VALUES (?, ?, ?, ?)', [complaint.user_id, msg, 'mediation_scheduled', targetPath]);
      ablyEmit(`user_${complaint.user_id}`, 'notification', { 
        id: mNotif.lastID, 
        mensahe: msg, 
        notification_type: 'mediation_scheduled',
        target_path: targetPath,
        nabasa: 0,
        created_at: new Date()
      });

      // Send Email to Reporter
      if (complaint.reporter_email) {
        void sendMediationScheduledEmail(complaint.reporter_email, complaint.reporter_name, complaint.blotter_number, scheduledAt.toISOString(), venue, false);
      }

      // Notify respondent if they have an account
      if (complaint.nireklamo_user_id && complaint.nireklamo_user_id !== complaint.user_id) {
        const respondentMsg = `You have been called to mediation regarding "${complaint.uri_ng_reklamo}" on ${scheduledAt.toISOString()} at ${venue}.`;
        const mrNotif = await db.run('INSERT INTO notifications (user_id, mensahe, notification_type, target_path) VALUES (?, ?, ?, ?)', [complaint.nireklamo_user_id, respondentMsg, 'mediation_summon', targetPath]);
        ablyEmit(`user_${complaint.nireklamo_user_id}`, 'notification', { 
          id: mrNotif.lastID, 
          mensahe: respondentMsg, 
          notification_type: 'mediation_summon',
          target_path: targetPath,
          nabasa: 0,
          created_at: new Date()
        });
      }

      // Send Email to Respondent (if email is known)
      if (complaint.nireklamo_email && complaint.nireklamo_email !== complaint.reporter_email) {
        void sendMediationScheduledEmail(complaint.nireklamo_email, complaint.nireklamo_pangalan || 'Respondent', complaint.blotter_number, scheduledAt.toISOString(), venue, true);
      }
      
      res.status(201).json({ id: transactionResult.mediationId });
    } catch (error) {
      console.error('Error scheduling mediation:', error);
      res.status(500).json({ error: 'Failed to schedule mediation.' });
    }
  });

  app.patch('/api/mediation/:id/outcome', authenticate, upload.single('document'), async (req: any, res) => {
    try {
      if (req.user.role === 'mamamayan') return res.status(403).json({ error: 'You are not authorized to perform this action.' });
      const { outcome, minutes, attendees } = req.body;
      const outcomeLabels: Record<string, string> = {
        settled: 'Settled',
        referred: 'Referred for further action',
        dismissed: 'Dismissed',
      };
      if (!Object.prototype.hasOwnProperty.call(outcomeLabels, outcome)) {
        return res.status(400).json({ error: 'Choose a valid mediation outcome.' });
      }
      const cleanMinutes = typeof minutes === 'string' ? minutes.trim().slice(0, 10000) : '';
      const cleanAttendees = typeof attendees === 'string' ? attendees.trim().slice(0, 5000) : '';
      if (cleanMinutes.length < 5 || cleanAttendees.length < 2) {
        return res.status(400).json({ error: 'Record the proceedings and attendance before completing mediation.' });
      }
      const document_path = req.file
        ? await uploadToCloudinary(req.file.buffer, { folder: 'mediation/documents', resource_type: 'auto' })
        : null;
      const updateResult = await db.transaction(async (transactionDb) => {
        const schedule = await transactionDb.get(`
          SELECT s.id, s.complaint_id, s.status, c.status AS complaint_status, c.user_id,
                 c.nireklamo_user_id, c.blotter_number, c.nireklamo_email, c.nireklamo_pangalan,
                 c.uri_ng_reklamo, u.email AS reporter_email, u.pangalan AS reporter_name
          FROM schedules s
          JOIN complaints c ON c.id = s.complaint_id
          JOIN account_profiles u ON u.id = c.user_id
          WHERE s.id = ? FOR UPDATE
        `, [req.params.id]);
        if (!schedule) return { error: 'Mediation record not found.', statusCode: 404 };
        if (schedule.status !== 'naka-iskedyul') return { error: 'This mediation has already been updated.', statusCode: 409 };
        await transactionDb.run(`
          UPDATE schedules
          SET status = 'tapos', outcome = ?, minutes = ?, attendees = ?,
              document_path = COALESCE(?, document_path), updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status = 'naka-iskedyul'
        `, [outcome, cleanMinutes, cleanAttendees, document_path, req.params.id]);
        const remarks = `Mediation outcome: ${outcomeLabels[outcome]}. Attendance: ${cleanAttendees}. Proceedings: ${cleanMinutes}`;
        await transactionDb.run(`
          INSERT INTO complaint_audit (complaint_id, previous_status, new_status, action_type, remarks, actor_user_id)
          VALUES (?, ?, ?, 'mediation_outcome_recorded', ?, ?)
        `, [schedule.complaint_id, schedule.complaint_status, schedule.complaint_status, remarks, req.user.id]);
        await transactionDb.run(
          'INSERT INTO actions (complaint_id, user_id, paglalarawan) VALUES (?, ?, ?)',
          [schedule.complaint_id, req.user.id, remarks]
        );
        await transactionDb.run(`
          INSERT INTO mediation_audit (complaint_id, schedule_id, action_type, details, actor_user_id)
          VALUES (?, ?, 'mediation_outcome_recorded', JSON_OBJECT('outcome', ?, 'attendance', ?, 'proceedings', ?, 'evidence_path', ?), ?)
        `, [schedule.complaint_id, req.params.id, outcome, cleanAttendees, cleanMinutes, document_path, req.user.id]);
        return { schedule };
      });
      if (updateResult.error) return res.status(updateResult.statusCode).json({ error: updateResult.error });
      const complaintInfo = updateResult.schedule;
      const outcomeText = outcomeLabels[outcome];
      {
        const msg = `There is a new mediation outcome for case #${complaintInfo.blotter_number}: ${outcomeText}`;

        // In-system for reporter
        const targetPath = `/complaints/${complaintInfo.id}`;
        const orNotif = await db.run('INSERT INTO notifications (user_id, mensahe, notification_type, target_path) VALUES (?, ?, ?, ?)', [complaintInfo.user_id, msg, 'mediation_outcome', targetPath]);
        ablyEmit(`user_${complaintInfo.user_id}`, 'notification', { 
          id: orNotif.lastID, 
          mensahe: msg, 
          notification_type: 'mediation_outcome',
          target_path: targetPath,
          nabasa: 0,
          created_at: new Date()
        });

        // In-system for respondent
        if (complaintInfo.nireklamo_user_id && complaintInfo.nireklamo_user_id !== complaintInfo.user_id) {
          const oresNotif = await db.run('INSERT INTO notifications (user_id, mensahe, notification_type, target_path) VALUES (?, ?, ?, ?)', [complaintInfo.nireklamo_user_id, msg, 'mediation_outcome', targetPath]);
          ablyEmit(`user_${complaintInfo.nireklamo_user_id}`, 'notification', { 
            id: oresNotif.lastID, 
            mensahe: msg, 
            notification_type: 'mediation_outcome',
            target_path: targetPath,
            nabasa: 0,
            created_at: new Date()
          });
        }

        // Email
        if (complaintInfo.reporter_email) {
          void sendMediationOutcomeEmail(complaintInfo.reporter_email, complaintInfo.reporter_name, complaintInfo.blotter_number, outcome);
        }
        if (complaintInfo.nireklamo_email && complaintInfo.nireklamo_email !== complaintInfo.reporter_email) {
          void sendMediationOutcomeEmail(complaintInfo.nireklamo_email, complaintInfo.nireklamo_pangalan || 'Respondent', complaintInfo.blotter_number, outcome);
        }
      }

      res.json({ message: 'Mediation updated successfully.' });
    } catch (error) {
      console.error('Error updating mediation:', error);
      res.status(500).json({ error: 'Failed to update mediation outcome.' });
    }
  });

  app.patch('/api/mediation/:id/summons', authenticate, async (req: any, res) => {
    if (req.user.role === 'mamamayan') return res.status(403).json({ error: 'Staff access is required to edit an official summons.' });
    const { issueDate, recipient, address, secretary, secretaryPosition, chairperson, chairpersonPosition } = req.body;
    const document = {
      issueDate: typeof issueDate === 'string' ? issueDate : '',
      recipient: typeof recipient === 'string' ? recipient.trim().slice(0, 255) : '',
      address: typeof address === 'string' ? address.trim().slice(0, 1000) : '',
      secretary: typeof secretary === 'string' ? secretary.trim().slice(0, 255) : '',
      secretaryPosition: typeof secretaryPosition === 'string' ? secretaryPosition.trim().slice(0, 150) : '',
      chairperson: typeof chairperson === 'string' ? chairperson.trim().slice(0, 255) : '',
      chairpersonPosition: typeof chairpersonPosition === 'string' ? chairpersonPosition.trim().slice(0, 150) : '',
    };
    const issueDateValue = new Date(`${document.issueDate}T00:00:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(document.issueDate) || Number.isNaN(issueDateValue.getTime()) ||
      issueDateValue.toISOString().slice(0, 10) !== document.issueDate ||
      !document.recipient || !document.secretary || !document.secretaryPosition ||
      !document.chairperson || !document.chairpersonPosition) {
      return res.status(400).json({ error: 'Complete the issue date, recipient, and issuing officials before saving the summons.' });
    }
    try {
      const result = await db.transaction(async (transactionDb) => {
        const schedule = await transactionDb.get(`
          SELECT s.id, s.complaint_id, s.status, s.summons_details, c.status AS complaint_status
          FROM schedules s JOIN complaints c ON c.id = s.complaint_id
          WHERE s.id = ? AND c.deleted_at IS NULL FOR UPDATE
        `, [req.params.id]);
        if (!schedule) return { error: 'Mediation record not found.', statusCode: 404 };
        if (schedule.status !== 'naka-iskedyul') return { error: 'Only an active mediation summons can be edited.', statusCode: 409 };
        let existing: unknown = schedule.summons_details;
        if (typeof existing === 'string') {
          try {
            existing = JSON.parse(existing);
          } catch {
            existing = null;
          }
        }
        const existingDetails = existing && typeof existing === 'object' && !Array.isArray(existing)
          ? existing as Record<string, unknown>
          : null;
        if (existingDetails && Object.entries(document).every(([key, value]) => existingDetails[key] === value)) {
          return { unchanged: true };
        }
        await transactionDb.run('UPDATE schedules SET summons_details = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [JSON.stringify(document), req.params.id]);
        const remarks = `Official summons edited for ${document.recipient}; issuing official: ${document.secretary} (${document.secretaryPosition}); chairperson: ${document.chairperson} (${document.chairpersonPosition}).`;
        await transactionDb.run(`
          INSERT INTO complaint_audit (complaint_id, previous_status, new_status, action_type, remarks, actor_user_id)
          VALUES (?, ?, ?, 'summons_document_saved', ?, ?)
        `, [schedule.complaint_id, schedule.complaint_status, schedule.complaint_status, remarks, req.user.id]);
        await transactionDb.run(`
          INSERT INTO mediation_audit (complaint_id, schedule_id, action_type, details, actor_user_id)
          VALUES (?, ?, 'summons_document_saved', JSON_OBJECT('issue_date', ?, 'recipient', ?, 'address', ?, 'secretary', ?, 'secretary_position', ?, 'chairperson', ?, 'chairperson_position', ?), ?)
        `, [schedule.complaint_id, req.params.id, document.issueDate, document.recipient, document.address, document.secretary, document.secretaryPosition, document.chairperson, document.chairpersonPosition, req.user.id]);
        return { saved: true };
      });
      if (result.error) return res.status(result.statusCode).json({ error: result.error });
      if (result.unchanged) return res.json({ message: 'This summons version is already saved.' });
      res.json({ message: 'Summons details saved to the mediation record.' });
    } catch (error) {
      console.error('Unable to save summons details:', error);
      res.status(500).json({ error: 'Unable to save summons details.' });
    }
  });

  app.get('/api/mediation/:id', authenticate, async (req: any, res) => {
    try {
      const mediation = await db.get(`
        SELECT s.*, 
               c.blotter_number,
               c.created_at AS complaint_date,
               c.uri_ng_reklamo, 
               ct.category,
               c.detalye as complaint_detail, 
               c.nireklamo_pangalan,
               ru.pangalan as reporter_name 
        FROM schedules s 
        JOIN complaints c ON s.complaint_id = c.id 
        LEFT JOIN complaint_types ct ON ct.name = c.uri_ng_reklamo
        JOIN account_profiles ru ON c.user_id = ru.id
        WHERE s.id = ?
      `, [req.params.id]);

      if (!mediation) return res.status(404).json({ error: 'Mediation document not found.' });
      
      const complaint = await db.get('SELECT user_id, nireklamo_user_id FROM complaints WHERE id = ?', [mediation.complaint_id]);
      if (!complaint) return res.status(404).json({ error: 'Complaint not found.' });
      if (req.user.role === 'mamamayan' && req.user.id !== complaint.user_id && req.user.id !== complaint.nireklamo_user_id) {
        return res.status(403).json({ error: 'You are not authorized to view this document.' });
      }

      res.json(mediation);
    } catch (error) {
      console.error('Error fetching single mediation:', error);
      res.status(500).json({ error: 'Unable to load the document.' });
    }
  });

  app.get('/api/mediation', authenticate, async (req: any, res) => {
    try {
      if (req.user.role === 'mamamayan') {
        // Residents only see their own mediations
        const mediations = await db.all(`
          SELECT s.*, c.uri_ng_reklamo, c.blotter_number 
          FROM schedules s 
          JOIN complaints c ON s.complaint_id = c.id 
          WHERE c.user_id = ? OR c.nireklamo_user_id = ?
          ORDER BY s.petsa ASC
        `, [req.user.id, req.user.id]);
        return res.json(mediations);
      } else {
        // Admin/Official see all mediations
        const mediations = await db.all(`
          SELECT s.*, c.uri_ng_reklamo, c.blotter_number, u.pangalan as reporter_name
          FROM schedules s 
          JOIN complaints c ON s.complaint_id = c.id 
          JOIN account_profiles u ON c.user_id = u.id
          ORDER BY s.petsa ASC
        `);
        return res.json(mediations);
      }
    } catch (error) {
      console.error('Error fetching mediations:', error);
      res.status(500).json({ error: 'Failed to fetch mediation schedules.' });
    }
  });

  // --- CHAT ROUTES ---
  app.post('/api/complaints/:id/messages', authenticate, async (req: any, res) => {
    try {
      const { mensahe } = req.body;
      const result = await db.run('INSERT INTO messages (complaint_id, user_id, mensahe) VALUES (?, ?, ?)', 
        [req.params.id, req.user.id, mensahe]);
      
      const sender = await db.get('SELECT pangalan FROM account_profiles WHERE id = ?', [req.user.id]);
      
      // Notify other participant
      const complaint = await db.get('SELECT user_id, assigned_to FROM complaints WHERE id = ?', [req.params.id]);
      const recipientId = req.user.id === complaint.user_id ? complaint.assigned_to : complaint.user_id;
      
      if (recipientId) {
        const msg = `New message from ${sender.pangalan}`;
        const targetPath = `/complaints/${req.params.id}`;
        const msgNotif = await db.run('INSERT INTO notifications (user_id, mensahe, notification_type, target_path) VALUES (?, ?, ?, ?)', [recipientId, msg, 'new_message', targetPath]);
        ablyEmit(`user_${recipientId}`, 'notification', { 
          id: msgNotif.lastID, 
          mensahe: msg, 
          notification_type: 'new_message',
          target_path: targetPath,
          nabasa: 0,
          created_at: new Date()
        });
      }

      ablyEmit(`complaint_${req.params.id}`, 'new_message', { 
        id: result.lastID, 
        mensahe, 
        sender: sender.pangalan, 
        user_id: req.user.id, 
        petsa: new Date(),
        nabasa: 0
      });
      
      res.status(201).json({ id: result.lastID });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: 'Unable to send the message.' });
    }
  });

  app.patch('/api/complaints/:id/messages/read', authenticate, async (req: any, res) => {
    await db.run('UPDATE messages SET nabasa = 1 WHERE complaint_id = ? AND user_id != ?', [req.params.id, req.user.id]);
    ablyEmit(`complaint_${req.params.id}`, 'complaint_read', { user_id: req.user.id });
    ablyEmit(`user_${req.user.id}`, 'messages_read', { complaint_id: Number(req.params.id) });
    res.json({ message: 'Messages marked as read.' });
  });

  // --- WITNESS ROUTES ---
  app.post('/api/complaints/:id/witnesses', authenticate, async (req: any, res) => {
    try {
      if (req.user.role === 'mamamayan') {
        const complaint = await db.get('SELECT user_id FROM complaints WHERE id = ?', [req.params.id]);
        if (complaint.user_id !== req.user.id) return res.status(403).json({ error: 'You are not authorized to add witnesses to this complaint.' });
      }
      const { pangalan, telepono, detalye } = req.body;
      const result = await db.run('INSERT INTO witnesses (complaint_id, pangalan, telepono, detalye) VALUES (?, ?, ?, ?)',
        [req.params.id, pangalan, telepono, detalye]);
      res.status(201).json({ id: result.lastID });
    } catch (error) {
      res.status(500).json({ error: 'Failed to add witness.' });
    }
  });

  // --- LUPON ROUTES ---
  app.get('/api/lupon-members', authenticate, async (req, res) => {
    try {
      const members = await db.all('SELECT * FROM lupon_members WHERE is_active = 1');
      res.json(members);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch lupon members.' });
    }
  });

  app.post('/api/complaints/:id/lupon', authenticate, async (req: any, res) => {
    try {
      if (req.user.role === 'mamamayan') return res.status(403).json({ error: 'You are not authorized to assign mediation members.' });
      const { lupon_ids } = req.body;
      if (!Array.isArray(lupon_ids) || lupon_ids.some((value: unknown) => !Number.isSafeInteger(Number(value)) || Number(value) < 1)) {
        return res.status(400).json({ error: 'Select valid Lupon members.' });
      }
      const memberIds = [...new Set(lupon_ids.map(Number))].sort((left, right) => left - right);
      const result = await db.transaction(async (transactionDb) => {
        const complaint = await transactionDb.get(
          'SELECT id, status FROM complaints WHERE id = ? AND deleted_at IS NULL FOR UPDATE',
          [req.params.id]
        );
        if (!complaint) return { error: 'Complaint not found.', statusCode: 404 };
        const currentMembers = await transactionDb.all(
          'SELECT lupon_id FROM case_lupon WHERE complaint_id = ? ORDER BY lupon_id',
          [req.params.id]
        );
        const currentIds = currentMembers.map((member: any) => Number(member.lupon_id));
        if (JSON.stringify(currentIds) === JSON.stringify(memberIds)) return { unchanged: true };
        if (memberIds.length) {
          const activeMembers = await transactionDb.all(
            `SELECT id FROM lupon_members WHERE is_active = 1 AND id IN (${memberIds.map(() => '?').join(',')})`,
            memberIds
          );
          if (activeMembers.length !== memberIds.length) return { error: 'One or more selected Lupon members are unavailable.', statusCode: 400 };
        }
        await transactionDb.run('DELETE FROM case_lupon WHERE complaint_id = ?', [req.params.id]);
        for (const memberId of memberIds) {
          await transactionDb.run('INSERT INTO case_lupon (complaint_id, lupon_id) VALUES (?, ?)', [req.params.id, memberId]);
        }
        const names = memberIds.length
          ? await transactionDb.all(
            `SELECT pangalan, posisyon FROM lupon_members WHERE id IN (${memberIds.map(() => '?').join(',')}) ORDER BY pangalan`,
            memberIds
          )
          : [];
        const remarks = memberIds.length
          ? `Mediation personnel assigned: ${names.map((member: any) => `${member.pangalan} (${member.posisyon})`).join(', ')}`
          : 'Mediation personnel assignment cleared.';
        await transactionDb.run(`
          INSERT INTO complaint_audit (complaint_id, previous_status, new_status, action_type, remarks, actor_user_id)
          VALUES (?, ?, ?, 'mediation_personnel_assigned', ?, ?)
        `, [req.params.id, complaint.status, complaint.status, remarks, req.user.id]);
        await transactionDb.run(`
          INSERT INTO mediation_audit (complaint_id, action_type, details, actor_user_id)
          VALUES (?, 'mediation_personnel_assigned', JSON_OBJECT('member_ids', ?, 'remarks', ?), ?)
        `, [req.params.id, JSON.stringify(memberIds), remarks, req.user.id]);
        return { changed: true };
      });
      if (result.error) return res.status(result.statusCode).json({ error: result.error });
      if (result.unchanged) return res.json({ message: 'These Lupon assignments are already recorded.' });
      res.json({ message: 'Lupon assigned successfully.' });
    } catch (error) {
      console.error('Unable to assign mediation members:', error);
      res.status(500).json({ error: 'Failed to assign lupon.' });
    }
  });

  // --- ADDITIONAL MEDIATION FEATURES ---
  app.patch('/api/mediation/:id/minutes', authenticate, async (req: any, res) => {
    try {
      if (req.user.role === 'mamamayan') return res.status(403).json({ error: 'You are not authorized to update mediation minutes.' });
      const { minutes } = req.body;
      await db.run('UPDATE schedules SET minutes = ? WHERE id = ?', [minutes, req.params.id]);
      res.json({ message: 'Minutes updated.' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update minutes.' });
    }
  });

  // --- KNOWLEDGE BASE ENDPOINTS ---
  app.post('/api/chat/search', async (req, res) => {
    const { message } = req.body;
    try {
      const kbAnswer = await searchKnowledgeBase(message);
      if (kbAnswer) {
        return res.json({ text: kbAnswer, source: 'knowledge_base' });
      }
      res.status(404).json({ message: 'No knowledge base match.' });
    } catch (error) {
      res.status(500).json({ error: 'KB search failed.' });
    }
  });

  app.post('/api/chat/learn', async (req, res) => {
    const { question, answer } = req.body;
    try {
      await learnToKnowledgeBase(question, answer);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Learning failed.' });
    }
  });

  // --- DASHBOARD STATS ---
  app.get('/api/stats', authenticate, async (req: any, res) => {
    try {
      if (req.user.role === 'mamamayan') return res.status(403).json({ error: 'You are not authorized to view dashboard statistics.' });
      const requestedScope = String(req.query.scope || 'all');
      const scope = ['all', 'resident', 'non-resident'].includes(requestedScope) ? requestedScope : 'all';
      const complaintFilter = scope === 'resident'
        ? ' WHERE deleted_at IS NULL AND (is_resident = ? OR is_resident IS NULL)'
        : scope === 'non-resident' ? ' WHERE deleted_at IS NULL AND is_resident = ?' : ' WHERE deleted_at IS NULL';
      const filterParams = scope === 'resident' || scope === 'non-resident'
        ? [scope === 'resident' ? 'Resident' : 'Non Resident'] : [];
      const statusFilter = (suffix: string) => `${suffix}${complaintFilter ? complaintFilter.replace(' WHERE', ' AND') : ''}`;
      const total = await db.get(`SELECT COUNT(*) as count FROM complaints${complaintFilter}`, filterParams);
      const pending = await db.get(`SELECT COUNT(*) as count FROM complaints WHERE status = "bago"${statusFilter('')}`, filterParams);
      const ongoing = await db.get(`SELECT COUNT(*) as count FROM complaints WHERE status NOT IN ("bago", "natapos", "archived")${statusFilter('')}`, filterParams);
      const completed = await db.get(`SELECT COUNT(*) as count FROM complaints WHERE status = "natapos"${statusFilter('')}`, filterParams);
      const byType = await db.all(`SELECT uri_ng_reklamo as type, COUNT(*) as count FROM complaints${complaintFilter} GROUP BY uri_ng_reklamo ORDER BY count DESC`, filterParams);
      const zoneFilter = complaintFilter ? complaintFilter.replace(' WHERE', " WHERE zone IS NOT NULL AND zone <> '' AND") : " WHERE zone IS NOT NULL AND zone <> ''";
      const byZone = await db.all(`SELECT zone, COUNT(*) as count FROM complaints${zoneFilter} GROUP BY zone ORDER BY count DESC LIMIT 10`, filterParams);
      const statusSummary = await db.all(`SELECT status as label, COUNT(*) as count FROM complaints${complaintFilter} GROUP BY status ORDER BY count DESC`, filterParams);
      const outcomeSummary = await db.all(`
        SELECT CASE
          WHEN status = 'natapos' THEN 'Resolved'
          WHEN status = 'sa-mediation' THEN 'Mediation'
          WHEN status = 'bago' THEN 'Pending'
          ELSE 'Active'
        END as label,
        COUNT(*) as count
        FROM complaints
        ${complaintFilter}
        GROUP BY label
        ORDER BY count DESC
      `, filterParams);
      const demographics = await db.get(`
        SELECT
          SUM(CASE WHEN is_resident = 'Resident' OR is_resident IS NULL THEN 1 ELSE 0 END) AS resident_count,
          SUM(CASE WHEN is_resident = 'Non Resident' THEN 1 ELSE 0 END) AS non_resident_count
        FROM complaints${complaintFilter}
      `, filterParams);
      const residentCount = Number(demographics?.resident_count || 0);
      const nonResidentCount = Number(demographics?.non_resident_count || 0);
      const weeklyTrend = await db.all(`
        SELECT DATE_FORMAT(DATE_SUB(DATE(created_at), INTERVAL WEEKDAY(created_at) DAY), '%Y-%m-%d') as week_start,
               COUNT(*) as count
        FROM complaints
        ${complaintFilter}
          AND created_at <= CURRENT_TIMESTAMP
        GROUP BY DATE_SUB(DATE(created_at), INTERVAL WEEKDAY(created_at) DAY)
        ORDER BY week_start DESC
        LIMIT 12
      `, filterParams);
      const responseTime = await db.get(`
        SELECT AVG(TIMESTAMPDIFF(SECOND, c.created_at, dispositions.disposition_date) / 86400) as avg_days
        FROM complaints c
        JOIN (
          SELECT complaint_id, MAX(disposition_date) as disposition_date
          FROM case_dispositions
          WHERE action_type = 'resolved'
          GROUP BY complaint_id
        ) dispositions ON dispositions.complaint_id = c.id
        WHERE c.deleted_at IS NULL AND c.status = 'natapos'
          AND dispositions.disposition_date >= c.created_at
          ${scope === 'resident' ? 'AND (c.is_resident = ? OR c.is_resident IS NULL)' : scope === 'non-resident' ? 'AND c.is_resident = ?' : ''}
      `, filterParams);
      const hotspotZonesRaw = await db.all(`
        SELECT b.name, COALESCE(b.description, cz.description, '') as description,
               COALESCE(AVG(c.latitude), cz.lat) as lat, COALESCE(AVG(c.longitude), cz.lng) as lng,
               COUNT(c.id) as complaint_count,
               SUM(CASE WHEN c.status = 'natapos' THEN 1 ELSE 0 END) as resolved_count,
               SUM(CASE WHEN c.status NOT IN ('natapos', 'archived') THEN 1 ELSE 0 END) as active_count
        FROM boundaries b
        JOIN boundary_types bt ON bt.id = b.type_id AND bt.is_active = 1
        LEFT JOIN complaint_zones cz ON cz.name = b.name AND cz.is_active = 1
        LEFT JOIN complaints c ON c.zone = b.name AND c.deleted_at IS NULL AND c.status NOT IN ('natapos', 'archived')${scope === 'resident' ? ' AND (c.is_resident = ? OR c.is_resident IS NULL)' : scope === 'non-resident' ? ' AND c.is_resident = ?' : ''}
        WHERE b.status = 'active' AND b.deleted_at IS NULL
          AND NOT (LOWER(bt.name) = 'barangay' AND LOWER(b.name) = 'barangay san andres')
        GROUP BY b.id, b.name, b.description, cz.description, cz.lat, cz.lng
        HAVING COUNT(c.id) > 0
        ORDER BY complaint_count DESC, active_count DESC
      `, filterParams);
      const hotspotZones = hotspotZonesRaw.map((zone: any) => {
        const complaintCount = Number(zone.complaint_count || 0);
        const activeCount = Number(zone.active_count || 0);
        const computedColor = complaintCount >= 10 ? 'red' : complaintCount >= 5 ? 'orange' : 'yellow';

        return {
          ...zone,
          complaint_count: complaintCount,
          active_count: activeCount,
          resolved_count: Number(zone.resolved_count || 0),
          color: computedColor,
        };
      });

      const activeComplaintDots = await db.all(`
        SELECT c.id, c.blotter_number, c.uri_ng_reklamo, ct.category, c.status,
               c.street_name, c.address_details, c.zone,
               c.latitude, c.longitude, c.created_at
        FROM complaints c
        LEFT JOIN complaint_types ct ON ct.name = c.uri_ng_reklamo
        WHERE c.deleted_at IS NULL
          AND c.status NOT IN ('natapos', 'archived')
          AND c.latitude IS NOT NULL
          AND c.longitude IS NOT NULL
          ${scope === 'resident' ? 'AND (c.is_resident = ? OR c.is_resident IS NULL)' : scope === 'non-resident' ? 'AND c.is_resident = ?' : ''}
        ORDER BY c.created_at DESC
      `, filterParams);

      const efficiencyRate = total.count ? Math.round((Number(completed.count || 0) / Number(total.count || 1)) * 100) : 0;
      
      res.json({
        total: total.count,
        pending: pending.count,
        ongoing: ongoing.count,
        completed: completed.count,
        byType,
        byZone,
        statusSummary,
        outcomeSummary,
        demographics,
        demographicDifference: {
          residentCount,
          nonResidentCount,
          countDifference: Math.abs(residentCount - nonResidentCount),
          higherGroup: residentCount === nonResidentCount ? 'equal' : residentCount > nonResidentCount ? 'resident' : 'non-resident',
        },
        weeklyTrend,
        responseTime: Number(responseTime?.avg_days || 0),
        efficiencyRate,
        hotspotZones,
        activeComplaintDots,
        scope
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ error: 'Unable to load dashboard statistics.' });
    }
  });

  app.get('/api/admin/complaint-zones', authenticate, async (req: any, res) => {
    try {
      if (!['admin', 'official'].includes(req.user.role)) return res.status(403).json({ error: 'Staff access is required.' });
      const zones = await db.all(`
        SELECT cz.*, COUNT(c.id) as complaint_count,
               SUM(CASE WHEN c.status = 'natapos' THEN 1 ELSE 0 END) as resolved_count,
               SUM(CASE WHEN c.status NOT IN ('natapos', 'archived') THEN 1 ELSE 0 END) as active_count
        FROM complaint_zones cz
        LEFT JOIN complaints c ON c.zone = cz.name AND c.deleted_at IS NULL AND c.status NOT IN ('natapos', 'archived')
        GROUP BY cz.id, cz.name, cz.description, cz.lat, cz.lng, cz.color, cz.is_active, cz.created_at
        ORDER BY cz.is_active DESC, cz.name ASC
      `);
      res.json(zones);
    } catch (error) {
      console.error('Error fetching admin complaint zones:', error);
      res.status(500).json({ error: 'Unable to load complaint zones.' });
    }
  });

  app.get('/api/complaint-zones', async (req, res) => {
    try {
      const includeEmpty = req.query.include_empty === '1';
      const zones = await db.all(`
        SELECT b.id, b.name,
               COALESCE(b.description, cz.description, '') AS description,
               COALESCE(AVG(c.latitude), cz.lat) AS lat,
               COALESCE(AVG(c.longitude), cz.lng) AS lng,
               COUNT(c.id) AS complaint_count,
               COUNT(c.id) AS active_count,
               0 AS resolved_count
        FROM boundaries b
        JOIN boundary_types bt ON bt.id = b.type_id AND bt.is_active = 1
        LEFT JOIN complaint_zones cz ON cz.name = b.name AND cz.is_active = 1
        LEFT JOIN complaints c ON c.zone = b.name AND c.deleted_at IS NULL AND c.status NOT IN ('natapos', 'archived')
        WHERE b.status = 'active' AND b.deleted_at IS NULL
          AND NOT (LOWER(bt.name) = 'barangay' AND LOWER(b.name) = 'barangay san andres')
        GROUP BY b.id, b.name, b.description, cz.description, cz.lat, cz.lng
        ${includeEmpty ? '' : 'HAVING COUNT(c.id) > 0'}
        ORDER BY complaint_count DESC, b.name ASC
      `);
      res.json(zones.map((zone: any) => {
        const complaintCount = Number(zone.complaint_count || 0);
        return {
          ...zone,
          source: 'boundary',
          complaint_count: complaintCount,
          active_count: Number(zone.active_count || 0),
          resolved_count: Number(zone.resolved_count || 0),
          color: complaintCount === 0 ? null : complaintCount >= 10 ? 'red' : complaintCount >= 5 ? 'orange' : 'yellow',
        };
      }));
    } catch (error) {
      console.error('Error fetching complaint hotspots:', error);
      res.status(500).json({ error: 'Unable to load complaint hotspots.' });
    }
  });

  app.post('/api/admin/complaint-zones', authenticate, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access is required.' });
      const { name, description, lat, lng, color } = req.body;
      const normalizedName = typeof name === 'string' ? name.trim() : '';
      const latitude = Number(lat);
      const longitude = Number(lng);
      if (!normalizedName || normalizedName.length > 100 || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 14.45 || latitude > 14.70 || longitude < 120.95 || longitude > 121.25) return res.status(400).json({ error: 'Enter a zone name and valid coordinates in the San Andres area.' });
      const result = await db.run(
        'INSERT INTO complaint_zones (name, description, lat, lng, color) VALUES (?, ?, ?, ?, ?)',
        [normalizedName, typeof description === 'string' ? description.trim() : '', latitude, longitude, color || 'green']
      );
      res.status(201).json({ id: result.lastID, name: normalizedName, description, lat: latitude, lng: longitude, color: color || 'green', is_active: 1, complaint_count: 0 });
    } catch (error) {
      console.error('Error creating complaint zone:', error);
      res.status(500).json({ error: 'Failed to create complaint zone.' });
    }
  });

  app.patch('/api/admin/complaint-zones/:id', authenticate, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access is required.' });
      const { name, description, lat, lng, is_active } = req.body;
      const normalizedName = typeof name === 'string' ? name.trim() : '';
      const latitude = Number(lat);
      const longitude = Number(lng);
      if (!normalizedName || normalizedName.length > 100 || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 14.45 || latitude > 14.70 || longitude < 120.95 || longitude > 121.25) return res.status(400).json({ error: 'Enter a zone name and valid coordinates in the San Andres area.' });
      const currentZone = await db.get('SELECT name FROM complaint_zones WHERE id = ?', [req.params.id]);
      if (!currentZone) return res.status(404).json({ error: 'Complaint zone not found.' });
      await db.transaction(async (transactionDb) => {
        await transactionDb.run('UPDATE complaint_zones SET name = ?, description = ?, lat = ?, lng = ?, is_active = ? WHERE id = ?', [normalizedName, typeof description === 'string' ? description.trim() : '', latitude, longitude, is_active ? 1 : 0, req.params.id]);
        if (currentZone.name !== normalizedName) {
          await transactionDb.run('UPDATE complaints SET zone = ? WHERE zone = ?', [normalizedName, currentZone.name]);
        }
      });
      res.json({ message: 'Complaint zone updated.' });
    } catch (error) {
      console.error('Error updating complaint zone:', error);
      res.status(500).json({ error: 'Failed to update complaint zone.' });
    }
  });

  app.delete('/api/admin/complaint-zones/:id', authenticate, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access is required.' });
      const result = await db.run('UPDATE complaint_zones SET is_active = 0 WHERE id = ?', [req.params.id]);
      if (!result.changes) return res.status(404).json({ error: 'Complaint zone not found.' });
      res.json({ message: 'Zone archived. Existing complaint records are preserved.' });
    } catch (error) {
      console.error('Error archiving complaint zone:', error);
      res.status(500).json({ error: 'Unable to archive complaint zone.' });
    }
  });

  // --- COMPLAINT TYPE ROUTES ---
  app.get('/api/complaint-types', async (req, res) => {
    try {
      const types = await db.all('SELECT * FROM complaint_types WHERE is_active = 1 ORDER BY category ASC, name ASC');
      res.json(types);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch complaint types.' });
    }
  });

  app.get('/api/admin/complaint-types', authenticate, async (req: any, res) => {
    try {
      if (req.user.role === 'mamamayan') return res.status(403).json({ error: 'You are not authorized to manage complaint types.' });
      const types = await db.all('SELECT * FROM complaint_types ORDER BY category ASC, name ASC');
      res.json(types);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch complaint types for admin.' });
    }
  });

  app.post('/api/admin/complaint-types', authenticate, async (req: any, res) => {
    try {
      if (req.user.role === 'mamamayan') return res.status(403).json({ error: 'You are not authorized to manage complaint types.' });
      const { category, name, description } = req.body;
      if (typeof category !== 'string' || !COMPLAINT_CATEGORIES.includes(category.trim()) || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Choose a category and enter a complaint type.' });
      }
      if (name.trim().length > 255 || typeof description !== 'string' || !description.trim() || description.trim().length > 2000) {
        return res.status(400).json({ error: 'The complaint type or description is too long.' });
      }
      const result = await db.run('INSERT INTO complaint_types (category, name, description) VALUES (?, ?, ?)', [category.trim(), name.trim(), String(description || '').trim()]);
      res.status(201).json({ id: result.lastID, category: category.trim(), name: name.trim(), description: String(description || '').trim() });
    } catch (error) {
      res.status(400).json({ error: 'That complaint type already exists or could not be created.' });
    }
  });

  app.patch('/api/admin/complaint-types/:id', authenticate, async (req: any, res) => {
    try {
      if (req.user.role === 'mamamayan') return res.status(403).json({ error: 'You are not authorized to manage complaint types.' });
      const { category, name, description, is_active } = req.body;
      if (typeof category !== 'string' || !COMPLAINT_CATEGORIES.includes(category.trim()) || typeof name !== 'string' || !name.trim() || typeof description !== 'string' || !description.trim()) {
        return res.status(400).json({ error: 'Choose a category and enter a complaint type.' });
      }
      if (name.trim().length > 255 || description.trim().length > 2000) {
        return res.status(400).json({ error: 'The complaint type or description is too long.' });
      }
      await db.run('UPDATE complaint_types SET category = ?, name = ?, description = ?, is_active = ? WHERE id = ?', [category.trim(), name.trim(), description.trim(), is_active ? 1 : 0, req.params.id]);
      res.json({ message: 'Complaint type updated.' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update complaint type.' });
    }
  });

  app.delete('/api/admin/complaint-types/:id', authenticate, async (req: any, res) => {
    try {
      if (req.user.role === 'mamamayan') return res.status(403).json({ error: 'You are not authorized to manage complaint types.' });
      // We soft delete by setting is_active = 0 to prevent breaking existing complaints
      await db.run('UPDATE complaint_types SET is_active = 0 WHERE id = ?', [req.params.id]);
      res.json({ message: 'Complaint type deactivated.' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete complaint type.' });
    }
  });

  // --- SITE SETTINGS ENDPOINTS ---
  app.get('/api/settings', async (req, res) => {
    try {
      const settings = await db.all('SELECT * FROM site_settings');
      // Convert array of {setting_key, setting_value} to an object
      const settingsObj = settings.reduce((acc: any, curr: any) => {
        acc[curr.setting_key] = curr.setting_value;
        return acc;
      }, {});
      res.json(settingsObj);
    } catch (error) {
      console.error('Error fetching settings:', error);
      res.status(500).json({ error: 'Failed to fetch settings.' });
    }
  });

  app.post('/api/admin/settings', authenticate, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access is required.' });
      
      const settings = req.body; // Expects an object of key-value pairs
      
      // Update each setting provided in the body
      for (const [key, value] of Object.entries(settings)) {
        await db.run(
          'INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
          [key, value, value]
        );
      }
      
      res.json({ message: 'Settings updated successfully.' });
    } catch (error) {
      console.error('Error updating settings:', error);
      res.status(500).json({ error: 'Failed to update settings.' });
    }
  });

  app.post('/api/admin/upload-logo', authenticate, upload.single('logo'), async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access is required.' });
      
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
      }

      const logoPath = await uploadToCloudinary(req.file.buffer, {
        folder: 'site/logo',
        resource_type: 'image',
      });
      
      await db.run(
        'INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
        ['logo_path', logoPath, logoPath]
      );
      
      res.json({ logo_path: logoPath, message: 'Logo uploaded successfully.' });
    } catch (error) {
      console.error('Error uploading logo:', error);
      res.status(500).json({ error: 'Failed to upload logo.' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server } },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const activePort = await listenOnAvailablePort(server, PORT);
  if (activePort !== PORT) {
    console.warn(`Port ${PORT} was busy; the application is using port ${activePort}.`);
  }

  server.on('error', (error) => {
    console.error('HTTP server error:', error);
  });

  console.log(`\n✅ Server is running!`);
  console.log(`🏠 Local:            http://localhost:${activePort}`);

  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]!) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`🌐 Network Access:   http://${net.address}:${activePort}`);
      }
    }
  }
  console.log('');
}

startServer().catch((error) => {
  console.error('Unable to start the server:', error);
  process.exitCode = 1;
});

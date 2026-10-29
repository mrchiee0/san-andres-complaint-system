# Google Login

Google login uses Google Identity Services and the existing application JWT session. Create a Web application OAuth client in the Google Cloud Console, add `http://localhost:3000` to its authorized JavaScript origins, then set the same client ID in the server environment:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Restart the dev server after changing environment variables. Existing resident, non-resident, administrator, and official accounts can sign in with Google when the Google email matches their account email. New Google accounts are created as resident accounts and do not receive administrator privileges automatically.

The sign-in page renders Google's sign-in button when `VITE_GOOGLE_CLIENT_ID` is configured. Google sign-in still requires the system's email OTP before a session is issued.
# San Andres Complaint System 🛡️

Modern Barangay Complaint Management System built with React 19 + Express + MySQL.

## ✨ Features
- **Real-time Chat** (Socket.io)
- **File Uploads** (Photos/Videos/PDF up to 50MB)
- **Mediation Scheduling** 
- **Complaint audit trail, formal case disposition records, and printable/email case history**
- **Staff-verified mediation eligibility, attendance/proceedings audit, and editable summons**
- **AI Assistant** (Google Gemini)
- **Notifications & Status Tracking**
- **Admin Dashboard** (Reports, Complaint Types)
- **Mobile-First** shadcn/ui design
- **Secure JWT Auth** + Rate Limiting

## 🚀 Quick Start

1. **Setup Environment**
```bash
cp .env.example .env.local  # Already done!
```
   
2. **Fill .env.local**
```
JWT_SECRET=your-64-char-secret  # powershell: [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
GEMINI_API_KEY=your_key_from_aistudio.google.com/app/apikey
```

3. **Install & Run**
```bash
npm install
npm run dev
```
Open http://localhost:3000

## Registration Email Verification

New registrations remain pending until the user verifies their email and accepts the Terms and Conditions. Configure the mail sender in `.env.local`:

```env
SMTP_USER=your-sender@gmail.com
SMTP_PASS=your-gmail-app-password
APP_URL=http://localhost:3000
```

For deployment, set `APP_URL` to the public HTTPS application URL so the verification button returns users to the correct registration page. SMTP credentials must be valid or registration cannot send activation links.

The resident quick-signup path asks for an email and Terms acceptance, verifies the email with an OTP, and starts a resident session without requiring the full profile first. Residents can skip profile completion and edit their name, phone, and address later in Settings; complaint filing still asks for any required resident information not yet on their profile. The previous multi-step registration form remains available at `/register/full`.

## 🛠 Development

```
npm run dev     # Dev server with HMR
npm run build   # Production build
npm run start   # Production server
npm run lint    # TypeScript check
```

## 📱 Pages & Routes
- `/` - Landing
- `/login` `/register` - Auth
- `/dashboard` `/reklamo` - Core
- `/chat` `/kalendaryo` `/ulat` - Features
- `/admin/complaint-types` - Admin

## 🗄 Database
MySQL is initialized from the `DB_HOST`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` settings. Additive schema checks run at server startup; the complaint-audit, disposition, mediation-audit, and case-history email tables are created without replacing existing tables or records.

Startup checks also add the resident profile-completion marker and registration OTP attempt counter without replacing existing account data.

Mediation scheduling is blocked until staff record an eligibility decision and supporting reason. Category alone does not determine legal eligibility. Complaint status changes, mediation eligibility, assignments, schedules, outcomes, and final dispositions are recorded with the responsible account and timestamp. Residents who are parties to a complaint can view its case history and request an emailed statement; repeated email requests are throttled.

The summons cites the Local Government Code of 1991 (Republic Act No. 7160) and does not prescribe an independent fine or penalty for nonappearance. Staff must follow applicable law and barangay procedure.

The Certificate to File Action screen is a draft template: authorized staff must enter and verify the procedural basis and issuing official before printing. Preparation is added to the complaint audit trail; the template does not fabricate prior notices, a failed settlement, or court jurisdiction.

## 🔒 Security
- JWT (required env)
- Rate limiting (100/min)
- File validation
- Honeypot traps
- Helmet CSP

## 🤖 AI Chatbot
Gemini fallback if no key.

## 📈 Optimizations Applied
- Lazy loading all routes
- Auto token validation
- Env required

## Production Deployment (Vercel + Render)

The recommended split deployment serves the Vite frontend from Vercel, runs the Express API on Render, uses an external MySQL provider for the database, and uses Cloudinary for uploaded evidence, logos, and static site imagery.

### Render API and MySQL database

1. Create an external MySQL database (for example, on Aiven) and import the database schema/data before directing production traffic. Render does not provide a managed MySQL service.
2. In Render, create a Blueprint from this repository and use the included `render.yaml`, or create a Node web service manually with the repository root, build command `npm install --legacy-peer-deps && npm run build`, and start command `npm run start`.
3. Configure `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` with the external MySQL connection values. Set `DB_SSL=true` when the provider requires TLS.
4. Set `APP_URL`, `FRONTEND_URL`, and `CORS_ORIGINS` to the Vercel site's HTTPS origin. `JWT_SECRET` is generated by the Render Blueprint; set a strong random value manually if creating the service without the Blueprint.
5. Add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. Optionally configure `GEMINI_API_KEY` and `GEMINI_MODEL`, SMTP settings, `GOOGLE_CLIENT_ID`, and `ABLY_API_KEY`. Keep secret values only in Render's environment settings.
6. The service health check uses `/api/health`. Add a persistent disk only if another part of the application needs local files; user uploads are stored in Cloudinary.

### Vercel frontend

1. Import the same repository into Vercel using the project root. `vercel.json` builds with `npm run build`, publishes `dist`, and supports client-side routes.
2. Set `VITE_API_URL` to the Render API's public HTTPS origin (for example, `https://san-andres-complaint-api.onrender.com`, without an `/api` suffix), then redeploy whenever it changes. All frontend API requests, including file uploads, use this base URL.
3. Before deploying the frontend, run `npm run cloudinary:upload-static` locally after adding your Cloudinary credentials to ignored `.env.local`. This uploads every file in `public/images` into the Cloudinary `san-andres-site` folder. Set `VITE_CLOUDINARY_CLOUD_NAME` to the account's cloud name in Vercel so static logos and images use those uploads.
4. Set public build-time values such as `VITE_GOOGLE_CLIENT_ID` and the subscribe-only `VITE_ABLY_API_KEY` in Vercel if those features are enabled. Do not put database, JWT, SMTP, Cloudinary API credentials, or Gemini secrets in `VITE_` variables; Vite embeds those values in the browser bundle.
5. Add the Vercel production domain to the Google OAuth authorized JavaScript origins. Keep `FRONTEND_URL` and `CORS_ORIGINS` in Render aligned with the actual Vercel origin.

The API handles uploads directly from the browser; requests do not pass through Vercel's serverless functions. The API continues to enforce its existing 50 MB per-file limit and validates supported file types. Test registration email, Google sign-in, uploads, and database access on the deployed domains before launch.

Never commit real credentials. If a credential was ever committed or shared, rotate it before deployment.

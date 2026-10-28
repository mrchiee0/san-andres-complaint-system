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



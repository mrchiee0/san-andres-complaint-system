import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Mail, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../store/useAuthStore';
import { safeJson } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import BrandLogo from '../components/BrandLogo';

export default function QuickRegister() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState('');
  const [code, setCode] = React.useState('');
  const [verificationToken, setVerificationToken] = React.useState('');
  const [emailVerified, setEmailVerified] = React.useState(false);
  const [residency, setResidency] = React.useState<'Resident' | 'Non Resident' | ''>('');
  const [termsAgreed, setTermsAgreed] = React.useState(false);
  const [codeSent, setCodeSent] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const requestCode = async (event?: React.FormEvent | React.MouseEvent) => {
    event?.preventDefault();
    if (!termsAgreed) {
      toast.error('Please accept the Terms and Conditions before continuing.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/auth/resident/register/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, terms_agreed: true }),
      });
      const data = await safeJson(response);
      if (!response.ok) throw new Error(data.error || 'Unable to send the verification code.');
      setCodeSent(true);
      setCode('');
      toast.success(data.message || 'Verification code sent.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to send the verification code.');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      toast.error('Enter the six-digit verification code.');
      return;
    }
    setLoading(true);
    try {
      const verifyResponse = await fetch('/api/auth/register/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, email }),
      });
      const verification = await safeJson(verifyResponse);
      if (!verifyResponse.ok) throw new Error(verification.error || 'Unable to verify your email.');
      if (!verification.token) throw new Error('The email was verified, but the registration session could not be created. Request a new code.');

      setVerificationToken(verification.token);
      setEmailVerified(true);
      toast.success('Email verified. Choose your residency to create your account.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to verify your email.');
    } finally {
      setLoading(false);
    }
  };

  const completeRegistration = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!residency) {
      toast.error('Choose Resident or Non-Resident to continue.');
      return;
    }
    setLoading(true);
    try {
      const completeResponse = await fetch('/api/auth/register/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verificationToken, terms_agreed: true, is_resident: residency }),
      });
      const account = await safeJson(completeResponse);
      if (!completeResponse.ok) throw new Error(account.error || 'Unable to finish creating your account.');
      if (!account.token || !account.user) throw new Error('Your account was created, but a sign-in session could not be started. Please sign in.');

      useAuthStore.getState().login(account.token, account.user);
      toast.success('Your account is ready.');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to finish creating your account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <Card className="w-full max-w-lg border-border/60 shadow-lg">
        <CardHeader className="items-center text-center">
          <Link to="/" aria-label="Barangay San Andres home">
            <BrandLogo className="mb-2 h-12 w-12 rounded-xl" fallback={<ShieldCheck className="h-10 w-10 text-primary" />} />
          </Link>
          <CardTitle className="text-2xl">
            {emailVerified ? 'Choose your account type' : 'Create an account'}
          </CardTitle>
          <CardDescription>
            {emailVerified
              ? 'Your email is verified. Select whether you are a Resident or Non-Resident to continue.'
              : codeSent
              ? `Enter the six-digit code sent to ${email}.`
              : 'Start with your email. After verification, choose your residency and continue to your account.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!codeSent ? (
            <form onSubmit={requestCode} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="signup-email" className="text-sm font-medium">Email address</label>
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  maxLength={255}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
                <p className="font-semibold text-foreground">Terms and Conditions</p>
                <p>Provide accurate information and use the system only for legitimate barangay complaints and communication. Submitted information may be reviewed by authorized barangay personnel.</p>
                <p>Your personal information will be used for account management, complaint processing, notifications, and official barangay services in accordance with applicable privacy laws.</p>
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm leading-relaxed">
                <input
                  type="checkbox"
                  checked={termsAgreed}
                  onChange={(event) => setTermsAgreed(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <span>I have read and agree to the Terms and Conditions.</span>
              </label>
              <Button type="submit" className="w-full" disabled={loading || !termsAgreed}>
                {loading ? 'Sending code...' : 'Continue to email verification'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          ) : !emailVerified ? (
            <form onSubmit={verifyCode} className="space-y-5">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
                <p className="flex items-center gap-2 font-medium text-foreground"><Mail className="h-4 w-4 text-primary" /> Check your inbox</p>
                <p className="mt-1 text-muted-foreground">The code expires in 10 minutes. If it does not arrive, check your spam folder.</p>
                <p className="mt-2 text-muted-foreground">Later, sign in with Google using this email or use “Forgot password?” on the sign-in page to create a password.</p>
              </div>
              <div className="space-y-2">
                <label htmlFor="signup-code" className="text-sm font-medium">Six-digit verification code</label>
                <Input
                  id="signup-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="text-center text-lg tracking-[0.4em]"
                  placeholder="000000"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
                {loading ? 'Verifying...' : 'Verify email'}
                <CheckCircle2 className="ml-2 h-4 w-4" />
              </Button>
              <div className="flex flex-wrap justify-between gap-3 text-sm">
                <button type="button" onClick={() => { setCodeSent(false); setCode(''); }} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground" disabled={loading}>
                  <ArrowLeft className="h-4 w-4" /> Change email
                </button>
                <button type="button" onClick={(event) => void requestCode(event)} className="text-primary hover:underline" disabled={loading}>
                  Resend code
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={completeRegistration} className="space-y-5">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                <p className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4" /> Email verified</p>
                <p className="mt-1">{email}</p>
              </div>
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">I am a...</legend>
                {([
                  ['Resident', 'Resident', 'I live in Barangay San Andres.'],
                  ['Non Resident', 'Non-Resident', 'I do not live in Barangay San Andres.'],
                ] as const).map(([value, label, description]) => (
                  <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${residency === value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'}`}>
                    <input
                      type="radio"
                      name="account-residency"
                      value={value}
                      checked={residency === value}
                      onChange={() => setResidency(value)}
                      className="mt-1 h-4 w-4 accent-primary"
                    />
                    <span>
                      <span className="block text-sm font-semibold">{label}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <Button type="submit" className="w-full" disabled={loading || !residency}>
                {loading ? 'Creating account...' : 'Continue to my account'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          )}
          <div className="mt-6 space-y-3 text-center text-sm text-muted-foreground">
            <p>Already have an account? <Link to="/login" className="font-semibold text-primary hover:underline">Sign in</Link></p>
            <p>Want to fill in your details now? <Link to="/register/full" className="font-semibold text-primary hover:underline">Use full registration</Link></p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

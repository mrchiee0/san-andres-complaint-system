import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ShieldCheck, User, Lock, Eye, EyeOff, ArrowRight, Info, ChevronLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { safeJson } from '../lib/utils';
import { useSettingsStore } from '../store/useSettingsStore';
import BrandLogo from '../components/BrandLogo';

const googleClientId = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env.VITE_GOOGLE_CLIENT_ID;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'reset'>('request');
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [googleChallenge, setGoogleChallenge] = useState('');
  const [googleOtp, setGoogleOtp] = useState('');
  const [googleEmail, setGoogleEmail] = useState('');
  const googleButtonRef = React.useRef<HTMLDivElement>(null);
  const { login } = useAuth();
  const { settings } = useSettingsStore();
  const navigate = useNavigate();

  const handleGoogleLogin = React.useCallback(async (credential: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        toast.error(data.error || 'Unable to sign in with Google.');
        return;
      }
      setGoogleChallenge(data.challenge);
      setGoogleEmail(data.email);
      toast.success('An OTP was sent to your email.');
    } catch {
      toast.error('Unable to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const buttonContainer = googleButtonRef.current;
    if (!buttonContainer || !googleClientId) return;

    const renderGoogleButton = () => {
      const googleIdentity = window.google?.accounts?.id;
      if (!googleIdentity || !buttonContainer.isConnected) return;
      buttonContainer.replaceChildren();
      googleIdentity.initialize({
        client_id: googleClientId,
        callback: ({ credential }) => void handleGoogleLogin(credential),
      });
      googleIdentity.renderButton(buttonContainer, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        locale: 'en',
        width: Math.floor(buttonContainer.getBoundingClientRect().width),
      });
    };

    if (window.google) {
      renderGoogleButton();
      return;
    }

    let script = document.querySelector<HTMLScriptElement>('script[data-google-identity]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client?hl=en';
      script.async = true;
      script.defer = true;
      script.dataset.googleIdentity = 'true';
      document.head.appendChild(script);
    }
    script.addEventListener('load', renderGoogleButton, { once: true });
    script.addEventListener('error', () => toast.error('Unable to load Google sign-in. Please use email and password.'), { once: true });
    return () => script?.removeEventListener('load', renderGoogleButton);
  }, [handleGoogleLogin, googleChallenge, resetMode]);

  const handleGoogleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(googleOtp)) {
      toast.error('Enter the 6-digit OTP sent to your email.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/google/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge: googleChallenge, otp: googleOtp }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        toast.error(data.error || 'Unable to verify the OTP.');
        return;
      }
      login(data.token, data.user);
      toast.success(`Welcome back, ${data.user.pangalan}!`);
      navigate('/dashboard');
    } catch {
      toast.error('Unable to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password }),
      });
      const data = await safeJson(res);
      if (res.ok) {
        login(data.token, data.user);
        toast.success(`Welcome back, ${data.user.pangalan}!`);
        navigate('/dashboard');
      } else {
        toast.error(data.error || 'Invalid email or password.');
      }
    } catch (error) {
      toast.error('Unable to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      toast.error('Enter the email address for your account.');
      return;
    }
    setResetLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        toast.error(data.error || 'Unable to send the OTP.');
        return;
      }
      setResetStep('reset');
      toast.success('If an account exists for that email, an OTP has been sent.');
    } catch {
      toast.error('Unable to connect to the server. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(resetOtp)) {
      toast.error('Enter the 6-digit OTP sent to your email.');
      return;
    }
    if (resetPassword.length < 8) {
      toast.error('The new password must contain at least 8 characters.');
      return;
    }
    setResetLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, otp: resetOtp, password: resetPassword }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        toast.error(data.error || 'Unable to reset the password.');
        return;
      }
      setResetMode(false);
      setResetStep('request');
      setPassword('');
      setResetOtp('');
      setResetPassword('');
      toast.success(data.message || 'Password reset successfully.');
    } catch {
      toast.error('Unable to connect to the server. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };


  return (
    <div className="flex min-h-[100svh] items-center justify-center overflow-hidden bg-background p-3 font-sans">
      {/* Decorative Background Elements */}
    <div className="absolute inset-0 z-0">
      <img
        src="/images/login-bg.jpg"
        alt=""
        className="h-full w-full object-cover opacity-85"
      />
      <div className="absolute inset-0 bg-black/60" />
    </div>

    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative z-10 w-full max-w-[390px]"
    >
        <div className="mb-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 rounded-full px-2 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            render={<Link to="/" />}
            nativeButton={false}
          >
            <ChevronLeft className="mr-1 h-3 w-3" /> Back to Home
          </Button>
        </div>

        <div className="mb-4 flex flex-col items-center">
          <motion.div
            whileHover={{ scale: 1.1, rotate: 5 }}
            className="mb-2 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-xl"
          >
            <BrandLogo
              className="w-full h-full rounded-xl bg-white p-1"
              fallback={<ShieldCheck size={25} />}
            />
          </motion.div>
          <h1 className="text-2xl font-bold tracking-tight text-white">San Andres</h1>
          <p className="mt-1 text-xs text-white/80">Complaint Management System</p>
        </div>

        <Card className="overflow-hidden rounded-2xl border border-white/25 bg-white/15 shadow-2xl backdrop-blur-xl">
          <CardHeader className="px-6 pb-3 pt-5">
            <CardTitle className="text-lg font-semibold text-white">{resetMode ? 'Reset Password' : googleChallenge ? 'Verify Google Login' : 'Sign In'}</CardTitle>
            <CardDescription className="text-xs text-white/75">{resetMode ? 'Request an OTP by email to create a new password.' : googleChallenge ? `Enter the OTP sent to ${googleEmail}.` : 'Enter your details to sign in.'}</CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4 px-6 pb-4 pt-2">
            {resetMode ? (
              resetStep === 'request' ? (
                <form onSubmit={handleRequestReset} className="space-y-4">
                  <div className="space-y-2">
                    <label className="ml-1 text-[10px] font-medium uppercase tracking-wider text-white/80">Username</label>
                    <Input
                      type="email"
                      placeholder="pangalan@email.com"
                      className="h-10 rounded-xl border-white/25 bg-white/15 text-white placeholder:text-white/55 focus-visible:ring-primary"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="h-10 w-full rounded-xl text-sm font-semibold" disabled={resetLoading}>
                      {resetLoading ? 'Sending...' : 'Send OTP'}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <label className="ml-1 text-[10px] font-medium uppercase tracking-wider text-white/80">6-Digit OTP</label>
                    <Input
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="123456"
                      className="h-10 rounded-xl border-white/25 bg-white/15 text-white placeholder:text-white/55 tracking-[0.3em]"
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ''))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="ml-1 text-[10px] font-medium uppercase tracking-wider text-white/80">New Password</label>
                    <Input
                      type="password"
                      placeholder="At least 8 characters"
                      className="h-10 rounded-xl border-white/25 bg-white/15 text-white placeholder:text-white/55"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      minLength={8}
                      required
                    />
                  </div>
                  <Button type="submit" className="h-10 w-full rounded-xl text-sm font-semibold" disabled={resetLoading}>
                    {resetLoading ? 'Resetting...' : 'Reset Password'}
                  </Button>
                  <button type="button" className="w-full text-xs font-bold text-primary hover:underline" onClick={() => setResetStep('request')}>
                    Request a new OTP
                  </button>
                </form>
              )
            ) : googleChallenge ? (
              <form onSubmit={handleGoogleOtp} className="space-y-4">
                <div className="space-y-2">
                  <label className="ml-1 text-[10px] font-medium uppercase tracking-wider text-white/80">6-Digit OTP</label>
                  <Input
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    className="h-10 rounded-xl border-white/25 bg-white/15 text-white placeholder:text-white/55 tracking-[0.3em]"
                    value={googleOtp}
                    onChange={(e) => setGoogleOtp(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                  />
                </div>
                <Button type="submit" className="h-10 w-full rounded-xl text-sm font-semibold" disabled={loading}>
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </Button>
                <button
                  type="button"
                  className="w-full text-xs font-bold text-primary hover:underline"
                  onClick={() => {
                    setGoogleChallenge('');
                    setGoogleOtp('');
                    setGoogleEmail('');
                  }}
                >
                  Back to Google sign-in
                </button>
              </form>
            ) : (
            <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                    <label className="ml-1 text-[10px] font-medium uppercase tracking-wider text-white/80">Email Address</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input 
                    type="text" 
                    autoComplete="username"
                    placeholder="your_username" 
                    className="h-10 rounded-xl border-white/25 bg-white/15 pl-11 text-white placeholder:text-white/55 focus-visible:ring-primary"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-medium uppercase tracking-wider text-white/80">Password</label>
                  <button
                    type="button"
                    className="text-[10px] font-medium text-white hover:underline"
                    onClick={() => {
                      setResetEmail(email.includes('@') ? email : '');
                      setResetMode(true);
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="••••••••" 
                    className="h-10 rounded-xl border-white/25 bg-white/15 pl-11 pr-11 text-white placeholder:text-white/55 focus-visible:ring-primary"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>


              <Button 
                type="submit" 
                className="h-10 w-full rounded-xl text-sm font-semibold shadow-lg group"
                disabled={loading}
              >
                {loading ? 'Signing in…' : 'Sign In'}
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </form>
            {!resetMode && !googleChallenge && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-[10px] font-medium uppercase tracking-wider text-white/65">
                  <span className="h-px flex-1 bg-white/25" />
                  <span>or</span>
                  <span className="h-px flex-1 bg-white/25" />
                </div>
                {googleClientId
                  ? <div ref={googleButtonRef} className="flex h-10 justify-center overflow-hidden rounded-xl [&>div]:!h-10 [&>div]:!w-full [&_iframe]:!h-10 [&_iframe]:!w-full" />
                  : <Button type="button" variant="outline" className="h-10 w-full rounded-xl bg-white text-slate-700" disabled>
                    Sign in with Google (not configured)
                  </Button>}
              </div>
            )}
            </>
            )}

          </CardContent>
          
          <CardFooter className="flex flex-col space-y-3 px-6 pb-5 pt-0">
            {resetMode ? (
              <button
                type="button"
                className="text-center text-xs font-medium text-white hover:underline"
                onClick={() => {
                  setResetMode(false);
                  setResetStep('request');
                }}
              >
                Back to sign in
              </button>
            ) : (
            <p className="text-center text-xs text-white/75">
              Don&apos;t have an account?{' '}
              <Link to="/register/full" className="font-semibold text-white hover:underline">Register here</Link>
            </p>
            )}
            <div className="flex items-start space-x-3 rounded-xl border border-white/20 bg-black/15 p-3">
              <Info size={15} className="mt-0.5 shrink-0 text-white/80" />
              <p className="text-[10px] leading-relaxed text-white/75">
                Please make sure the information you provide is accurate.
              </p>
            </div>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}

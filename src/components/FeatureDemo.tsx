import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  Lock, 
  Smartphone, 
  User,
  ShieldCheck,
  AlertCircle,
  FileText,
  Camera,
  MapPin
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Card } from './ui/card';
import { LABELS } from '../constants';

interface FeatureDemoProps {
  type: string;
  onClose: () => void;
}

export default function FeatureDemo({ type, onClose }: FeatureDemoProps) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-card border border-border shadow-2xl rounded-[2.5rem] w-full max-w-2xl overflow-hidden relative"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-8 md:p-12">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h3 className="text-2xl font-serif italic font-bold text-foreground">{type} Demo</h3>
              <p className="text-muted-foreground text-sm">See how it works.</p>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
            >
              <span className="sr-only">Close</span>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          <div className="bg-muted/30 rounded-3xl p-8 min-h-[300px] flex items-center justify-center relative overflow-hidden">
            {type === 'Real-time Chat' && <ChatDemo />}
            {type === 'Complaint Tracking' && <ActionDemo />}
            {type === 'Safe and Private' && <SecurityDemo />}
            {type === 'Mobile First' && <MobileDemo />}
            {type === 'Secure Auth' && <AuthDemo />}
            {type === 'User Friendly' && <FriendlyDemo />}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ChatDemo() {
  const [messages, setMessages] = useState<{ text: string; side: 'left' | 'right' }[]>([]);

  useEffect(() => {
    const sequence: { text: string; side: 'left' | 'right' }[] = [
      { text: 'I added the requested photo evidence to my complaint.', side: 'right' },
      { text: 'Received. We will review it with your case.', side: 'left' },
      { text: 'Thank you for the update.', side: 'right' },
    ];

    let i = 0;
    const interval = setInterval(() => {
      setMessages(prev => {
        if (i < sequence.length) {
          const next = [...prev, sequence[i]];
          i++;
          return next;
        } else {
          i = 0;
          return [];
        }
      });
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-md space-y-4">
      <AnimatePresence>
        {messages?.map((msg, idx) => msg && (
          <motion.div
            key={`${idx}-${msg.text}`}
            initial={{ opacity: 0, x: msg.side === 'right' ? 20 : -20, y: 10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            className={cn(
              "p-4 rounded-2xl text-xs font-bold max-w-[80%] shadow-sm",
              msg.side === 'right' 
                ? "bg-primary text-primary-foreground ml-auto rounded-tr-none" 
                : "bg-card text-foreground rounded-tl-none border border-border"
            )}
          >
            {msg.text}
          </motion.div>
        ))}
      </AnimatePresence>
      {(!messages || messages.length === 0) && (
        <div className="text-center text-muted-foreground italic text-sm">Starting conversation...</div>
      )}
    </div>
  );
}

function ActionDemo() {
  const [status, setStatus] = useState(0);
  const stages = Object.entries(LABELS.STATUS);

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(prev => (prev + 1) % stages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [stages.length]);

  return (
    <div className="w-full max-w-xl space-y-7">
      <div className="overflow-x-auto pb-2">
        <div className="relative flex min-w-[640px] justify-between">
        <div className="absolute left-0 right-0 top-5 h-1 -translate-y-1/2 bg-border"></div>
        <motion.div 
          className="absolute left-0 top-5 h-1 -translate-y-1/2 bg-primary"
          animate={{ width: `${(status / Math.max(stages.length - 1, 1)) * 100}%` }}
          transition={{ duration: 1 }}
        />
        {stages.map(([key, label], i) => (
          <div key={key} className="relative z-10 flex w-20 shrink-0 flex-col items-center gap-2 text-center">
            <motion.div 
              animate={{ 
                scale: status === i ? 1.12 : 1,
                backgroundColor: status >= i ? 'var(--primary)' : 'var(--card)',
                color: status >= i ? 'var(--primary-foreground)' : 'var(--muted-foreground)'
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border shadow-sm"
            >
              {status > i ? <CheckCircle2 size={20} /> : i + 1}
            </motion.div>
            <span className={cn(
              "text-[9px] font-semibold leading-tight",
              status === i ? "text-primary" : "text-muted-foreground"
            )}>{label}</span>
          </div>
        ))}
        </div>
      </div>
      <Card className="border-border/50 bg-card/70 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
            {status === 0 && <AlertCircle size={24} />}
            {status === stages.length - 1 && <CheckCircle2 size={24} />}
            {status > 0 && status < stages.length - 1 && <Clock size={24} />}
          </div>
          <div>
            <h4 className="text-sm font-bold">Current status: {stages[status][1]}</h4>
            <p className="text-xs text-muted-foreground">Staff update your complaint as it moves through review and resolution.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function SecurityDemo() {
  const [activeRole, setActiveRole] = useState(0);
  const roles = [
    { name: 'Complainant', access: 'Can view and update their own complaint.' },
    { name: 'Named respondent', access: 'Can view a complaint that names them.' },
    { name: 'Authorized staff', access: 'Can review and manage barangay cases.' },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveRole((current) => (current + 1) % roles.length);
    }, 2600);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-md space-y-4">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Lock size={21} /></div>
        <div><p className="text-xs font-semibold text-muted-foreground">Complaint access</p><p className="text-sm font-bold">Limited to case participants</p></div>
      </div>
      <div className="space-y-2">
        {roles.map((role, index) => <motion.div key={role.name}
          animate={{ opacity: activeRole === index ? 1 : 0.55, x: activeRole === index ? 4 : 0 }}
          className={cn('flex items-center gap-3 rounded-lg border p-3', activeRole === index ? 'border-primary/40 bg-primary/5' : 'border-border bg-card/60')}>
          {activeRole === index ? <ShieldCheck size={18} className="shrink-0 text-primary" /> : <User size={18} className="shrink-0 text-muted-foreground" />}
          <div><p className="text-xs font-bold">{role.name}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{role.access}</p></div>
        </motion.div>)}
      </div>
    </div>
  );
}

function MobileDemo() {
  const [screen, setScreen] = useState(0);
  const screens = [
    { title: 'Choose complaint details', detail: 'Select a category and San Andres area.' },
    { title: 'Add supporting evidence', detail: 'Attach photos to help staff review your report.' },
    { title: 'Follow case progress', detail: 'See the latest status from barangay staff.' },
  ];

  useEffect(() => {
    const interval = setInterval(() => setScreen((current) => (current + 1) % screens.length), 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative h-[350px] w-[210px] overflow-hidden rounded-[2rem] border-4 border-muted bg-background shadow-2xl">
      <div className="absolute left-1/2 top-0 z-20 h-5 w-20 -translate-x-1/2 rounded-b-xl bg-muted" />
      <div className="space-y-3 p-3 pt-8">
        <div className="flex items-center justify-between text-[10px] font-semibold"><span>My Complaints</span><span className="text-primary">New report</span></div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 flex items-center gap-2"><FileText size={14} className="text-primary" /><span className="text-[10px] font-semibold">Noise complaint</span></div>
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground"><MapPin size={11} /> San Andres area</div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><motion.div className="h-full rounded-full bg-primary" animate={{ width: `${35 + screen * 30}%` }} transition={{ duration: 0.5 }} /></div>
          <p className="mt-2 text-[9px] font-semibold text-primary">{screen === 2 ? 'Under review' : 'Complaint filing'}</p>
        </div>
        <div className="min-h-[94px] rounded-lg bg-muted/40 p-3">
          <AnimatePresence mode="wait">
            <motion.div key={screen} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
              <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">{screen === 1 ? <Camera size={15} /> : screen === 2 ? <Clock size={15} /> : <FileText size={15} />}</div>
              <p className="text-[10px] font-semibold">{screens[screen].title}</p>
              <p className="mt-1 text-[8px] leading-relaxed text-muted-foreground">{screens[screen].detail}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="flex gap-1.5">
          {screens.map((item, index) => <span key={item.title} className={`h-1 flex-1 rounded-full ${index <= screen ? 'bg-primary' : 'bg-muted'}`} />)}
        </div>
      </div>
    </div>
  );
}

function AuthDemo() {
  const [step, setStep] = useState(0);
  const steps = ['Password sign-in', 'Google email verification', 'Account access'];

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => (prev + 1) % steps.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-sm space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
        <span className="text-xs font-semibold">{steps[step]}</span>
        <span className="text-[9px] font-bold text-muted-foreground">{step + 1} / {steps.length}</span>
      </div>
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div 
            key="login"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="rounded-lg border border-border bg-card px-3 py-2.5 text-xs text-muted-foreground">Email address</div>
            <div className="rounded-lg border border-border bg-card px-3 py-2.5 text-xs text-muted-foreground">Password</div>
            <div className="flex h-9 w-full items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">Sign in</div>
            <p className="text-center text-[10px] text-muted-foreground">Or continue with Google</p>
          </motion.div>
        )}
        {step === 1 && (
          <motion.div 
            key="google-otp"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4 text-center"
          >
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
              <Smartphone size={24} />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest">Google sign-in sends a six-digit code to your email</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="flex h-9 w-8 items-center justify-center rounded-md border border-primary/20 bg-muted font-bold">{i < 4 ? '•' : ''}</div>
              ))}
            </div>
            <p className="text-center text-[10px] text-muted-foreground">This extra code is for Google sign-in.</p>
          </motion.div>
        )}
        {step === 2 && (
          <motion.div 
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="text-center space-y-4"
          >
            <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto shadow-xl">
              <ShieldCheck size={32} />
            </div>
            <p className="text-sm font-bold">Account access confirmed</p>
            <p className="text-[10px] text-muted-foreground">Your account is ready to use the complaint system.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FriendlyDemo() {
  const [activeAction, setActiveAction] = useState(0);
  const actions = [
    { icon: FileText, label: 'File complaint' },
    { icon: Camera, label: 'Add evidence' },
    { icon: Clock, label: 'Track progress' },
    { icon: MessageSquare, label: 'Message staff' },
  ];

  useEffect(() => {
    const interval = setInterval(() => setActiveAction((current) => (current + 1) % actions.length), 1900);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-md grid grid-cols-2 gap-3">
      {actions.map((item, i) => (
        <motion.div
          key={item.label}
          animate={{ y: activeAction === i ? -3 : 0, borderColor: activeAction === i ? 'var(--primary)' : 'var(--border)' }}
          transition={{ duration: 0.25 }}
          className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <item.icon size={18} />
          </div>
          <span className="text-xs font-semibold">{item.label}</span>
        </motion.div>
      ))}
    </div>
  );
}

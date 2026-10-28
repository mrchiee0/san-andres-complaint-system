import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Camera, Check, CheckCircle2, ClipboardCheck, FileText, MapPin, Send, ShieldCheck, UserRound } from 'lucide-react';
import { cn } from '../lib/utils';

export const COMPLAINT_DEMO_STEPS = [
  { label: 'Read notice', description: 'Acknowledge the truthful-reporting notice.' },
  { label: 'Category', description: 'Choose a category and complaint type.' },
  { label: 'Your information', description: 'Confirm your name and contact details.' },
  { label: 'Details', description: 'Describe what happened.' },
  { label: 'Location', description: 'Select an area and optionally pin the incident.' },
  { label: 'Evidence', description: 'Attach supporting photos (optional).' },
  { label: 'Review', description: 'Check your report before submitting.' },
];

interface StepDemoProps {
  device?: 'mobile' | 'tablet' | 'laptop';
}

export default function StepDemo({ device = 'laptop' }: StepDemoProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setStep((current) => (current + 1) % (COMPLAINT_DEMO_STEPS.length + 1));
    }, 2600);
    return () => window.clearInterval(interval);
  }, [device]);

  const submitted = step === COMPLAINT_DEMO_STEPS.length;
  const currentStep = COMPLAINT_DEMO_STEPS[Math.min(step, COMPLAINT_DEMO_STEPS.length - 1)];
  const StepIcon = [AlertTriangle, FileText, UserRound, ClipboardCheck, MapPin, Camera, ShieldCheck][Math.min(step, COMPLAINT_DEMO_STEPS.length - 1)];

  return (
    <div className={cn(
      "relative mx-auto bg-white border border-[#141414]/10 shadow-2xl overflow-hidden flex flex-col transition-all duration-500",
      device === 'mobile' ? "w-[280px] h-[500px] rounded-[3rem]" : 
      device === 'tablet' ? "w-[450px] h-[600px] rounded-[2.5rem]" : 
      "w-full max-w-2xl aspect-[4/3] rounded-[2.5rem] scale-[0.85] sm:scale-100"
    )}>
      {/* Device Specific Header */}
      {device === 'laptop' ? (
        <div className="h-12 bg-[#F5F5F0] border-b border-[#141414]/5 flex items-center px-6 space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-400"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
          <div className="w-3 h-3 rounded-full bg-green-400"></div>
          <div className="flex-1"></div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#141414]/30">San Andres Demo</div>
        </div>
      ) : (
        <div className="h-8 bg-black flex items-center justify-center px-6">
          <div className="w-20 h-4 bg-[#141414] rounded-full"></div>
        </div>
      )}

      <div className={cn("flex-1 flex min-h-0 flex-col relative", device === 'mobile' ? "p-4" : "p-8")}>
        {/* Steps Indicator */}
        <div className={cn("relative mb-4 flex justify-between", device === 'mobile' ? "mb-5" : "mb-6")}>
          <div className="absolute left-0 right-0 top-3.5 h-0.5 bg-[#141414]/10" />
          {COMPLAINT_DEMO_STEPS.map((item, i) => (
            <div key={item.label} className="relative z-10 flex min-w-0 flex-1 flex-col items-center">
              <div className={cn(
                "rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-500",
                device === 'mobile' ? "h-6 w-6" : "h-7 w-7",
                step > i ? "bg-[#141414] text-white" : step === i ? "scale-110 bg-[#141414] text-white" : "border border-[#141414]/10 bg-white text-[#141414]/30"
              )}>
                {step > i ? <Check size={device === 'mobile' ? 12 : 14} /> : i + 1}
              </div>
              {device === 'laptop' && (
                <span className={cn("mt-1.5 max-w-16 truncate text-[7px] font-bold uppercase tracking-wide transition-colors", step >= i ? "text-[#141414]" : "text-[#141414]/30")}>
                  {item.label}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Form Mockup */}
        <div className="flex-1 bg-[#F5F5F0] rounded-3xl p-6 border border-[#141414]/5 relative overflow-hidden">
          <AnimatePresence mode="wait">
            {!submitted ? (
              <motion.div 
                key="form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex h-full flex-col space-y-3"
              >
                <div className="flex items-start gap-2 border-b border-[#141414]/5 pb-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#141414]/5 text-[#141414]"><StepIcon size={14} /></div>
                  <div className="min-w-0"><p className="text-[10px] font-bold">{currentStep.label}</p><p className="mt-0.5 text-[8px] leading-tight text-[#141414]/50">{currentStep.description}</p></div>
                </div>
                {step === 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[8px] leading-relaxed text-amber-950">
                  <p className="font-bold">Truthful and responsible reporting</p>
                  <p className="mt-1">I will provide honest information to the best of my knowledge.</p>
                </div>}
                {step === 1 && <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><label className="text-[8px] font-bold uppercase text-[#141414]/40">Category</label><div className={cn('flex h-8 items-center rounded-lg border bg-white px-2 text-[8px]', step === 1 ? 'border-[#141414]' : 'border-[#141414]/10')}>Environmental &amp; Public Nuisance</div></div>
                  <div className="space-y-1"><label className="text-[8px] font-bold uppercase text-[#141414]/40">Complaint type</label><div className="flex h-8 items-center rounded-lg border border-[#141414] bg-white px-2 text-[8px]">Noise Complaints</div></div>
                </div>}
                {step === 2 && <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><label className="text-[8px] font-bold uppercase text-[#141414]/40">Your name</label><div className="flex h-8 items-center rounded-lg border border-[#141414]/10 bg-white px-2 text-[8px] text-[#141414]/50">Complainant name</div></div>
                  <div className="space-y-1"><label className="text-[8px] font-bold uppercase text-[#141414]/40">Email address</label><div className="flex h-8 items-center rounded-lg border border-[#141414]/10 bg-white px-2 text-[8px] text-[#141414]/50">Email address</div></div>
                </div>}
                {step === 3 && <div className="space-y-1">
                  <label className="text-[8px] font-bold uppercase text-[#141414]/40">What happened?</label>
                  <div className="min-h-16 rounded-lg border border-[#141414]/10 bg-white p-2 text-[9px] leading-relaxed text-[#141414]/80">Loud music late at night is disturbing nearby homes.</div>
                </div>}
                {step === 4 && <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><label className="text-[8px] font-bold uppercase text-[#141414]/40">San Andres area</label><div className="flex h-8 items-center rounded-lg border border-[#141414] bg-white px-2 text-[8px]">Midtown Subdivision</div></div>
                  <div className="space-y-1"><label className="text-[8px] font-bold uppercase text-[#141414]/40">Street (optional)</label><div className="flex h-8 items-center rounded-lg border border-[#141414]/10 bg-white px-2 text-[8px] text-[#141414]/50">Street / landmark</div></div>
                  <div className="col-span-2 flex h-14 items-center justify-center gap-2 rounded-lg border border-dashed border-[#141414]/20 bg-white text-[8px] text-[#141414]/50"><MapPin size={12} /> Pin incident location (optional)</div>
                </div>}
                {step === 5 && <div className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[#141414]/20 bg-white p-2 text-center"><Camera size={16} className="text-[#141414]/60" /><p className="text-[8px] font-semibold">Add photos (optional)</p><p className="text-[7px] text-[#141414]/45">Up to 5 photos per update</p></div>}
                {step === 6 && <div className="grid grid-cols-2 gap-2 text-[8px]">
                  {[['Category', 'Environmental & Public Nuisance'], ['Type', 'Noise Complaints'], ['Location', 'Midtown Subdivision'], ['Evidence', '1 photo attached']].map(([label, value]) => <div key={label} className="rounded-md border border-[#141414]/10 bg-white p-2"><p className="text-[#141414]/40">{label}</p><p className="mt-0.5 truncate font-semibold">{value}</p></div>)}
                </div>}
                <div className="mt-auto flex items-center justify-between pt-1">
                  <span className="text-[8px] text-[#141414]/40">Step {step + 1} of {COMPLAINT_DEMO_STEPS.length}</span>
                  <div className="flex items-center gap-1 rounded-lg bg-[#141414] px-3 py-1.5 text-[8px] font-bold text-white"><span>{step === COMPLAINT_DEMO_STEPS.length - 1 ? 'Submit for review' : 'Continue'}</span><Send size={10} /></div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="h-full flex flex-col items-center justify-center text-center space-y-4"
              >
                <div className="w-16 h-16 bg-[#141414] text-white rounded-full flex items-center justify-center shadow-2xl">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <h4 className="text-lg font-serif italic font-bold">Submitted for review</h4>
                  <p className="text-[10px] text-[#141414]/50 leading-tight">Barangay staff can now review and update your complaint.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}

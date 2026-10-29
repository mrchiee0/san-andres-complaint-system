import { apiUrl } from '../lib/api';
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Eye, EyeOff, FileText, Mail, MapPin, ShieldCheck, User, Users } from 'lucide-react';
import { safeJson } from '../lib/utils';
import { toast } from 'sonner';
import { useSettingsStore } from '../store/useSettingsStore';
import BrandLogo from '../components/BrandLogo';

const steps = [
  { label: 'Account', icon: User },
  { label: 'Personal', icon: Users },
  { label: 'Address', icon: MapPin },
  { label: 'Verify Account', icon: Mail },
  { label: 'Terms', icon: FileText },
];

const inputClass = 'mt-2 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10';
const psgcApi = 'https://psgc.cloud/api';

type LocationOption = { code: string; name: string; type?: string };
type RegistrationDraft = Partial<{
  step: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName: string;
  suffix: string;
  dateOfBirth: string;
  sex: string;
  placeOfBirth: string;
  civilStatus: string;
  phoneNumber: string;
  occupation: string;
  religion: string;
  provinceCode: string;
  municipalityCode: string;
  barangayCode: string;
  houseNumber: string;
  street: string;
  subdivision: string;
  purok: string;
  compound: string;
  registeredVoter: string;
  residency: 'Resident' | 'Non Resident' | '';
  verificationSent: boolean;
  agreedToTerms: boolean;
}>;

const registrationDraftKey = 'sanAndresRegistrationDraft';

function loadRegistrationDraft(): RegistrationDraft {
  try {
    const saved = sessionStorage.getItem(registrationDraftKey);
    return saved ? JSON.parse(saved) as RegistrationDraft : {};
  } catch {
    return {};
  }
}

export default function Register() {
  const [draft] = React.useState(loadRegistrationDraft);
  const [step, setStep] = React.useState(() => Math.min(draft.step ?? 0, sessionStorage.getItem('registrationVerificationToken') ? 4 : 3));
  const [username, setUsername] = React.useState(draft.username || '');
  const [email, setEmail] = React.useState(draft.email || '');
  const [firstName, setFirstName] = React.useState(draft.firstName || '');
  const [lastName, setLastName] = React.useState(draft.lastName || '');
  const [middleName, setMiddleName] = React.useState(draft.middleName || '');
  const [suffix, setSuffix] = React.useState(draft.suffix || '');
  const [dateOfBirth, setDateOfBirth] = React.useState(draft.dateOfBirth || '');
  const [sex, setSex] = React.useState(draft.sex || '');
  const [placeOfBirth, setPlaceOfBirth] = React.useState(draft.placeOfBirth || '');
  const [civilStatus, setCivilStatus] = React.useState(draft.civilStatus || '');
  const [phoneNumber, setPhoneNumber] = React.useState(draft.phoneNumber || '');
  const [occupation, setOccupation] = React.useState(draft.occupation || '');
  const [religion, setReligion] = React.useState(draft.religion || '');
  const [provinces, setProvinces] = React.useState<LocationOption[]>([]);
  const [municipalities, setMunicipalities] = React.useState<LocationOption[]>([]);
  const [barangays, setBarangays] = React.useState<LocationOption[]>([]);
  const [provinceCode, setProvinceCode] = React.useState(draft.provinceCode || '');
  const [municipalityCode, setMunicipalityCode] = React.useState(draft.municipalityCode || '');
  const [barangayCode, setBarangayCode] = React.useState(draft.barangayCode || '');
  const [locationLoading, setLocationLoading] = React.useState(false);
  const [locationError, setLocationError] = React.useState('');
  const [houseNumber, setHouseNumber] = React.useState(draft.houseNumber || '');
  const [street, setStreet] = React.useState(draft.street || '');
  const [subdivision, setSubdivision] = React.useState(draft.subdivision || '');
  const [purok, setPurok] = React.useState(draft.purok || '');
  const [compound, setCompound] = React.useState(draft.compound || '');
  const [registeredVoter, setRegisteredVoter] = React.useState(draft.registeredVoter || '');
  const [residency, setResidency] = React.useState<'Resident' | 'Non Resident' | ''>(draft.residency || '');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [emailVerified, setEmailVerified] = React.useState(false);
  const [verificationSent, setVerificationSent] = React.useState(draft.verificationSent || false);
  const [verificationCode, setVerificationCode] = React.useState('');
  const [verifyingEmail, setVerifyingEmail] = React.useState(false);
  const [agreedToTerms, setAgreedToTerms] = React.useState(draft.agreedToTerms || false);
  const [loading, setLoading] = React.useState(false);
  const [sendingVerification, setSendingVerification] = React.useState(false);
  const [error, setError] = React.useState('');
  const { settings } = useSettingsStore();
  const navigate = useNavigate();

  const fullName = [firstName, middleName, lastName, suffix].filter(Boolean).join(' ');
  const selectedProvince = provinces.find((item) => item.code === provinceCode);
  const selectedMunicipality = municipalities.find((item) => item.code === municipalityCode);
  const selectedBarangay = barangays.find((item) => item.code === barangayCode);
  const address = [houseNumber, street, subdivision, purok, compound, selectedBarangay?.name, selectedMunicipality?.name, selectedProvince?.name]
    .filter(Boolean)
    .join(', ');

  React.useEffect(() => {
    const savedDraft: RegistrationDraft = {
      step, username, email, firstName, lastName, middleName, suffix, dateOfBirth, sex,
      placeOfBirth, civilStatus, phoneNumber, occupation, religion, provinceCode,
      municipalityCode, barangayCode, houseNumber, street, subdivision, purok, compound,
      registeredVoter, residency, verificationSent, agreedToTerms,
    };
    try {
      sessionStorage.setItem(registrationDraftKey, JSON.stringify(savedDraft));
    } catch {
      // Keep registration usable if browser storage is unavailable.
    }
  }, [step, username, email, firstName, lastName, middleName, suffix, dateOfBirth, sex, placeOfBirth, civilStatus, phoneNumber, occupation, religion, provinceCode, municipalityCode, barangayCode, houseNumber, street, subdivision, purok, compound, registeredVoter, residency, verificationSent, agreedToTerms]);

  React.useEffect(() => {
    let active = true;
    fetch(`${psgcApi}/provinces`)
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load provinces.');
        return response.json();
      })
      .then((items: LocationOption[]) => {
        if (!active) return;
        setProvinces([
          ...items.sort((a, b) => a.name.localeCompare(b.name)),
          { code: '1300000000', name: 'Metro Manila (NCR)' },
        ]);
        setLocationError('');
      })
      .catch(() => {
        if (active) setLocationError('Philippine location choices could not be loaded. Check your connection and reload this step.');
      });
    return () => { active = false; };
  }, []);

  React.useEffect(() => {
    if (!provinceCode) {
      setLocationError('');
      setMunicipalities([]);
      setBarangays([]);
      return;
    }

    let active = true;
    setLocationError('');
    setLocationLoading(true);
    const path = provinceCode === '1300000000'
      ? `${psgcApi}/regions/${provinceCode}/cities-municipalities`
      : `${psgcApi}/provinces/${provinceCode}/cities-municipalities`;
    fetch(path)
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load cities and municipalities.');
        return response.json();
      })
      .then((items: LocationOption[]) => {
        if (active) {
          setMunicipalities(items.sort((a, b) => a.name.localeCompare(b.name)));
          setLocationError('');
        }
      })
      .catch(() => {
        if (active) setLocationError('Unable to load cities and municipalities for this province.');
      })
      .finally(() => { if (active) setLocationLoading(false); });
    return () => { active = false; };
  }, [provinceCode]);

  React.useEffect(() => {
    if (!municipalityCode) {
      setLocationError('');
      setBarangays([]);
      return;
    }

    let active = true;
    setLocationError('');
    setLocationLoading(true);
    fetch(`${psgcApi}/cities-municipalities/${municipalityCode}/barangays`)
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load barangays.');
        return response.json();
      })
      .then((items: LocationOption[]) => {
        if (active) {
          setBarangays(items.sort((a, b) => a.name.localeCompare(b.name)));
          setLocationError('');
        }
      })
      .catch(() => {
        if (active) setLocationError('Unable to load barangays for this city or municipality.');
      })
      .finally(() => { if (active) setLocationLoading(false); });
    return () => { active = false; };
  }, [municipalityCode]);

  React.useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('verify')
      || sessionStorage.getItem('registrationVerificationToken');
    if (!token) return;

    let cancelled = false;
    const verifyEmail = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(apiUrl('/api/auth/register/verify-email'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await safeJson(response);
        if (!response.ok) throw new Error(data.error || 'Unable to verify this email address.');
        if (cancelled) return;
        sessionStorage.setItem('registrationVerificationToken', data.token || token);
        setUsername(data.username);
        setEmail(data.email);
        setEmailVerified(true);
        setStep(4);
        window.history.replaceState(null, '', window.location.pathname);
        toast.success('Email verified. Review and accept the Terms and Conditions to activate your account.');
      } catch (verificationError) {
        if (cancelled) return;
        sessionStorage.removeItem('registrationVerificationToken');
        setStep(3);
        setError(verificationError instanceof Error ? verificationError.message : 'Unable to verify this email address.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void verifyEmail();
    return () => { cancelled = true; };
  }, []);

  const validateCurrentStep = () => {
    setError('');
    if (step === 0 && !/^[a-zA-Z0-9._-]{3,32}$/.test(username.trim())) {
      setError('Username must be 3–32 characters and may contain letters, numbers, dots, underscores, or hyphens.');
      return false;
    }
    if (step === 0 && password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return false;
    }
    if (step === 0 && password !== confirmPassword) {
      setError('The passwords do not match.');
      return false;
    }
    if (step === 1 && (!firstName.trim() || !lastName.trim())) {
      setError('Enter your first and last name to continue.');
      return false;
    }
    if (step === 1 && !residency) {
      setError('Choose whether you are a Resident or Non-Resident to continue.');
      return false;
    }
    if (step === 3 && !emailVerified) {
      setError('Verify your email using the six-digit code before continuing.');
      return false;
    }
    if (step === 4 && !agreedToTerms) {
      setError('You must accept the Terms and Conditions to activate your account.');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 3) {
      if (emailVerified) setStep(4);
      else if (verificationSent) void verifyEmailCode();
      else setError('Send a verification code to your email before continuing.');
      return;
    }
    if (validateCurrentStep()) setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const sendVerification = async () => {
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address that you can access.');
      return;
    }
    if (!validateAccountAndPersonal()) return;
    setSendingVerification(true);
    try {
      const response = await fetch(apiUrl('/api/auth/register/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(), email: email.trim(), password, pangalan: fullName,
          first_name: firstName, last_name: lastName, middle_name: middleName, suffix,
          date_of_birth: dateOfBirth || null, sex, place_of_birth: placeOfBirth,
          civil_status: civilStatus, phone_number: phoneNumber, occupation, religion,
          address, registered_voter: registeredVoter, is_resident: residency,
        }),
      });
      const data = await safeJson(response);
      if (!response.ok) throw new Error(data.error || 'Unable to send the verification email.');
      setVerificationSent(true);
      setVerificationCode('');
      toast.success('Verification code sent. Check your inbox and spam folder.');
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : 'Unable to send the verification email.';
      setError(message);
      toast.error(message);
    } finally {
      setSendingVerification(false);
    }
  };

  const verifyEmailCode = async () => {
    setError('');
    if (!/^\d{6}$/.test(verificationCode.trim())) {
      setError('Enter the six-digit code sent to your email.');
      return;
    }

    setVerifyingEmail(true);
    try {
      const response = await fetch(apiUrl('/api/auth/register/verify-email'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode.trim() }),
      });
      const data = await safeJson(response);
      if (!response.ok) throw new Error(data.error || 'Unable to verify this email address.');
      if (!data.token) throw new Error('Email was verified, but the registration session could not be created. Please request a new code.');
      sessionStorage.setItem('registrationVerificationToken', data.token);
      setUsername(data.username);
      setEmail(data.email);
      setEmailVerified(true);
      setStep(4);
      toast.success('Email verified. Review and accept the Terms and Conditions to activate your account.');
    } catch (verificationError) {
      const message = verificationError instanceof Error ? verificationError.message : 'Unable to verify this email address.';
      setError(message);
      toast.error(message);
    } finally {
      setVerifyingEmail(false);
    }
  };

  const validateAccountAndPersonal = () => {
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username.trim())) {
      setError('Enter a valid username before requesting email verification.');
      setStep(0);
      return false;
    }
    if (password.length < 8 || password !== confirmPassword) {
      setError(password.length < 8 ? 'Password must contain at least 8 characters.' : 'The passwords do not match.');
      setStep(0);
      return false;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setError('Enter your first and last name before requesting email verification.');
      setStep(1);
      return false;
    }
    if (!residency) {
      setError('Choose whether you are a Resident or Non-Resident before requesting email verification.');
      setStep(1);
      return false;
    }
    return true;
  };

  const handleCompleteRegistration = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateCurrentStep()) return;
    const token = sessionStorage.getItem('registrationVerificationToken');
    if (!token) {
      setError('Verification session not found. Open the activation link in your email again.');
      setStep(3);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(apiUrl('/api/auth/register/complete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, terms_agreed: agreedToTerms }),
      });
      const data = await safeJson(response);
      if (!response.ok) throw new Error(data.error || 'Unable to activate your account.');
      sessionStorage.removeItem('registrationVerificationToken');
      sessionStorage.removeItem(registrationDraftKey);
      toast.success(data.message || 'Account activated. You can now sign in with your username.');
      navigate('/login');
    } catch (completionError) {
      const message = completionError instanceof Error ? completionError.message : 'Unable to activate your account.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const renderPersonalStep = () => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium text-slate-700">First Name *<input required value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Enter first name" className={inputClass} /></label>
      <label className="text-sm font-medium text-slate-700">Last Name *<input required value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Enter last name" className={inputClass} /></label>
      <label className="text-sm font-medium text-slate-700">Middle Name<input value={middleName} onChange={(event) => setMiddleName(event.target.value)} placeholder="Enter middle name" className={inputClass} /></label>
      <label className="text-sm font-medium text-slate-700">Suffix<select value={suffix} onChange={(event) => setSuffix(event.target.value)} className={inputClass}><option value="">No Suffix</option><option>Jr.</option><option>Sr.</option><option>II</option><option>III</option></select></label>
      <label className="text-sm font-medium text-slate-700">Date of Birth<input type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} className={inputClass} /></label>
      <label className="text-sm font-medium text-slate-700">Sex<select value={sex} onChange={(event) => setSex(event.target.value)} className={inputClass}><option value="">Select Sex</option><option>Male</option><option>Female</option><option>Prefer not to say</option></select></label>
      <label className="text-sm font-medium text-slate-700 sm:col-span-2">Place of Birth<input value={placeOfBirth} onChange={(event) => setPlaceOfBirth(event.target.value)} placeholder="Enter place of birth" className={inputClass} /></label>
      <label className="text-sm font-medium text-slate-700">Civil Status<select value={civilStatus} onChange={(event) => setCivilStatus(event.target.value)} className={inputClass}><option value="">Select Civil Status</option><option>Single</option><option>Married</option><option>Widowed</option><option>Separated</option></select></label>
      <label className="text-sm font-medium text-slate-700">Phone Number<input type="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="+63 9XX XXX XXXX" className={inputClass} /></label>
      <label className="text-sm font-medium text-slate-700">Occupation<input value={occupation} onChange={(event) => setOccupation(event.target.value)} placeholder="Enter occupation" className={inputClass} /></label>
      <label className="text-sm font-medium text-slate-700">Religion<input value={religion} onChange={(event) => setReligion(event.target.value)} placeholder="Enter religion" className={inputClass} /></label>
      <fieldset className="space-y-2 sm:col-span-2">
        <legend className="text-sm font-medium text-slate-700">Residency status *</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ['Resident', 'Resident', 'I live in Barangay San Andres.'],
            ['Non Resident', 'Non-Resident', 'I do not live in Barangay San Andres.'],
          ] as const).map(([value, label, description]) => (
            <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${residency === value ? 'border-primary bg-primary/5' : 'border-slate-200 hover:bg-slate-50'}`}>
              <input
                type="radio"
                name="full-registration-residency"
                value={value}
                checked={residency === value}
                onChange={() => setResidency(value)}
                className="mt-1 h-4 w-4 accent-primary"
                required
              />
              <span>
                <span className="block text-sm font-semibold text-slate-800">{label}</span>
                <span className="mt-1 block text-xs text-slate-500">{description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );

  const renderAddressStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><MapPin size={17} className="text-primary" />Your Philippine Address</div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">House No.<input value={houseNumber} onChange={(event) => setHouseNumber(event.target.value)} placeholder="House number" className={inputClass} /></label>
        <label className="text-sm font-medium text-slate-700">Street<input value={street} onChange={(event) => setStreet(event.target.value)} placeholder="Street name" className={inputClass} /></label>
        <label className="text-sm font-medium text-slate-700">Subdivision<input value={subdivision} onChange={(event) => setSubdivision(event.target.value)} placeholder="Subdivision" className={inputClass} /></label>
        <label className="text-sm font-medium text-slate-700">Purok / Area<select value={purok} onChange={(event) => setPurok(event.target.value)} className={inputClass}><option value="">Select Area (if any)</option><option>Purok 1</option><option>Purok 2</option><option>Purok 3</option><option>Purok 4</option><option>Purok 5</option></select></label>
        <label className="text-sm font-medium text-slate-700">Province *<select required value={provinceCode} onChange={(event) => { setProvinceCode(event.target.value); setMunicipalityCode(''); setBarangays([]); setBarangayCode(''); setLocationError(''); }} className={inputClass}><option value="">Select Province</option>{provinces.map((province) => <option key={province.code} value={province.code}>{province.name}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">City / Municipality *<select required disabled={!provinceCode || locationLoading} value={municipalityCode} onChange={(event) => { setMunicipalityCode(event.target.value); setBarangays([]); setBarangayCode(''); setLocationError(''); }} className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}><option value="">{locationLoading && provinceCode ? 'Loading locations…' : 'Select City / Municipality'}</option>{municipalities.map((municipality) => <option key={municipality.code} value={municipality.code}>{municipality.name}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">Barangay *<select required disabled={!municipalityCode || locationLoading} value={barangayCode} onChange={(event) => { setBarangayCode(event.target.value); setLocationError(''); }} className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}><option value="">{locationLoading && municipalityCode ? 'Loading barangays…' : 'Select Barangay'}</option>{barangays.map((barangay) => <option key={barangay.code} value={barangay.code}>{barangay.name.trim()}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">Compound<input value={compound} onChange={(event) => setCompound(event.target.value)} placeholder="" className={inputClass} /></label>
      </div>
      {locationError && <p role="alert" className="text-sm text-red-600">{locationError}</p>}
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-relaxed text-slate-600"><strong>Barangay:</strong> {selectedBarangay?.name.trim() || 'Not selected'} | <strong>City / Municipality:</strong> {selectedMunicipality?.name || 'Not selected'}<br /><strong>Province:</strong> {selectedProvince?.name || 'Not selected'}</div>
      <div className="rounded-lg border border-slate-200 p-3"><p className="mb-2 text-sm text-slate-700">Are you a registered voter in the selected barangay?</p><label className="mr-5 text-sm text-slate-600"><input type="radio" name="registered-voter" value="Yes" checked={registeredVoter === 'Yes'} onChange={(event) => setRegisteredVoter(event.target.value)} className="mr-2 accent-primary" />Yes</label><label className="text-sm text-slate-600"><input type="radio" name="registered-voter" value="No" checked={registeredVoter === 'No'} onChange={(event) => setRegisteredVoter(event.target.value)} className="mr-2 accent-primary" />No</label></div>
    </div>
  );

  const currentTitle = ['Create Username', 'Personal Information', 'Address Details', 'Verify Account', 'Terms and Conditions'][step];
  const currentDescription = [
    'Choose the username and password you will use to sign in.',
    'Enter your personal information.',
    'Where do you currently reside?',
    'Enter an email address you can access to verify your account.',
    'Read and accept the terms to activate your account.',
  ][step];

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-foreground">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-3">
            <BrandLogo
              className="h-10 w-10 rounded-full"
              fallback={<div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-primary shadow-sm"><ShieldCheck size={23} /></div>}
            />
            <div className="leading-tight"><p className="text-sm font-bold sm:text-base">Barangay San Andres</p><p className="text-[10px] text-slate-500 sm:text-xs">Cainta, Rizal</p></div>
          </Link>
          <p className="text-xs text-slate-500 sm:text-sm">Already registered? <Link to="/login" className="font-semibold text-primary hover:underline">Sign in <ArrowRight className="inline" size={14} /></Link></p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
        <div className="mb-8 text-center"><h1 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">Create Your Account</h1><p className="mt-2 text-sm text-slate-500 sm:text-base">Register for the Barangay San Andres Complaint System</p></div>
        <div className="mx-auto mb-8 max-w-3xl">
          <div className="relative hidden items-start justify-between sm:flex">
            <div className="absolute left-[10%] right-[10%] top-5 h-1 rounded-full bg-slate-200" />
            <motion.div className="absolute left-[10%] top-5 h-1 rounded-full bg-primary" animate={{ width: `${(step / (steps.length - 1)) * 80}%` }} />
            {steps.map((item, index) => { const Icon = item.icon; return <div key={item.label} className="relative z-10 flex w-24 flex-col items-center gap-2 text-center"><div className={`flex h-10 w-10 items-center justify-center rounded-full border-4 border-[#f8fafc] ${index <= step ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-400'}`}>{index < step ? <Check size={18} /> : <Icon size={17} />}</div><span className={`text-[11px] font-medium ${index <= step ? 'text-primary' : 'text-slate-400'}`}>{item.label}</span></div>; })}
          </div>
          <div className="flex items-center justify-between sm:hidden"><span className="text-xs font-semibold text-primary">Step {step + 1} of {steps.length}</span><span className="text-xs text-slate-500">{steps[step].label}</span></div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200 sm:hidden"><motion.div className="h-full bg-primary" animate={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
        </div>

        <motion.section key={step} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="px-6 pb-5 pt-7 text-center sm:px-10 sm:pt-9"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">{React.createElement(steps[step].icon, { size: 27 })}</div><h2 className="text-2xl font-bold tracking-[-0.025em] sm:text-3xl">{currentTitle}</h2><p className="mt-2 text-sm text-slate-500">{currentDescription}</p></div>
          {error && <div className="mx-6 mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-10">{error}</div>}
          <form onSubmit={step === 4 ? handleCompleteRegistration : (event) => { event.preventDefault(); handleNext(); }}>
            <div className="space-y-5 px-6 pb-7 sm:px-10">
              {step === 0 && <><label className="block text-sm font-medium text-slate-700">Create Username *<input required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="3–32 characters" className={inputClass} /></label><label className="block text-sm font-medium text-slate-700">Password *<span className="relative mt-2 block"><input type={showPassword ? 'text' : 'password'} required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" className={`${inputClass} mt-0 pr-11`} /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label><label className="block text-sm font-medium text-slate-700">Confirm Password *<span className="relative mt-2 block"><input type={showConfirmPassword ? 'text' : 'password'} required autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Re-enter your password" className={`${inputClass} mt-0 pr-11`} /><button type="button" onClick={() => setShowConfirmPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary" aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}>{showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label></>}
              {step === 1 && renderPersonalStep()}
              {step === 2 && renderAddressStep()}
              {step === 3 && (
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-slate-700">
                    Email Address *
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      disabled={verificationSent || emailVerified}
                      onChange={(event) => { setEmail(event.target.value); setVerificationSent(false); setVerificationCode(''); }}
                      placeholder="you@example.com"
                      className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-70`}
                    />
                  </label>
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-relaxed text-blue-800">
                    We will email a six-digit verification code. The code expires after 10 minutes.
                  </div>
                  <button type="button" onClick={sendVerification} disabled={sendingVerification || emailVerified} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
                    {sendingVerification ? 'Sending verification code…' : verificationSent ? 'Resend Verification Code' : 'Send Verification Code'}
                    <Mail size={16} />
                  </button>
                  {verificationSent && !emailVerified && (
                    <>
                      <label className="block text-sm font-medium text-slate-700">
                        Verification Code
                        <input
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          value={verificationCode}
                          onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="Enter 6-digit code"
                          className={`${inputClass} text-center font-mono text-lg tracking-[0.4em]`}
                        />
                      </label>
                      <button type="button" onClick={verifyEmailCode} disabled={verifyingEmail || verificationCode.length !== 6} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary bg-white px-5 text-sm font-semibold text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60">
                        {verifyingEmail ? 'Verifying code…' : 'Verify Email'}
                        <CheckCircle2 size={16} />
                      </button>
                      <button type="button" onClick={() => { setVerificationSent(false); setVerificationCode(''); }} className="w-full text-center text-xs font-medium text-slate-500 hover:text-primary">
                        Change email address
                      </button>
                    </>
                  )}
                  {emailVerified && <p className="text-center text-sm font-semibold text-emerald-700">Email verified successfully.</p>}
                </div>
              )}
              {step === 4 && <div className="space-y-4"><div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><p className="font-semibold">Email verified</p><p className="mt-1">Username: {username}</p><p>Email: {email}</p></div><div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm leading-relaxed text-slate-600"><h3 className="mb-3 font-semibold text-slate-800">Barangay San Andres Complaint System Terms and Conditions</h3><p className="mb-3">By creating an account, you agree to provide accurate information and use this system only for legitimate barangay complaints, requests, and communication.</p><p className="mb-3">You are responsible for keeping your username and password confidential. Do not submit false, abusive, threatening, or unlawful reports. Submitted information may be reviewed by authorized barangay personnel for proper action and verification.</p><p>Your personal information will be handled for account management, complaint processing, notifications, and official barangay services in accordance with applicable privacy laws.</p></div><label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-primary/50"><input type="checkbox" checked={agreedToTerms} onChange={(event) => setAgreedToTerms(event.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" /><span className="text-sm text-slate-700">I have read and agree to the Terms and Conditions of the Barangay San Andres Complaint System.</span></label></div>}
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4 sm:px-10"><button type="button" onClick={() => { setError(''); setStep((value) => Math.max(value - 1, 0)); }} disabled={step === 0 || loading || verificationSent || emailVerified} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-600 transition hover:border-primary hover:text-primary disabled:invisible"><ArrowLeft size={16} /> Previous</button>{step < steps.length - 1 ? <button type="submit" disabled={step === 3 || loading} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">Continue <ArrowRight size={16} /></button> : <button type="submit" disabled={loading || !agreedToTerms || !emailVerified} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Activating Account…' : 'Agree and Activate Account'} <CheckCircle2 size={16} /></button>}</div>
          </form>
        </motion.section>
        <p className="mt-6 text-center text-sm text-slate-500">Already registered? <Link to="/login" className="font-semibold text-primary hover:underline">Sign in</Link></p>
        <p className="mt-8 text-center text-xs text-slate-400">{settings.footer_text}</p>
      </main>
    </div>
  );
}
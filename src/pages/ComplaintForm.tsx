import { apiUrl } from '../lib/api';
import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ClipboardCheck, FileText, ImagePlus, MapPin, ShieldCheck, UserRound, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Complaint, ComplaintType } from '../types';
import { COMPLAINT_CATEGORIES } from '../data/complaintTaxonomy';
import { safeJson } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import LocationSearchPicker, { LocationResult } from '../components/LocationSearchPicker';

const steps = [
  { label: 'Read notice', icon: AlertTriangle },
  { label: 'Category', icon: FileText },
  { label: 'Your information', icon: UserRound },
  { label: 'Details', icon: ClipboardCheck },
  { label: 'Location', icon: MapPin },
  { label: 'Evidence', icon: ImagePlus },
  { label: 'Review', icon: ShieldCheck },
];

export default function ComplaintForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const editing = Boolean(id);
  const [step, setStep] = React.useState(0);
  const [acceptedNotice, setAcceptedNotice] = React.useState(false);
  const [category, setCategory] = React.useState(COMPLAINT_CATEGORIES[0]);
  const [type, setType] = React.useState('');
  // Anonymity: 'real' = use real name, 'anonymous' = submit anonymously
  const [identityMode, setIdentityMode] = React.useState<'real' | 'anonymous'>('real');
  const [complainantEmail, setComplainantEmail] = React.useState(user?.email || '');
  const [respondentName, setRespondentName] = React.useState('');
  const [details, setDetails] = React.useState('');
  const [locationResult, setLocationResult] = React.useState<LocationResult | null>(null);
  const [typedAddress, setTypedAddress] = React.useState('');
  const [addressDetails, setAddressDetails] = React.useState('');
  const [files, setFiles] = React.useState<File[]>([]);
  const [existingComplaint, setExistingComplaint] = React.useState<Complaint | null>(null);
  const [complaintTypes, setComplaintTypes] = React.useState<ComplaintType[]>([]);
  const [complaintTypesLoading, setComplaintTypesLoading] = React.useState(true);
  const [loading, setLoading] = React.useState(editing);
  const [submitting, setSubmitting] = React.useState(false);
  const [savedDraft, setSavedDraft] = React.useState<any | null>(null);
  const [showDraftBanner, setShowDraftBanner] = React.useState(false);

  const draftKey = user?.id ? `barangay_complaint_draft_${user.id}` : null;
  const isAnonymous = identityMode === 'anonymous';
  const displayName = isAnonymous ? 'Anonymous' : (user?.pangalan || '');

  React.useEffect(() => {
    fetch(apiUrl('/api/complaint-types'))
      .then(safeJson)
      .then((data) => setComplaintTypes(Array.isArray(data) ? data : []))
      .catch(() => toast.error('Unable to load complaint types.'))
      .finally(() => setComplaintTypesLoading(false));
  }, []);

  // Check for unsaved draft on mount (only for new complaints)
  React.useEffect(() => {
    if (editing || !draftKey) return;
    try {
      const stored = localStorage.getItem(draftKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          setSavedDraft(parsed);
          setShowDraftBanner(true);
        }
      }
    } catch (err) {
      console.warn('Failed to parse saved complaint draft:', err);
      localStorage.removeItem(draftKey);
    }
  }, [editing, draftKey]);

  // Debounced auto-save to browser local storage
  React.useEffect(() => {
    if (editing || !draftKey || loading) return;
    const hasContent = acceptedNotice || Boolean(type) || Boolean(details.trim()) || Boolean(respondentName.trim()) || Boolean(locationResult) || Boolean(addressDetails.trim()) || step > 0;
    if (!hasContent) return;

    const timer = setTimeout(() => {
      try {
        const payload = {
          step,
          acceptedNotice,
          category,
          type,
          identityMode,
          complainantEmail,
          respondentName,
          details,
          addressDetails,
          locationResult,
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(draftKey, JSON.stringify(payload));
      } catch (err) {
        console.warn('Failed to save complaint draft to local storage:', err);
      }
    }, 750);

    return () => clearTimeout(timer);
  }, [editing, draftKey, loading, step, acceptedNotice, category, type, identityMode, complainantEmail, respondentName, details, addressDetails, locationResult]);

  const restoreDraft = () => {
    if (!savedDraft) return;
    if (typeof savedDraft.step === 'number' && savedDraft.step >= 0 && savedDraft.step < steps.length) {
      setStep(savedDraft.step);
    }
    if (typeof savedDraft.acceptedNotice === 'boolean') setAcceptedNotice(savedDraft.acceptedNotice);
    if (savedDraft.category) setCategory(savedDraft.category);
    if (savedDraft.type) setType(savedDraft.type);
    if (savedDraft.identityMode) setIdentityMode(savedDraft.identityMode);
    if (savedDraft.complainantEmail) setComplainantEmail(savedDraft.complainantEmail);
    if (savedDraft.respondentName) setRespondentName(savedDraft.respondentName);
    if (savedDraft.details) setDetails(savedDraft.details);
    if (savedDraft.addressDetails) setAddressDetails(savedDraft.addressDetails);
    if (savedDraft.locationResult && savedDraft.locationResult.insideBoundary) {
      setLocationResult(savedDraft.locationResult);
    }
    setShowDraftBanner(false);
    toast.success('Your previously saved draft was restored.');
  };

  const discardDraft = () => {
    if (draftKey) localStorage.removeItem(draftKey);
    setSavedDraft(null);
    setShowDraftBanner(false);
    toast.info('Draft discarded.');
  };

  React.useEffect(() => {
    if (!id || !token) return;
    fetch(apiUrl(`/api/complaints/${id}`), { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const data = await safeJson(response);
        if (!response.ok) throw new Error(data.error || 'Unable to load this complaint.');
        return data;
      })
      .then((complaint) => {
        setExistingComplaint(complaint);
        setType(complaint.uri_ng_reklamo || '');
        const complaintType = complaintTypes.find((item) => item.name === complaint.uri_ng_reklamo);
        if (complaintType) setCategory(complaintType.category);
        setIdentityMode(complaint.is_anonymous ? 'anonymous' : 'real');
        setComplainantEmail(complaint.complainant_email || user?.email || '');
        setRespondentName(complaint.nireklamo_pangalan || '');
        setDetails(complaint.detalye || '');
        setAddressDetails(complaint.address_details || '');
        if (
          Number.isFinite(Number(complaint.latitude)) &&
          Number.isFinite(Number(complaint.longitude)) &&
          complaint.latitude != null &&
          complaint.longitude != null
        ) {
          setLocationResult({
            latitude: Number(complaint.latitude),
            longitude: Number(complaint.longitude),
            address: complaint.street_name || '',
            insideBoundary: true,
            zone: complaint.zone || null,
          });
        }
        setStep(1);
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Unable to load this complaint.');
        navigate('/complaints');
      })
      .finally(() => setLoading(false));
  }, [id, token, navigate, user, complaintTypes]);

  const validateStep = () => {
    if (step === 0 && !acceptedNotice) return 'Please acknowledge the notice before continuing.';
    if (step === 1 && (!category || !type)) return 'Choose a category and complaint type.';
    if (step === 2) {
      if (!isAnonymous && !complainantEmail.trim()) return 'Enter your email address.';
      if (!isAnonymous && complainantEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(complainantEmail.trim())) return 'Enter a valid email address.';
    }
    if (step === 3 && details.trim().length < 10) return 'Describe what happened in at least 10 characters.';
    if (step === 4) {
      if (!locationResult) return 'Please confirm your incident address by clicking "Set as Official Address" or choosing a location from the search list.';
      if (!locationResult.insideBoundary) return 'The selected location is outside Barangay San Andres. Only incidents within the barangay can be filed.';
    }
    return '';
  };

  const nextStep = async () => {
    // If user is on step 4 and has typed an address but hasn't explicitly clicked "Set as Official Address",
    // automatically validate and lock it in so they can proceed effortlessly!
    if (step === 4 && (!locationResult || !locationResult.insideBoundary) && typedAddress.trim()) {
      setSubmitting(true);
      try {
        const res = await fetch(apiUrl('/api/location/validate'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ address: typedAddress.trim() }),
        });
        const data = await res.json();
        const isInside = Boolean(data.valid && (data.insideSanAndres ?? data.in_san_andres));
        if (isInside) {
          const loc: LocationResult = {
            latitude: Number(data.latitude ?? 14.5682),
            longitude: Number(data.longitude ?? 121.1078),
            address: typedAddress.trim(),
            insideBoundary: true,
            zone: data.zone || data.matched_zone || null,
          };
          setLocationResult(loc);
          setSubmitting(false);
          setStep((current) => Math.min(current + 1, steps.length - 1));
          return;
        } else {
          setSubmitting(false);
          toast.error(
            data.message ||
              'The entered location is outside Barangay San Andres coverage. Only incidents within the barangay can be accepted.'
          );
          return;
        }
      } catch {
        setSubmitting(false);
      }
    }

    const validationError = validateStep();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const submitComplaint = async () => {
    if (!editing && !acceptedNotice) {
      toast.error('Please acknowledge the notice before submitting.');
      setStep(0);
      return;
    }
    if (!locationResult?.insideBoundary) {
      toast.error('Please select a valid location inside Barangay San Andres before submitting.');
      setStep(4);
      return;
    }
    setSubmitting(true);
    const body = new FormData();
    body.append('uri_ng_reklamo', type);
    body.append('category', category);
    body.append('is_anonymous', isAnonymous ? '1' : '0');
    body.append('complainant_name', displayName);
    if (!isAnonymous) body.append('complainant_email', complainantEmail.trim());
    body.append('nireklamo_pangalan', respondentName.trim());
    body.append('detalye', details.trim());
    if (locationResult?.zone) body.append('zone', locationResult.zone);
    body.append('street_name', locationResult.address);
    if (addressDetails.trim()) body.append('address_details', addressDetails.trim());
    body.append('latitude', String(locationResult.latitude));
    body.append('longitude', String(locationResult.longitude));
    body.append('is_resident', user?.is_resident || 'Resident');
    body.append('truthfulness_acknowledged', acceptedNotice ? '1' : '0');
    files.forEach((file) => body.append('evidence', file));

    try {
      const response = await fetch(editing ? apiUrl(`/api/complaints/${id}`) : apiUrl('/api/complaints'), {
        method: editing ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const data = await safeJson(response);
      if (!response.ok) throw new Error(data.error || 'Unable to save your complaint.');
      if (draftKey) {
        localStorage.removeItem(draftKey);
      }
      toast.success(editing ? 'Your complaint update was saved.' : 'Your complaint was submitted for review.');
      navigate(`/complaints/${editing ? id : data.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save your complaint.');
    } finally {
      setSubmitting(false);
    }
  };

  const categoryTypes = complaintTypes.filter((item) => item.category === category && item.is_active !== 0);
  const stepTitle = ['Before you file', 'Choose a category and type', 'Complainant information', 'Complaint details', 'Incident location', 'Photo evidence', 'Review and submit'];
  const stepDescription = [
    'Please use the complaint system responsibly.',
    'Select the category that best matches the issue.',
    'Choose how your identity will appear and confirm your email.',
    'Describe what happened clearly and accurately.',
    'Search for the incident address within Barangay San Andres.',
    'Photos can help officials review the complaint. They are optional.',
    'Check the information before sending it for review.',
  ];

  if (loading) return <div className="p-12 text-center text-sm text-muted-foreground">Loading complaint...</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" render={<Link to={editing ? `/complaints/${id}` : '/complaints'} />} nativeButton={false} className="px-2">
          <ArrowLeft className="mr-2 h-4 w-4" /> {editing ? 'Back to complaint' : 'Back to complaints'}
        </Button>
        <span className="text-xs font-medium text-muted-foreground">{editing ? 'Update complaint' : 'Complaint filing'}</span>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4 md:p-6">
        <div className="mb-4 hidden items-center justify-between gap-2 sm:flex">
          {steps.map((item, index) => {
            const Icon = index < step ? Check : item.icon;
            return <div key={item.label} className={`flex min-w-0 items-center gap-2 text-xs ${index === step ? 'font-semibold text-primary' : index < step ? 'text-foreground' : 'text-muted-foreground'}`}>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${index <= step ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}><Icon size={15} /></span>
              <span className="hidden lg:block">{item.label}</span>
            </div>;
          })}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground sm:hidden"><span>Step {step + 1} of {steps.length}</span><span>{steps[step].label}</span></div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
      </div>

      {/* Draft restoration banner */}
      {showDraftBanner && savedDraft && !editing && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm shadow-sm">
          <div className="space-y-0.5">
            <p className="font-semibold text-foreground flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-primary" /> Unsaved complaint draft found
            </p>
            <p className="text-xs text-muted-foreground">
              You have an in-progress draft saved in this browser from {savedDraft.updatedAt ? new Date(savedDraft.updatedAt).toLocaleString() : 'a previous session'}.
            </p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            <Button size="sm" variant="default" onClick={restoreDraft} className="text-xs h-8">
              Restore Draft
            </Button>
            <Button size="sm" variant="ghost" onClick={discardDraft} className="text-xs h-8 text-muted-foreground hover:text-destructive">
              Discard
            </Button>
          </div>
        </div>
      )}

      <Card className="overflow-hidden border-border/60 shadow-sm">
        <div className="border-b border-border/60 bg-muted/20 px-6 py-6 md:px-9">
          <h1 className="text-2xl font-semibold text-foreground">{stepTitle[step]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{stepDescription[step]}</p>
        </div>
        <CardContent className="space-y-6 p-5 md:p-9">
          {step === 0 && <div className="space-y-5">
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
              <div className="mb-2 flex items-center gap-2 font-semibold"><AlertTriangle size={17} /> Truthful and responsible reporting</div>
              <p>Only submit information that is honest and based on what you know. Do not file a false, misleading, or nuisance complaint. Knowingly making false statements or misusing an official complaint process may have consequences under applicable law. Reports are reviewed by authorized barangay personnel.</p>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4">
              <input type="checkbox" checked={acceptedNotice} onChange={(event) => setAcceptedNotice(event.target.checked)} className="mt-1 h-4 w-4 accent-primary" />
              <span className="text-sm leading-relaxed text-foreground">I understand. I confirm that I will provide truthful information to the best of my knowledge.</span>
            </label>
          </div>}

          {step === 1 && <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2"><label className="text-sm font-medium">Category</label><Select value={category} onValueChange={(value) => { setCategory(value); setType(''); }}><SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger><SelectContent>{COMPLAINT_CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><label className="text-sm font-medium">Complaint type</label><Select key={category} value={type} onValueChange={setType} disabled={complaintTypesLoading || categoryTypes.length === 0}><SelectTrigger><SelectValue placeholder={complaintTypesLoading ? 'Loading types...' : categoryTypes.length ? 'Choose a complaint type' : 'No active types'} /></SelectTrigger><SelectContent>{categoryTypes.map((item) => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <p className="text-xs text-muted-foreground sm:col-span-2">Registered residency: <span className="font-medium text-foreground">{user?.account_type || user?.is_resident || 'Resident'}</span></p>
          </div>}

          {step === 2 && <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">How would you like to file?</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  id="identity-real"
                  onClick={() => setIdentityMode('real')}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all ${identityMode === 'real' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}
                >
                  <Eye className="h-6 w-6" />
                  <span className="text-sm font-semibold">Use Real Name</span>
                  <span className="text-[10px] leading-tight">Your name will be visible to barangay officials</span>
                </button>
                <button
                  type="button"
                  id="identity-anonymous"
                  onClick={() => setIdentityMode('anonymous')}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all ${identityMode === 'anonymous' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}
                >
                  <EyeOff className="h-6 w-6" />
                  <span className="text-sm font-semibold">Submit Anonymously</span>
                  <span className="text-[10px] leading-tight">Your identity will not be disclosed to anyone</span>
                </button>
              </div>
            </div>

            {identityMode === 'real' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Your name</label>
                  <Input value={user?.pangalan || ''} readOnly className="bg-muted/50 text-muted-foreground cursor-not-allowed" />
                  <p className="text-[10px] text-muted-foreground">Using your registered account name.</p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="complainant-email" className="text-sm font-medium">Email address</label>
                  <Input id="complainant-email" type="email" value={complainantEmail} onChange={(event) => setComplainantEmail(event.target.value)} maxLength={255} required />
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                <p className="font-medium">Anonymous complaint</p>
                <p className="mt-1 text-xs leading-relaxed">Your name and contact information will not be shared with barangay officials or attached to this complaint. The complaint will still be reviewed. Note: anonymous complaints may limit the barangay's ability to follow up with you.</p>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="respondent-name" className="text-sm font-medium">Person involved (optional)</label>
              <Input id="respondent-name" value={respondentName} onChange={(event) => setRespondentName(event.target.value)} maxLength={255} placeholder="Name of the person involved, if known" />
            </div>
          </div>}

          {step === 3 && <div className="space-y-2"><label htmlFor="complaint-details" className="text-sm font-medium">What happened?</label><Textarea id="complaint-details" value={details} onChange={(event) => setDetails(event.target.value)} minLength={10} maxLength={10000} required placeholder="Include what happened, when it happened, and any other helpful information." className="min-h-48 resize-y" /><p className="text-right text-xs text-muted-foreground">{details.length}/10,000</p></div>}

          {step === 4 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">Official incident address</label>
                <LocationSearchPicker
                  value={locationResult}
                  onChange={setLocationResult}
                  onQueryChange={setTypedAddress}
                  token={token || undefined}
                />
              </div>

              {/* Additional Address Details section */}
              <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4">
                <label htmlFor="address-details-input" className="text-sm font-medium text-foreground">
                  Address Details (Optional)
                </label>
                <p className="text-xs text-muted-foreground">
                  Enter additional directions or location descriptions, such as landmarks, building names, house numbers, or other details that help officials locate the incident accurately.
                </p>
                <Textarea
                  id="address-details-input"
                  value={addressDetails}
                  onChange={(event) => setAddressDetails(event.target.value)}
                  maxLength={2000}
                  placeholder="e.g. Near San Andres Elementary School, Block 4 Lot 12, Yellow gate beside sari-sari store..."
                  className="min-h-20 bg-background text-sm"
                />
                <p className="text-right text-[10px] text-muted-foreground">{addressDetails.length}/2,000</p>
              </div>
            </div>
          )}

          {step === 5 && <div className="space-y-4">
            <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 p-6 text-center hover:border-primary/50">
              <ImagePlus className="h-7 w-7 text-primary" />
              <span className="text-sm font-medium">Add photos (optional)</span>
              <span className="text-xs text-muted-foreground">Up to 5 files per update. You can add more evidence whenever you update the complaint.</span>
              <input type="file" accept="image/*" multiple className="sr-only" onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 5))} />
            </label>
            {files.length > 0 && <ul className="space-y-2">{files.map((file, index) => <li key={`${file.name}-${index}`} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm"><span className="truncate">{file.name}</span><button type="button" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="ml-3 text-xs font-medium text-destructive">Remove</button></li>)}</ul>}
          </div>}

          {step === 6 && <div className="space-y-4">
            {!editing && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">You confirmed that this report is truthful. Your complaint will be reviewed by barangay personnel before further action.</div>}
            <dl className="grid gap-3 sm:grid-cols-2">{[
              ['Category', category],
              ['Complaint type', type],
              ['Filing as', isAnonymous ? 'Anonymous' : (user?.pangalan || 'Identified')],
              ...(!isAnonymous ? [['Email', complainantEmail]] : []),
              ['Person involved', respondentName || 'Not provided'],
              ['Official incident address', locationResult?.address || '—'],
              ...(locationResult?.zone ? [['Area', locationResult.zone]] : []),
              ...(addressDetails.trim() ? [['Additional address details', addressDetails.trim()]] : []),
              ...(locationResult ? [['Coordinates', `${locationResult.latitude.toFixed(6)}, ${locationResult.longitude.toFixed(6)}`]] : []),
            ].map(([label, value]) => <div key={label} className="rounded-lg border border-border/60 p-3"><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium text-foreground">{value}</dd></div>)}</dl>
            <div className="rounded-lg border border-border/60 p-3"><p className="text-xs font-medium text-muted-foreground">Complaint details</p><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{details}</p></div>
            <p className="text-xs text-muted-foreground">{files.length} new photo(s) attached. {existingComplaint?.evidence?.length || 0} existing photo(s) will be kept.</p>
          </div>}
        </CardContent>
        <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-5 py-4 md:px-9">
          <Button type="button" variant="outline" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0 || submitting}>Previous</Button>
          {step < steps.length - 1
            ? <Button type="button" onClick={nextStep} disabled={step === 0 && !acceptedNotice}>Continue <ArrowRight className="ml-2 h-4 w-4" /></Button>
            : <Button type="button" onClick={submitComplaint} disabled={submitting}>{submitting ? 'Submitting...' : editing ? 'Save one-time update' : 'Submit for review'} <Check className="ml-2 h-4 w-4" /></Button>}
        </div>
      </Card>
    </div>
  );
}
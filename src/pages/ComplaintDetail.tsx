import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Complaint, Action } from '../types';
import { LABELS } from '../constants';
import { 
  ArrowLeft, 
  Clock, 
  CheckCircle, 
  User, 
  Shield,
  FileText,
  ImageIcon,
  PlayCircle,
  Download,
  ExternalLink,
  AlertCircle,
  Check,
  Plus,
  Pencil,
  Users,
  Gavel,
  MapPin
} from 'lucide-react';
import { cn, safeJson, maskEmail } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import MediationManager from '../components/MediationManager';
import CaseHistory from '../components/CaseHistory';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "../components/ui/dialog";
import { toast } from 'sonner';
import { motion } from 'motion/react';

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'bago': return <AlertCircle size={14} className="text-destructive" />;
    case 'sa-mediation': return <User size={14} className="text-amber-500" />;
    case 'natapos': return <CheckCircle size={14} className="text-green-500" />;
    default: return <Clock size={14} className="text-blue-500" />;
  }
};

export default function ComplaintDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [witnessForm, setWitnessForm] = useState({ pangalan: '', telepono: '', detalye: '' });
  const [isWitnessDialogOpen, setIsWitnessDialogOpen] = useState(false);
  const [luponMembers, setLuponMembers] = useState<any[]>([]);
  const [isLuponDialogOpen, setIsLuponDialogOpen] = useState(false);
  const [selectedLupon, setSelectedLupon] = useState<number[]>([]);
  const [isLuponConfirmOpen, setIsLuponConfirmOpen] = useState(false);
  const [statusToConfirm, setStatusToConfirm] = useState<string | null>(null);
  const [statusRemarks, setStatusRemarks] = useState('');
  const [resolutionDetails, setResolutionDetails] = useState('');
  const [dispositionFile, setDispositionFile] = useState<File | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [eligibilityDecision, setEligibilityDecision] = useState<boolean | null>(null);
  const [eligibilityRemarks, setEligibilityRemarks] = useState('');
  const [isSavingEligibility, setIsSavingEligibility] = useState(false);

  useEffect(() => {
    fetchComplaint();
  }, [id, token]);

  const fetchComplaint = () => {
    fetch(`/api/complaints/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(safeJson)
    .then(data => {
      const result = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
      setComplaint(result as Complaint);
      setActions(result.actions || []);
      setSelectedLupon((result.lupon || []).map((l: any) => l.id));

      if (user?.role !== 'mamamayan') {
        void fetch(`/api/complaints/${id}/read`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        }).catch((error) => console.error('Unable to mark complaint as read:', error));
      }
      
    });
  };

  const fetchLupon = () => {
    fetch('/api/lupon-members', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(setLuponMembers)
    .catch(console.error);
  };

  const addWitness = (e: React.FormEvent) => {
    e.preventDefault();
    fetch(`/api/complaints/${id}/witnesses`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(witnessForm)
    })
    .then(res => res.json())
    .then(() => {
      toast.success('Witness added successfully');
      setWitnessForm({ pangalan: '', telepono: '', detalye: '' });
      setIsWitnessDialogOpen(false);
      fetchComplaint();
    });
  };

  const assignLupon = () => {
    fetch(`/api/complaints/${id}/lupon`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ lupon_ids: selectedLupon })
    })
    .then(async (res) => {
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Unable to assign Lupon.');
      toast.success(result.message || 'Lupon assigned successfully');
      setIsLuponDialogOpen(false);
      fetchComplaint();
    })
    .catch((error) => toast.error(error instanceof Error ? error.message : 'Unable to assign Lupon.'));
  };

  const updateStatus = (status: string) => {
    if (status === complaint?.status || isUpdatingStatus) return;
    setStatusRemarks('');
    setResolutionDetails('');
    setDispositionFile(null);
    setStatusToConfirm(status);
  };

  const confirmStatusUpdate = async () => {
    if (!statusToConfirm || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    try {
      const body = new FormData();
      body.append('status', statusToConfirm);
      body.append('remarks', statusRemarks.trim());
      if (statusToConfirm === 'natapos' || statusToConfirm === 'archived') {
        body.append('resolution_details', resolutionDetails.trim());
        if (dispositionFile) body.append('disposition_document', dispositionFile);
      }
      const response = await fetch(`/api/complaints/${id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to update complaint status.');
      toast.success(`Status updated to ${LABELS.STATUS[statusToConfirm]}`);
      setStatusToConfirm(null);
      fetchComplaint();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update complaint status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const saveEligibility = async () => {
    if (eligibilityDecision === null || isSavingEligibility) return;
    setIsSavingEligibility(true);
    try {
      const response = await fetch(`/api/complaints/${id}/mediation-eligibility`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ eligible: eligibilityDecision, remarks: eligibilityRemarks.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save mediation eligibility.');
      toast.success(result.message || 'Mediation eligibility recorded.');
      setEligibilityDecision(null);
      setEligibilityRemarks('');
      fetchComplaint();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save mediation eligibility.');
    } finally {
      setIsSavingEligibility(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEvidenceIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon size={18} className="text-blue-500" />;
    if (type.startsWith('video/')) return <PlayCircle size={18} className="text-red-500" />;
    return <FileText size={18} className="text-gray-500" />;
  };

  if (!complaint) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  const complaintStatuses = Object.entries(LABELS.STATUS);
  const currentStatusIndex = complaintStatuses.findIndex(([status]) => status === complaint.status);

  return (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => navigate('/complaints')}
          className="px-2 text-sm font-bold text-muted-foreground hover:text-foreground md:px-0"
        >
          <ArrowLeft size={16} className="mr-2" /> Back to complaints
        </Button>
        {user?.role !== 'mamamayan' && ['natapos', 'archived'].includes(complaint.status) && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs font-semibold"
            onClick={async () => {
              try {
                const response = await fetch(`/api/complaints/${complaint.id}/report/docx`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (!response.ok) {
                  const err = await response.json();
                  toast.error(err.error || 'Unable to generate report.');
                  return;
                }
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const cd = response.headers.get('Content-Disposition') || '';
                const match = cd.match(/filename="([^"]+)"/);
                a.download = match ? match[1] : `Case_Report_${complaint.id}.docx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
              } catch {
                toast.error('Unable to download case closure report.');
              }
            }}
          >
            <Download size={14} /> Download Case Report (.docx)
          </Button>
        )}
      </div>


      <section className="rounded-xl border border-border/60 bg-card p-4 md:p-6" aria-label="Complaint progress">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">Complaint progress</h2>
          <Badge variant={complaint.status === 'natapos' ? 'secondary' : 'outline'}>{LABELS.STATUS[complaint.status]}</Badge>
        </div>
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-[760px] items-start">
            {complaintStatuses.map(([status, label], index) => {
              const complete = index < currentStatusIndex;
              const current = index === currentStatusIndex;
              return <div key={status} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
                {index < complaintStatuses.length - 1 && <span aria-hidden="true" className={`absolute left-1/2 top-4 h-0.5 w-full ${index < currentStatusIndex ? 'bg-primary' : 'bg-border'}`} />}
                <span className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 ${complete || current ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground'}`} aria-current={current ? 'step' : undefined}>
                  {complete ? <Check size={15} /> : current ? <span className="h-2 w-2 rounded-full bg-current" /> : <span className="h-1.5 w-1.5 rounded-full bg-current/50" />}
                </span>
                <span className={`mt-2 max-w-24 px-1 text-[10px] leading-tight md:text-xs ${current ? 'font-semibold text-primary' : complete ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
              </div>;
            })}
          </div>
        </div>
      </section>

      <div className={`grid grid-cols-1 gap-6 md:gap-8 ${user?.role === 'mamamayan' ? '' : 'lg:grid-cols-3'}`}>
        {/* Left: Details & Timeline */}
        <div className={user?.role === 'mamamayan' ? 'space-y-6 md:space-y-8' : 'space-y-6 md:space-y-8 lg:col-span-2'}>
          <Card className="border-border/50 shadow-xl overflow-hidden rounded-[2rem]">
            <CardHeader className="p-6 md:p-8 bg-muted/30 border-b border-border/50">
              <div className="flex flex-col md:flex-row justify-between items-start mb-6 space-y-4 md:space-y-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] md:text-xs font-mono text-muted-foreground">ID: #{complaint.id}</span>
                    <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                      {complaint.blotter_number || 'No Case Number'}
                    </Badge>
                  </div>
                  <CardTitle className="text-2xl md:text-3xl font-serif italic font-bold text-foreground mt-1">{complaint.uri_ng_reklamo}</CardTitle>
                </div>
                <Badge variant={
                  complaint.status === 'bago' ? "destructive" :
                  complaint.status === 'natapos' ? "secondary" :
                  "default"
                } className="px-4 py-1.5 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest">
                  {LABELS.STATUS[complaint.status]}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{LABELS.COMPLAINT.reporter}</p>
                  <p className="font-bold text-foreground text-sm md:text-base flex items-center">
                    <User size={14} className="mr-2 text-primary" />
                    {complaint.is_anonymous || complaint.complainant_name === 'Anonymous' ? 'Anonymous' : (complaint.complainant_name || complaint.reporter)}
                  </p>
                  {!(complaint.is_anonymous || complaint.complainant_name === 'Anonymous') && complaint.complainant_email && (
                    <p className="text-[10px] font-mono text-muted-foreground truncate">{maskEmail(complaint.complainant_email)}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Respondent</p>
                  <p className="font-bold text-foreground text-sm md:text-base flex items-center">
                    <User size={14} className="mr-2 text-destructive" />
                    {complaint.nireklamo_pangalan || 'No Name Provided'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{LABELS.COMPLAINT.date}</p>
                  <p className="font-bold text-foreground text-sm md:text-base flex items-center">
                    <Clock size={14} className="mr-2 text-primary" />
                    {formatDate(complaint.created_at)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Residency</p>
                  <p className="font-bold text-foreground text-sm md:text-base flex items-center">
                    <Shield size={14} className="mr-2 text-primary" />
                    <Badge variant="outline" className={cn(
                      "rounded-full text-[10px] font-bold",
                      complaint.is_resident === 'Non Resident' ? "border-amber-500 text-amber-500" : "border-primary text-primary"
                    )}>
                      {complaint.is_resident || 'Resident'}
                    </Badge>
                  </p>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-6 md:p-8 space-y-8">
              {/* Incident Location & Additional Details */}
              <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-primary" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Official Incident Location</p>
                  </div>
                  {complaint.latitude != null && complaint.longitude != null && (
                    <a
                      href={`https://www.google.com/maps?q=${complaint.latitude},${complaint.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      <ExternalLink size={12} /> Open in Google Maps
                    </a>
                  )}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground text-sm md:text-base">
                        {complaint.street_name || 'Barangay San Andres, Cainta, Rizal'}
                      </p>
                      {complaint.zone && <p className="text-xs text-muted-foreground">Zone / Sector: {complaint.zone}</p>}
                    </div>
                    <Badge variant="outline" className="w-fit border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                      Verified: Inside San Andres
                    </Badge>
                  </div>
                  {complaint.latitude != null && complaint.longitude != null && (
                    <p className="text-[11px] font-mono text-muted-foreground">
                      Coordinates: {Number(complaint.latitude).toFixed(6)}, {Number(complaint.longitude).toFixed(6)}
                    </p>
                  )}
                  {complaint.address_details && (
                    <div className="mt-3 rounded-xl border border-border/60 bg-background/80 p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Additional Address Details</p>
                      <p className="mt-1 text-xs text-foreground leading-relaxed whitespace-pre-wrap">{complaint.address_details}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{LABELS.COMPLAINT.details}</p>
                  {user?.role === 'mamamayan' && (
                    <Button variant="outline" size="sm" render={<Link to={`/complaints/${complaint.id}/edit`} />} nativeButton={false}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit complaint
                    </Button>
                  )}
                </div>
                <div className="text-foreground/80 leading-relaxed bg-muted/50 p-6 md:p-8 rounded-[2rem] italic text-sm md:text-base relative">
                  <span className="absolute top-4 left-4 text-primary opacity-20 text-4xl font-serif">"</span>
                  <p className="relative z-10">{complaint.detalye}</p>
                  <span className="absolute bottom-4 right-4 text-primary opacity-20 text-4xl font-serif">"</span>
                </div>
              </div>

              {complaint.evidence && complaint.evidence.length > 0 && (
                <div className="space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Evidence</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {complaint.evidence.map((ev) => (
                      <motion.div 
                        key={ev.id}
                        whileHover={{ scale: 1.05 }}
                        className="group relative bg-muted rounded-2xl border border-border/50 overflow-hidden shadow-md aspect-square"
                      >
                        {ev.file_type.startsWith('image/') ? (
                          <img 
                            src={ev.file_path} 
                            alt={ev.original_name} 
                            className="w-full h-full object-cover transition-transform group-hover:scale-110"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                            {getEvidenceIcon(ev.file_type)}
                            <span className="text-[8px] font-bold mt-2 truncate w-full">{ev.original_name}</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button 
                            size="icon" 
                            variant="secondary" 
                            className="w-8 h-8 rounded-full" 
                            render={<a href={ev.file_path} target="_blank" rel="noopener noreferrer" />}
                            nativeButton={false}
                          >
                            <ExternalLink size={14} />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="secondary" 
                            className="w-8 h-8 rounded-full" 
                            render={<a href={ev.file_path} download={ev.original_name} />}
                            nativeButton={false}
                          >
                            <Download size={14} />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="pt-6 border-t border-border/50 space-y-8">
                {/* Lupon & Witnesses Row */}
                <div className="space-y-8">
                  {/* Witnesses Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center">
                        <Users size={12} className="mr-2" />
                        Witnesses
                      </p>
                      <Dialog open={isWitnessDialogOpen} onOpenChange={setIsWitnessDialogOpen}>
                        <DialogTrigger render={<Button variant="ghost" size="sm" className="h-6 text-[10px] font-bold p-0 px-2 text-primary hover:bg-primary/10" />}>
                            <Plus size={12} className="mr-1" /> Add witness
                        </DialogTrigger>
                        <DialogContent className="rounded-[2rem]">
                          <DialogHeader>
                            <DialogTitle>Add a witness</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={addWitness} className="space-y-4 pt-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-muted-foreground">Name</label>
                              <Input 
                                required
                                value={witnessForm.pangalan} 
                                onChange={e => setWitnessForm({...witnessForm, pangalan: e.target.value})} 
                                className="rounded-xl"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-muted-foreground">Phone / Contact</label>
                              <Input 
                                value={witnessForm.telepono} 
                                onChange={e => setWitnessForm({...witnessForm, telepono: e.target.value})} 
                                className="rounded-xl"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-muted-foreground">Details / Relationship</label>
                              <Textarea 
                                value={witnessForm.detalye} 
                                onChange={e => setWitnessForm({...witnessForm, detalye: e.target.value})} 
                                className="rounded-xl min-h-[80px]"
                              />
                            </div>
                            <DialogFooter>
                              <Button type="submit" className="rounded-xl w-full">Save witness</Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                    
                    <div className="space-y-2">
                       {complaint.witnesses && complaint.witnesses.length > 0 ? (
                         complaint.witnesses.map((w: any) => (
                           <div key={w.id} className="bg-muted/50 p-3 rounded-xl border border-border/30 flex justify-between items-center group">
                              <div>
                                <p className="text-sm font-bold">{w.pangalan}</p>
                                <p className="text-[10px] text-muted-foreground">{w.telepono || 'No contact'}</p>
                              </div>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <Badge variant="outline" className="text-[8px] font-bold uppercase">{w.detalye || 'Witness'}</Badge>
                              </div>
                           </div>
                         ))
                       ) : (
                         <p className="text-[10px] text-muted-foreground italic p-4 text-center border-2 border-dashed border-border/30 rounded-xl">
                           No witnesses listed yet.
                         </p>
                       )}
                    </div>
                  </div>

                </div>

                {complaint.lupon && complaint.lupon.length > 0 && (
                  <div className="space-y-4 rounded-xl border border-border/50 bg-muted/20 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center">
                        <Gavel size={12} className="mr-2" />
                        Barangay Justice Council
                      </p>
                      {user?.role !== 'mamamayan' && (
                        <Dialog open={isLuponDialogOpen} onOpenChange={(open) => {
                          setIsLuponDialogOpen(open);
                          if (open) fetchLupon();
                        }}>
                          <DialogTrigger render={<Button variant="ghost" size="sm" className="h-6 text-[10px] font-bold p-0 px-2 text-primary hover:bg-primary/10" />}>
                              <Plus size={12} className="mr-1" /> Assign members
                          </DialogTrigger>
                          <DialogContent className="rounded-[2rem]">
                            <DialogHeader>
                              <DialogTitle>Assign mediation members</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-4">
                               <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                                  {luponMembers.map(member => (
                                    <div 
                                      key={member.id} 
                                      className={cn(
                                        "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all",
                                        selectedLupon.includes(member.id) 
                                          ? "bg-primary/10 border-primary" 
                                          : "bg-muted/30 border-border/50"
                                      )}
                                      onClick={() => {
                                        if (selectedLupon.includes(member.id)) {
                                          setSelectedLupon(selectedLupon.filter(id => id !== member.id));
                                        } else {
                                          setSelectedLupon([...selectedLupon, member.id]);
                                        }
                                      }}
                                    >
                                      <div>
                                        <p className="text-sm font-bold">{member.pangalan}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase">{member.posisyon}</p>
                                      </div>
                                      {selectedLupon.includes(member.id) && <CheckCircle size={14} className="text-primary" />}
                                    </div>
                                  ))}
                               </div>
                               <DialogFooter>
                                 <Button onClick={() => setIsLuponConfirmOpen(true)} className="rounded-xl w-full">Review assignments</Button>
                               </DialogFooter>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>

                    <div className="space-y-2">
                      {complaint.lupon.map((l: any) => (
                        <div key={l.id} className="bg-primary/5 p-3 rounded-xl border border-primary/10 flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                             {l.pangalan.charAt(0)}
                           </div>
                           <div>
                             <p className="text-sm font-bold text-foreground">{l.pangalan}</p>
                             <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{l.posisyon}</p>
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <section className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
                  <div>
                    <h3 className="font-semibold">Mediation eligibility</h3>
                    <p className="text-sm text-muted-foreground">
                      Category: {complaint.category || 'Not classified'} ·
                      {' '}{complaint.mediation_eligible ? 'Verified eligible' : 'Not verified as eligible'}
                    </p>
                    {complaint.mediation_eligibility_notes && (
                      <p className="mt-2 text-sm">Staff reason: {complaint.mediation_eligibility_notes}</p>
                    )}
                    {complaint.mediation_eligibility_verified_by_name && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Verified by {complaint.mediation_eligibility_verified_by_name}
                        {complaint.mediation_eligibility_verified_at ? ` · ${formatDate(complaint.mediation_eligibility_verified_at)}` : ''}
                      </p>
                    )}
                  </div>
                  {user?.role !== 'mamamayan' && (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => {
                        setEligibilityDecision(true);
                        setEligibilityRemarks('');
                      }}>
                        Verify eligible
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => {
                        setEligibilityDecision(false);
                        setEligibilityRemarks('');
                      }}>
                        Record ineligible
                      </Button>
                    </div>
                  )}
                </section>

                <MediationManager 
                  mediation={complaint.mediation} 
                  complaintId={complaint.id} 
                  isStaff={user?.role !== 'mamamayan'} 
                  mediationEligible={Boolean(complaint.mediation_eligible)}
                  onRefresh={fetchComplaint} 
                />
              </div>
            </CardContent>
          </Card>

          {/* Timeline / Actions */}
          <Card className="border-border/50 shadow-xl rounded-[2rem]">
            <CardHeader className="p-6 md:p-8 border-b border-border/50">
              <CardTitle className="text-lg font-serif italic flex items-center">
                <Shield size={18} className="mr-2 text-primary" />
                Activity history
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 md:p-8">
              <div className="space-y-8 relative before:absolute before:inset-0 before:left-[15px] before:w-0.5 before:bg-border/50">
                {actions.map((action, index) => (
                  <motion.div 
                    key={action.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="relative pl-10"
                  >
                    <div className="absolute left-0 top-1 w-8 h-8 rounded-full bg-card border-2 border-primary flex items-center justify-center z-10 shadow-lg">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                    </div>
                    <div className="bg-muted/30 p-4 rounded-2xl border border-border/30">
                      <p className="text-sm font-bold text-foreground">{action.paglalarawan}</p>
                      <div className="flex items-center mt-2 text-[10px] text-muted-foreground font-medium">
                        <User size={10} className="mr-1" />
                        <span>{action.actor}</span>
                        <span className="mx-2">•</span>
                        <Clock size={10} className="mr-1" />
                        <span>{formatDate(action.petsa)}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>

          <CaseHistory
            complaint={complaint}
            actions={actions}
            audit={complaint.audit || []}
            mediationAudit={complaint.mediationAudit || []}
            dispositions={complaint.dispositions || []}
            history={complaint.history || []}
          />
        </div>

        {/* Right: Chat & Admin Controls */}
        <div className={user?.role === 'mamamayan' ? 'contents' : 'space-y-6 md:space-y-8'}>
          {user?.role !== 'mamamayan' && (
            <Card className="border-border/50 shadow-xl rounded-[2rem] overflow-hidden">
              <CardHeader className="bg-primary text-primary-foreground p-6">
                <CardTitle className="text-lg font-serif italic">Admin Controls</CardTitle>
                <CardDescription className="text-primary-foreground/70">Update the complaint status.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(LABELS.STATUS).map(([key, label]) => (
                    <Button
                      key={key}
                      variant={complaint.status === key ? "default" : "outline"}
                      onClick={() => updateStatus(key)}
                      disabled={complaint.status === key || key === 'sa-mediation' || isUpdatingStatus || ['natapos', 'archived'].includes(complaint.status)}
                      className={cn(
                        "justify-start h-12 rounded-xl font-bold text-xs uppercase tracking-widest",
                        complaint.status === key ? "shadow-lg scale-105" : "border-border/50"
                      )}
                    >
                      {getStatusIcon(key)}
                      <span className="ml-2">{label}</span>
                    </Button>
                  ))}
                  
                  <div className="pt-4 border-t border-border/50 flex flex-col gap-2">
                     <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Legal Documents</p>
                     <Button
                       variant="outline"
                       onClick={() => navigate(`/reklamo/${id}/cfa`)}
                       className="justify-start h-12 rounded-xl font-bold text-xs uppercase tracking-widest border-destructive/30 text-destructive hover:bg-destructive/5"
                     >
                       <FileText size={14} className="mr-2" />
                       Certificate to File Action
                     </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>

      <Dialog open={statusToConfirm !== null} onOpenChange={(open) => {
        if (!open && !isUpdatingStatus) setStatusToConfirm(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm complaint status update</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Change status from <strong>{complaint.status}</strong> to <strong>{statusToConfirm ? LABELS.STATUS[statusToConfirm] : ''}</strong>?
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="status-remarks">Action remarks</label>
              <Textarea
                id="status-remarks"
                required
                minLength={3}
                maxLength={2000}
                value={statusRemarks}
                onChange={(event) => setStatusRemarks(event.target.value)}
                placeholder="Record the reason or action taken."
              />
            </div>
            {(statusToConfirm === 'natapos' || statusToConfirm === 'archived') && (
              <>
                <div className="rounded-md border p-3 text-sm">
                  Complaint date: {formatDate(complaint.created_at)}<br />
                  {statusToConfirm === 'natapos' ? 'Resolution' : 'Archival'} date: {new Date().toLocaleString()}<br />
                  Responsible staff member: {user?.pangalan}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="resolution-details">Resolution or archival details</label>
                  <Textarea
                    id="resolution-details"
                    required
                    minLength={10}
                    maxLength={10000}
                    value={resolutionDetails}
                    onChange={(event) => setResolutionDetails(event.target.value)}
                    placeholder="Describe the final outcome or reason for archiving."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="disposition-evidence">Optional evidence attachment</label>
                  <Input id="disposition-evidence" type="file" accept=".jpg,.jpeg,.png,.pdf,.mp4,.mov,.avi,.mkv" onChange={(event) => setDispositionFile(event.target.files?.[0] || null)} />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={isUpdatingStatus} onClick={() => setStatusToConfirm(null)}>Cancel</Button>
            <Button
              disabled={isUpdatingStatus || statusRemarks.trim().length < 3 || (['natapos', 'archived'].includes(statusToConfirm || '') && resolutionDetails.trim().length < 10)}
              onClick={confirmStatusUpdate}
            >
              {isUpdatingStatus ? 'Saving...' : 'Confirm update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={eligibilityDecision !== null} onOpenChange={(open) => {
        if (!open && !isSavingEligibility) setEligibilityDecision(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm mediation eligibility decision</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              Record this complaint as {eligibilityDecision ? 'eligible' : 'not eligible'} for mediation?
              Category: {complaint.category || 'Not classified'}.
            </p>
            <p className="text-xs text-muted-foreground">
              Eligibility is a staff determination based on the case facts and applicable law; selecting a complaint category alone does not establish eligibility.
            </p>
            <Textarea
              required
              minLength={10}
              maxLength={2000}
              value={eligibilityRemarks}
              onChange={(event) => setEligibilityRemarks(event.target.value)}
              placeholder="Enter the supporting reason for this decision."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={isSavingEligibility} onClick={() => setEligibilityDecision(null)}>Cancel</Button>
            <Button disabled={isSavingEligibility || eligibilityRemarks.trim().length < 10} onClick={saveEligibility}>
              {isSavingEligibility ? 'Saving...' : 'Confirm decision'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isLuponConfirmOpen} onOpenChange={setIsLuponConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm mediation personnel assignment</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Save {selectedLupon.length} selected Lupon member{selectedLupon.length === 1 ? '' : 's'} to this complaint?
            The assignment will be recorded in the case history.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLuponConfirmOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              setIsLuponConfirmOpen(false);
              assignLupon();
            }}>Confirm assignment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

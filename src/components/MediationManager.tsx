import { apiUrl } from '../lib/api';
import React from 'react';
import { Calendar, MapPin, FileText, CheckCircle2, Clock, AlertCircle, Printer, Upload, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Mediation } from '../types';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';

import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';

interface MediationManagerProps {
  mediation?: Mediation[];
  complaintId: number;
  isStaff: boolean;
  mediationEligible: boolean;
  onRefresh: () => void;
}

export default function MediationManager({ mediation = [], complaintId, isStaff, mediationEligible, onRefresh }: MediationManagerProps) {
  const { token } = useAuth();
  const [isScheduling, setIsScheduling] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [confirmSchedule, setConfirmSchedule] = React.useState(false);
  const [confirmOutcomeFor, setConfirmOutcomeFor] = React.useState<number | null>(null);
  const [formData, setFormData] = React.useState({
    petsa: '',
    lokasyon: 'Barangay Hall - Mediation Room',
    detalye: '',
    paraan_ng_pagpapadala: 'system',
    paraan_detalye: '',
    assigned_personnel: ''
  });
  const [isUpdating, setIsUpdating] = React.useState<number | null>(null);
  const [updateData, setUpdateData] = React.useState({
    outcome: 'settled',
    minutes: '',
    attendees: '',
    file: null as File | null
  });

  const handleSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmSchedule(true);
  };

  const submitSchedule = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(apiUrl(`/api/complaints/${complaintId}/mediation`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        toast.success('Mediation scheduled successfully.');
        setIsScheduling(false);
        setFormData({
          petsa: '',
          lokasyon: 'Barangay Hall - Mediation Room',
          detalye: '',
          paraan_ng_pagpapadala: 'system',
          paraan_detalye: '',
          assigned_personnel: ''
        });
        setConfirmSchedule(false);
        onRefresh();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Unable to save the schedule.');
      }
    } catch (error) {
      console.error('Error scheduling:', error);
      toast.error('Unable to connect to the server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateOutcome = async (mediationId: number) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('outcome', updateData.outcome);
      formData.append('status', 'tapos');
      formData.append('minutes', updateData.minutes);
      formData.append('attendees', updateData.attendees);
      if (updateData.file) {
        formData.append('document', updateData.file);
      }

      const response = await fetch(apiUrl(`/api/mediation/${mediationId}/outcome`), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        toast.success('Mediation outcome updated successfully.');
        setIsUpdating(null);
        setConfirmOutcomeFor(null);
        setUpdateData({ outcome: 'settled', minutes: '', attendees: '', file: null });
        onRefresh();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Unable to update the outcome.');
      }
    } catch (error) {
      console.error('Error updating outcome:', error);
      toast.error('Unable to connect to the server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Mediation & Schedules
        </h3>
        {isStaff && !mediationEligible && (
          <p className="text-sm text-muted-foreground">Scheduling is disabled until staff records an eligible mediation determination.</p>
        )}
        {isStaff && mediationEligible && !isScheduling && !mediation.some((item) => item.status === 'naka-iskedyul') && (
          <Button onClick={() => setIsScheduling(true)} size="sm" className="rounded-full">
            Schedule Mediation
          </Button>
        )}
      </div>

      {isScheduling && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-sm">Set Mediation Schedule</CardTitle>
          </CardHeader>
          <form onSubmit={handleSchedule}>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date and Time</Label>
                  <Input 
                    type="datetime-local" 
                    required 
                    value={formData.petsa}
                    onChange={e => setFormData({...formData, petsa: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input 
                    required 
                    value={formData.lokasyon}
                    onChange={e => setFormData({...formData, lokasyon: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Summons Delivery Method</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.paraan_ng_pagpapadala}
                    onChange={e => setFormData({...formData, paraan_ng_pagpapadala: e.target.value})}
                  >
                    <option value="system">System (Account Notification)</option>
                    <option value="telepono">Phone (Call/SMS)</option>
                    <option value="personal">In Person (Messenger Delivery)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Delivery Details</Label>
                  <Input 
                    placeholder={formData.paraan_ng_pagpapadala === 'telepono' ? 'Phone number' : formData.paraan_ng_pagpapadala === 'personal' ? 'Name of person delivering' : 'Auto-sent to account'}
                    disabled={formData.paraan_ng_pagpapadala === 'system'}
                    required={formData.paraan_ng_pagpapadala !== 'system'}
                    value={formData.paraan_detalye}
                    onChange={e => setFormData({...formData, paraan_detalye: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Assigned barangay personnel</Label>
                <Input
                  required
                  maxLength={1000}
                  placeholder="Name and position of assigned personnel"
                  value={formData.assigned_personnel}
                  onChange={e => setFormData({...formData, assigned_personnel: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label>Additional Details</Label>
                <Input 
                   placeholder="Example: Bring the required documents"
                   value={formData.detalye}
                   onChange={e => setFormData({...formData, detalye: e.target.value})}
                />
              </div>
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsScheduling(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Schedule'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {mediation.length === 0 ? (
        <div className="text-center py-10 bg-muted/30 rounded-xl border border-dashed">
          <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-20" />
          <p className="text-muted-foreground text-sm">No mediation is scheduled for this complaint.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {mediation.map((item) => (
            <Card key={item.id} className={cn(
              "overflow-hidden transition-all",
              item.status === 'naka-iskedyul' ? "border-l-4 border-l-blue-500" : 
              item.outcome === 'settled' ? "border-l-4 border-l-green-500" : "border-l-4 border-l-slate-400"
            )}>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={item.status === 'tapos' ? 'secondary' : 'default'} className="rounded-full">
                        {item.status.toUpperCase()}
                      </Badge>
                      {item.paraan_ng_pagpapadala && (
                        <Badge variant="outline" className="rounded-full text-[10px]">
                          {item.paraan_ng_pagpapadala.toUpperCase()}
                        </Badge>
                      )}
                      {item.outcome && (
                        <Badge variant="outline" className={cn(
                          "rounded-full capitalize",
                          item.outcome === 'settled' ? "text-green-600 bg-green-50 border-green-200" : "text-amber-600 bg-amber-50 border-amber-200"
                        )}>
                          {item.outcome}
                        </Badge>
                      )}
                    </div>
                    <p className="font-bold text-lg">{format(new Date(item.petsa), 'PPPP p')}</p>
                    {item.assigned_personnel && <p className="text-sm">Assigned personnel: {item.assigned_personnel}</p>}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {item.lokasyon}</span>
                    </div>
                    {item.minutes && (
                      <div className="mt-2 p-3 bg-muted rounded-lg border border-border/30 text-xs text-foreground italic whitespace-pre-wrap">
                        <p className="font-bold not-italic mb-1 uppercase text-[8px] text-muted-foreground">Meeting Minutes:</p>
                        {item.minutes}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    {isStaff && item.status === 'naka-iskedyul' && (
                      <Button variant="outline" size="sm" render={<Link to={`/mediation/${item.id}/patawag`} />} nativeButton={false}>
                        <Printer className="w-4 h-4 mr-2" /> Formal Summon
                      </Button>
                    )}
                    {isStaff && item.status === 'naka-iskedyul' && (
                      <Button size="sm" onClick={() => setIsUpdating(item.id)}>
                        Update Outcome
                      </Button>
                    )}
                    {item.status === 'tapos' && item.outcome === 'settled' && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        render={<Link to={`/reklamo/${complaintId}/kasunduan/${item.id}`} />}
                        nativeButton={false}
                        className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                      >
                        <FileText className="w-4 h-4 mr-2" /> View Settlement
                      </Button>
                    )}
                    {item.document_path && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        render={<a href={item.document_path} target="_blank" rel="noreferrer" />}
                        nativeButton={false}
                      >
                        <ExternalLink className="w-4 h-4 mr-1" /> Original File
                      </Button>
                    )}
                  </div>
                </div>

                {isUpdating === item.id && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg border space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Outcome</Label>
                        <select 
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={updateData.outcome}
                          onChange={e => setUpdateData({...updateData, outcome: e.target.value})}
                        >
                          <option value="settled">Settled</option>
                          <option value="referred">Referred for further action</option>
                          <option value="dismissed">Dismissed</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Certificate / Document (Optional)</Label>
                        <div className="flex items-center gap-2">
                          <Input 
                            type="file" 
                            className="hidden" 
                            id={`file-${item.id}`} 
                            onChange={e => setUpdateData({...updateData, file: e.target.files?.[0] || null})}
                          />
                          <Button 
                            variant="outline" 
                            className="w-full justify-start text-xs" 
                            onClick={() => document.getElementById(`file-${item.id}`)?.click()}
                          >
                            <Upload className="w-4 h-4 mr-2" /> {updateData.file ? updateData.file.name : 'Choose File'}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Meeting Minutes</Label>
                      <textarea 
                        className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder="Enter the key points discussed..."
                        value={updateData.minutes}
                        onChange={e => setUpdateData({...updateData, minutes: e.target.value})}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Attendance (parties and attendance status)</Label>
                      <textarea
                        required
                        minLength={2}
                        maxLength={5000}
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder="Record who attended and any absence."
                        value={updateData.attendees}
                        onChange={e => setUpdateData({...updateData, attendees: e.target.value})}
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setIsUpdating(null)}>Cancel</Button>
                      <Button size="sm" disabled={updateData.minutes.trim().length < 5 || updateData.attendees.trim().length < 2} onClick={() => setConfirmOutcomeFor(item.id)}>Save Outcome</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={confirmSchedule} onOpenChange={(open) => {
        if (!open && !isSubmitting) setConfirmSchedule(false);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm mediation schedule</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>Confirm the mediation schedule for Complaint #{complaintId}.</p>
            <p><strong>Schedule:</strong> {formData.petsa ? format(new Date(formData.petsa), 'PPPP p') : 'Not set'}</p>
            <p><strong>Venue:</strong> {formData.lokasyon}</p>
            <p><strong>Assigned personnel:</strong> {formData.assigned_personnel || 'Not set'}</p>
            <p><strong>Summons delivery:</strong> {formData.paraan_ng_pagpapadala}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={isSubmitting} onClick={() => setConfirmSchedule(false)}>Cancel</Button>
            <Button disabled={isSubmitting || !mediationEligible} onClick={submitSchedule}>
              {isSubmitting ? 'Saving...' : 'Confirm schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOutcomeFor !== null} onOpenChange={(open) => {
        if (!open && !isSubmitting) setConfirmOutcomeFor(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm mediation proceedings</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Record this mediation as <strong>{updateData.outcome}</strong>, including the attendance and proceedings entered for this case?
          </p>
          <DialogFooter>
            <Button variant="outline" disabled={isSubmitting} onClick={() => setConfirmOutcomeFor(null)}>Cancel</Button>
            <Button disabled={isSubmitting || confirmOutcomeFor === null} onClick={() => confirmOutcomeFor !== null && handleUpdateOutcome(confirmOutcomeFor)}>
              {isSubmitting ? 'Saving...' : 'Confirm outcome'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

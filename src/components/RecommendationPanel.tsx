import { apiUrl } from '../lib/api';
import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  Calendar,
  MapPin,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  Play,
  RotateCcw,
  Sparkles,
  Plus,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { safeJson } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from './ui/dialog';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

export interface RecommendationItem {
  id: number;
  title: string;
  recommendation_type: 'seasonal' | 'report_based' | 'zone_based' | 'risk_based';
  category?: string | null;
  zone?: string | null;
  risk_level: 'low' | 'moderate' | 'high' | 'critical' | 'insufficient_data';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  recommended_action: string;
  rationale: string;
  supporting_stats?: any;
  timeframe: string;
  responsible_office: string;
  status: 'suggested' | 'under_review' | 'approved' | 'in_progress' | 'completed' | 'dismissed';
  notes?: string | null;
  actioned_at?: string | null;
  created_at: string;
}

const TYPE_LABELS: Record<string, { label: string; badge: string }> = {
  seasonal: { label: 'Seasonal Pattern', badge: 'bg-blue-500/10 text-blue-500 border-blue-500/30' },
  report_based: { label: 'Complaint Backlog', badge: 'bg-purple-500/10 text-purple-500 border-purple-500/30' },
  zone_based: { label: 'Zone Pattern', badge: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' },
  risk_based: { label: 'High Risk Alert', badge: 'bg-rose-500/10 text-rose-500 border-rose-500/30' },
};

const PRIORITY_BADGES: Record<string, string> = {
  urgent: 'bg-red-500 text-white font-bold',
  high: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
  low: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: any }> = {
  suggested: { label: 'Suggested', badge: 'bg-slate-500/15 text-slate-400', icon: Sparkles },
  under_review: { label: 'Under Review', badge: 'bg-blue-500/15 text-blue-500', icon: Clock },
  approved: { label: 'Approved', badge: 'bg-indigo-500/15 text-indigo-500', icon: ShieldCheck },
  in_progress: { label: 'In Progress', badge: 'bg-amber-500/15 text-amber-500', icon: Play },
  completed: { label: 'Completed', badge: 'bg-emerald-500/15 text-emerald-500', icon: CheckCircle2 },
  dismissed: { label: 'Dismissed', badge: 'bg-zinc-500/15 text-zinc-500', icon: X },
};

export default function RecommendationPanel({
  recommendations = [],
  onUpdateStatus,
  filterType,
  title = 'Preventive Action Recommendations',
  description = 'Evidence-based intervention plans generated from historical complaint patterns and predictive risk assessments.',
}: {
  recommendations: RecommendationItem[];
  onUpdateStatus?: (id: number, status: string, notes?: string) => Promise<void>;
  filterType?: string;
  title?: string;
  description?: string;
}) {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'completed'>('all');
  const [selectedType, setSelectedType] = useState<string>(filterType || 'all');
  const [isUpdating, setIsUpdating] = useState<number | null>(null);
  const [noteModalItem, setNoteModalItem] = useState<{ id: number; targetStatus: string } | null>(null);
  const [adminNote, setAdminNote] = useState('');

  // Create modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<'seasonal' | 'report_based' | 'zone_based' | 'risk_based'>('zone_based');
  const [newZone, setNewZone] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('high');
  const [newAction, setNewAction] = useState('');
  const [newRationale, setNewRationale] = useState('');
  const [newTimeframe, setNewTimeframe] = useState('Next 7 Days');
  const [newOffice, setNewOffice] = useState('Barangay San Andres Council');

  const filtered = recommendations.filter((r) => {
    if (selectedType !== 'all' && r.recommendation_type !== selectedType) return false;
    if (activeTab === 'pending') {
      return ['suggested', 'under_review', 'approved', 'in_progress'].includes(r.status);
    }
    if (activeTab === 'completed') {
      return r.status === 'completed' || r.status === 'dismissed';
    }
    return true;
  });

  const handleStatusChange = async (id: number, status: string, promptNote = false) => {
    if (promptNote) {
      setNoteModalItem({ id, targetStatus: status });
      setAdminNote('');
      return;
    }
    await executeUpdate(id, status);
  };

  const executeUpdate = async (id: number, status: string, notes?: string) => {
    try {
      setIsUpdating(id);
      if (onUpdateStatus) {
        await onUpdateStatus(id, status, notes);
      } else {
        const res = await fetch(apiUrl(`/api/analytics/recommendations/${id}`), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status, notes }),
        });
        if (!res.ok) throw new Error('Failed to update recommendation.');
        toast.success(`Recommendation status updated to ${STATUS_CONFIG[status]?.label || status}.`);
      }
    } catch (e: any) {
      toast.error(e.message || 'Error updating status.');
    } finally {
      setIsUpdating(null);
      setNoteModalItem(null);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newAction.trim()) {
      toast.error('Title and Recommended Action are required.');
      return;
    }

    try {
      const res = await fetch(apiUrl('/api/analytics/recommendations'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newTitle,
          recommendation_type: newType,
          category: newCategory || null,
          zone: newZone || null,
          priority: newPriority,
          recommended_action: newAction,
          rationale: newRationale,
          timeframe: newTimeframe,
          responsible_office: newOffice,
        }),
      });

      if (!res.ok) throw new Error('Failed to record recommendation.');
      toast.success('New preventive action plan created successfully.');
      setIsCreateOpen(false);
      setNewTitle('');
      setNewAction('');
      setNewRationale('');
      if (onUpdateStatus) {
        onUpdateStatus(-1, 'refresh');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error creating recommendation.');
    }
  };

  return (
    <Card className="border-border/70 shadow-lg overflow-hidden">
      <CardHeader className="bg-muted/30 border-b border-border/60 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-serif italic font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {title}
            </CardTitle>
            <CardDescription className="text-xs mt-1">{description}</CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger render={<Button size="sm" className="gap-1.5 text-xs h-8" />}>
                <Plus className="w-3.5 h-3.5" />
                Add Action Plan
              </DialogTrigger>
              <DialogContent className="sm:max-w-[550px]">
                <form onSubmit={handleCreateSubmit}>
                  <DialogHeader>
                    <DialogTitle className="text-lg font-bold">New Preventive Recommendation</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 py-3 text-xs">
                    <div>
                      <label className="font-semibold block mb-1">Title</label>
                      <Input
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="e.g., Pre-typhoon Canal Declogging Drive"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-semibold block mb-1">Type</label>
                        <select
                          className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs"
                          value={newType}
                          onChange={(e: any) => setNewType(e.target.value)}
                        >
                          <option value="seasonal">Seasonal</option>
                          <option value="report_based">Report-Based</option>
                          <option value="zone_based">Zone-Based</option>
                          <option value="risk_based">Risk-Based</option>
                        </select>
                      </div>
                      <div>
                        <label className="font-semibold block mb-1">Priority</label>
                        <select
                          className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs"
                          value={newPriority}
                          onChange={(e: any) => setNewPriority(e.target.value)}
                        >
                          <option value="urgent">Urgent</option>
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-semibold block mb-1">Target Zone (Optional)</label>
                        <Input
                          value={newZone}
                          onChange={(e) => setNewZone(e.target.value)}
                          placeholder="e.g., Eastbank Floodway"
                        />
                      </div>
                      <div>
                        <label className="font-semibold block mb-1">Responsible Office</label>
                        <Input
                          value={newOffice}
                          onChange={(e) => setNewOffice(e.target.value)}
                          placeholder="e.g., BPSO / BDRRMC"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">Recommended Preventive Action</label>
                      <Textarea
                        rows={3}
                        value={newAction}
                        onChange={(e) => setNewAction(e.target.value)}
                        placeholder="Detailed operational steps to be taken..."
                        required
                      />
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">Analytical Rationale</label>
                      <Textarea
                        rows={2}
                        value={newRationale}
                        onChange={(e) => setNewRationale(e.target.value)}
                        placeholder="Why is this intervention recommended..."
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" type="button" onClick={() => setIsCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Save Recommendation</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters and Sub-tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-1">
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/50 text-xs">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                activeTab === 'all' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({recommendations.length})
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                activeTab === 'pending' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Active / In Progress (
              {recommendations.filter((r) => ['suggested', 'under_review', 'approved', 'in_progress'].includes(r.status)).length}
              )
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                activeTab === 'completed' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Completed / Dismissed (
              {recommendations.filter((r) => r.status === 'completed' || r.status === 'dismissed').length}
              )
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Category:</span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-muted/60 border border-border/50 rounded px-2.5 py-1 text-xs font-medium text-foreground focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="seasonal">Seasonal Pattern</option>
              <option value="report_based">Report-Based</option>
              <option value="zone_based">Zone-Based</option>
              <option value="risk_based">Risk-Based</option>
            </select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground space-y-2">
            <ShieldCheck className="w-10 h-10 mx-auto text-muted-foreground/60" />
            <p className="font-semibold text-sm">No recommendations found matching your criteria.</p>
            <p className="text-xs">Adjust your status or type filters to view other recommendations.</p>
          </div>
        ) : (
          filtered.map((item) => {
            const typeInfo = TYPE_LABELS[item.recommendation_type] || { label: 'General', badge: 'bg-muted' };
            const statusInfo = STATUS_CONFIG[item.status] || STATUS_CONFIG.suggested;
            const StatusIcon = statusInfo.icon;
            const isItemBusy = isUpdating === item.id;

            return (
              <div
                key={item.id}
                className="group relative rounded-xl border border-border/60 bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md space-y-3"
              >
                {/* Header row */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1 max-w-[75%]">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] uppercase font-bold ${typeInfo.badge}`}>
                        {typeInfo.label}
                      </Badge>
                      <Badge className={`text-[10px] uppercase ${PRIORITY_BADGES[item.priority] || ''}`}>
                        {item.priority} Priority
                      </Badge>
                      {item.zone && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-primary" /> {item.zone}
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-sm text-foreground leading-snug">{item.title}</h4>
                  </div>

                  <Badge variant="outline" className={`text-xs gap-1 py-1 px-2.5 font-semibold ${statusInfo.badge}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {statusInfo.label}
                  </Badge>
                </div>

                {/* Body Content */}
                <div className="text-xs space-y-2">
                  <div className="bg-primary/5 border border-primary/15 rounded-lg p-3">
                    <span className="font-bold text-primary block text-[11px] mb-1 uppercase tracking-wide">
                      Recommended Preventive Action:
                    </span>
                    <p className="text-foreground leading-relaxed font-medium">{item.recommended_action}</p>
                  </div>

                  {item.rationale && (
                    <div className="text-muted-foreground text-[11px] leading-relaxed">
                      <strong className="text-foreground">Analytical Evidence: </strong>
                      {item.rationale}
                    </div>
                  )}

                  {item.notes && (
                    <div className="text-[11px] bg-muted/40 border border-border/50 rounded p-2 text-foreground">
                      <strong className="text-primary">Admin Action Notes: </strong>
                      {item.notes}
                    </div>
                  )}
                </div>

                {/* Footer metadata & Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-3">
                    <span>
                      <strong className="text-foreground">Lead:</strong> {item.responsible_office}
                    </span>
                    <span>&bull;</span>
                    <span>
                      <strong className="text-foreground">Target:</strong> {item.timeframe}
                    </span>
                  </div>

                  {/* Operational Status Action Buttons */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    {item.status === 'suggested' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isItemBusy}
                        className="h-7 text-[11px] gap-1 hover:border-blue-500 hover:text-blue-500"
                        onClick={() => handleStatusChange(item.id, 'under_review')}
                      >
                        <Clock className="w-3 h-3" /> Acknowledge
                      </Button>
                    )}

                    {(item.status === 'suggested' || item.status === 'under_review') && (
                      <Button
                        size="sm"
                        variant="default"
                        disabled={isItemBusy}
                        className="h-7 text-[11px] gap-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                        onClick={() => handleStatusChange(item.id, 'approved')}
                      >
                        <Check className="w-3 h-3" /> Approve
                      </Button>
                    )}

                    {item.status === 'approved' && (
                      <Button
                        size="sm"
                        variant="default"
                        disabled={isItemBusy}
                        className="h-7 text-[11px] gap-1 bg-amber-600 hover:bg-amber-700 text-white"
                        onClick={() => handleStatusChange(item.id, 'in_progress')}
                      >
                        <Play className="w-3 h-3" /> Start Action
                      </Button>
                    )}

                    {item.status === 'in_progress' && (
                      <Button
                        size="sm"
                        variant="default"
                        disabled={isItemBusy}
                        className="h-7 text-[11px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleStatusChange(item.id, 'completed', true)}
                      >
                        <CheckCircle2 className="w-3 h-3" /> Mark Completed
                      </Button>
                    )}

                    {['suggested', 'under_review'].includes(item.status) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isItemBusy}
                        className="h-7 text-[11px] text-muted-foreground hover:text-destructive"
                        onClick={() => handleStatusChange(item.id, 'dismissed', true)}
                      >
                        <X className="w-3 h-3" /> Dismiss
                      </Button>
                    )}

                    {item.status === 'dismissed' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isItemBusy}
                        className="h-7 text-[11px] gap-1 text-muted-foreground"
                        onClick={() => handleStatusChange(item.id, 'suggested')}
                      >
                        <RotateCcw className="w-3 h-3" /> Reopen
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>

      {/* Admin Notes Dialog */}
      {noteModalItem && (
        <Dialog open={true} onOpenChange={() => setNoteModalItem(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                {noteModalItem.targetStatus === 'completed' ? 'Complete Intervention' : 'Dismiss Recommendation'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs">
              <p className="text-muted-foreground">
                {noteModalItem.targetStatus === 'completed'
                  ? 'Record details of preventive steps completed by barangay personnel:'
                  : 'Specify reason for dismissing this analytical recommendation:'}
              </p>
              <Textarea
                rows={3}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Optional notes or operational summary..."
              />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setNoteModalItem(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant={noteModalItem.targetStatus === 'completed' ? 'default' : 'destructive'}
                onClick={() => executeUpdate(noteModalItem.id, noteModalItem.targetStatus, adminNote)}
              >
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

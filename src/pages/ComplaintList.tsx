import { apiUrl } from '../lib/api';
import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Complaint } from '../types';
import { LABELS } from '../constants';
import { AlertCircle, CheckCircle2, Clock, FilePlus2, Filter, Search, ChevronRight, CalendarDays, TriangleAlert, Archive, RotateCcw, Trash2, ArrowUpDown } from 'lucide-react';
import { safeJson } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { categoryForType, SEVERITY_INFO, severityForType, type ComplaintSeverity } from '../data/complaintSeverity';

export default function ComplaintList() {
  const { token, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [complaints, setComplaints] = React.useState<Complaint[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState(searchParams.get('status') || 'all');
  const [dateRange, setDateRange] = React.useState(searchParams.get('range') || '30d');
  const [sortBy, setSortBy] = React.useState<'severity' | 'date' | 'status'>(
    (searchParams.get('sort') as 'severity' | 'date' | 'status') || 'severity'
  );
  const categoryFilter = searchParams.get('category') || '';
  const typeFilter = searchParams.get('type') || '';
  const [showRecycleBin, setShowRecycleBin] = React.useState(false);

  React.useEffect(() => {
    setFilterStatus(searchParams.get('status') || 'all');
    setDateRange(searchParams.get('range') || '30d');
    const sortParam = searchParams.get('sort');
    if (sortParam === 'severity' || sortParam === 'date' || sortParam === 'status') {
      setSortBy(sortParam);
    }
  }, [searchParams]);

  React.useEffect(() => {
    setLoading(true);
    const endpoint = user?.role === 'mamamayan'
      ? apiUrl('/api/complaints?scope=mine')
      : apiUrl(`/api/complaints${showRecycleBin ? '?recycle_bin=1' : ''}`);
    fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = await safeJson(response);
        if (!response.ok) throw new Error(data.error || 'Failed to fetch complaints.');
        setComplaints(Array.isArray(data) ? data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) : []);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Failed to fetch complaints.'))
      .finally(() => setLoading(false));
  }, [token, user?.role, showRecycleBin]);

  const updateRecycleBin = async (complaint: Complaint, restore: boolean) => {
    const reference = complaint.blotter_number || `#${complaint.id}`;
    const confirmation = restore
      ? `Restore complaint ${reference} from the recycle bin?`
      : `Move complaint ${reference} to the recycle bin?`;
    if (!window.confirm(confirmation)) return;
    try {
      const response = await fetch(restore
        ? apiUrl(`/api/admin/complaints/${complaint.id}/restore`)
        : apiUrl(`/api/admin/complaints/${complaint.id}`), {
        method: restore ? 'PATCH' : 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await safeJson(response);
      if (!response.ok) throw new Error(data.error || 'Unable to update complaint.');
      setComplaints((current) => current.filter((item) => item.id !== complaint.id));
      toast.success(restore ? 'Complaint restored.' : 'Complaint moved to the recycle bin.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update complaint.');
    }
  };

  const filteredComplaints = complaints.filter((complaint) => {
    const matchesSearch = `${complaint.uri_ng_reklamo} ${complaint.detalye}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all'
      || (filterStatus === 'active' ? complaint.status !== 'bago' && complaint.status !== 'natapos' && complaint.status !== 'archived' : complaint.status === filterStatus);
    const matchesCategory = !categoryFilter || categoryForType(complaint.uri_ng_reklamo) === categoryFilter;
    const matchesType = !typeFilter || complaint.uri_ng_reklamo === typeFilter;
    return matchesSearch && matchesStatus && matchesCategory && matchesType;
  });

  const statusIcon = (status: string) => status === 'bago'
    ? <AlertCircle size={14} />
    : status === 'natapos'
      ? <CheckCircle2 size={14} />
      : <Clock size={14} />;

  const cutoffDate = dateRange === 'all' ? null : new Date();
  if (cutoffDate && dateRange === '7d') cutoffDate.setDate(cutoffDate.getDate() - 7);
  if (cutoffDate && dateRange === '30d') cutoffDate.setDate(cutoffDate.getDate() - 30);
  if (cutoffDate && dateRange === '12m') cutoffDate.setMonth(cutoffDate.getMonth() - 12);
  const dateFilteredComplaints = filteredComplaints.filter((complaint) => !cutoffDate || new Date(complaint.created_at) >= cutoffDate);
  const severityRank: Record<ComplaintSeverity, number> = { red: 0, orange: 1, yellow: 2 };
  const statusRank: Record<string, number> = {
    bago: 0,
    sinusuri: 1,
    'naka-assign': 2,
    iniimbestigahan: 3,
    'naka-iskedyul': 4,
    'sa-mediation': 5,
    natapos: 6,
    archived: 7,
  };

  const sortedComplaints = [...dateFilteredComplaints].sort((a, b) => {
    if (sortBy === 'severity') {
      const diff = severityRank[severityForType(a.uri_ng_reklamo)] - severityRank[severityForType(b.uri_ng_reklamo)];
      if (diff !== 0) return diff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    if (sortBy === 'status') {
      const diff = (statusRank[a.status] ?? 99) - (statusRank[b.status] ?? 99);
      if (diff !== 0) return diff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    // sortBy === 'date': Newest first
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  if (user?.role !== 'mamamayan') {
    const severityCounts = (['red', 'orange', 'yellow'] as ComplaintSeverity[]).map((severity) => ({
      severity,
      count: dateFilteredComplaints.filter((complaint) => severityForType(complaint.uri_ng_reklamo) === severity).length,
    }));

    return (
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground md:text-3xl">{showRecycleBin ? 'Recycle Bin' : 'Complaints'}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{showRecycleBin ? 'Deleted complaints are hidden from public lists and the heatmap. Restore them here.' : 'Review incoming reports by priority and filing date.'}</p>
          </div>
          {user?.role === 'admin' && <Button type="button" size="icon" variant="outline" title={showRecycleBin ? 'Back to complaints' : 'Recycle Bin'} aria-label={showRecycleBin ? 'Back to complaints' : 'Open recycle bin'} onClick={() => { setShowRecycleBin((current) => !current); setFilterStatus('all'); setDateRange('all'); }}>
            {showRecycleBin ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          </Button>}
        </header>

        {!showRecycleBin && <p className="flex items-center gap-2 text-xs leading-relaxed text-muted-foreground"><TriangleAlert size={14} className="shrink-0" />Red indicates urgent safety or health concerns. Orange indicates significant hazards or access issues. Yellow indicates routine concerns. Priority is a review aid; staff should consider the reported circumstances and applicable procedures.</p>}

        <section className="grid grid-cols-3 gap-3" aria-label="Complaint severity summary">
          {severityCounts.map(({ severity, count }) => {
            const info = SEVERITY_INFO[severity];
            return <Card key={severity} className={`h-full min-w-0 border ${info.className}`}>
              <CardContent className="p-3 md:p-4">
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0"><p className="truncate text-[10px] font-bold uppercase tracking-wider md:text-xs">{info.label} priority</p><p className="mt-1 text-2xl font-bold tabular-nums md:text-3xl">{count}</p></div>
                  <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: info.color }} />
                </div>
                <p className="mt-1 text-[10px] opacity-80">{info.priority} review</p>
                <div className="mt-3 hidden max-h-24 space-y-1 overflow-y-auto border-t border-current/15 pt-2 sm:block">
                  {dateFilteredComplaints.filter((complaint) => severityForType(complaint.uri_ng_reklamo) === severity).length ? dateFilteredComplaints.filter((complaint) => severityForType(complaint.uri_ng_reklamo) === severity).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((complaint) => <Link key={complaint.id} to={`/complaints/${complaint.id}`} className="block truncate text-[10px] hover:underline"><time>{new Date(complaint.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</time> · {complaint.blotter_number || `#${complaint.id}`} · {complaint.uri_ng_reklamo}</Link>) : <p className="text-[10px] opacity-70">No reports in range</p>}
                </div>
              </CardContent>
            </Card>;
          })}
        </section>

        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search complaints" placeholder="Search ID, category, type, or details..." className="h-10 pl-10" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              value={sortBy}
              onValueChange={(value: 'severity' | 'date' | 'status') => {
                setSortBy(value);
                setSearchParams((current) => {
                  const next = new URLSearchParams(current);
                  next.set('sort', value);
                  return next;
                });
              }}
            >
              <SelectTrigger className="h-10 w-full sm:w-44">
                <ArrowUpDown className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="severity">Sort By: Severity</SelectItem>
                <SelectItem value="date">Sort By: Date</SelectItem>
                <SelectItem value="status">Sort By: Status</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={dateRange}
              onValueChange={(value) => {
                setDateRange(value);
                setSearchParams((current) => {
                  const next = new URLSearchParams(current);
                  next.set('range', value);
                  return next;
                });
              }}
            >
              <SelectTrigger className="h-10 w-full sm:w-40">
                <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="12m">Last 12 months</SelectItem>
                <SelectItem value="all">All dates</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filterStatus}
              onValueChange={(value) => {
                setFilterStatus(value);
                setSearchParams((current) => {
                  const next = new URLSearchParams(current);
                  next.set('status', value);
                  return next;
                });
              }}
            >
              <SelectTrigger className="h-10 w-full sm:w-40">
                <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="bago">New</SelectItem>
                <SelectItem value="active">In progress</SelectItem>
                <SelectItem value="natapos">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {(categoryFilter || typeFilter) && <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          Showing {typeFilter || categoryFilter} complaints
          <Button size="sm" variant="ghost" onClick={() => setSearchParams({ status: filterStatus, range: dateRange, sort: sortBy })}>Clear category filter</Button>
        </div>}

        <Card className="overflow-hidden border-border/60 shadow-sm">
          <CardContent className="p-0">
            <div className="max-h-[58vh] overflow-auto">
              <table className="w-full min-w-[940px] border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
                  <tr className="border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Priority</th><th className="px-4 py-3">ID</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Complaint type</th><th className="px-4 py-3">Zone</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {loading ? <tr><td colSpan={8} className="p-10 text-center text-sm text-muted-foreground">Loading complaints...</td></tr>
                    : sortedComplaints.length === 0 ? <tr><td colSpan={8} className="p-10 text-center text-sm text-muted-foreground">{showRecycleBin ? 'The recycle bin is empty.' : 'No complaints match the selected filters.'}</td></tr>
                    : sortedComplaints.map((complaint) => {
                      const severity = severityForType(complaint.uri_ng_reklamo);
                      const info = SEVERITY_INFO[severity];
                      const unread = !showRecycleBin && complaint.is_read !== true && Number(complaint.is_read) !== 1;
                      return <tr key={complaint.id} className={`transition-colors ${unread ? 'bg-amber-50/80 font-semibold text-foreground hover:bg-amber-100/80 dark:bg-amber-950/25 dark:hover:bg-amber-950/40' : 'hover:bg-muted/30'}`}>
                        <td className="px-4 py-3"><Badge variant="outline" className={`gap-1.5 ${info.className}`}><span className="h-2 w-2 rounded-full" style={{ backgroundColor: info.color }} />{info.label}</Badge></td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{complaint.blotter_number || `#${complaint.id}`}</td>
                        <td className="px-4 py-3 text-xs">{new Date(complaint.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        <td className="px-4 py-3 text-xs">{categoryForType(complaint.uri_ng_reklamo)}</td>
                        <td className="px-4 py-3 text-sm font-medium">{complaint.uri_ng_reklamo}</td>
                        <td className="px-4 py-3 text-xs">{[complaint.zone, complaint.street_name].filter(Boolean).join(', ') || '—'}</td>
                        <td className="px-4 py-3"><Badge variant={complaint.status === 'bago' ? 'destructive' : complaint.status === 'natapos' ? 'secondary' : 'default'}>{LABELS.STATUS[complaint.status] || 'In progress'}</Badge></td>
                        <td className="px-4 py-3 text-right"><div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" render={<Link to={`/complaints/${complaint.id}`} />} nativeButton={false}>Open</Button>
                          {user?.role === 'admin' && (showRecycleBin
                            ? <Button type="button" size="icon-sm" variant="ghost" title="Restore complaint" aria-label={`Restore complaint ${complaint.blotter_number || complaint.id}`} onClick={() => void updateRecycleBin(complaint, true)}><RotateCcw /></Button>
                            : <Button type="button" size="icon-sm" variant="ghost" title="Move to recycle bin" aria-label={`Delete complaint ${complaint.blotter_number || complaint.id}`} onClick={() => void updateRecycleBin(complaint, false)}><Trash2 /></Button>)}
                        </div></td>
                      </tr>;
                    })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
              Showing {sortedComplaints.length} complaint(s) (Sorted by {sortBy === 'severity' ? 'Severity (Urgent first)' : sortBy === 'status' ? 'Status (Workflow order)' : 'Date (Newest first)'}).
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 md:space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground md:text-3xl">Complaints</h1>
          <p className="mt-1 text-sm text-muted-foreground">Review filed complaints and follow their progress.</p>
        </div>
        {user?.role === 'mamamayan' && (
          <Button render={<Link to="/complaints/new" />} nativeButton={false} className="h-11 px-5 font-semibold">
            <FilePlus2 className="mr-2 h-4 w-4" /> File Now
          </Button>
        )}
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search complaints" placeholder="Search complaints..." className="h-11 pl-10" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-11 w-full sm:w-48"><Filter className="mr-2 h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Filter by status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="bago">New</SelectItem>
            <SelectItem value="active">In progress</SelectItem>
            <SelectItem value="natapos">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden border-border/60 shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Loading complaints...</div>
        ) : filteredComplaints.length === 0 ? (
          <CardContent className="flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground"><FilePlus2 size={22} /></div>
            <h2 className="text-base font-semibold text-foreground">{complaints.length ? 'No matching complaints' : 'No complaints filed yet'}</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{complaints.length ? 'Try changing your search or status filter.' : 'When you file a complaint, you can track its review and progress here.'}</p>
            {!complaints.length && user?.role === 'mamamayan' && <Button render={<Link to="/complaints/new" />} nativeButton={false} className="mt-5">File Now</Button>}
          </CardContent>
        ) : (
          <div className="divide-y divide-border/60">
            {filteredComplaints.map((complaint) => (
              <Link key={complaint.id} to={`/complaints/${complaint.id}`} className="group block p-5 transition-colors hover:bg-muted/30 md:px-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">#{complaint.blotter_number || complaint.id}</span>
                      <Badge variant={complaint.status === 'bago' ? 'destructive' : complaint.status === 'natapos' ? 'secondary' : 'default'} className="inline-flex items-center gap-1.5">
                        {statusIcon(complaint.status)}{LABELS.STATUS[complaint.status] || 'In progress'}
                      </Badge>
                    </div>
                    <h2 className="font-semibold text-foreground">{complaint.uri_ng_reklamo}</h2>
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{complaint.detalye}</p>
                    <p className="mt-3 text-xs text-muted-foreground">Filed {new Date(complaint.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                  <ChevronRight className="mt-5 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
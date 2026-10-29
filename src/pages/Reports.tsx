import { apiUrl } from '../lib/api';
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Download, TrendingUp, Users, AlertTriangle, ArrowUpRight, MapPinned, BarChart3, Percent, Target, CheckCircle2, MapPin, Brain, Sparkles, ChevronRight } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
  PieChart,
  Pie,
  LineChart,
  Line,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { motion } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { safeJson } from '../lib/utils';
import { LABELS } from '../constants';
import { getComplaintHeatColor } from '../lib/complaintHeatmap';

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
const CHART_TICK = { fontSize: 12, fill: 'var(--foreground)' };
const TOOLTIP_STYLE = {
  borderRadius: '12px',
  border: '1px solid var(--border)',
  backgroundColor: 'var(--popover)',
  color: 'var(--popover-foreground)',
  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.35)',
};

export default function Reports() {
  const { token } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [reportScope, setReportScope] = useState<'all' | 'resident' | 'non-resident'>('all');

  useEffect(() => {
    setStats(null);
    fetch(apiUrl(`/api/stats?scope=${reportScope}`), { headers: { Authorization: `Bearer ${token}` }})
      .then(safeJson)
      .then((data) => setStats(data || null))
      .catch(() => setStats(null));
  }, [token, reportScope]);

  const efficiency = stats?.efficiencyRate ?? (stats?.total ? Math.round(((stats.completed || 0) / stats.total) * 100) : 0);
  const completedCount = Number(stats?.completed || 0);
  const totalCount = Number(stats?.total || 0);
  const successRate = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
  const residentCount = Number(stats?.demographicDifference?.residentCount || 0);
  const nonResidentCount = Number(stats?.demographicDifference?.nonResidentCount || 0);
  const demographicTotal = residentCount + nonResidentCount;
  const demographicDifference = Math.abs(residentCount - nonResidentCount);
  const chartData = useMemo(() => {
    if (!stats?.weeklyTrend || !stats.weeklyTrend.length) {
      return [];
    }

    const counts = new Map<string, number>(stats.weeklyTrend.map((entry: any) => [entry.week_start, Number(entry.count || 0)]));
    const today = new Date();
    const latestWeek = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    latestWeek.setUTCDate(latestWeek.getUTCDate() - ((latestWeek.getUTCDay() + 6) % 7));
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(latestWeek);
      date.setUTCDate(date.getUTCDate() - (11 - index) * 7);
      const weekStart = date.toISOString().slice(0, 10);
      return {
        week: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
        complaints: counts.get(weekStart) || 0,
      };
    });
  }, [stats]);
  const statusSummary = useMemo(() => (stats?.statusSummary || []).map((entry: any) => ({
    ...entry,
    label: LABELS.STATUS[entry.label as keyof typeof LABELS.STATUS] || entry.label,
  })), [stats]);
  const hotspotChartData = useMemo(() => (stats?.byZone || []).map((entry: any, index: number) => ({
    zone: entry.zone,
    count: Number(entry.count || 0),
    color: COLORS[index % COLORS.length],
  })), [stats]);

  const handleExport = () => {
    window.print();
  };

  if (!stats) {
    return <div className="flex items-center justify-center h-[60vh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="reports-page mx-auto space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="report-header flex items-center justify-between"
      >
        <h1 className="text-3xl font-serif italic font-bold">Reports and Analytics</h1>
        <div className="report-controls flex items-center gap-3">
          <div className="hidden print:hidden flex items-center gap-2 mr-1">
            <Link
              to="/reports/trends"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/60 bg-card text-xs font-semibold text-foreground hover:border-primary/50 hover:bg-primary/5 transition-all shadow-xs"
            >
              <TrendingUp size={13} className="text-primary" />
              Trend Analysis
              <ChevronRight size={12} className="text-muted-foreground" />
            </Link>
            <Link
              to="/reports/predictions"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/40 bg-primary/5 text-xs font-semibold text-primary hover:bg-primary/10 transition-all shadow-xs"
            >
              <Sparkles size={13} />
              AI Prediction
              <ChevronRight size={12} className="text-primary/60" />
            </Link>
          </div>
          <div className="flex rounded-xl border border-border/50 bg-muted/30 p-1" role="group" aria-label="Report scope">
            {[
              { value: 'all', label: 'Combined' },
              { value: 'resident', label: 'Residents' },
              { value: 'non-resident', label: 'Non-Residents' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setReportScope(option.value as typeof reportScope)}
                className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${reportScope === option.value ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleExport}
            className="bg-primary text-white px-6 py-2 rounded-xl font-bold flex items-center space-x-2 hover:opacity-90 transition-opacity shadow-lg"
          >
            <Download size={18} />
            <span>Export (PDF)</span>
          </button>
        </div>
      </motion.div>

      <div className="report-stat-grid grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {[
          { title: 'Efficiency Rate', value: efficiency, suffix: '%', decimals: 0, trend: 'Resolved vs total', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
          { title: 'Total Complaints', value: Number(stats.total || 0), suffix: '', decimals: 0, trend: 'All filed cases', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { title: 'Average Response', value: Number(stats.responseTime || 0), suffix: ' days', decimals: 1, trend: 'Resolution cycle', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
          { title: 'Active Cases', value: Number(stats.ongoing || 0), suffix: '', decimals: 0, trend: 'Currently progressing', icon: BarChart3, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((item, idx) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card className="report-card report-stat-card border-border/50 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 md:p-5">
                <div className={cn("report-stat-icon w-10 h-10 rounded-2xl flex items-center justify-center mb-4", item.bg, item.color)}>
                  <item.icon size={18} />
                </div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{item.title}</h3>
                <p className="text-2xl font-serif italic font-bold text-foreground"><CountUp value={item.value} decimals={item.decimals} suffix={item.suffix} /></p>
                <p className={cn("text-[10px] mt-2 font-bold", item.color)}>{item.trend}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="report-chart-grid grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
        <Card className="report-card report-chart-card border-border/50 shadow-xl overflow-hidden">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-lg font-serif italic flex items-center">
              <MapPinned className="mr-2 h-5 w-5 text-primary" />
              Barangay Hotspots
            </CardTitle>
            <CardDescription>Complaint concentration per zone for better operational planning.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(150px,0.8fr)]">
              <div className="report-chart h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={hotspotChartData}
                      dataKey="count"
                      nameKey="zone"
                      cx="50%"
                      cy="50%"
                      outerRadius="78%"
                      paddingAngle={2}
                      isAnimationActive
                      animationBegin={120}
                      animationDuration={1000}
                      animationEasing="ease-out"
                    >
                      {hotspotChartData.map((entry: any, index: number) => (
                        <Cell key={`zone-slice-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: 'var(--popover-foreground)' }} itemStyle={{ color: 'var(--popover-foreground)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-1 gap-2 text-xs">
                {hotspotChartData.map((entry: any, index: number) => (
                  <div key={`${entry.zone}-${index}`} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="truncate font-semibold text-foreground">{entry.zone}</span>
                    </span>
                    <strong className="shrink-0 tabular-nums text-foreground">{entry.count}</strong>
                  </div>
                ))}
                {hotspotChartData.length === 0 && <p className="text-muted-foreground">No zone complaint data to display.</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="report-card report-chart-card border-border/50 shadow-xl overflow-hidden">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-lg font-serif italic flex items-center">
              <Target className="mr-2 h-5 w-5 text-primary" />
              Complaint Progression
            </CardTitle>
            <CardDescription>Stage-by-stage status flow for active cases.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="report-chart h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusSummary} margin={{ top: 18, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={CHART_TICK} />
                  <YAxis axisLine={false} tickLine={false} tick={CHART_TICK} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: 'var(--popover-foreground)' }} itemStyle={{ color: 'var(--popover-foreground)' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive animationBegin={260} animationDuration={1100} animationEasing="ease-out">
                    {statusSummary.map((entry: any, index: number) => (
                      <Cell key={`status-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                    <LabelList dataKey="count" position="top" offset={6} fill="var(--foreground)" fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="report-card report-chart-card border-border/50 shadow-xl overflow-hidden">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-lg font-serif italic flex items-center">
              <TrendingUp className="mr-2 h-5 w-5 text-primary" />
              Weekly Trend
            </CardTitle>
            <CardDescription>Complaints filed each week over the latest 12 weeks.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="report-chart h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 18, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="week" axisLine={false} tickLine={false} tick={CHART_TICK} interval={1} angle={-30} textAnchor="end" height={48} />
                  <YAxis axisLine={false} tickLine={false} tick={CHART_TICK} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: 'var(--popover-foreground)' }} itemStyle={{ color: 'var(--popover-foreground)' }} />
                  <Line type="monotone" dataKey="complaints" stroke="var(--chart-1)" strokeWidth={3} dot={{ r: 4 }} isAnimationActive animationBegin={220} animationDuration={1300} animationEasing="ease-out">
                    <LabelList dataKey="complaints" position="top" offset={8} fill="var(--foreground)" fontSize={10} />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="report-card report-chart-card border-border/50 shadow-xl overflow-hidden">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-lg font-serif italic flex items-center">
              <CheckCircle2 className="mr-2 h-5 w-5 text-primary" />
              Outcome & Efficiency
            </CardTitle>
            <CardDescription>Completion rate and disposition summary.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="report-chart h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.outcomeSummary || []} dataKey="count" nameKey="label" innerRadius={50} outerRadius={90} paddingAngle={3} isAnimationActive animationBegin={380} animationDuration={1200} animationEasing="ease-out">
                    {(stats.outcomeSummary || []).map((entry: any, index: number) => (
                      <Cell key={`outcome-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: 'var(--popover-foreground)' }} itemStyle={{ color: 'var(--popover-foreground)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {(stats.outcomeSummary || []).map((entry: any, index: number) => (
                <div key={`outcome-label-${index}`} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span>{entry.label}</span>
                  </div>
                  <strong>{entry.count}</strong>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="report-card report-chart-card report-hotspot-card border-border/50 shadow-xl overflow-hidden lg:col-span-2">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-lg font-serif italic flex items-center">
              <Percent className="mr-2 h-5 w-5 text-primary" />
              Demographics & Hotspot Indicators
            </CardTitle>
            <CardDescription>Resident mix and per-zone complaint severity color bands.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="report-demographics-grid grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="mb-3 text-sm font-bold uppercase tracking-widest text-muted-foreground">Resident vs Non-Resident Complaints</h4>
                <div className="space-y-4">
                  {[
                    { label: 'Residents', count: residentCount, color: '#2563eb' },
                    { label: 'Non-Residents', count: nonResidentCount, color: '#ea580c' },
                  ].map((group) => {
                    const share = demographicTotal ? (group.count / demographicTotal) * 100 : 0;
                    return <div key={group.label}>
                      <div className="mb-1 flex justify-between text-sm"><span>{group.label}</span><strong><CountUp value={group.count} /> <span className="text-xs font-normal text-muted-foreground">({share.toFixed(1)}%)</span></strong></div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted"><motion.div initial={{ width: 0 }} animate={{ width: `${share}%` }} transition={{ duration: 1, ease: 'easeOut' }} className="h-full rounded-full" style={{ backgroundColor: group.color }} /></div>
                    </div>;
                  })}
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
                    {residentCount === nonResidentCount ? 'Complaint counts are equal.' : <><strong>{demographicDifference}</strong> more complaint(s) were filed by <strong>{residentCount > nonResidentCount ? 'residents' : 'non-residents'}</strong>.</>}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Hotspot Indicator Colors</h4>
                <div className="space-y-3">
                  {((stats.hotspotZones || []) as any[]).map((zone: any) => (
                    <div key={zone.name} className="report-hotspot-row flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-3">
                      <div className="flex items-center gap-3">
                        <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: getComplaintHeatColor(Number(zone.complaint_count || 0)) }} />
                        <span className="font-semibold text-sm">{zone.name}</span>
                      </div>
                      <span className="text-xs font-bold text-muted-foreground">{zone.complaint_count || 0} cases</span>
                    </div>
                  ))}
                  {(!stats.hotspotZones || stats.hotspotZones.length === 0) && <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No complaints have been filed in zones yet.</p>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>


      <Card className="report-card report-success-summary border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Overall complaint success rate</p>
            <p className="mt-1 text-sm">{completedCount.toLocaleString('en-US')} of {totalCount.toLocaleString('en-US')} complaints resolved</p>
          </div>
          <p className="text-3xl font-bold tabular-nums text-primary">{successRate}%</p>
        </CardContent>
      </Card>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

function CountUp({ value, decimals = 0, suffix = '' }: { value: number; decimals?: number; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const startedAt = performance.now();
    const duration = 1000;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setDisplayValue(value * eased);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{displayValue.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>;
}

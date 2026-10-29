import { apiUrl } from '../lib/api';
import React, { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp,
  BarChart3,
  Calendar,
  CloudRain,
  Thermometer,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Download,
  RefreshCw,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  ChevronRight,
  Compass,
  FileSpreadsheet,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../hooks/useAuth';
import { safeJson } from '../lib/utils';
import { toast } from 'sonner';
import RecommendationPanel from '../components/RecommendationPanel';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

const TOOLTIP_STYLE = {
  borderRadius: '12px',
  border: '1px solid var(--border)',
  backgroundColor: 'var(--popover)',
  color: 'var(--popover-foreground)',
  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
};

export default function TrendAnalysis() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);

  // Filters
  const [scope, setScope] = useState<'all' | 'resident' | 'non-resident'>('all');
  const [range, setRange] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [trendView, setTrendView] = useState<'weekly' | 'daily' | 'monthly'>('weekly');

  const fetchTrends = async (isBackgroundRefresh = false) => {
    try {
      if (isBackgroundRefresh) setRefreshing(true);
      else setLoading(true);

      const params = new URLSearchParams();
      if (scope !== 'all') params.append('scope', scope);
      if (range !== 'all') params.append('range', range);
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (selectedZone !== 'all') params.append('zone', selectedZone);

      const res = await fetch(apiUrl(`/api/analytics/trends?${params.toString()}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load trend analytics');
      const json = await safeJson(res);
      setData(json);

      // Load recommendations
      const recRes = await fetch(apiUrl('/api/analytics/recommendations'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (recRes.ok) {
        const recJson = await safeJson(recRes);
        setRecommendations(Array.isArray(recJson) ? recJson : []);
      }
    } catch (e: any) {
      console.error(e);
      toast.error('Unable to fetch trend analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchTrends();
  }, [token, scope, range, selectedCategory, selectedStatus, selectedZone]);

  const handleExport = () => {
    window.print();
  };

  const handleRecommendationUpdate = async (id: number, status: string, notes?: string) => {
    if (id === -1) {
      void fetchTrends(true);
      return;
    }
    const res = await fetch(apiUrl(`/api/analytics/recommendations/${id}`), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status, notes }),
    });
    if (!res.ok) throw new Error('Failed to update recommendation.');
    toast.success('Recommendation updated.');
    void fetchTrends(true);
  };

  // Trend Chart dataset selection
  const trendChartData = useMemo(() => {
    if (!data) return [];
    if (trendView === 'daily') return data.dailyTrend || [];
    if (trendView === 'monthly') return data.monthlyTrend || [];
    return (data.weeklyTrend || []).map((w: any) => ({
      ...w,
      displayWeek: new Date(w.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }));
  }, [data, trendView]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Aggregating historical complaint trends...</p>
      </div>
    );
  }

  const summary = data?.summary || {};
  const weather = data?.weather || {};

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <TrendingUp className="w-6 h-6" />
            </span>
            <h1 className="text-3xl font-serif italic font-bold text-foreground">Trend Analysis</h1>
            <Badge variant="outline" className="text-xs bg-muted/40">
              Descriptive Analytics
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Empirical historical complaint patterns, Philippine seasonal correlations, and local geographic concentrations in Barangay San Andres.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchTrends(true)}
            disabled={refreshing}
            className="gap-1.5 text-xs h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button variant="default" size="sm" onClick={handleExport} className="gap-1.5 text-xs h-9">
            <Download className="w-3.5 h-3.5" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-xs">
        <CardContent className="p-3.5">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-muted-foreground">
              <Filter className="w-3.5 h-3.5 text-primary" /> Filter By:
            </div>

            {/* Time Range */}
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Range:</span>
              <select
                value={range}
                onChange={(e) => setRange(e.target.value)}
                className="h-8 bg-muted/60 border border-border/60 rounded px-2.5 font-medium text-foreground focus:outline-none"
              >
                <option value="all">All Available History</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="1y">Past 1 Year</option>
              </select>
            </div>

            {/* Scope */}
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Scope:</span>
              <select
                value={scope}
                onChange={(e: any) => setScope(e.target.value)}
                className="h-8 bg-muted/60 border border-border/60 rounded px-2.5 font-medium text-foreground focus:outline-none"
              >
                <option value="all">All Complainants</option>
                <option value="resident">Residents Only</option>
                <option value="non-resident">Non-Residents</option>
              </select>
            </div>

            {/* Category */}
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Category:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-8 bg-muted/60 border border-border/60 rounded px-2.5 font-medium text-foreground focus:outline-none max-w-[170px] truncate"
              >
                <option value="all">All Categories</option>
                {(data?.byCategory || []).map((c: any) => (
                  <option key={c.category} value={c.category}>
                    {c.category}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="h-8 bg-muted/60 border border-border/60 rounded px-2.5 font-medium text-foreground focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="bago">New (Bago)</option>
                <option value="sinusuri">Under Review</option>
                <option value="naka-assign">Assigned</option>
                <option value="iniimbestigahan">Under Investigation</option>
                <option value="sa-mediation">In Mediation</option>
                <option value="natapos">Resolved (Natapos)</option>
              </select>
            </div>

            {/* Zone */}
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Zone:</span>
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="h-8 bg-muted/60 border border-border/60 rounded px-2.5 font-medium text-foreground focus:outline-none max-w-[160px] truncate"
              >
                <option value="all">All Zones</option>
                {(data?.byZone || []).map((z: any) => (
                  <option key={z.zone} value={z.zone}>
                    {z.zone}
                  </option>
                ))}
              </select>
            </div>

            {(range !== 'all' || selectedCategory !== 'all' || selectedStatus !== 'all' || selectedZone !== 'all' || scope !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground ml-auto"
                onClick={() => {
                  setRange('all');
                  setScope('all');
                  setSelectedCategory('all');
                  setSelectedStatus('all');
                  setSelectedZone('all');
                }}
              >
                Reset Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Complaints */}
        <Card className="border-border/60 shadow-xs relative overflow-hidden">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs uppercase font-semibold text-muted-foreground">
              Total Complaints Logged
            </CardDescription>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold font-mono text-foreground">{summary.total || 0}</span>
              {summary.momGrowthPercentage !== 0 && (
                <span
                  className={`text-xs font-semibold flex items-center ${
                    summary.momGrowthPercentage > 0 ? 'text-rose-500' : 'text-emerald-500'
                  }`}
                >
                  {summary.momGrowthPercentage > 0 ? (
                    <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                  )}
                  {Math.abs(summary.momGrowthPercentage)}% MoM
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-[11px] text-muted-foreground">
            Active: <strong className="text-foreground">{summary.total - summary.completed}</strong> &bull; Resolved:{' '}
            <strong className="text-foreground">{summary.completed}</strong>
          </CardContent>
        </Card>

        {/* 2. Resolution Rate */}
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs uppercase font-semibold text-muted-foreground">
              Resolution Efficiency
            </CardDescription>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold font-mono text-emerald-500">{summary.resolutionRate || 0}%</span>
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                {summary.completed} of {summary.total} closed
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-[11px] text-muted-foreground">
            Avg Turnaround: <strong className="text-foreground">{summary.averageResolutionDays || 0} days</strong>
          </CardContent>
        </Card>

        {/* 3. Top Zone */}
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs uppercase font-semibold text-muted-foreground">
              Highest Concentration Area
            </CardDescription>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-lg font-bold text-foreground truncate max-w-[170px]">
                {data?.byZone?.[0]?.zone || 'N/A'}
              </span>
              <span className="text-xs font-mono font-bold text-primary">
                {data?.byZone?.[0]?.count || 0} reports
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-[11px] text-muted-foreground truncate">
            Primary Concern: <strong className="text-foreground">{data?.byCategory?.[0]?.category || 'General'}</strong>
          </CardContent>
        </Card>

        {/* 4. Emerging Concern */}
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs uppercase font-semibold text-muted-foreground">
              Recent Issue Velocity (30d)
            </CardDescription>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-lg font-bold text-foreground truncate max-w-[170px]">
                {data?.emergingCategories?.[0]?.category || 'Stable Baseline'}
              </span>
              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/30">
                {data?.emergingCategories?.[0]?.recent_count || 0} recent
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-[11px] text-muted-foreground">
            Based on 30-day velocity comparison
          </CardContent>
        </Card>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Historical Volume Trend */}
        <Card className="lg:col-span-2 border-border/70 shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Historical Complaint Volume Trend
              </CardTitle>
              <CardDescription className="text-xs">
                Aggregate incident volume across selected time intervals
              </CardDescription>
            </div>

            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/50 text-[11px]">
              <button
                onClick={() => setTrendView('daily')}
                className={`px-2 py-0.5 rounded font-medium ${
                  trendView === 'daily' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground'
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setTrendView('weekly')}
                className={`px-2 py-0.5 rounded font-medium ${
                  trendView === 'weekly' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground'
                }`}
              >
                Weekly
              </button>
              <button
                onClick={() => setTrendView('monthly')}
                className={`px-2 py-0.5 rounded font-medium ${
                  trendView === 'monthly' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground'
                }`}
              >
                Monthly
              </button>
            </div>
          </CardHeader>

          <CardContent className="pt-2">
            <div className="h-[280px] w-full">
              {trendChartData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                  No complaints recorded for this timeframe.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendChartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis
                      dataKey={trendView === 'weekly' ? 'displayWeek' : trendView === 'daily' ? 'date' : 'month'}
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="count" name="Complaints" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Category Breakdown Pie */}
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Category Breakdown
            </CardTitle>
            <CardDescription className="text-xs">Distribution by complaint taxonomy</CardDescription>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="h-[200px] w-full">
              {(data?.byCategory || []).length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                  No categorized data.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.byCategory}
                      dataKey="count"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      innerRadius={45}
                      paddingAngle={3}
                    >
                      {(data.byCategory || []).map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="space-y-1.5 pt-2 max-h-[120px] overflow-y-auto text-xs border-t border-border/40">
              {(data?.byCategory || []).slice(0, 5).map((item: any, idx: number) => (
                <div key={item.category} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 truncate max-w-[180px]">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="truncate text-foreground font-medium">{item.category}</span>
                  </div>
                  <span className="font-mono text-muted-foreground font-semibold">
                    {item.count} ({Math.round((item.count / Math.max(1, summary.total)) * 100)}%)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Environmental & Meteorological Trends Card */}
      <Card className="border-border/70 shadow-sm bg-gradient-to-r from-blue-950/20 via-background to-cyan-950/20">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                <CloudRain className="w-5 h-5" />
              </span>
              <div>
                <CardTitle className="text-base font-bold">Current Environmental & Meteorological Context</CardTitle>
                <CardDescription className="text-xs">
                  Weather observations and flood susceptibility metrics for Barangay San Andres, Cainta
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              <Badge variant="outline" className="bg-background/80 font-mono text-[10px]">
                Updated: {new Date(weather.retrievalTimestamp || '').toLocaleTimeString()}
              </Badge>
              {weather.isFallback && (
                <Badge variant="secondary" className="text-[10px]">
                  Climatological Baseline
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-muted/30 border border-border/60 rounded-xl p-3.5 text-xs">
            <div className="flex items-center gap-3">
              <Thermometer className="w-7 h-7 text-amber-500 shrink-0" />
              <div>
                <span className="text-muted-foreground text-[10px] block">Cainta Temperature</span>
                <span className="text-lg font-bold font-mono text-foreground">{weather.temperature || 31}&deg;C</span>
                <span className="text-[10px] text-muted-foreground block">{weather.weatherDescription}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <CloudRain className="w-7 h-7 text-blue-500 shrink-0" />
              <div>
                <span className="text-muted-foreground text-[10px] block">7-Day Rainfall Outlook</span>
                <span className="text-lg font-bold font-mono text-foreground">{weather.rainfallForecast7d || 0} mm</span>
                <span className="text-[10px] text-muted-foreground block">Cumulative expected</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <AlertTriangle
                className={`w-7 h-7 shrink-0 ${
                  weather.floodRiskLevel === 'Severe' || weather.floodRiskLevel === 'High'
                    ? 'text-rose-500'
                    : 'text-emerald-500'
                }`}
              />
              <div>
                <span className="text-muted-foreground text-[10px] block">Flood Susceptibility</span>
                <span
                  className={`text-lg font-bold ${
                    weather.floodRiskLevel === 'Severe' || weather.floodRiskLevel === 'High'
                      ? 'text-rose-500'
                      : 'text-emerald-500'
                  }`}
                >
                  {weather.floodRiskLevel || 'Low'} Risk
                </span>
                <span className="text-[10px] text-muted-foreground block">Manggahan Corridor</span>
              </div>
            </div>

            <div className="border-l border-border/60 pl-3 flex flex-col justify-center">
              <span className="text-[10px] font-semibold text-primary uppercase tracking-wide block">
                Official Advisory Note:
              </span>
              <p className="text-[11px] text-foreground leading-snug mt-0.5">{weather.advisoryText}</p>
              <span className="text-[9px] text-muted-foreground/70 block mt-1">Source: {weather.sourceName}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seasonal Analysis Section */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Philippine Seasonal Complaint Patterns
          </CardTitle>
          <CardDescription className="text-xs">
            Evaluating historical complaint concentrations against verified Philippine meteorological cycles and recurring local calendar events.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(data?.seasonalPatterns || []).map((pattern: any) => (
              <div
                key={pattern.id}
                className={`rounded-xl border p-4 space-y-3 transition-all ${
                  pattern.isCurrentSeason
                    ? 'border-primary/50 bg-primary/5 shadow-xs'
                    : 'border-border/60 bg-card hover:border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-foreground">{pattern.seasonName}</h4>
                      {pattern.isCurrentSeason && (
                        <Badge className="bg-primary text-primary-foreground text-[9px] uppercase font-bold">
                          Active Season
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{pattern.periodMonths}</span>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase font-bold ${
                        pattern.patternStrength === 'Strong'
                          ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                          : pattern.patternStrength === 'Moderate'
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                          : pattern.patternStrength === 'Emerging'
                          ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                          : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                      }`}
                    >
                      {pattern.patternStrength} Pattern
                    </Badge>
                    <span className="text-[10px] font-mono text-muted-foreground font-semibold">
                      {pattern.historicalCount} recorded cases
                    </span>
                  </div>
                </div>

                {pattern.historicalCount > 0 ? (
                  <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-2.5 rounded-lg border border-border/50">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Top Complaint Types</span>
                      <ul className="space-y-0.5 mt-0.5 font-medium text-foreground text-[11px]">
                        {pattern.topCategories.slice(0, 2).map((tc: any) => (
                          <li key={tc.category} className="truncate">
                            &bull; {tc.category} ({tc.percentage}%)
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Primary Affected Zones</span>
                      <ul className="space-y-0.5 mt-0.5 font-medium text-foreground text-[11px]">
                        {pattern.topZones.slice(0, 2).map((tz: any) => (
                          <li key={tz.zone} className="truncate">
                            &bull; {tz.zone} ({tz.count})
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-muted-foreground italic bg-muted/30 p-2 rounded border border-border/40">
                    *Insufficient historical samples logged during this specific window to establish a statistically verified recurring pattern.
                  </div>
                )}

                <div className="text-xs space-y-1">
                  <span className="font-semibold text-primary text-[10px] uppercase block tracking-wider">
                    Recommended Seasonal Preventive Actions:
                  </span>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-muted-foreground">
                    {pattern.recommendedActions.slice(0, 2).map((action: string, i: number) => (
                      <li key={i} className="leading-snug">
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Geographic Breakdown & Repeated Issues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Zones Bar Chart */}
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Complaint Concentration by Zone
            </CardTitle>
            <CardDescription className="text-xs">Barangay San Andres geographic distribution</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-[280px] w-full">
              {(data?.byZone || []).length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                  No zone records.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(data.byZone || []).slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                    <YAxis
                      type="category"
                      dataKey="zone"
                      width={120}
                      tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="count" name="Total Complaints" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Repeated Complaints in Same Location */}
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Repeated Complaints in Same Area
            </CardTitle>
            <CardDescription className="text-xs">
              Multiple complaints logged for recurring concerns at the same street or zone
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {(data?.repeatedIssues || []).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground space-y-1 text-xs">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
                <p className="font-semibold text-foreground">No Recurring Location Clusters</p>
                <p>Complaints are distributed evenly across individual addresses without repeated clusters.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1 text-xs">
                {data.repeatedIssues.map((issue: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-start justify-between gap-3 p-2.5 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-bold text-foreground">
                        <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="truncate max-w-[200px]">{issue.street_name || issue.zone}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Type: <span className="font-semibold text-foreground">{issue.uri_ng_reklamo}</span> &bull; Zone:{' '}
                        {issue.zone}
                      </p>
                    </div>

                    <div className="flex flex-col items-end shrink-0">
                      <Badge variant="outline" className="text-xs font-mono font-bold bg-amber-500/10 text-amber-500 border-amber-500/30">
                        {issue.repeat_count} reports
                      </Badge>
                      <span className="text-[9px] text-muted-foreground mt-0.5">
                        {new Date(issue.last_reported_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Interactive Recommendation Panel */}
      <RecommendationPanel
        recommendations={recommendations.filter((r) => ['seasonal', 'report_based', 'zone_based'].includes(r.recommendation_type))}
        onUpdateStatus={handleRecommendationUpdate}
        title="Trend-Based Operational Recommendations"
        description="Suggested interventions synthesized from historical complaint volumes, repeat locations, and seasonal patterns."
      />
    </div>
  );
}

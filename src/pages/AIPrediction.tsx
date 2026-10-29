import { apiUrl } from '../lib/api';
import React, { useEffect, useState, useMemo } from 'react';
import {
  Sparkles,
  Brain,
  Calendar,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Download,
  RefreshCw,
  HelpCircle,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  Bar,
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
import PredictiveRiskMap from '../components/PredictiveRiskMap';
import RecommendationPanel from '../components/RecommendationPanel';

const TOOLTIP_STYLE = {
  borderRadius: '12px',
  border: '1px solid var(--border)',
  backgroundColor: 'var(--popover)',
  color: 'var(--popover-foreground)',
  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
};

const RISK_BADGE_CLASSES: Record<string, string> = {
  Critical: 'bg-red-500/20 text-red-500 border-red-500/30 font-bold',
  High: 'bg-orange-500/20 text-orange-500 border-orange-500/30 font-bold',
  Moderate: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30 font-medium',
  Low: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30 font-medium',
  'Insufficient Data': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

export default function AIPrediction() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [horizon, setHorizon] = useState<'7d' | '30d' | '90d'>('30d');
  const [scope, setScope] = useState<'all' | 'resident' | 'non-resident'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [selectedHotspot, setSelectedHotspot] = useState<any | null>(null);

  const fetchPredictions = async (isBackgroundRefresh = false) => {
    try {
      if (isBackgroundRefresh) setRefreshing(true);
      else setLoading(true);

      const params = new URLSearchParams();
      params.append('horizon', horizon);
      if (scope !== 'all') params.append('scope', scope);
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedZone !== 'all') params.append('zone', selectedZone);

      const res = await fetch(apiUrl(`/api/analytics/predictions?${params.toString()}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load predictions.');
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
      toast.error('Unable to compute predictive analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchPredictions();
  }, [token, horizon, scope, selectedCategory, selectedZone]);

  const handleExport = () => {
    window.print();
  };

  const handleRecommendationUpdate = async (id: number, status: string, notes?: string) => {
    if (id === -1) {
      void fetchPredictions(true);
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
    void fetchPredictions(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Running predictive models and hotspot clustering...</p>
      </div>
    );
  }

  const forecast = data?.forecast || {};
  const meta = data?.modelMetadata || {};
  const narrative = data?.narrative || {};
  const weather = data?.weather || {};
  const hotspots = data?.hotspots || [];
  const chartSeries = data?.chartForecastSeries || [];
  const horizonLabel = horizon === '7d' ? 'Next 7 Days' : horizon === '90d' ? 'Next 3 Months (90 Days)' : 'Next 30 Days';

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <Brain className="w-6 h-6" />
            </span>
            <h1 className="text-3xl font-serif italic font-bold text-foreground">AI Prediction & Risk Modeling</h1>
            <Badge variant="outline" className="text-xs bg-muted/40 gap-1">
              <Sparkles className="w-3 h-3 text-primary" /> Predictive Intelligence
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Empirical forecasting of complaint volumes, geographic risk clustering, and preventive resource planning for Barangay San Andres.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Horizon Selector */}
          <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border/50 text-xs">
            <button
              onClick={() => setHorizon('7d')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                horizon === '7d' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Next 7 Days
            </button>
            <button
              onClick={() => setHorizon('30d')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                horizon === '30d' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Next 30 Days
            </button>
            <button
              onClick={() => setHorizon('90d')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                horizon === '90d' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Next 3 Months
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchPredictions(true)}
            disabled={refreshing}
            className="gap-1.5 text-xs h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button variant="default" size="sm" onClick={handleExport} className="gap-1.5 text-xs h-9">
            <Download className="w-3.5 h-3.5" />
            Export Forecast
          </Button>
        </div>
      </div>

      {/* Transparent Model Metadata & Limitations Banner */}
      <Card className="border-border/70 shadow-xs bg-muted/20">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-primary" /> Model: {meta.modelName}
              </span>
              <span>&bull;</span>
              <span>
                <strong className="text-muted-foreground">Confidence: </strong>
                <Badge
                  variant="outline"
                  className={`text-[10px] uppercase font-bold ${
                    meta.confidenceLevel === 'High'
                      ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                      : meta.confidenceLevel === 'Moderate'
                      ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                      : 'bg-slate-500/15 text-slate-400 border-slate-500/30'
                  }`}
                >
                  {meta.confidenceLevel}
                </Badge>
              </span>
              <span>&bull;</span>
              <span>
                <strong className="text-muted-foreground">Sample Size: </strong>
                {meta.historicalSampleCount} complaints ({meta.historicalSpanDays} days history)
              </span>
              {meta.wapePercentage > 0 && (
                <>
                  <span>&bull;</span>
                  <span>
                    <strong className="text-muted-foreground">Backtest Error: </strong>
                    {meta.wapePercentage}% WAPE (MAE: {meta.modelMAE})
                  </span>
                </>
              )}
            </div>

            <span className="text-[10px] font-mono text-muted-foreground">
              Generated: {new Date(meta.generatedAt).toLocaleString()}
            </span>
          </div>

          {/* Insufficient Data Warning Banner when applicable */}
          {data?.isInsufficientData && (
            <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/25 p-3 rounded-lg text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <div className="space-y-0.5">
                <span className="font-bold">Limited Historical Records Notice:</span>
                <p className="leading-relaxed">
                  The complaint database currently contains limited historical observations ({meta.historicalSampleCount} recorded cases).
                  Numerical projections represent a baseline descriptive estimate. As additional complaints are logged across seasons, statistical confidence and predictive precision will automatically calibrate.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Forecast KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Forecasted Complaints */}
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs uppercase font-semibold text-muted-foreground">
              Forecasted Volume ({horizonLabel})
            </CardDescription>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-3xl font-bold font-mono text-primary">~{forecast.expectedCount}</span>
              <span className="text-xs font-semibold text-muted-foreground">
                [{forecast.lowerBound} &ndash; {forecast.upperBound}]
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-[11px] text-muted-foreground">
            95% Prediction Interval: <strong className="text-foreground">{forecast.lowerBound} to {forecast.upperBound}</strong> cases
          </CardContent>
        </Card>

        {/* 2. Direction of Change */}
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs uppercase font-semibold text-muted-foreground">
              Projected Trajectory
            </CardDescription>
            <div className="flex items-baseline justify-between mt-1">
              <span
                className={`text-2xl font-bold flex items-center gap-1 ${
                  forecast.direction === 'Increasing'
                    ? 'text-rose-500'
                    : forecast.direction === 'Decreasing'
                    ? 'text-emerald-500'
                    : 'text-amber-500'
                }`}
              >
                {forecast.direction === 'Increasing' ? (
                  <TrendingUp className="w-6 h-6" />
                ) : forecast.direction === 'Decreasing' ? (
                  <TrendingDown className="w-6 h-6" />
                ) : (
                  <Minus className="w-6 h-6" />
                )}
                {forecast.direction}
              </span>
              <Badge variant="outline" className="text-[10px] bg-muted/40">
                vs Baseline: {forecast.baselineCount}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-[11px] text-muted-foreground">
            Compared to 4-week historical moving average
          </CardContent>
        </Card>

        {/* 3. Top Prioritized Hotspot */}
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs uppercase font-semibold text-muted-foreground">
              Top Prioritized Area
            </CardDescription>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-lg font-bold text-foreground truncate max-w-[170px]">
                {hotspots[0]?.zone || 'No Hotspot'}
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] uppercase ${RISK_BADGE_CLASSES[hotspots[0]?.riskLevel || 'Low']}`}
              >
                {hotspots[0]?.riskLevel || 'Low'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-[11px] text-muted-foreground truncate">
            Projected Cases: <strong className="text-primary font-mono font-bold">~{hotspots[0]?.predictedCount || 0}</strong> &bull; Score: {hotspots[0]?.riskScore || 0}/100
          </CardContent>
        </Card>

        {/* 4. Meteorological Risk Factor */}
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs uppercase font-semibold text-muted-foreground">
              Environmental Risk Factor
            </CardDescription>
            <div className="flex items-baseline justify-between mt-1">
              <span
                className={`text-2xl font-bold font-mono ${
                  weather.floodRiskLevel === 'Severe' || weather.floodRiskLevel === 'High'
                    ? 'text-rose-500'
                    : 'text-emerald-500'
                }`}
              >
                {weather.floodRiskLevel || 'Low'}
              </span>
              <span className="text-xs font-mono font-semibold text-muted-foreground">
                {weather.rainfallForecast7d || 0}mm rain
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-[11px] text-muted-foreground">
            {meta.weatherAdjustmentApplied ? 'Meteorological risk multiplier applied' : 'Standard seasonal baseline'}
          </CardContent>
        </Card>
      </div>

      {/* Forecast Chart: Historical Trend Connecting into Forecast */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Forecast Projection vs Historical Baseline
            </CardTitle>
            <CardDescription className="text-xs">
              Weekly historical complaint volume connecting into future projected weeks with 95% uncertainty interval
            </CardDescription>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-blue-600 inline-block" />
              <span className="text-muted-foreground">Historical Actual</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 border-t-2 border-dashed border-primary inline-block" />
              <span className="text-muted-foreground">AI Projected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-primary/20 border border-primary/40 inline-block" />
              <span className="text-muted-foreground">95% Confidence Band</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartSeries}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  tickFormatter={(val) => {
                    const d = new Date(val);
                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  }}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />

                {/* 95% Confidence Band for forecast */}
                <Area
                  type="monotone"
                  dataKey="upperBound"
                  stroke="none"
                  fill="#2563eb"
                  fillOpacity={0.15}
                  name="Upper Uncertainty Band"
                />
                <Area
                  type="monotone"
                  dataKey="lowerBound"
                  stroke="none"
                  fill="#ffffff"
                  fillOpacity={0}
                  name="Lower Uncertainty Band"
                />

                {/* Historical Actual Bar */}
                <Bar dataKey="actual" fill="#2563eb" name="Historical Actual" radius={[4, 4, 0, 0]} />

                {/* AI Forecast Line */}
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  strokeDasharray="5 5"
                  dot={{ r: 4, fill: '#3b82f6' }}
                  name="AI Expected Forecast"
                />

                {/* Baseline Comparison Line */}
                <Line
                  type="monotone"
                  dataKey="baseline"
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  dot={false}
                  name="Historical Moving Average Baseline"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Leaflet Predictive Risk Map */}
      <Card className="border-border/70 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/20 border-b border-border/50 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Predictive Risk Map (Barangay San Andres)
              </CardTitle>
              <CardDescription className="text-xs">
                Visualizing forecasted complaint hotspots and verified incident coordinates
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs bg-background/80 font-mono">
              Horizon: {horizonLabel}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <PredictiveRiskMap
            hotspots={hotspots}
            complaints={data?.actualComplaintDots || []}
            horizonLabel={horizonLabel}
            onSelectHotspot={(hotspot) => setSelectedHotspot(hotspot)}
          />
        </CardContent>
      </Card>

      {/* Category Predictions & Zone Risk Prioritization Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Predictions */}
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Category-Specific Forecasts ({horizonLabel})
            </CardTitle>
            <CardDescription className="text-xs">
              Projected complaint counts and contributing external factors per complaint category
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 text-xs">
              {(data?.categoryPredictions || []).map((cat: any) => (
                <div key={cat.category} className="p-3 rounded-xl border border-border/60 bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-foreground">{cat.category}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-semibold flex items-center gap-0.5 ${
                          cat.trend === 'Increasing'
                            ? 'text-rose-500'
                            : cat.trend === 'Decreasing'
                            ? 'text-emerald-500'
                            : 'text-amber-500'
                        }`}
                      >
                        {cat.trend === 'Increasing' ? (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        ) : cat.trend === 'Decreasing' ? (
                          <ArrowDownRight className="w-3.5 h-3.5" />
                        ) : (
                          <Minus className="w-3.5 h-3.5" />
                        )}
                        {cat.trend}
                      </span>
                      <Badge variant="outline" className="font-mono text-xs font-bold text-primary">
                        ~{cat.predictedCount} cases
                      </Badge>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">Contributing Factor: </strong>
                    {cat.externalFactor}
                  </p>

                  <div className="rounded bg-primary/5 border border-primary/15 p-2 text-[11px] text-foreground">
                    <strong className="text-primary text-[10px] uppercase block tracking-wider">
                      Preventive Response:
                    </strong>
                    {cat.recommendedAction}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Zone Risk Prioritization */}
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-primary" />
              Zone Risk Prioritization
            </CardTitle>
            <CardDescription className="text-xs">
              Transparent multi-factor risk scoring for resource allocation in Barangay San Andres
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 text-xs">
              {hotspots.map((hotspot: any) => (
                <div
                  key={hotspot.zone}
                  className="p-3 rounded-xl border border-border/60 bg-card space-y-2 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-foreground">{hotspot.zone}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-muted-foreground">
                        Score: {hotspot.riskScore}/100
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase font-bold ${RISK_BADGE_CLASSES[hotspot.riskLevel]}`}
                      >
                        {hotspot.riskLevel}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-muted/40 p-2 rounded-lg border border-border/40">
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Historical Cases</span>
                      <span className="font-bold text-foreground font-mono">{hotspot.historicalCount} logged</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Forecasted ({horizonLabel})</span>
                      <span className="font-bold text-primary font-mono">~{hotspot.predictedCount} cases</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-snug">
                    <strong className="text-foreground">Lead Office: </strong>
                    {hotspot.responsibleOffice}
                  </p>

                  <div className="text-[11px] text-muted-foreground leading-snug">
                    <strong className="text-foreground">Suggested Operation: </strong>
                    {hotspot.suggestedAction}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations & Action Planning Panel */}
      <RecommendationPanel
        recommendations={recommendations.filter((r) => ['risk_based', 'zone_based', 'seasonal'].includes(r.recommendation_type))}
        onUpdateStatus={handleRecommendationUpdate}
        title="Predictive & Risk-Based Recommendations"
        description="Priority preventive interventions generated to mitigate anticipated risks in forecasted hotspot zones."
      />

      {/* Non-Punitive Legal & Operational Disclaimer */}
      <div className="bg-muted/30 border border-border/60 rounded-xl p-4 text-xs text-muted-foreground space-y-1">
        <span className="font-semibold text-foreground flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-primary" /> Administrative Decision-Support Notice
        </span>
        <p className="leading-relaxed">
          The AI Prediction module produces advisory forecasts designed exclusively to assist Barangay San Andres officials in proactive inspection planning, staffing, and drainage maintenance. Risk classifications indicate analytical operational priority and do not establish wrongdoing, liability, or official fault for any community member, household, or property.
        </p>
      </div>
    </div>
  );
}

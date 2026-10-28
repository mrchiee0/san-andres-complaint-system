import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LABELS } from '../constants';
import { getComplaintHeatColor } from '../lib/complaintHeatmap';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ArrowUpRight,
  TrendingUp,
  Users,
  MessageSquare,
  ArrowRight,
  Home,
  Zap,
  Settings
} from 'lucide-react';
import { cn, safeJson } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { AnimatePresence, motion } from 'motion/react';
import { ShieldCheck } from 'lucide-react';
import SanAndresMap from '../components/SanAndresMap';
import { ComplaintType } from '../types';
import { COMPLAINT_CATEGORIES, COMPLAINT_TAXONOMY } from '../data/complaintTaxonomy';
import { categoryForType } from '../data/complaintSeverity';

interface Stats {
  total: number;
  pending: number;
  ongoing: number;
  completed: number;
  byType: { type: string; count: number }[];
  byZone: { zone: string; count: number }[];
  responseTime: number;
  hotspotZones: Array<{ name: string; description: string; lat: number; lng: number; color: string; complaint_count: number; active_count: number; resolved_count: number; }>;
}

const COLORS = [
  'var(--chart-1)', 
  'var(--chart-2)', 
  'var(--chart-3)', 
  'var(--chart-4)', 
  'var(--chart-5)'
];
const CHART_TICK = { fontSize: 10, fill: 'var(--foreground)' };
const TOOLTIP_STYLE = {
  borderRadius: '16px',
  border: '1px solid var(--border)',
  backgroundColor: 'var(--popover)',
  color: 'var(--popover-foreground)',
  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.35)',
  fontSize: '12px',
  fontWeight: 'bold' as const,
};

export default function Dashboard() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [complaintTypes, setComplaintTypes] = useState<ComplaintType[]>(COMPLAINT_TAXONOMY.map((item, index) => ({ ...item, id: index + 1, is_active: 1, created_at: '' })));
  const [activeCategoryIndex, setActiveCategoryIndex] = useState<number | null>(null);

  const getCategoryIcon = (category: string) => {
    if (category.startsWith('Neighborhood')) return <Home size={24} />;
    if (category.startsWith('Environmental')) return <Zap size={24} />;
    if (category.startsWith('Property')) return <Settings size={24} />;
    if (category.startsWith('Traffic')) return <ArrowRight size={24} />;
    return <ShieldCheck size={24} />;
  };

  useEffect(() => {
    if (user?.role === 'mamamayan') return;
    fetch('/api/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(safeJson)
    .then(data => {
      setStats(data && typeof data === 'object' && !Array.isArray(data) ? data : null);
    })
    .catch(() => setStats(null));
  }, [token, user]);

  useEffect(() => {
    if (user?.role !== 'mamamayan') return;
    fetch('/api/complaint-types')
      .then(safeJson)
      .then((data) => { if (Array.isArray(data) && data.length) setComplaintTypes(data); });
  }, [user?.role]);

  if (user?.role === 'mamamayan') {
    const complaintGroups = COMPLAINT_CATEGORIES.map((category) => ({
      category,
      types: complaintTypes.filter((item) => item.category === category),
    })).filter((group) => group.types.length > 0);

    return (
      <div className="space-y-5 md:space-y-7">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary text-primary-foreground p-6 md:p-8 rounded-2xl relative overflow-hidden shadow-lg"
        >
          <div className="relative z-10">
            <h1 className="text-2xl md:text-3xl font-serif italic mb-2">Welcome, {user.pangalan}!</h1>
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="secondary" className="px-3 py-1 text-[10px] md:text-xs font-bold uppercase tracking-widest bg-white/20 border-none hover:bg-white/30 text-white">
                <Users className="mr-1.5 h-3 w-3" />
                {user.account_type === 'Non Resident' || user.is_resident === 'Non Resident' ? 'Non Resident' : 'Resident'}
              </Badge>
              <Badge variant="secondary" className="px-3 py-1 text-[10px] md:text-xs font-bold uppercase tracking-widest bg-white/20 border-none hover:bg-white/30 text-white">
                <ShieldCheck className="mr-1.5 h-3 w-3" />
                Verified
              </Badge>
            </div>
            <p className="text-primary-foreground/80 max-w-lg text-sm leading-relaxed">
              The San Andres Complaint System is here to assist you with your concerns and complaints in our barangay.
            </p>
          </div>
          <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-white/5 md:block" />
        </motion.div>

        <Card className="border-border/50 shadow-md overflow-hidden">
          <div className="flex flex-col gap-5 bg-card p-6 md:flex-row md:items-center md:justify-between md:p-8">
            <div className="max-w-2xl">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">Need to report an issue?</p>
              <h2 className="text-xl font-semibold text-foreground md:text-2xl">You have a complaint? File it now.</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Submit the details securely and follow every update from your dashboard.</p>
            </div>
            <Button render={<Link to="/complaints/new" />} nativeButton={false} className="h-11 shrink-0 px-5 font-semibold">
              File Now <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </Card>
        
        <div className="space-y-6">
          <Card className="border-border/50 shadow-md overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/50">
              <CardTitle className="text-lg font-semibold flex items-center">
                <TrendingUp className="mr-2 h-5 w-5 text-primary" />
                How to Submit a Complaint
              </CardTitle>
              <CardDescription>Follow these simple steps.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 md:p-8">
              <div className="space-y-6">
                {[
                  { step: 1, text: 'Select File Now or open Complaints from the navigation.' },
                  { step: 2, text: 'Choose a complaint type and describe what happened.' },
                  { step: 3, text: 'Add any supporting evidence, then submit your complaint.' }
                ].map((item) => (
                  <div key={item.step} className="flex items-start group/step">
                    <span className="w-8 h-8 bg-primary text-primary-foreground rounded-lg flex items-center justify-center text-xs mr-4 shrink-0 font-bold">
                      {item.step}
                    </span>
                    <p className="text-sm md:text-base text-muted-foreground leading-relaxed group-hover/step:text-foreground transition-colors">{item.text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          <section className="space-y-4" aria-labelledby="complaint-categories-heading">
            <div>
              <h2 id="complaint-categories-heading" className="text-xl font-semibold text-foreground">Complaint categories</h2>
              <p className="mt-1 text-sm text-muted-foreground">Choose the closest category when you file a complaint.</p>
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2 xl:grid-cols-3" onMouseLeave={() => setActiveCategoryIndex(null)}>
              {complaintGroups.map((group, index) => (
                (() => {
                  const isActive = activeCategoryIndex === index;
                  const anotherIsActive = activeCategoryIndex !== null && !isActive;
                  return <motion.div
                    key={group.category}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    viewport={{ once: true }}
                    onHoverStart={() => setActiveCategoryIndex(index)}
                    onFocus={() => setActiveCategoryIndex(index)}
                    className={`relative h-[116px] transition-transform duration-200 ease-out ${isActive ? 'z-20 scale-[1.04]' : anotherIsActive ? 'scale-[0.96]' : ''}`}
                    style={{ zIndex: isActive ? 20 : 0 }}
                  >
                    <Card className={`relative h-full overflow-visible rounded-xl border-border/60 bg-card shadow-sm transition-shadow duration-200 ${isActive ? 'shadow-xl' : ''}`}>
                      <CardContent className="relative h-full p-0">
                        <div className="flex h-full items-center gap-4 px-5 py-4">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                            {getCategoryIcon(group.category)}
                          </div>
                          <h3 className="text-base font-semibold leading-snug">{group.category}</h3>
                        </div>
                        <AnimatePresence>
                          {isActive && <motion.div
                            key="category-details"
                            initial={{ opacity: 0, y: -8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.98 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                            className="absolute left-0 right-0 top-full z-30 -mt-px rounded-b-xl border border-border/60 bg-card px-5 pb-5 pt-3 shadow-xl"
                          >
                            <div className="divide-y divide-border/60">
                              {group.types.map((type) => (
                                <div key={type.id} className="py-2.5 first:pt-1">
                                  <h4 className="text-sm font-semibold text-foreground">{type.name}</h4>
                                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{type.description}</p>
                                </div>
                              ))}
                            </div>
                            <Button render={<Link to="/complaints/new" />} nativeButton={false} className="mt-3 w-full">
                              File Now <ArrowRight size={16} className="ml-2" />
                            </Button>
                          </motion.div>}
                        </AnimatePresence>
                      </CardContent>
                    </Card>
                  </motion.div>;
                })()
              ))}
            </div>
          </section>

          <Card className="bg-primary text-primary-foreground border-none shadow-md relative overflow-hidden">
            <CardContent className="p-6 md:p-8 relative z-10 flex flex-col justify-between gap-5 md:flex-row md:items-center">
              <div>
                <h3 className="text-xl font-semibold mb-2">Need help?</h3>
                <p className="text-primary-foreground/80 text-sm leading-relaxed">Message barangay officials about your submitted complaints and questions.</p>
              </div>
              <Link to="/chat" className="w-full md:w-auto">
                <Button variant="secondary" className="w-full px-5 font-semibold"><MessageSquare className="mr-2 h-5 w-5" />Open Messages</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!stats) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  const cards = [
    { name: 'Total Complaints', value: stats.total, icon: FileText, color: 'bg-primary', trend: '+12%', trendColor: 'text-primary', href: '/complaints?status=all&range=all' },
    { name: 'Pending', value: stats.pending, icon: AlertCircle, color: 'bg-[var(--warning)]', trend: '+5%', trendColor: 'text-amber-600', href: '/complaints?status=bago&range=all' },
    { name: 'In Progress', value: stats.ongoing, icon: Clock, color: 'bg-[var(--info)]', trend: '-2%', trendColor: 'text-blue-600', href: '/complaints?status=active&range=all' },
    { name: 'Resolved', value: stats.completed, icon: CheckCircle2, color: 'bg-[var(--success)]', trend: '+18%', trendColor: 'text-green-600', href: '/complaints?status=natapos&range=all' },
  ];

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {cards.map((card, index) => (
          <motion.div
            key={card.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Link to={card.href} aria-label={`View ${card.name.toLowerCase()} complaints`}>
            <Card className="h-full border-border/50 shadow-lg hover:shadow-xl transition-all group cursor-pointer overflow-hidden relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <CardContent className="p-3 md:p-4 relative z-10">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-3 md:space-y-0">
                  <div className={cn("p-3 rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform", card.color)}>
                    <card.icon size={18} className="md:w-5 md:h-5" />
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] font-bold border-current/20", card.trendColor)}>
                    {card.trend}
                  </Badge>
                </div>
                <div className="mt-4">
                  <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-muted-foreground">{card.name}</p>
                  <p className="text-2xl md:text-2xl font-serif italic font-bold text-foreground mt-1">{card.value}</p>
                </div>
              </CardContent>
              <div className={cn("absolute -bottom-6 -right-6 w-24 h-24 rounded-full opacity-5 group-hover:scale-150 transition-transform duration-700", card.color)}></div>
            </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      <Card className="border-border/50 shadow-xl overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg font-serif italic flex items-center">
            <ShieldCheck className="mr-2 h-5 w-5 text-primary" />
            Barangay San Andres Boundary
          </CardTitle>
          <CardDescription>Official barangay territorial boundary and geographic scope.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[56vh] min-h-[420px] w-full">
            <SanAndresMap showOfficialBoundary={false} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
        <Card className="border-border/50 shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-serif italic flex items-center">
              <TrendingUp className="mr-2 h-4 w-4 text-primary" />
              Complaint Types
            </CardTitle>
            <CardDescription className="text-xs">Distribution of complaints by category.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[180px] md:h-[210px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.byType || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis 
                    dataKey="type" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={CHART_TICK} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={CHART_TICK} 
                  />
                  <Tooltip 
                    cursor={{ fill: 'var(--muted)' }}
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={{ color: 'var(--popover-foreground)' }}
                    itemStyle={{ color: 'var(--popover-foreground)' }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} isAnimationActive animationBegin={180} animationDuration={1100} animationEasing="ease-out" cursor="pointer">
                    {(stats.byType || []).map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={`var(--chart-${(index % 5) + 1})`}
                        onClick={() => navigate(`/complaints?category=${encodeURIComponent(categoryForType(entry.type))}&type=${encodeURIComponent(entry.type)}&range=all`)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-serif italic flex items-center">
              <ArrowUpRight className="mr-2 h-4 w-4 text-primary" />
              Zone Hotspots
            </CardTitle>
            <CardDescription className="text-xs">Highest complaint concentration by zone.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[180px] md:h-[210px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.byZone || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="zone" axisLine={false} tickLine={false} tick={CHART_TICK} />
                  <YAxis axisLine={false} tickLine={false} tick={CHART_TICK} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: 'var(--popover-foreground)' }} itemStyle={{ color: 'var(--popover-foreground)' }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} isAnimationActive animationBegin={320} animationDuration={1200} animationEasing="ease-out">
                    {(stats.byZone || []).map((entry, index) => (
                      <Cell key={`zone-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 space-y-2">
              {(stats.hotspotZones || []).slice(0, 3).map((zone) => (
                <div key={zone.name} className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getComplaintHeatColor(Number(zone.complaint_count || 0)) }} />
                    <div>
                      <div className="text-xs font-bold">{zone.name}</div>
                      <div className="text-[9px] text-muted-foreground">{zone.description || 'Barangay complaint cluster'}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-foreground">{zone.complaint_count || 0}</div>
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Cases</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-xl lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-serif italic flex items-center">
              <ArrowUpRight className="mr-2 h-4 w-4 text-primary" />
              Distribution
            </CardTitle>
            <CardDescription className="text-xs">Percentage breakdown of each complaint type.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.8fr)]">
              <div className="h-[180px] w-full md:h-[210px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.byType || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={window.innerWidth < 768 ? 28 : 42}
                      outerRadius={window.innerWidth < 768 ? 52 : 72}
                      paddingAngle={5}
                      dataKey="count"
                      nameKey="type"
                      isAnimationActive
                      animationBegin={420}
                      animationDuration={1300}
                      animationEasing="ease-out"
                    >
                      {(stats.byType || []).map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                          onClick={() => navigate(`/complaints?category=${encodeURIComponent(categoryForType(entry.type))}&type=${encodeURIComponent(entry.type)}&range=all`)}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: '16px',
                        ...TOOLTIP_STYLE,
                      }}
                      labelStyle={{ color: 'var(--popover-foreground)' }}
                      itemStyle={{ color: 'var(--popover-foreground)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul aria-label="Complaint type distribution labels" className="max-h-[210px] space-y-1 overflow-y-auto pr-1">
                {(stats.byType || []).map((entry, index) => (
                  <li key={`${entry.type}-${index}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/40">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <Link
                      to={`/complaints?category=${encodeURIComponent(categoryForType(entry.type))}&type=${encodeURIComponent(entry.type)}&range=all`}
                      className="min-w-0 flex-1 truncate hover:underline focus-visible:underline"
                      title={`View ${categoryForType(entry.type)} complaints: ${entry.type}`}
                    >{entry.type}</Link>
                    <span className="font-semibold tabular-nums text-muted-foreground">{entry.count}</span>
                  </li>
                ))}
                {!(stats.byType || []).length && <li className="px-2 py-3 text-xs text-muted-foreground">No complaint data to display.</li>}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

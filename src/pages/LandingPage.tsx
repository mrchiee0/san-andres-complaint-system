import { apiUrl } from '../lib/api';
import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  MessageSquare, 
  Clock, 
  Shield, 
  Users, 
  Smartphone,
  ChevronRight,
  Star,
  Zap,
  Lock,
  Info,
  Settings,
  Home,
  MapPinned,
  MapPin,
  Facebook,
  Mail,
  Phone,
  Clock3,
  ArrowUp,
  LogIn,
  Menu,
  X
} from 'lucide-react';

import StepDemo, { COMPLAINT_DEMO_STEPS } from '../components/StepDemo';
import FeatureDemo from '../components/FeatureDemo';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet';
import { cn } from '../lib/utils';
import { cloudinaryImageUrl } from '../lib/cloudinaryAssets';
import AIChatbot from '../components/AIChatbot';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAuth } from '../hooks/useAuth';
import { ComplaintType } from '../types';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { COMPLAINT_CATEGORIES } from '../data/complaintTaxonomy';
import BrandLogo from '../components/BrandLogo';
import CommunityBoundaryMap from '../components/CommunityBoundaryMap';

const ctaCarouselImages = [
  cloudinaryImageUrl('cta-cleanup.jpg'),
  cloudinaryImageUrl('cta-address.jpg'),
  cloudinaryImageUrl('cta-community.jpg'),
];
const aboutCarouselImages = [
  { src: cloudinaryImageUrl('san-andres-community.jpg'), alt: 'Community life in Barangay San Andres' },
  { src: cloudinaryImageUrl('about-san-andres-seal.jpg'), alt: 'Barangay San Andres official seal at the barangay hall' },
  { src: cloudinaryImageUrl('about-san-andres-community-1.jpg'), alt: 'Residents at a community activity in San Andres' },
  { src: cloudinaryImageUrl('about-san-andres-community-2.jpg'), alt: 'Barangay personnel speaking with a resident' },
];

function AnimatedWords({ text, className }: { text: string; className?: string }) {
  const shouldReduceMotion = useReducedMotion();
  const words = text.split(/(\s+)/);

  if (shouldReduceMotion) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <motion.span
        aria-hidden="true"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.35 }}
        variants={{ visible: { transition: { staggerChildren: 0.01 } } }}
      >
        {words.map((word, index) => /\s+/.test(word) ? word : (
          <motion.span
            key={`${word}-${index}`}
            className="inline-block"
            variants={{
              hidden: { opacity: 0, y: 4 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.16, ease: 'easeOut' } },
            }}
          >
            {word}
          </motion.span>
        ))}
      </motion.span>
    </span>
  );
}

function AnimatedStat({ value, decimals = 0, suffix = '', animate }: { value: number; decimals?: number; suffix?: string; animate: boolean }) {
  const [currentValue, setCurrentValue] = React.useState(0);

  React.useEffect(() => {
    if (!animate) return;

    const startedAt = performance.now();
    const duration = 1400;
    let frameId = 0;

    const updateValue = (timestamp: number) => {
      const progress = Math.min((timestamp - startedAt) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      setCurrentValue(value * easedProgress);
      if (progress < 1) frameId = requestAnimationFrame(updateValue);
    };

    frameId = requestAnimationFrame(updateValue);
    return () => cancelAnimationFrame(frameId);
  }, [animate, value]);

  return <>{currentValue.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>;
}

export default function LandingPage() {
  const prefersReducedMotion = useReducedMotion();
  const [selectedFeature, setSelectedFeature] = React.useState<string | null>(null);
  const [activeServiceIndex, setActiveServiceIndex] = React.useState<number | null>(null);
  const [demoDevice, setDemoDevice] = React.useState<'mobile' | 'tablet' | 'laptop'>('laptop');
  const [complaintTypes, setComplaintTypes] = React.useState<ComplaintType[]>([]);
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = React.useState(false);
  const [hasAnimatedStats, setHasAnimatedStats] = React.useState(false);
  const [showBackToTop, setShowBackToTop] = React.useState(false);
  const [activeSection, setActiveSection] = React.useState('home');
  const [sectionNotice, setSectionNotice] = React.useState<string | null>(null);
  const [ctaSlide, setCtaSlide] = React.useState(0);
  const [aboutSlide, setAboutSlide] = React.useState(0);
  const demographicsRef = React.useRef<HTMLElement | null>(null);
  const { settings } = useSettingsStore();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [activeFeatureIndex, setActiveFeatureIndex] = React.useState<number | null>(null);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setCtaSlide((currentSlide) => (currentSlide + 1) % ctaCarouselImages.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    if (prefersReducedMotion) return;
    const timer = window.setInterval(() => {
      setAboutSlide((currentSlide) => (currentSlide + 1) % aboutCarouselImages.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, [prefersReducedMotion]);

  React.useEffect(() => {
    fetch(apiUrl('/api/complaint-types'))
      .then(res => res.json())
      .then(data => setComplaintTypes(Array.isArray(data) ? data : []))
      .catch(err => console.error('Failed to fetch complaint types', err));
  }, []);

  React.useEffect(() => {
    const sections = ['about-us', 'services', 'features', 'demo']
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleSection = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visibleSection) return;
        const sectionId = visibleSection.target.id;
        setActiveSection(sectionId);
        setSectionNotice(
          sectionId === 'about-us' ? 'Learn about the purpose behind the system' :
          sectionId === 'services' ? 'Explore our barangay services' :
          sectionId === 'features' ? 'Discover what San Andres offers' :
          'See how easy it is to file a complaint'
        );
        window.setTimeout(() => setSectionNotice(null), 2600);
      },
      { threshold: [0.25, 0.6] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (event: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    event.preventDefault();
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 24);
      setShowBackToTop(window.scrollY > 500);
      if (window.scrollY < 80) setActiveSection('home');
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  React.useEffect(() => {
    const section = demographicsRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasAnimatedStats(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const handleFileNow = () => {
    if (token && user) {
      navigate('/complaints/new');
    } else {
      toast.info('Please log in or register before submitting a complaint.');
      navigate('/register');
    }
  };

  const getIconForCategory = (category: string) => {
    if (category.startsWith('Neighborhood')) return <Home size={24} />;
    if (category.startsWith('Environmental')) return <Zap size={24} />;
    if (category.startsWith('Property')) return <Settings size={24} />;
    if (category.startsWith('Traffic')) return <ArrowRight size={24} />;
    return <Shield size={24} />;
  };

  const complaintGroups = COMPLAINT_CATEGORIES.map((category) => ({
    category,
    types: complaintTypes.filter((type) => type.category === category),
  })).filter((group) => group.types.length > 0);
  const demographicStats = [
    { label: 'Total Population', value: Number(settings.population ?? 14318), icon: Users, suffix: '' },
    { label: 'Barangay Area', value: Number(settings.barangay_area ?? 0.86), icon: MapPinned, suffix: ' km²', decimals: 2 },
    { label: 'Number of Households', value: Number(settings.households ?? 3421), icon: Home, suffix: '' },
  ];
  const renderDemographicStat = (stat: typeof demographicStats[number]) => (
    <motion.div
      key={stat.label}
      initial={prefersReducedMotion ? false : { y: 14 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      whileHover={prefersReducedMotion ? undefined : { y: -4 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="community-stat-card group rounded-2xl border border-border/60 bg-card p-5 shadow-sm transition-shadow hover:shadow-xl sm:p-6"
    >
      <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
        <stat.icon size={20} />
      </div>
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground"><AnimatedWords text={stat.label} /></p>
      <p className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        <AnimatedStat value={stat.value} decimals={stat.decimals} suffix={stat.suffix} animate={hasAnimatedStats} />
      </p>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground">
      <AnimatePresence>
        {selectedFeature && (
          <FeatureDemo 
            type={selectedFeature} 
            onClose={() => setSelectedFeature(null)} 
          />
        )}
      </AnimatePresence>
      {/* Navigation */}
      <nav className={cn(
        "fixed top-0 z-50 w-full border-b backdrop-blur-xl transition-all duration-300",
        isScrolled
          ? "border-border/70 bg-white/75 shadow-sm"
          : "border-white/20 bg-white/15"
      )}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="San Andres homepage" className="flex min-w-0 max-w-[72%] items-center space-x-2 group sm:max-w-none">
            <BrandLogo
              className="h-8 w-8 rounded-lg bg-primary/10 transition-transform group-hover:scale-110"
              fallback={
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg transition-transform group-hover:rotate-6">
                  <ShieldCheck size={18} />
                </div>
              }
            />
            <span className="flex min-w-0 flex-col">
              <span className={cn(
                "truncate text-lg font-semibold leading-tight tracking-tight transition-colors sm:text-xl",
                isScrolled ? "text-foreground" : "text-white"
              )}>{settings.system_name}</span>
              <span className={cn(
                "text-[11px] leading-tight transition-colors sm:text-xs",
                isScrolled ? "text-muted-foreground" : "text-white/80"
              )}>Cainta, Rizal</span>
            </span>
          </Link>
          <div className="hidden items-center md:flex">
            <div className="flex items-center gap-4 lg:gap-6">
              <a href="#home" onClick={(event) => scrollToSection(event, 'home')} className={cn("text-xs font-medium tracking-tight transition-all hover:text-primary active:scale-95 lg:text-sm", isScrolled ? "text-muted-foreground" : "text-white")}>
                Home
              </a>
              <a href="#about-us" onClick={(event) => scrollToSection(event, 'about-us')} className={cn("text-xs font-medium tracking-tight transition-all hover:text-primary active:scale-95 lg:text-sm", isScrolled ? "text-muted-foreground" : "text-white", activeSection === 'about-us' && "font-semibold text-primary")}>About Us</a>
              <a href="#services" onClick={(event) => scrollToSection(event, 'services')} className={cn("text-xs font-medium tracking-tight transition-all hover:text-primary active:scale-95 lg:text-sm", isScrolled ? "text-muted-foreground" : "text-white", activeSection === 'services' && "font-semibold text-primary")}>Our Services</a>
              <a href="#features" onClick={(event) => scrollToSection(event, 'features')} className={cn("text-xs font-medium tracking-tight transition-all hover:text-primary active:scale-95 lg:text-sm", isScrolled ? "text-muted-foreground" : "text-white", activeSection === 'features' && "font-semibold text-primary")}>Features</a>
              <a href="#demo" onClick={(event) => scrollToSection(event, 'demo')} className={cn("text-xs font-medium tracking-tight transition-all hover:text-primary active:scale-95 lg:text-sm", isScrolled ? "text-muted-foreground" : "text-white", activeSection === 'demo' && "font-semibold text-primary")}>Demo</a>
            </div>
            <div className="ml-4 flex items-center gap-2 lg:ml-6">
              <Link to="/login">
                <Button variant="ghost" className={cn("h-8 gap-1.5 px-2.5 text-sm font-medium text-primary active:scale-95 hover:bg-primary/10 hover:text-primary", !isScrolled && "text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground")}>
                  <LogIn size={16} />
                  Login
                </Button>
              </Link>
              <Link to="/register">
                <Button className="h-9 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/30 active:scale-95">
                  Register
                </Button>
              </Link>
            </div>
          </div>
          <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
            <SheetTrigger render={<Button
              variant="ghost"
              size="icon"
              aria-label="Open navigation menu"
              title="Open navigation menu"
              className={cn("md:hidden", !isScrolled && "text-white hover:bg-white/15 hover:text-white")}
            />}>
              <Menu size={21} />
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(88vw,360px)] border-l border-border bg-card p-0 text-card-foreground">
              <SheetHeader className="border-b border-border p-5">
                <SheetTitle className="flex items-center gap-3 text-left">
                  <BrandLogo className="h-9 w-9 rounded-lg bg-primary/10" />
                  <span className="truncate">{settings.system_name}</span>
                </SheetTitle>
              </SheetHeader>
              <nav aria-label="Homepage navigation" className="flex flex-col gap-1 p-4">
                {[
                  { id: 'home', label: 'Home' },
                  { id: 'about-us', label: 'About Us' },
                  { id: 'services', label: 'Our Services' },
                  { id: 'features', label: 'Features' },
                  { id: 'demo', label: 'Demo' },
                ].map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    onClick={(event) => {
                      scrollToSection(event, item.id);
                      setIsMobileNavOpen(false);
                    }}
                    className={cn(
                      'rounded-lg px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted hover:text-primary',
                      activeSection === item.id && item.id !== 'home' ? 'bg-primary/10 text-primary' : 'text-foreground'
                    )}
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
              <div className="mt-auto grid gap-3 border-t border-border p-4">
                <Link to="/login" onClick={() => setIsMobileNavOpen(false)}>
                  <Button variant="outline" className="w-full justify-center gap-2">
                    <LogIn size={16} />
                    Login
                  </Button>
                </Link>
                <Link to="/register" onClick={() => setIsMobileNavOpen(false)}>
                  <Button className="w-full justify-center">Register</Button>
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative flex min-h-[100svh] items-center overflow-hidden pb-12 pt-24 md:pb-16 md:pt-24">
        {/* Decorative Elements */}
        {/* Hero background */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-scroll md:bg-fixed"
          style={{ backgroundImage: `url('${cloudinaryImageUrl('san-andres-hall.jpg')}')` }}
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-black/60" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="mx-auto mb-5 max-w-4xl text-3xl font-bold leading-tight tracking-[-0.03em] text-white sm:text-4xl md:text-5xl">
              <AnimatedWords text="Barangay San Andres Complaint System" />
            </h1>
            <p className="mx-auto mb-8 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base md:text-lg">
              <AnimatedWords text={settings.hero_subtitle} />
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <Link to="/register">
                <Button size="lg" className="h-12 rounded-full px-7 text-sm font-semibold shadow-2xl transition-transform group active:scale-95 sm:h-13 sm:px-8 sm:text-base">
                  Start now
                  <ArrowRight className="ml-2 group-hover:translate-x-2 transition-transform" />
                </Button>
              </Link>
              <a href="#demo">
                <Button variant="outline" size="lg" className="h-12 rounded-full border-white/50 bg-transparent px-7 text-sm font-semibold text-white transition-all hover:bg-white hover:text-primary active:scale-95 sm:h-13 sm:px-8 sm:text-base">
                  View Demo
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Barangay Demographics Section */}
      <section ref={demographicsRef} className="bg-background py-16 md:py-20" aria-labelledby="demographics-title">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-9 text-center md:mb-12">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-primary"><AnimatedWords text="Barangay San Andres" /></p>
            <h2 id="demographics-title" className="text-2xl font-semibold tracking-[-0.02em] md:text-4xl"><AnimatedWords text="Our Community at a Glance" /></h2>
          </div>
          <div className="community-stats-marquee sm:hidden" aria-label="Barangay community statistics">
            <div className="community-stats-track">
              {[0, 1].map((copy) => (
                <div key={copy} className="community-stats-group" aria-hidden={copy === 1}>
                  {demographicStats.map((stat) => renderDemographicStat(stat))}
                </div>
              ))}
            </div>
          </div>
          <div className="hidden grid-cols-3 gap-5 sm:grid">
            {demographicStats.map((stat) => renderDemographicStat(stat))}
          </div>
          <CommunityBoundaryMap />
        </div>
      </section>

      <section id="about-us" className="scroll-mt-20 overflow-hidden bg-white py-16 md:py-20" aria-labelledby="about-us-title">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto mb-8 max-w-3xl text-center md:mb-10">
            <Badge variant="outline" className="mb-4 border-primary/20 text-primary font-bold uppercase tracking-[0.2em] text-[10px]">
              <AnimatedWords text="About Us" />
            </Badge>
            <h2 id="about-us-title" className="text-2xl font-semibold leading-tight tracking-[-0.02em] sm:text-3xl md:text-4xl">
              <AnimatedWords text="A clearer way to listen, organize, and respond." />
            </h2>
          </div>

          <div className="grid items-stretch gap-6 md:grid-cols-2 md:gap-8 lg:gap-12">
            <div className="relative min-h-[260px] overflow-hidden rounded-2xl bg-muted sm:min-h-[340px] md:min-h-[420px]">
              <AnimatePresence mode="wait">
                <motion.img
                  key={aboutCarouselImages[aboutSlide].src}
                  src={aboutCarouselImages[aboutSlide].src}
                  alt={aboutCarouselImages[aboutSlide].alt}
                  initial={{ x: prefersReducedMotion ? 0 : 36, scale: 1.03 }}
                  animate={{ x: 0, scale: 1 }}
                  exit={{ x: prefersReducedMotion ? 0 : -24, scale: 0.99 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: 'easeOut' }}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </AnimatePresence>
              <div className="absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-black/45 to-transparent px-4 pb-4 pt-10 sm:px-5 sm:pb-5">
                <div className="flex items-center gap-2" aria-label="About Us photo carousel">
                  {aboutCarouselImages.map((image, index) => (
                    <button
                      key={image.src}
                      type="button"
                      aria-label={`Show photo ${index + 1}: ${image.alt}`}
                      aria-current={aboutSlide === index}
                      onClick={() => setAboutSlide(index)}
                      className={cn(
                        'h-2.5 w-2.5 rounded-full border border-white/80 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40',
                        aboutSlide === index ? 'scale-110 bg-white' : 'bg-white/40 hover:bg-white/80',
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-background p-5 shadow-sm sm:p-7 md:p-8">
              <div className="max-h-[300px] space-y-4 overflow-y-auto overscroll-contain pr-3 text-sm leading-relaxed text-muted-foreground sm:max-h-[360px] sm:text-base">
                <p>
                  <AnimatedWords text="Every community has concerns that deserve to be heard and handled with care. We created this complaint management system to give residents a clearer online way to share those concerns and provide the details needed for review." />
                </p>
                <p>
                  <AnimatedWords text="The system brings complaint information, supporting details, and available status updates into a more organized process. Residents can follow the progress of their report, while authorized barangay personnel can review and manage complaint records in one place." />
                </p>
                <p>
                  <AnimatedWords text="The built-in San Andres AI chatbot helps residents ask supported questions about complaint-related information and how to get started. It can use available knowledge-base content together with AI responses to provide guidance, while barangay personnel remain responsible for reviewing and processing each complaint." />
                </p>
                <p>
                  <AnimatedWords text="Our goal is to make the complaint journey easier to understand and help strengthen communication between residents and barangay personnel. The platform supports the work of public service; each complaint still receives review and handling by authorized personnel." />
                </p>
                <p className="font-medium text-foreground">
                  <AnimatedWords text="A more connected San Andres begins with listening to every concern." />
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Services Section */}
      <section id="services" className="scroll-mt-20 relative bg-background py-20 md:py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-12 text-center md:mb-14">
            <Badge variant="outline" className="mb-4 border-primary/20 text-primary font-bold uppercase tracking-widest text-[10px]"><AnimatedWords text="What We Handle" /></Badge>
            <h2 className="mb-4 text-3xl font-semibold tracking-[-0.02em] md:text-4xl"><AnimatedWords text="Our Services" /></h2>
            <p className="mx-auto max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              <AnimatedWords text="Here are the types of complaints and services we manage to help maintain peace, order, and proper governance in our barangay." />
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {complaintGroups.map((group, index) => (
              <motion.div
                key={group.category}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut', delay: index * 0.04 }}
                viewport={{ once: true }}
              >
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={activeServiceIndex === index}
                  onClick={() => setActiveServiceIndex(activeServiceIndex === index ? null : index)}
                  onMouseEnter={() => {
                    const supportsHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
                    if (supportsHover) setActiveServiceIndex(index);
                  }}
                  className="group w-full flex items-center gap-4 rounded-xl border border-border/60 bg-card px-5 py-4 text-left shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-110">
                    {getIconForCategory(group.category)}
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold leading-snug text-foreground"><AnimatedWords text={group.category} /></span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{group.types.length} service type{group.types.length !== 1 ? 's' : ''}</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-muted-foreground/50 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Full backdrop overlay modal for selected service */}
        <AnimatePresence>
          {activeServiceIndex !== null && complaintGroups[activeServiceIndex] && (() => {
            const group = complaintGroups[activeServiceIndex];
            return (
              <>
                {/* Backdrop */}
                <motion.div
                  key="service-backdrop"
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                  onClick={() => setActiveServiceIndex(null)}
                  aria-hidden="true"
                />
                {/* Modal panel */}
                <motion.div
                  key="service-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-label={`${group.category} services`}
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,480px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setActiveServiceIndex(null);
                  }}
                  tabIndex={-1}
                  ref={(el) => el?.focus()}
                >
                  {/* Modal header */}
                  <div className="flex items-center gap-3 border-b border-border/60 bg-primary/5 px-5 py-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {getIconForCategory(group.category)}
                    </span>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-foreground">{group.category}</h3>
                      <p className="text-[11px] text-muted-foreground">{group.types.length} service type{group.types.length !== 1 ? 's' : ''}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveServiceIndex(null)}
                      aria-label="Close"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Complaint types list */}
                  <div className="max-h-[50vh] overflow-y-auto px-5 py-4">
                    <div className="divide-y divide-border/50">
                      {group.types.length > 0 ? group.types.map((type: ComplaintType) => (
                        <div key={type.id} className="py-3 first:pt-0 last:pb-0">
                          <h4 className="text-sm font-semibold text-foreground">{type.name}</h4>
                          {type.description && (
                            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{type.description}</p>
                          )}
                        </div>
                      )) : (
                        <p className="py-3 text-sm text-muted-foreground">No active complaint types in this category.</p>
                      )}
                    </div>
                  </div>

                  {/* Footer CTA */}
                  <div className="border-t border-border/60 bg-muted/30 px-5 py-4">
                    <Button className="w-full" onClick={() => { handleFileNow(); setActiveServiceIndex(null); }}>
                      File a Complaint <ArrowRight size={15} className="ml-2" />
                    </Button>
                    <p className="mt-2 text-center text-[10px] text-muted-foreground">Press Esc or click outside to close</p>
                  </div>
                </motion.div>
              </>
            );
          })()}
        </AnimatePresence>
      </section>


{/* Features Section */}
<section id="features" className="scroll-mt-20 relative overflow-visible bg-white py-16 text-foreground md:py-20">
  <div className="relative z-10 mx-auto max-w-7xl px-6">
    <div className="mb-12 text-center md:mb-14">
      <h2 className="mb-4 text-2xl font-semibold tracking-[-0.02em] md:text-4xl">
        <AnimatedWords text="A clearer way to manage community concerns" />
      </h2>

      <p className="mx-auto max-w-2xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground md:text-base">
        <AnimatedWords text={settings.about_text} />
      </p>
    </div>

    <div className="grid grid-cols-1 gap-x-6 gap-y-4 overflow-visible md:grid-cols-2 lg:grid-cols-3" onMouseLeave={() => setActiveFeatureIndex(null)}>
      {[
        {
          icon: MessageSquare,
          title: 'Real-time Chat',
          desc: 'Message barangay staff directly within the context of your complaint.',
          color: 'bg-primary',
        },
        {
          icon: Clock,
          title: 'Complaint Tracking',
          desc: 'Follow staff-set case statuses from New through resolution.',
          color: 'bg-blue-500',
        },
        {
          icon: Shield,
          title: 'Safe and Private',
          desc: 'Complaint details are available to the complainant, named respondent, and authorized staff.',
          color: 'bg-green-500',
        },
        {
          icon: Smartphone,
          title: 'Mobile First',
          desc: 'File a complaint, attach evidence, and check its progress from your phone.',
          color: 'bg-orange-500',
        },
        {
          icon: Lock,
          title: 'Secure Auth',
          desc: 'Sign in with your password, or verify Google sign-in with an email code.',
          color: 'bg-purple-500',
        },
        {
          icon: Star,
          title: 'User Friendly',
          desc: 'Use guided complaint filing, evidence uploads, messages, and case updates.',
          color: 'bg-yellow-500',
        },
      ].map((feature, index) => (
        <motion.div
          key={feature.title}
          initial={prefersReducedMotion ? false : { x: index % 2 === 0 ? -24 : 24 }}
          whileInView={{ x: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: index * 0.025 }}
          onHoverStart={() => setActiveFeatureIndex(index)}
          onHoverEnd={() => setActiveFeatureIndex((current) => current === index ? null : current)}
          onFocusCapture={() => setActiveFeatureIndex(index)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setActiveFeatureIndex(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setActiveFeatureIndex(null);
          }}
          className="group relative h-[116px]"
          style={{ zIndex: activeFeatureIndex === index ? 20 : 0 }}
        >
          <Card className={`h-full overflow-visible rounded-xl border-border/60 bg-white text-foreground shadow-sm transition-all ${activeFeatureIndex === index ? 'border-primary/30 shadow-lg' : ''}`}>
            <CardContent className="h-full p-0">
              <button
                type="button"
                aria-expanded={activeFeatureIndex === index}
                aria-controls={`feature-details-${index}`}
                onClick={() => {
                  const supportsHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
                  setActiveFeatureIndex((current) => supportsHover ? index : current === index ? null : index);
                }}
                className="flex h-full w-full items-center gap-4 rounded-xl p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset sm:p-5"
              >
                <span
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-md transition-transform group-hover:scale-110',
                    feature.color,
                  )}
                >
                  <feature.icon size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold sm:text-base"><AnimatedWords text={feature.title} /></span>
                  <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-muted-foreground"><AnimatedWords text={feature.desc} /></span>
                </span>
              </button>
            </CardContent>
          </Card>
          <AnimatePresence>
            {activeFeatureIndex === index && (
              <motion.div
                id={`feature-details-${index}`}
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="absolute left-0 right-0 top-full z-30 -mt-px rounded-xl border border-border/60 bg-white p-3 shadow-xl"
              >
                <button
                  type="button"
                  onClick={() => setSelectedFeature(feature.title)}
                  className="flex w-full items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  View Demo <ChevronRight size={14} className="ml-1" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}
    </div>
  </div>
</section>

      {/* Demo Section */}
      <section id="demo" className="scroll-mt-20 overflow-hidden py-20 md:py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col items-center gap-12 lg:flex-row lg:gap-16">
            <div className="flex-1 text-center lg:text-left">
              <Badge variant="outline" className="mb-6 border-primary/20 text-primary font-bold uppercase tracking-widest text-[10px]"><AnimatedWords text="Interactive Demo" /></Badge>
              <h2 className="mb-5 text-3xl font-semibold leading-tight tracking-[-0.02em] md:text-4xl">
                <AnimatedWords text="Try our Interactive Demo." />
              </h2>
              <p className="mx-auto mb-8 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base lg:mx-0">
                <AnimatedWords text={`See how easy it is to submit a complaint through our system. Follow the steps on the right to experience the fast and efficient service of ${settings.system_name}.`} />
              </p>
              <div className="mx-auto max-w-md space-y-4 text-left lg:mx-0">
                {COMPLAINT_DEMO_STEPS.map((step, i) => (
                  <div key={step.label} className="flex items-start gap-3 sm:gap-4">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1"><p className="text-sm font-medium leading-snug text-foreground/80"><AnimatedWords text={step.label} /></p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground"><AnimatedWords text={step.description} /></p></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 w-full max-w-2xl mx-auto">
              <div className="relative flex flex-col items-center">
                <div className="absolute -inset-4 bg-primary/10 rounded-[3rem] blur-3xl -z-10"></div>
                
                {/* Device Switcher */}
                <div className="mb-7 flex items-center gap-1 rounded-full bg-muted p-1 shadow-inner">
                  {(['mobile', 'tablet', 'laptop'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDemoDevice(d)}
                      className={cn(
                        "rounded-full px-5 py-1.5 text-xs font-medium capitalize transition-all",
                        demoDevice === d 
                          ? "bg-white text-primary shadow-lg scale-105" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>

                <div className="flex min-h-[420px] w-full items-center justify-center">
                  <StepDemo device={demoDevice} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden py-20 text-white md:py-24">
        <div className="absolute inset-0 bg-background">
          <AnimatePresence mode="wait">
            <motion.img
              key={ctaCarouselImages[ctaSlide]}
              src={ctaCarouselImages[ctaSlide]}
              alt=""
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ duration: 1.1, ease: 'easeOut' }}
              className="h-full w-full object-cover"
            />
          </AnimatePresence>
          <div className="absolute inset-0 bg-black/25" />
        </div>
        
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className="mb-6 text-3xl font-semibold leading-tight tracking-[-0.02em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)] md:text-5xl">
            <AnimatedWords text="Bagong San Andres" />
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-sm leading-relaxed text-white md:text-base">
            <AnimatedWords text="Join thousands of residents who are already using the system to help build a better community." />
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link to="/register">
              <Button size="lg" variant="secondary" className="h-12 rounded-full px-8 text-sm font-semibold shadow-2xl transition-transform hover:scale-105 md:text-base">
                <AnimatedWords text="Register Now" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="secondary" className="h-12 rounded-full bg-white px-7 text-sm font-semibold text-primary shadow-xl transition-all hover:bg-white/85 hover:text-primary hover:shadow-2xl active:scale-95 md:text-base">
                <AnimatedWords text="Already have an account? Login" />
              </Button>
            </Link>
          </div>
          <div className="mt-8 flex items-center justify-center gap-2" aria-label="Change background photo">
            {ctaCarouselImages.map((image, index) => (
              <button
                key={image}
                type="button"
                aria-label={`Show background photo ${index + 1}`}
                onClick={() => setCtaSlide(index)}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  ctaSlide === index ? 'w-8 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80',
                )}
              />
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 bg-[#1a1a1a] text-zinc-200">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 py-14 md:grid-cols-[0.9fr_1.1fr_1fr] md:gap-12 md:py-16">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <BrandLogo
                className="h-12 w-12 rounded-xl bg-primary/10"
                fallback={
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <ShieldCheck size={24} />
                  </div>
                }
              />
              <div>
                <p className="text-lg font-semibold text-white"><AnimatedWords text={settings.footer_heading || 'Barangay San Andres'} /></p>
                <p className="mt-1 text-sm text-zinc-400"><AnimatedWords text="Cainta, Rizal" /></p>
              </div>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-zinc-300">
              <AnimatedWords text={settings.footer_description || 'Serving the community of San Andres, Cainta, Rizal with accessible and responsive public service.'} />
            </p>
          </div>

          <div>
            <h3 className="mb-5 text-base font-semibold text-white"><AnimatedWords text="Contact Us" /></h3>
            <div className="grid gap-4 text-sm text-zinc-300 sm:grid-cols-2">
              <div className="flex items-start gap-3"><MapPin size={17} className="mt-0.5 shrink-0 text-primary" /><span>{settings.footer_address}</span></div>
              <a href={`mailto:${settings.footer_email}`} className="flex items-start gap-3 hover:text-white"><Mail size={17} className="mt-0.5 shrink-0 text-primary" /><span>{settings.footer_email}</span></a>
              <a href="https://www.facebook.com/BSACPIO/" target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 hover:text-white"><Facebook size={17} className="mt-0.5 shrink-0 text-primary" /><span>Official Facebook page</span></a>
              <div className="flex items-start gap-3"><Phone size={17} className="mt-0.5 shrink-0 text-primary" /><span>{settings.footer_phone || '0917 123 4567\n02 8654 3210'}</span></div>
              <div className="flex items-start gap-3"><Clock3 size={17} className="mt-0.5 shrink-0 text-primary" /><span>{settings.footer_hours || 'Monday - Friday\n8:00 AM - 5:00 PM'}</span></div>
            </div>
          </div>

          <div className="w-full md:max-w-sm md:justify-self-end md:translate-x-3">
            <h3 className="mb-5 text-base font-semibold text-white"><AnimatedWords text="Find Us" /></h3>
            <div className="h-44 overflow-hidden rounded-2xl border border-border/60 bg-muted shadow-sm">
              <iframe
                title="Barangay San Andres location map"
                src="https://maps.google.com/maps?q=14.5742665%2C121.1038815&z=17&output=embed"
                className="h-full w-full border-0"
                loading="lazy"
              />
            </div>
          </div>
        </div>
        <div className="border-t border-border/60 bg-black/20">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-6 py-5 text-center text-xs text-zinc-400">
            <span>{settings.footer_text}</span>
            <span>All rights reserved.</span>
          </div>
        </div>
      </footer>
      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            type="button"
            aria-label="Back to top"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-5 left-5 z-[55] flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:bottom-7 sm:left-7"
          >
            <ArrowUp size={18} />
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {sectionNotice && (
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            className="pointer-events-none fixed bottom-5 left-1/2 z-[54] -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background shadow-xl sm:bottom-7"
          >
            {sectionNotice}
          </motion.div>
        )}
      </AnimatePresence>
      <AIChatbot />
    </div>
  );
}

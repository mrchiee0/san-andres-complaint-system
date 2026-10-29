import { apiUrl } from '../lib/api';
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../store/useAuthStore';
import { LABELS } from '../constants';
import { 
  LayoutDashboard, 
  FileText, 
  Calendar, 
  MessageSquare, 
  BarChart3, 
  LogOut, 
  Bell, 
  Menu, 
  X, 
  ShieldCheck,
  Settings,
  Moon,
  Sun,
  User as UserIcon,
  UsersRound,
  CheckCircle2,
  Trash2,
  MapPinned,
  Flame,
  CalendarDays,
  MessageCircle,
  BellRing,
  ChevronLeft,
  Send,
  TrendingUp,
  Brain
} from 'lucide-react';
import { cn, safeJson } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Button, buttonVariants } from './ui/button';
import { Input } from './ui/input';
import AIChatbot from './AIChatbot';
import Ably from 'ably';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { Badge } from './ui/badge';
import { useSettingsStore } from '../store/useSettingsStore';
import BrandLogo from './BrandLogo';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isDarkMode, setIsDarkMode] = React.useState(() => localStorage.getItem('theme') !== 'light');
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<any[]>([]);
  const [isMessagesPanelOpen, setIsMessagesPanelOpen] = React.useState(false);
  const [activeMessageThread, setActiveMessageThread] = React.useState<any | null>(null);
  const [threadMessages, setThreadMessages] = React.useState<any[]>([]);
  const [messageDraft, setMessageDraft] = React.useState('');
  const [isThreadLoading, setIsThreadLoading] = React.useState(false);
  const [isSendingMessage, setIsSendingMessage] = React.useState(false);
  const [messengerOrigin, setMessengerOrigin] = React.useState({ x: 0, y: 0 });
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const socketRef = React.useRef<any>(null);
  const messengerEndRef = React.useRef<HTMLDivElement | null>(null);
  const mobileMessagesButtonRef = React.useRef<HTMLButtonElement>(null);
  const desktopMessagesButtonRef = React.useRef<HTMLButtonElement>(null);
  const { settings } = useSettingsStore();
  const visibleNotificationTypes = user?.role === 'mamamayan'
    ? ['status_update', 'mediation_scheduled', 'mediation_summon', 'mediation_outcome', 'mediation_update']
    : ['new_complaint'];
  const isBellNotification = (notification: any) => visibleNotificationTypes.includes(notification.notification_type);

  const fetchMessages = React.useCallback(async () => {
    if (!user) {
      setMessages([]);
      return;
    }

    try {
      const res = await fetch(apiUrl('/api/complaints'), {
        headers: { Authorization: `Bearer ${useAuthStore.getState().token}` }
      });
      const complaints = await safeJson(res);
      const complaintList = Array.isArray(complaints) ? [...complaints] : [];
      complaintList.sort((left, right) => {
        const dateDifference = new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
        return dateDifference || Number(left.id) - Number(right.id);
      });
      const countsByReporter = new Map<number, number>();
      const complaintNumbers = new Map<number, number>();
      complaintList.forEach((complaint) => {
        const reporterId = Number(complaint.user_id);
        const complaintNumber = (countsByReporter.get(reporterId) || 0) + 1;
        countsByReporter.set(reporterId, complaintNumber);
        complaintNumbers.set(Number(complaint.id), complaintNumber);
      });

      const unread = complaintList
        .map((complaint) => ({
          id: complaint.id,
          complaint_id: complaint.id,
          complaint_number: complaintNumbers.get(Number(complaint.id)),
          mensahe: Number(complaint.unread_message_count ?? 0) > 0
            ? complaint.last_unread_message
            : complaint.last_message || 'Start a conversation',
          sender: Number(complaint.unread_message_count ?? 0) > 0 ? complaint.last_unread_sender : complaint.last_message_sender,
          unread_message_count: Number(complaint.unread_message_count ?? 0),
          petsa: complaint.last_message_at || complaint.created_at,
          complaint_created_at: complaint.created_at,
          blotter_number: complaint.blotter_number,
          uri_ng_reklamo: complaint.uri_ng_reklamo,
        }))
        .sort((left, right) => new Date(right.petsa).getTime() - new Date(left.petsa).getTime());
      setMessages(unread);
    } catch (error) {
      console.error('Failed to fetch unread messages:', error);
      setMessages([]);
    }
  }, [user]);

  React.useEffect(() => {
    if (user) {
      fetchNotifications();

      // Connect to Ably and subscribe to this user's personal channel.
      // VITE_ABLY_API_KEY should be a key scoped to subscribe-only capability.
      const ablyKey = (import.meta as any).env?.VITE_ABLY_API_KEY as string | undefined;
      if (!ablyKey) {
        console.warn('[Ably] VITE_ABLY_API_KEY is not set — real-time notifications disabled.');
        return;
      }
      const ablyClient = new Ably.Realtime({ key: ablyKey });
      socketRef.current = ablyClient;

      const userChannel = ablyClient.channels.get(`user_${user.id}`);
      const broadcastChannel = ablyClient.channels.get('broadcast');

      userChannel.subscribe('notification', (message) => {
        const notif = message.data;
        if (notif.notification_type === 'new_message') {
          void fetchMessages();
          return;
        }
        if (!isBellNotification(notif)) return;
        setNotifications(prev => [notif, ...prev]);
        if (audioRef.current) {
          audioRef.current.play().catch(e => console.log('Audio play failed:', e));
        }
        toast.info(notif.mensahe, {
          description: 'New system notification',
          duration: 5000,
        });
      });

      userChannel.subscribe('status_update', (message) => {
        // ComplaintDetail pages listen to window events for status changes
        window.dispatchEvent(new CustomEvent('ably_status_update', { detail: message.data }));
      });

      userChannel.subscribe('messages_read', (message) => {
        const { complaint_id } = message.data;
        setMessages((current) => current.map((m) => m.complaint_id === complaint_id ? { ...m, unread_message_count: 0 } : m));
        setThreadMessages((current) => current.map((m) => m.complaint_id === complaint_id && m.user_id !== user.id ? { ...m, nabasa: 1 } : m));
      });

      broadcastChannel.subscribe('new_complaint', () => {
        void fetchMessages();
      });

      return () => {
        userChannel.unsubscribe();
        broadcastChannel.unsubscribe();
        ablyClient.close();
        socketRef.current = null;
      };
    }
  }, [user, fetchMessages]);

  const fetchNotifications = async () => {
    if (!useAuthStore.getState().token) return;
    try {
      const res = await fetch(apiUrl('/api/notifications'), {
        headers: { 'Authorization': `Bearer ${useAuthStore.getState().token}` }
      });
      const data = await safeJson(res);
      setNotifications(Array.isArray(data) ? data.filter(isBellNotification) : []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      setNotifications([]);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await fetch(apiUrl(`/api/notifications/${id}/read`), {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${useAuthStore.getState().token}` }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, nabasa: 1 } : n));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch(apiUrl('/api/notifications/read-all'), {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${useAuthStore.getState().token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, nabasa: 1 })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const openNotification = async (notification: any) => {
    await markAsRead(notification.id);
    setIsNotificationsOpen(false);
    const target = typeof notification.target_path === 'string' ? notification.target_path : '/complaints';
    navigate(target.startsWith('/') && !target.startsWith('//') ? target : '/complaints');
  };

  const openMessage = async (thread: any) => {
    setActiveMessageThread(thread);
    setIsThreadLoading(true);
    setThreadMessages([]);
    try {
      const response = await fetch(apiUrl(`/api/complaints/${thread.complaint_id}`), {
        headers: { Authorization: `Bearer ${useAuthStore.getState().token}` }
      });
      const data = await safeJson(response);
      if (!response.ok) throw new Error(data.error || 'Unable to load this conversation.');
      setActiveMessageThread((current: any) => current?.complaint_id === thread.complaint_id
        ? { ...current, complaint_number: current.complaint_number ?? thread.complaint_number, uri_ng_reklamo: data.uri_ng_reklamo, complaint_created_at: data.created_at, blotter_number: data.blotter_number }
        : current);
      const conversation = Array.isArray(data.messages) ? data.messages : [];
      setThreadMessages(conversation);

      if (conversation.some((message: any) => message.user_id !== user?.id && !message.nabasa)) {
        await fetch(apiUrl(`/api/complaints/${thread.complaint_id}/messages/read`), {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${useAuthStore.getState().token}` }
        });
        setMessages((current) => current.map((item) => item.complaint_id === thread.complaint_id ? { ...item, unread_message_count: 0 } : item));
        setActiveMessageThread((current: any) => current?.complaint_id === thread.complaint_id ? { ...current, unread_message_count: 0 } : current);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load this conversation.');
      setActiveMessageThread(null);
    } finally {
      setIsThreadLoading(false);
    }
  };

  const sendMessengerMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeMessageThread || !messageDraft.trim() || isSendingMessage) return;
    const text = messageDraft.trim();
    setIsSendingMessage(true);
    try {
      const response = await fetch(apiUrl(`/api/complaints/${activeMessageThread.complaint_id}/messages`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${useAuthStore.getState().token}`
        },
        body: JSON.stringify({ mensahe: text })
      });
      const data = await safeJson(response);
      if (!response.ok) throw new Error(data.error || 'Unable to send this message.');
      const newMessage = {
        id: data.id,
        complaint_id: activeMessageThread.complaint_id,
        user_id: user?.id,
        mensahe: text,
        sender: user?.pangalan,
        petsa: new Date().toISOString(),
        nabasa: 0,
      };
      setThreadMessages((current) => current.some((message) => message.id === newMessage.id) ? current : [...current, newMessage]);
      setMessages((current) => current
        .map((thread) => thread.complaint_id === activeMessageThread.complaint_id
          ? { ...thread, mensahe: text, sender: user?.pangalan, petsa: newMessage.petsa }
          : thread)
        .sort((left, right) => new Date(right.petsa).getTime() - new Date(left.petsa).getTime()));
      setMessageDraft('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to send this message.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  React.useEffect(() => {
    const complaintId = activeMessageThread?.complaint_id;
    const ablyClient = socketRef.current as Ably.Realtime | null;
    if (!complaintId || !ablyClient) return;

    const channel = ablyClient.channels.get(`complaint_${complaintId}`);
    const handleNewMessage = (message: Ably.Message) => {
      const msg = message.data;
      setThreadMessages((current) => current.some((item) => item.id === msg.id) ? current : [...current, msg]);
      setMessages((current) => current
        .map((thread) => thread.complaint_id === complaintId
          ? { ...thread, mensahe: msg.mensahe, sender: msg.sender, petsa: msg.petsa }
          : thread)
        .sort((left, right) => new Date(right.petsa).getTime() - new Date(left.petsa).getTime()));
      if (msg.user_id !== user?.id) {
        void fetch(apiUrl(`/api/complaints/${complaintId}/messages/read`), {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${useAuthStore.getState().token}` }
        });
      }
    };

    channel.subscribe('new_message', handleNewMessage);
    channel.subscribe('complaint_read', (message) => {
      window.dispatchEvent(new CustomEvent('ably_complaint_read', { detail: message.data }));
    });

    return () => {
      channel.unsubscribe('new_message', handleNewMessage);
      channel.unsubscribe('complaint_read');
    };
  }, [activeMessageThread?.complaint_id, user?.id]);

  React.useEffect(() => {
    const openMessengerThread = (event: Event) => {
      const complaintId = (event as CustomEvent<{ complaintId: number }>).detail?.complaintId;
      if (!complaintId) return;
      const thread = messages.find((item) => item.complaint_id === complaintId) || { complaint_id: complaintId };
      captureMessengerOrigin();
      setIsMessagesPanelOpen(true);
      void openMessage(thread);
    };
    window.addEventListener('open-messenger-thread', openMessengerThread);
    return () => window.removeEventListener('open-messenger-thread', openMessengerThread);
  }, [messages]);

  React.useEffect(() => {
    messengerEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages]);

  const notificationLabel = (type: string) => ({
    new_complaint: 'New complaint',
    status_update: 'Status update',
    mediation_scheduled: 'Mediation scheduled',
    mediation_summon: 'Mediation notice',
    mediation_outcome: 'Mediation outcome',
    mediation_update: 'Mediation update',
    new_message: 'New message',
  } as Record<string, string>)[type] || 'Notification';

  const notificationIcon = (type: string) => {
    if (type === 'new_message') return <MessageCircle size={17} />;
    if (type.startsWith('mediation')) return <CalendarDays size={17} />;
    if (type === 'status_update') return <CheckCircle2 size={17} />;
    if (type === 'new_complaint') return <FileText size={17} />;
    return <BellRing size={17} />;
  };

  const unreadCount = notifications.filter(n => !n.nabasa).length;
  const unreadMessagesCount = messages.reduce((total, message) => total + message.unread_message_count, 0);

  const captureMessengerOrigin = (button?: HTMLButtonElement | null) => {
    const trigger = button || (window.matchMedia('(min-width: 768px)').matches
      ? desktopMessagesButtonRef.current
      : mobileMessagesButtonRef.current);
    if (!trigger) return;

    const bounds = trigger.getBoundingClientRect();
    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
    const panelWidth = Math.min(360, window.innerWidth - 24);
    const panelHeight = Math.min(520, window.innerHeight - 112);
    const panelLeft = window.innerWidth - (isDesktop ? 24 : 12) - panelWidth;
    const panelTop = window.innerHeight - (isDesktop ? 24 : 88) - panelHeight;
    setMessengerOrigin({
      x: bounds.left + bounds.width / 2 - panelLeft,
      y: bounds.top + bounds.height / 2 - panelTop,
    });
  };

  const handleMessageIconClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    captureMessengerOrigin(event.currentTarget);
    setIsMessagesPanelOpen((open) => !open);
    setIsNotificationsOpen(false);
  };

  const closeMessengerPanel = () => {
    captureMessengerOrigin();
    setIsMessagesPanelOpen(false);
  };

  const toggleTheme = () => setIsDarkMode((darkMode) => !darkMode);

  React.useEffect(() => {
    void fetchMessages();
  }, [fetchMessages, location.pathname]);

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  React.useEffect(() => () => {
    document.documentElement.classList.remove('dark');
  }, []);

  React.useEffect(() => {
    if (!user || user.role !== 'mamamayan' || user.profile_completed !== false) return;
    const dismissalKey = `profile-completion-dismissed:${user.id}`;
    if (sessionStorage.getItem(dismissalKey)) return;

    const notificationId = toast('Finish setting up your profile', {
      description: 'Add your full name and contact details in Settings. You can do this now or skip and complete it later.',
      duration: 12000,
      action: {
        label: 'Open Settings',
        onClick: () => navigate('/settings'),
      },
      cancel: {
        label: 'Skip for now',
        onClick: () => sessionStorage.setItem(dismissalKey, '1'),
      },
    });
    return () => {
      toast.dismiss(notificationId);
    };
  }, [user, navigate]);

  const navItems = [
    { name: LABELS.NAV.dashboard, path: '/dashboard', icon: LayoutDashboard, roles: ['mamamayan', 'admin', 'official'] },
    { name: LABELS.NAV.reklamo, path: '/complaints', icon: FileText, roles: ['mamamayan', 'admin', 'official'] },
    { name: LABELS.NAV.calendar, path: '/calendar', icon: Calendar, roles: ['admin', 'official'] },
    { name: 'Verified Accounts', path: '/admin/accounts', icon: UsersRound, roles: ['admin', 'official'] },
    { name: 'Settings', path: '/settings', icon: Settings, roles: ['mamamayan'] },
    {
      name: LABELS.NAV.reports,
      path: '/reports',
      icon: BarChart3,
      roles: ['admin'],
      subItems: [
        { name: 'Trend Analysis', path: '/reports/trends', icon: TrendingUp, roles: ['admin'] },
        { name: 'AI Prediction', path: '/reports/predictions', icon: Brain, roles: ['admin'] },
      ]
    },
    { name: 'Heatmap', path: '/barangay-map', icon: Flame, roles: ['admin', 'official'] },
    { name: 'Boundary Management', path: '/admin/boundaries', icon: MapPinned, roles: ['admin'] },
    { name: 'Settings', path: '/admin/settings', icon: Settings, roles: ['admin'] },
  ];

  const isItemActive = (path: string) => {
    if (location.pathname === path) return true;
    if (path === '/complaints' && (location.pathname === '/reklamo' || location.pathname.startsWith('/reklamo/'))) return true;
    if (path === '/calendar' && location.pathname === '/kalendaryo') return true;
    if (path === '/reports' && (location.pathname === '/reports' || location.pathname === '/ulat')) return true;
    if (path === '/reports/trends' && (location.pathname === '/reports/trends' || location.pathname === '/ulat/trends')) return true;
    if (path === '/reports/predictions' && (location.pathname === '/reports/predictions' || location.pathname === '/ulat/predictions')) return true;
    return false;
  };

  const filteredNav = navItems.filter(item => item.roles.includes(user?.role || ''));
  const isReportsPage = location.pathname === '/reports' || location.pathname === '/ulat';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getHeaderTitle = () => {
    if (location.pathname === '/complaints/new' || /^\/complaints\/[^/]+\/edit$/.test(location.pathname)) {
      return 'Complaint Form';
    }
    if (location.pathname === '/reports/trends' || location.pathname === '/ulat/trends') {
      return 'Trend Analysis';
    }
    if (location.pathname === '/reports/predictions' || location.pathname === '/ulat/predictions') {
      return 'AI Prediction';
    }
    return navItems.find(i => isItemActive(i.path))?.name || 'System';
  };

  return (
    <div className={cn(
      'min-h-screen w-full bg-background text-foreground flex flex-col md:flex-row font-sans overflow-x-hidden selection:bg-primary selection:text-primary-foreground',
      isReportsPage && 'reports-print-layout'
    )}>
      <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3" preload="auto" />
      
      {/* Mobile Header */}
      <header className="md:hidden h-16 bg-card border-b border-border flex items-center justify-between px-4 sticky top-0 z-[1000]">
        <div className="flex items-center space-x-2">
          <BrandLogo
            className="w-8 h-8 rounded-lg bg-primary/10"
            fallback={
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground shadow-lg">
                <ShieldCheck size={18} />
              </div>
            }
          />
          <span className="font-serif italic font-bold text-foreground">{settings.system_name}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggleTheme}
            className="text-muted-foreground"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </Button>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Messages"
              title="Messages"
              ref={mobileMessagesButtonRef}
              className="relative text-muted-foreground"
              onClick={handleMessageIconClick}
            >
              <MessageSquare size={20} />
              {unreadMessagesCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full border border-card bg-destructive px-1 text-[9px] font-bold text-white">
                  {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                </span>
              )}
            </Button>
          </div>
          <div className="relative">
            <Button 
              variant="ghost" 
              size="icon" 
              className="relative text-muted-foreground"
              onClick={() => {
                setIsNotificationsOpen(!isNotificationsOpen);
                closeMessengerPanel();
              }}
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-[10px] text-white font-bold h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center border border-card">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Button>
            <AnimatePresence>
              {isNotificationsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-4 w-[min(360px,calc(100vw-24px))] bg-card border border-border shadow-2xl rounded-2xl z-[1050] overflow-hidden"
                >
                  <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                    <h3 className="font-bold text-xs">Notifications</h3>
                    {unreadCount > 0 && (
                      <Button variant="ghost" size="sm" className="text-[8px] h-6 px-1" onClick={markAllAsRead}>
                        Mark all as read
                      </Button>
                    )}
                  </div>
                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground">
                        <p className="text-[10px]">No notifications.</p>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <button
                          type="button"
                          key={notif.id} 
                          className={cn(
                            "flex w-full items-start gap-3 p-3 text-left border-b border-border/50 transition-colors hover:bg-muted/50",
                            !notif.nabasa && "bg-primary/5"
                          )}
                          onClick={() => void openNotification(notif)}
                        >
                          <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", notif.nabasa ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary")}>{notificationIcon(notif.notification_type || 'general')}</span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className={cn("text-[10px] font-semibold", !notif.nabasa ? "text-foreground" : "text-muted-foreground")}>{notificationLabel(notif.notification_type || 'general')}</span>
                              {!notif.nabasa && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                            </span>
                            <span className={cn("mt-1 block text-xs leading-relaxed", !notif.nabasa ? "text-foreground" : "text-muted-foreground")}>{notif.mensahe}</span>
                            <span className="mt-1 block text-[10px] text-muted-foreground/70">{new Date(notif.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
            <SheetTrigger render={<button className={buttonVariants({ variant: "ghost", size: "icon" })} />}>
              <Menu size={24} />
            </SheetTrigger>
            <SheetContent side="left" className="flex h-full w-[280px] flex-col bg-card p-0 border-r border-border">
              <SheetHeader className="p-6 border-b border-border">
                <SheetTitle className="font-serif italic text-xl font-bold text-foreground flex items-center">
                  <BrandLogo
                    className="w-6 h-6 mr-2 rounded object-contain"
                    fallback={<ShieldCheck className="mr-2 text-primary" />}
                  />
                  {settings.system_name}
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto px-4">
                {filteredNav.map((item: any) => (
                  <React.Fragment key={item.path}>
                    <Link
                      to={item.path}
                      onClick={() => setIsSidebarOpen(false)}
                      className={cn(
                        "flex items-center p-3 rounded-xl transition-all group",
                        isItemActive(item.path)
                          ? "bg-primary text-primary-foreground shadow-lg"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <item.icon size={20} className="shrink-0" />
                      <span className="ml-3 font-medium">{item.name}</span>
                    </Link>
                    {item.subItems && (
                      <div className="ml-4 pl-3 border-l-2 border-border/60 space-y-1 my-1">
                        {item.subItems.map((sub: any) => (
                          <Link
                            key={sub.path}
                            to={sub.path}
                            onClick={() => setIsSidebarOpen(false)}
                            className={cn(
                              "flex items-center px-3 py-2 rounded-lg text-xs transition-all group",
                              isItemActive(sub.path)
                                ? "bg-primary/15 text-primary font-bold border border-primary/25"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            )}
                          >
                            <sub.icon size={16} className="shrink-0" />
                            <span className="ml-2.5 font-medium">{sub.name}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </nav>
              <div className="mt-auto shrink-0 border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={handleLogout}
                >
                  <LogOut size={20} className="mr-3" />
                  {LABELS.NAV.logout}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Sidebar (Desktop) */}
      <aside 
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 md:flex bg-card text-card-foreground flex-col border-r border-border transition-all duration-300 ease-in-out",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="p-6 flex items-center justify-between h-20">
          {isSidebarOpen && (
            <div className="flex items-center space-x-2 overflow-hidden">
              <BrandLogo
                className="w-8 h-8 rounded-lg bg-primary/10 shrink-0"
                fallback={
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground shadow-lg shrink-0">
                    <ShieldCheck size={18} />
                  </div>
                }
              />
              <span className="font-serif italic text-xl font-bold text-foreground truncate">
                {settings.system_name}
              </span>
            </div>
          )}
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
            className="hidden md:flex shrink-0"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </Button>
        </div>

        <nav className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto px-4">
          {filteredNav.map((item: any) => (
            <React.Fragment key={item.path}>
              <Link
                to={item.path}
                className={cn(
                  "flex items-center p-3 rounded-xl transition-all group",
                  isItemActive(item.path)
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
                title={item.name}
              >
                <item.icon size={20} className="shrink-0 group-hover:scale-110 transition-transform" />
                {isSidebarOpen && (
                  <span className="ml-3 font-medium whitespace-nowrap overflow-hidden">
                    {item.name}
                  </span>
                )}
              </Link>
              {item.subItems && isSidebarOpen && (
                <div className="ml-4 pl-3 border-l-2 border-border/60 space-y-1 my-1">
                  {item.subItems.map((sub: any) => (
                    <Link
                      key={sub.path}
                      to={sub.path}
                      className={cn(
                        "flex items-center px-3 py-2 rounded-lg text-xs transition-all group",
                        isItemActive(sub.path)
                          ? "bg-primary/15 text-primary font-bold border border-primary/25"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <sub.icon size={16} className="shrink-0 group-hover:scale-110 transition-transform" />
                      <span className="ml-2.5 font-medium whitespace-nowrap overflow-hidden">
                        {sub.name}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              {item.subItems && !isSidebarOpen && (
                <div className="flex flex-col items-center space-y-1 my-1">
                  {item.subItems.map((sub: any) => (
                    <Link
                      key={sub.path}
                      to={sub.path}
                      title={sub.name}
                      className={cn(
                        "flex items-center justify-center p-2 rounded-lg transition-all group",
                        isItemActive(sub.path)
                          ? "bg-primary/20 text-primary font-bold"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <sub.icon size={16} className="shrink-0 group-hover:scale-110 transition-transform" />
                    </Link>
                  ))}
                </div>
              )}
            </React.Fragment>
          ))}
        </nav>

        <div className="shrink-0 border-t border-border p-4 space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start px-3 text-muted-foreground"
            onClick={toggleTheme}
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            {isSidebarOpen && <span className="ml-3">{isDarkMode ? 'Light mode' : 'Dark mode'}</span>}
          </Button>
          <Button 
            variant="ghost" 
            className="w-full justify-start px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleLogout}
            aria-label={LABELS.NAV.logout}
            title={LABELS.NAV.logout}
          >
            <LogOut size={20} />
            {isSidebarOpen && <span className="ml-3">{LABELS.NAV.logout}</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen md:h-screen max-md:min-h-[100dvh] max-md:overflow-y-auto overflow-hidden relative">
        {/* Header (Desktop) */}
        <header className="hidden md:flex h-20 bg-card border-b border-border items-center justify-between px-8 shrink-0 relative z-[1000]">
          <h2 className="text-xl font-serif italic font-bold text-foreground">
            {getHeaderTitle()}
          </h2>
          
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Messages"
                title="Messages"
                ref={desktopMessagesButtonRef}
                className="relative text-muted-foreground"
                onClick={handleMessageIconClick}
              >
                <MessageSquare size={18} />
                {unreadMessagesCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-card bg-destructive px-1 text-[10px] font-bold text-white">
                    {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                  </span>
                )}
              </Button>
            </div>
            <div className="relative">
              <Button 
                variant="ghost" 
                size="icon" 
                className="relative text-muted-foreground"
                onClick={() => {
                  setIsNotificationsOpen(!isNotificationsOpen);
                  closeMessengerPanel();
                }}
              >
                <Bell size={22} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-[10px] text-white font-bold h-5 min-w-[20px] px-1 rounded-full flex items-center justify-center border-2 border-card">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-4 w-[min(420px,calc(100vw-32px))] bg-card border border-border shadow-2xl rounded-2xl z-[1050] overflow-hidden"
                  >
                    <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                      <h3 className="font-bold text-sm">Notifications</h3>
                      {unreadCount > 0 && (
                        <Button variant="ghost" size="sm" className="text-[10px] h-7 px-2" onClick={markAllAsRead}>
                          Mark all as read
                        </Button>
                      )}
                    </div>
                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                          <Bell className="mx-auto mb-2 opacity-20" size={32} />
                          <p className="text-xs">No notifications.</p>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <button
                            type="button"
                            key={notif.id} 
                            className={cn(
                              "flex w-full items-start gap-3 border-b border-border/50 p-4 text-left transition-colors hover:bg-muted/50",
                              !notif.nabasa && "bg-primary/5"
                            )}
                            onClick={() => void openNotification(notif)}
                          >
                            <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full", notif.nabasa ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary")}>{notificationIcon(notif.notification_type || 'general')}</span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-2">
                                <span className={cn("text-xs font-semibold", !notif.nabasa ? "text-foreground" : "text-muted-foreground")}>{notificationLabel(notif.notification_type || 'general')}</span>
                                {!notif.nabasa && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                              </span>
                              <span className={cn("mt-1 block text-sm leading-relaxed", !notif.nabasa ? "text-foreground" : "text-muted-foreground")}>{notif.mensahe}</span>
                              <span className="mt-1 block text-[10px] text-muted-foreground/70">{new Date(notif.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right flex flex-col items-end">
                <p className="text-sm font-bold text-foreground">{user?.pangalan}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-[8px] h-4 px-1.5 border-primary/20 text-primary font-bold uppercase tracking-widest bg-primary/5">
                    {user?.account_type || user?.is_resident}
                  </Badge>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{LABELS.ROLES[user?.role || 'mamamayan']}</p>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-lg">
                {user?.pangalan.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-10 pb-24 md:pb-10 bg-background/50">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-6 left-4 right-4 bg-card/80 text-foreground h-16 rounded-2xl flex items-center justify-around px-4 shadow-2xl z-40 border border-border backdrop-blur-lg">
          {filteredNav.slice(0, 4).map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center space-y-1 transition-all",
                isItemActive(item.path) ? "text-primary scale-110" : "text-muted-foreground"
              )}
            >
              <item.icon size={20} />
              <span className="text-[8px] font-bold uppercase tracking-widest">{item.name}</span>
            </Link>
          ))}
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="flex flex-col items-center justify-center space-y-1 text-muted-foreground"
          >
            <UserIcon size={20} />
            <span className="text-[8px] font-bold uppercase tracking-widest">Profile</span>
          </button>
        </nav>

        {user?.role === 'mamamayan' && <AIChatbot />}

      </main>

      <AnimatePresence>
        {isMessagesPanelOpen && user && (
          <motion.section
            initial={{ opacity: 0, scale: 0.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.04 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30, mass: 0.7 }}
            aria-label="Messages"
            style={{ transformOrigin: `${messengerOrigin.x}px ${messengerOrigin.y}px` }}
            className="fixed bottom-[5.5rem] right-3 z-[1100] flex h-[min(520px,calc(100dvh-112px))] w-[min(360px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl md:bottom-6 md:right-6"
          >
            <div className="flex min-h-14 items-center gap-2 border-b border-border bg-card px-3 py-2 shadow-sm">
              {activeMessageThread ? (
                <Button variant="ghost" size="icon" aria-label="Back to conversations" onClick={() => setActiveMessageThread(null)}>
                  <ChevronLeft size={20} />
                </Button>
              ) : (
                <MessageCircle size={18} className="ml-1 text-primary" />
              )}
              <div className="min-w-0 flex-1">
                {activeMessageThread ? (
                  <>
                    <p className="truncate text-sm font-semibold">
                      {user.role === 'mamamayan'
                        ? `Complaint ID #${activeMessageThread.complaint_number ?? activeMessageThread.complaint_id}`
                        : `Blotter No. ${activeMessageThread.blotter_number || activeMessageThread.complaint_id}`}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">Blotter No. {activeMessageThread.blotter_number || 'Not assigned'}</p>
                    <p className="truncate text-[10px] text-muted-foreground">Submitted {activeMessageThread.complaint_created_at ? new Date(activeMessageThread.complaint_created_at).toLocaleDateString('en-US', { dateStyle: 'medium' }) : 'date unavailable'}</p>
                    <p className="truncate text-[10px] font-medium uppercase tracking-wider text-primary">{activeMessageThread.uri_ng_reklamo}</p>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">Chats</p>
                    {unreadMessagesCount > 0 && <Badge variant="destructive" className="h-5 min-w-5 justify-center px-1 text-[10px]">{unreadMessagesCount}</Badge>}
                  </div>
                )}
              </div>
              <Button variant="ghost" size="icon" aria-label="Close messages" onClick={closeMessengerPanel}>
                <X size={18} />
              </Button>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {activeMessageThread ? (
                <motion.div
                  key={`thread-${activeMessageThread.complaint_id}`}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 18 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="flex min-h-0 flex-1 flex-col"
                >
                <div className="flex-1 space-y-3 overflow-y-auto bg-muted/20 p-3">
                  {isThreadLoading ? (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Loading conversation...</div>
                  ) : threadMessages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">No messages yet. Start the conversation.</div>
                  ) : threadMessages.map((message) => (
                    <div key={message.id} className={cn('flex flex-col', message.user_id === user.id ? 'items-end' : 'items-start')}>
                      <span className="mb-1 px-1 text-[10px] font-medium text-muted-foreground">{message.sender}</span>
                      <div className={cn(
                        'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm',
                        message.user_id === user.id ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-background text-foreground shadow-sm'
                      )}>
                        {message.mensahe}
                      </div>
                    </div>
                  ))}
                  <div ref={messengerEndRef} />
                </div>
                <form onSubmit={sendMessengerMessage} className="flex items-center gap-2 border-t border-border bg-card p-3">
                  <Input
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    placeholder="Write a message..."
                    aria-label="Write a message"
                    className="h-10 rounded-full bg-muted/50"
                  />
                  <Button type="submit" size="icon" aria-label="Send message" disabled={!messageDraft.trim() || isSendingMessage} className="h-10 w-10 shrink-0 rounded-full">
                    <Send size={17} />
                  </Button>
                </form>
                </motion.div>
            ) : (
              <motion.div
                key="inbox"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="min-h-0 flex-1 overflow-y-auto"
              >
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                    <MessageCircle size={30} className="mb-2 text-muted-foreground/40" />
                    <p className="text-sm font-semibold">No conversations yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">Messages about your complaints will appear here.</p>
                  </div>
                ) : messages.map((thread) => (
                  <div
                    role="button"
                    tabIndex={0}
                    key={thread.complaint_id}
                    onClick={() => void openMessage(thread)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        void openMessage(thread);
                      }
                    }}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-3 border-b border-border/50 px-3 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                      thread.unread_message_count > 0 && 'bg-primary/5'
                    )}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><MessageCircle size={20} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={cn('truncate text-sm', thread.unread_message_count > 0 ? 'font-bold text-foreground' : 'font-medium text-foreground')}>
                          {user.role === 'mamamayan'
                            ? `Complaint ID #${thread.complaint_number ?? thread.complaint_id}`
                            : `Blotter No. ${thread.blotter_number || thread.complaint_id}`}
                          {' · '}{thread.uri_ng_reklamo}
                        </span>
                        {thread.unread_message_count > 0 && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />}
                      </span>
                      <span className={cn('mt-1 block truncate text-xs', thread.unread_message_count > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                        {thread.sender ? `${thread.sender}: ` : ''}{thread.mensahe}
                      </span>
                      <span className="mt-1 block text-[10px] text-muted-foreground">{new Date(thread.petsa).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </span>
                  </div>
                ))}
              </motion.div>
            )}
            </AnimatePresence>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Bot, User, Sparkles, Minimize2, LogIn, UserPlus, ClipboardList, MessageCircle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Input } from './ui/input';
import { getChatResponse } from '../services/geminiService';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';

const STATUS_LABELS: Record<string, string> = {
  bago: 'New',
  sinusuri: 'Under Review',
  'naka-assign': 'Assigned',
  iniimbestigahan: 'Under Investigation',
  'naka-iskedyul': 'Scheduled',
  'sa-mediation': 'In Mediation',
  natapos: 'Resolved',
  archived: 'Archived',
};

const STATUS_NEXT_STEPS: Record<string, string> = {
  bago: 'Your complaint has been received and is waiting to be assigned for review.',
  sinusuri: 'Barangay staff are reviewing your complaint. No action is needed from you right now.',
  'naka-assign': 'Your complaint has been assigned to a barangay officer for investigation.',
  iniimbestigahan: 'Your complaint is currently under active investigation.',
  'naka-iskedyul': 'A mediation hearing has been scheduled. Check the complaint details page for the schedule.',
  'sa-mediation': 'Mediation proceedings are ongoing. Please attend any scheduled hearings.',
  natapos: 'This complaint has been resolved. You may view the full case details for the resolution.',
  archived: 'This case has been closed and archived.',
};

interface ActionButton {
  label: string;
  icon?: React.ReactNode;
  action: () => void;
  variant?: 'primary' | 'outline';
}

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  disclaimer?: string;
  actions?: ActionButton[];
}

// Intent detector: returns a recognized intent or null
function detectIntent(text: string): string | null {
  const t = text.toLowerCase();
  if (/\b(register|sign.?up|create.?account|gumawa|mag-sign|magrehistro)\b/.test(t)) return 'register';
  if (/\b(log.?in|login|sign.?in|mag-login|account|password|pasok)\b/.test(t)) return 'login';
  if (/\b(status|track|complaint|reklamo|case|blotter|filed|sinubmit|nasubmit|update|progress)\b/.test(t)) return 'status';
  if (/\b(official|admin|staff|contact|tao|assistance|help me|tulong|talk|message|barangay officer|magmessage)\b/.test(t)) return 'contact';
  return null;
}

export default function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'model',
      text: "Hello! I'm the San Andres AI Assistant. I can help you with registering an account, checking complaint status, or connecting with barangay officials. How can I help you today?",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, token } = useAuth();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const addBotMessage = (text: string, actions?: ActionButton[], disclaimer?: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'model',
      text,
      timestamp: new Date(),
      disclaimer,
      actions,
    }]);
  };

  const openMessenger = (complaintId: number) => {
    window.dispatchEvent(new CustomEvent('open-messenger-thread', { detail: { complaintId } }));
    setIsOpen(false);
  };

  const handleRegisterIntent = () => {
    addBotMessage(
      "To file complaints with Barangay San Andres, you need a resident account. Here's what to prepare:\n\n• Full name\n• Valid email address\n• Home address in Barangay San Andres\n• A secure password\n\nClick the button below to create your account:",
      [{
        label: 'Create an Account',
        icon: <UserPlus size={14} />,
        action: () => { navigate('/register'); setIsOpen(false); },
        variant: 'primary',
      }]
    );
  };

  const handleLoginIntent = () => {
    if (user) {
      addBotMessage(
        `You're already logged in as ${user.pangalan || 'a registered user'}! You can go to My Complaints to view your filed complaints, or ask me anything else.`,
        [{
          label: 'View My Complaints',
          icon: <ClipboardList size={14} />,
          action: () => { navigate('/complaints'); setIsOpen(false); },
          variant: 'outline',
        }]
      );
    } else {
      addBotMessage(
        "To access your complaints and communicate with barangay officials, please log in to your account:",
        [{
          label: 'Log In',
          icon: <LogIn size={14} />,
          action: () => { navigate('/login'); setIsOpen(false); },
          variant: 'primary',
        }]
      );
    }
  };

  const handleStatusIntent = async () => {
    if (!user || !token) {
      addBotMessage(
        "To check the status of your complaints, you need to be logged in. Please log in first:",
        [
          {
            label: 'Log In',
            icon: <LogIn size={14} />,
            action: () => { navigate('/login'); setIsOpen(false); },
            variant: 'primary',
          },
          {
            label: 'Create an Account',
            icon: <UserPlus size={14} />,
            action: () => { navigate('/register'); setIsOpen(false); },
            variant: 'outline',
          },
        ]
      );
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/complaints?scope=mine', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok || !Array.isArray(data) || data.length === 0) {
        addBotMessage(
          "You don't have any complaints filed yet. Would you like to file a complaint?",
          [{
            label: 'File a Complaint',
            icon: <ClipboardList size={14} />,
            action: () => { navigate('/complaints/new'); setIsOpen(false); },
            variant: 'primary',
          }]
        );
        return;
      }

      if (data.length === 1) {
        const c = data[0];
        const statusLabel = STATUS_LABELS[c.status] || c.status;
        const nextStep = STATUS_NEXT_STEPS[c.status] || 'Check the complaint details page for updates.';
        addBotMessage(
          `Here is the status of your complaint:\n\n📋 **${c.blotter_number || `Case #${c.id}`}**\n🔖 Type: ${c.uri_ng_reklamo}\n📅 Filed: ${new Date(c.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n**Status: ${statusLabel}**\n\n${nextStep}`,
          [
            {
              label: 'View Full Details',
              icon: <ChevronRight size={14} />,
              action: () => { navigate(`/complaints/${c.id}`); setIsOpen(false); },
              variant: 'primary',
            },
            {
              label: 'Message Officials',
              icon: <MessageCircle size={14} />,
              action: () => openMessenger(c.id),
              variant: 'outline',
            },
          ]
        );
      } else {
        // Multiple complaints — list them with navigation options
        const list = data.slice(0, 5).map((c: any, i: number) => {
          const statusLabel = STATUS_LABELS[c.status] || c.status;
          return `${i + 1}. ${c.blotter_number || `Case #${c.id}`} — ${c.uri_ng_reklamo} (${statusLabel})`;
        }).join('\n');

        const actions: ActionButton[] = data.slice(0, 3).map((c: any) => ({
          label: `View ${c.blotter_number || `Case #${c.id}`}`,
          icon: <ChevronRight size={14} />,
          action: () => { navigate(`/complaints/${c.id}`); setIsOpen(false); },
          variant: 'outline' as const,
        }));
        actions.unshift({
          label: 'View All Complaints',
          icon: <ClipboardList size={14} />,
          action: () => { navigate('/complaints'); setIsOpen(false); },
          variant: 'primary',
        });

        addBotMessage(
          `You have ${data.length} complaint(s) on file. Here are the most recent:\n\n${list}\n\nSelect one to view its full details:`,
          actions
        );
      }
    } catch {
      addBotMessage("I wasn't able to load your complaints right now. Please try again or visit the Complaints page directly.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleContactIntent = async () => {
    if (!user || !token) {
      addBotMessage(
        "To contact a barangay official, you need to be logged in. Log in to access the messaging feature:",
        [{
          label: 'Log In',
          icon: <LogIn size={14} />,
          action: () => { navigate('/login'); setIsOpen(false); },
          variant: 'primary',
        }]
      );
      return;
    }

    // Check for existing active complaint to link the conversation to
    setIsLoading(true);
    try {
      const res = await fetch('/api/complaints?scope=mine', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const activeComplaint = Array.isArray(data) && data.length > 0
        ? data.find((c: any) => !['natapos', 'archived'].includes(c.status)) || data[0]
        : null;

      if (activeComplaint) {
        addBotMessage(
          `I can connect you with a barangay official regarding your complaint (${activeComplaint.blotter_number || `Case #${activeComplaint.id}`}). Use the message thread to communicate directly with barangay staff:`,
          [
            {
              label: 'Continue Existing Conversation',
              icon: <MessageCircle size={14} />,
              action: () => openMessenger(activeComplaint.id),
              variant: 'primary',
            },
            {
              label: 'View All Complaints',
              icon: <ClipboardList size={14} />,
              action: () => { navigate('/complaints'); setIsOpen(false); },
              variant: 'outline',
            },
          ]
        );
      } else {
        addBotMessage(
          "You can reach barangay officials through the Chat page. If you have an active complaint, officials can also message you through your complaint thread:",
          [{
            label: 'Contact an Official',
            icon: <MessageCircle size={14} />,
            action: () => { navigate('/chat'); setIsOpen(false); },
            variant: 'primary',
          }]
        );
      }
    } catch {
      addBotMessage(
        "You can reach barangay officials through the Chat section:",
        [{
          label: 'Go to Chat',
          icon: <MessageCircle size={14} />,
          action: () => { navigate('/chat'); setIsOpen(false); },
          variant: 'primary',
        }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: userText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    const intent = detectIntent(userText);

    if (intent === 'register') { await handleRegisterIntent(); return; }
    if (intent === 'login') { await handleLoginIntent(); return; }
    if (intent === 'status') { await handleStatusIntent(); return; }
    if (intent === 'contact') { await handleContactIntent(); return; }

    setIsLoading(true);

    let kbResult: any = null;
    try {
      const kbRes = await fetch('/api/chat/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText })
      });
      if (kbRes.ok) kbResult = await kbRes.json();
    } catch (e) {
      console.warn('KB search failed', e);
    }

    try {
      const history = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
      const aiResponse = await getChatResponse(userText, history);
      const hasError = !aiResponse || aiResponse.includes('Unable to connect to the server.');

      if (hasError && kbResult) {
        addBotMessage(kbResult.text, undefined, 'Our cloud system is temporarily busy. Here is information from the knowledge base:');
      } else {
        const cleanResponse = aiResponse || "I could not process your request right now.";
        addBotMessage(cleanResponse);

        const looksLikeQuestion = userText.endsWith('?') ||
          /^(ano|paano|why|how|saan|bakit|kailan|what)\b/i.test(userText);

        if (looksLikeQuestion && cleanResponse.length > 30 && !hasError) {
          fetch('/api/chat/learn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: userText, answer: cleanResponse })
          }).catch(console.error);
        }
      }
    } catch (error) {
      console.error('Chat Error:', error);
      if (kbResult) {
        addBotMessage(kbResult.text, undefined, 'Our cloud system is offline. Here is the information currently available:');
      } else {
        addBotMessage('There was a problem connecting to the AI assistant. Please try again later.');
      }
    }

    setIsLoading(false);
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 md:bottom-10 md:right-10 z-[60] flex flex-col items-end pointer-events-none">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20, transformOrigin: 'bottom right' }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="mb-4 w-[calc(100vw-32px)] sm:w-[390px] h-[min(620px,75vh)] shadow-2xl pointer-events-auto"
          >
            <Card className="h-full flex flex-col border-border/50 rounded-[2.5rem] overflow-hidden bg-white/95 backdrop-blur-xl shadow-2xl dark:bg-card/95">
              <CardHeader className="p-5 bg-primary text-primary-foreground flex flex-row items-center justify-between shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                    <Bot size={22} className="animate-pulse" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-serif italic">San Andres AI</CardTitle>
                    <div className="flex items-center text-[10px] uppercase tracking-widest font-bold opacity-80">
                      <span className="w-2 h-2 bg-green-400 rounded-full mr-2 shadow-[0_0_8px_rgba(74,222,128,0.5)]"></span>
                      Assistant Online
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="text-primary-foreground hover:bg-white/10 rounded-full h-9 w-9"
                >
                  <Minimize2 size={18} />
                </Button>
              </CardHeader>

              <CardContent className="flex-1 overflow-hidden p-0 bg-muted/30">
                <div
                  ref={scrollRef}
                  className="h-full overflow-y-auto p-4 space-y-4 scroll-smooth"
                >
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex w-full",
                        msg.role === 'user' ? "justify-end" : "justify-start"
                      )}
                    >
                      <div className={cn(
                        "flex max-w-[85%] space-x-2",
                        msg.role === 'user' ? "flex-row-reverse space-x-reverse" : "flex-row"
                      )}>
                        <div className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-1 shadow-sm",
                          msg.role === 'user' ? "bg-primary text-primary-foreground" : "bg-white border border-border/50 dark:bg-muted"
                        )}>
                          {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                        </div>
                        <div className="space-y-2 flex-1">
                          <div className={cn(
                            "p-4 rounded-[1.5rem] text-sm leading-relaxed shadow-sm whitespace-pre-wrap",
                            msg.role === 'user'
                              ? "bg-primary text-primary-foreground rounded-tr-none"
                              : "bg-white text-foreground rounded-tl-none border border-border/50 dark:bg-card"
                          )}>
                            {msg.disclaimer && (
                              <div className="text-[10px] font-bold text-primary mb-1 italic opacity-70">
                                {msg.disclaimer}
                              </div>
                            )}
                            {msg.text}
                            <div className={cn(
                              "text-[8px] mt-1 font-bold opacity-50 uppercase tracking-tighter",
                              msg.role === 'user' ? "text-right" : "text-left"
                            )}>
                              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>

                          {/* Action buttons */}
                          {msg.actions && msg.actions.length > 0 && (
                            <div className="flex flex-wrap gap-2 pl-1">
                              {msg.actions.map((action, i) => (
                                <button
                                  key={i}
                                  onClick={action.action}
                                  className={cn(
                                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-sm",
                                    action.variant === 'primary'
                                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                      : "bg-white border border-border text-foreground hover:bg-muted dark:bg-card"
                                  )}
                                >
                                  {action.icon}
                                  {action.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="flex max-w-[80%] space-x-2">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-1 shadow-sm bg-white border border-border/50 dark:bg-muted">
                          <Bot size={14} className="animate-pulse" />
                        </div>
                        <div className="bg-white text-foreground p-4 rounded-[1.5rem] rounded-tl-none border border-border/50 shadow-sm flex space-x-1.5 dark:bg-card">
                          <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce"></span>
                          <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                          <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>

              {/* Quick action shortcuts */}
              <div className="px-4 pt-3 pb-1 border-t border-border/30 bg-white/80 dark:bg-card/80 shrink-0 flex gap-2 overflow-x-auto">
                <button
                  onClick={() => { setInput('How do I check my complaint status?'); }}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <ClipboardList size={11} /> Check status
                </button>
                <button
                  onClick={() => { setInput('How do I register?'); }}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <UserPlus size={11} /> Register
                </button>
                <button
                  onClick={() => { setInput('I need to contact an official'); }}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <MessageCircle size={11} /> Contact official
                </button>
              </div>

              <CardFooter className="p-4 border-t border-border/50 bg-white dark:bg-card shrink-0">
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                  className="flex w-full items-center space-x-3"
                >
                  <Input
                    placeholder="Magtanong dito..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="flex-1 h-12 rounded-[1.25rem] border-border/50 bg-muted/30 focus-visible:ring-primary text-sm px-5 transition-all focus:bg-white"
                    disabled={isLoading}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim() || isLoading}
                    className="rounded-[1.25rem] h-12 w-12 shrink-0 shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                  >
                    <Send size={18} />
                  </Button>
                </form>
              </CardFooter>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.1, rotate: isOpen ? 90 : 0 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-16 h-16 rounded-2xl shadow-2xl flex items-center justify-center transition-all duration-500 pointer-events-auto",
          isOpen
            ? "bg-destructive text-destructive-foreground rotate-90 rounded-[2rem]"
            : "bg-primary text-primary-foreground hover:shadow-primary/20"
        )}
      >
        {isOpen ? <X size={28} /> : <MessageSquare size={28} />}
        {!isOpen && (
          <span className="absolute -top-1 -right-1 flex h-6 w-6">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-6 w-6 bg-primary border-4 border-background flex items-center justify-center">
              <Sparkles size={10} className="text-primary-foreground fill-current" />
            </span>
          </span>
        )}
      </motion.button>
    </div>
  );
}

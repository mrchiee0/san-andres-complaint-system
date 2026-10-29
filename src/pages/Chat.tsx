import { apiUrl } from '../lib/api';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Complaint } from '../types';
import { LABELS } from '../constants';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { MessageSquare, Clock, ArrowRight, Search } from 'lucide-react';
import { cn, formatTime, safeJson } from '../lib/utils';
import { Input } from '../components/ui/input';
import { motion } from 'motion/react';

export default function Chat() {
  const { user, token } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        const res = await fetch(apiUrl('/api/complaints'), {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await safeJson(res);
          // Sort by last message or created date
          setComplaints(data);
        }
      } catch (error) {
        console.error('Error fetching complaints for chat:', error);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchComplaints();
    }
  }, [token]);

  const filteredComplaints = complaints.filter(c => 
    (c.uri_ng_reklamo?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (c.detalye?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif italic font-bold text-foreground">Messages</h1>
          <p className="text-muted-foreground">Choose a complaint to message barangay officials.</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            placeholder="Search messages..."
            className="pl-10 rounded-xl border-border/50 bg-card"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4">
        {filteredComplaints.length > 0 ? (
          filteredComplaints.map((complaint, index) => (
            <motion.div
              key={complaint.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div
                role="button"
                tabIndex={0}
                className="w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => window.dispatchEvent(new CustomEvent('open-messenger-thread', { detail: { complaintId: complaint.id } }))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    window.dispatchEvent(new CustomEvent('open-messenger-thread', { detail: { complaintId: complaint.id } }));
                  }
                }}
              >
                <Card className="group hover:shadow-xl transition-all border-border/50 rounded-[2rem] overflow-hidden bg-card cursor-pointer">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <MessageSquare size={28} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-bold text-foreground truncate">{complaint.uri_ng_reklamo}</h3>
                          {Number((complaint as any).unread_message_count ?? 0) > 0 && (
                            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">
                              {(complaint as any).unread_message_count}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                            {formatTime(complaint.created_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-[10px] uppercase tracking-widest font-bold py-0 h-5">
                            {complaint.uri_ng_reklamo}
                          </Badge>
                          <Badge className={cn(
                            "text-[10px] uppercase tracking-widest font-bold py-0 h-5",
                            complaint.status === 'natapos' ? "bg-green-500" : "bg-primary"
                          )}>
                            {LABELS.STATUS[complaint.status] || 'In progress'}
                          </Badge>
                        </div>
                        <p className={cn(
                          'text-sm truncate italic',
                          Number((complaint as any).unread_message_count ?? 0) > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'
                        )}>
                          {Number((complaint as any).unread_message_count ?? 0) > 0 ? 'Unread message in this complaint thread.' : 'Open this complaint\'s message thread.'}
                        </p>
                      </div>
                      <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-full bg-muted group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <ArrowRight size={20} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          ))
        ) : (
          <Card className="border-dashed border-2 border-border/50 rounded-[2rem] bg-transparent">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
                <MessageSquare size={32} />
              </div>
              <h3 className="text-lg font-bold mb-2">No conversations found</h3>
              <p className="text-muted-foreground max-w-xs mx-auto">
                Submit a new complaint to start a conversation with officials.
              </p>
              <Link to="/reklamo" className="mt-6 inline-block">
                <Badge className="px-4 py-2 rounded-full cursor-pointer hover:scale-105 transition-transform">
                  Go to Complaints
                </Badge>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

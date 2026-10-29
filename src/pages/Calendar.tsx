import { apiUrl } from '../lib/api';
import React, { useEffect, useState } from 'react';
import { Calendar as CalendarIcon, MapPin, Clock, ExternalLink } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { safeJson } from '../lib/utils';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router-dom';

interface MediationEvent {
  id: number;
  complaint_id: number;
  petsa: string;
  lokasyon: string;
  detalye: string;
  status: string;
  uri_ng_reklamo: string;
  blotter_number: string;
  reporter_name?: string;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<MediationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchEvents();
  }, [token]);

  const fetchEvents = async () => {
    try {
      const res = await fetch(apiUrl('/api/mediation'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await safeJson(res);
      setEvents(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      month: date.toLocaleDateString(undefined, { month: 'short' }),
      day: date.getDate(),
      time: date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
      fullDate: date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="bg-card p-8 rounded-[2rem] border border-border/50 shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-serif italic font-bold text-foreground">Hearing Calendar</h1>
            <p className="text-muted-foreground text-sm mt-1">Scheduled mediations and meetings.</p>
          </div>
          <Badge variant="outline" className="px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest border-primary/20 text-primary bg-primary/5">
            {events.length} Active Schedules
          </Badge>
        </div>
        
        {events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => {
              const dateInfo = formatDate(event.petsa);
              return (
                <div key={event.id} className="bg-muted/30 p-6 rounded-3xl border border-border/50 hover:border-primary/30 transition-all group flex flex-col h-full shadow-sm hover:shadow-lg">
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-14 h-14 bg-card rounded-2xl flex flex-col items-center justify-center border border-border shadow-sm group-hover:bg-primary group-hover:border-primary transition-colors">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground group-hover:text-primary-foreground/70">{dateInfo.month}</span>
                      <span className="text-xl font-bold text-foreground group-hover:text-primary-foreground">{dateInfo.day}</span>
                    </div>
                    <Badge variant={event.status === 'naka-iskedyul' ? "default" : "secondary"} className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full">
                      {event.status === 'naka-iskedyul' ? 'Scheduled' : event.status === 'tapos' ? 'Completed' : 'Cancelled'}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1 mb-4">
                    <span className="text-[10px] font-mono text-muted-foreground">{event.blotter_number}</span>
                    <h3 className="font-bold text-foreground text-lg group-hover:text-primary transition-colors line-clamp-2">
                      {event.uri_ng_reklamo}
                    </h3>
                  </div>
                  
                  <div className="space-y-3 text-sm text-muted-foreground mb-6 flex-1">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mr-3 shrink-0">
                        <Clock size={14} className="text-primary" />
                      </div>
                      <span>{dateInfo.time}</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mr-3 shrink-0">
                        <MapPin size={14} className="text-primary" />
                      </div>
                      <span className="truncate">{event.lokasyon}</span>
                    </div>
                  </div>

                  <Button 
                    variant="outline" 
                    className="w-full rounded-xl h-10 text-xs font-bold uppercase tracking-widest border-border hover:bg-primary hover:text-primary-foreground hover:border-primary group/btn"
                    onClick={() => navigate(`/reklamo/${event.complaint_id}`)}
                  >
                    <span>View Details</span>
                    <ExternalLink size={14} className="ml-2 group-hover/btn:translate-x-1 transition-transform" />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-12 p-20 border-2 border-dashed border-border/50 rounded-[2.5rem] flex flex-col items-center justify-center text-muted-foreground bg-muted/5">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6 opacity-50">
              <CalendarIcon size={40} />
            </div>
            <p className="font-serif italic text-xl mb-2 text-foreground/70">No hearings are scheduled yet.</p>
            <p className="text-sm">Scheduled mediation sessions will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

import { apiUrl } from '../lib/api';
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Printer, ChevronLeft, Download, ShieldCheck, User, Users, Calendar, MapPin } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../hooks/useAuth';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface SettlementData {
  id: number;
  complaint_id: number;
  petsa: string;
  lokasyon: string;
  detalye: string;
  status: string;
  outcome: string;
  document_path?: string;
  uri_ng_reklamo: string;
  complaint_detail: string;
  reporter_name: string;
  nireklamo_pangalan: string;
}

export default function Settlement() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<SettlementData | null>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(apiUrl(`/api/mediation/${id}`), {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const settlement = await response.json();
          setData(settlement);
        } else {
          toast.error('Document not found.');
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Error fetching settlement:', error);
        toast.error('Unable to connect to the server.');
      } finally {
        setLoading(false);
      }
    };

    if (token && id) {
      fetchData();
    }
  }, [token, id, navigate]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-muted-foreground font-medium animate-pulse">Preparing document...</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 print:pb-0 print:m-0">
      {/* Action Bar - Hidden on print */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-full">
          <ChevronLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <div className="flex gap-2">
          {data.document_path && (
            <Button 
              variant="outline" 
              size="sm" 
              className="rounded-full shadow-sm" 
              render={<a href={data.document_path} target="_blank" rel="noreferrer" />}
              nativeButton={false}
            >
              <Download className="w-4 h-4 mr-2" /> Download PDF
            </Button>
          )}
          <Button onClick={handlePrint} size="sm" className="rounded-full shadow-lg shadow-primary/20">
              <Printer className="w-4 h-4 mr-2" /> Print Agreement
          </Button>
        </div>
      </div>

      {/* Document Header Info - Brief overview before the paper */}
      <div className="space-y-2 print:hidden">
        <div className="flex items-center gap-2">
          <Badge className="rounded-full uppercase tracking-widest text-[10px] bg-green-500 hover:bg-green-600">
            AMICABLE SETTLEMENT
          </Badge>
          <span className="text-muted-foreground text-xs">•</span>
          <span className="text-xs text-muted-foreground font-mono">CASE #{data.complaint_id}</span>
        </div>
        <h1 className="text-3xl font-serif italic tracking-tight text-foreground">Settlement Agreement</h1>
        <p className="text-muted-foreground text-sm max-w-xl">
          This is the formal record of the agreement reached by both parties under the barangay justice process.
        </p>
      </div>

      {/* The "Paper" Document */}
      <Card className="border-border/40 shadow-2xl rounded-[1.5rem] overflow-hidden bg-white print:shadow-none print:border-none print:rounded-none">
        <CardContent className="p-12 md:p-16 space-y-12">
          {/* Official Letterhead */}
          <div className="text-center space-y-1 border-b-2 border-double border-slate-900 pb-8 relative">
             <div className="absolute left-0 top-0 opacity-10 print:opacity-20">
                <ShieldCheck className="w-20 h-20 text-slate-900" />
             </div>
             <p className="uppercase tracking-[0.3em] text-[10px] font-bold text-slate-500">Republic of the Philippines</p>
             <p className="uppercase tracking-[0.1em] text-xs font-bold text-slate-800">Municipality of Cainta</p>
             <p className="uppercase tracking-widest text-sm font-bold text-slate-900">Barangay San Andres</p>
             <div className="py-4">
                <h2 className="text-xl font-serif font-bold uppercase underline decoration-2 underline-offset-8">Office of the Barangay Justice Council</h2>
             </div>
          </div>

          {/* Parties Involved */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] items-center gap-8">
            <div className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
               <div className="flex items-center gap-2 text-slate-400">
                  <User className="w-4 h-4" />
                  <span className="uppercase text-[10px] font-bold tracking-widest">Complainant</span>
               </div>
               <p className="text-xl font-bold text-slate-900">{data.reporter_name}</p>
            </div>

            <div className="flex flex-col items-center">
               <div className="h-full w-px bg-slate-200 hidden md:block" />
               <span className="bg-white px-4 py-2 text-xs font-serif italic text-slate-400 z-10">versus</span>
               <div className="h-full w-px bg-slate-200 hidden md:block" />
            </div>

            <div className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
               <div className="flex items-center gap-2 text-slate-400">
                  <User className="w-4 h-4" />
                  <span className="uppercase text-[10px] font-bold tracking-widest">Respondent</span>
               </div>
               <p className="text-xl font-bold text-slate-900">{data.nireklamo_pangalan || 'N/A'}</p>
            </div>
          </div>

          {/* Subject Matter */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
               <FileText className="w-4 h-4 text-slate-400" />
               <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Complaint Subject</h3>
            </div>
            <div className="space-y-4">
              <p className="text-lg font-bold text-slate-900 underline decoration-slate-300 decoration-wavy underline-offset-4">{data.uri_ng_reklamo}</p>
              <div className="prose prose-slate max-w-none bg-slate-50/50 p-6 rounded-2xl italic text-slate-700">
                "{data.complaint_detail}"
              </div>
            </div>
          </div>

          {/* The Agreement Body */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
               <Users className="w-4 h-4 text-slate-400" />
               <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Agreement</h3>
            </div>
            <div className="space-y-6 leading-relaxed text-slate-800 font-serif text-lg">
              <p>
                We, the parties named above, voluntarily agree to settle our dispute under the following terms:
              </p>
              <div className="bg-slate-900 text-slate-50 p-8 rounded-[2rem] shadow-xl relative overflow-hidden group">
                <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
                   <FileText size={120} />
                </div>
                <p className="relative z-10 whitespace-pre-wrap min-h-[100px]">
                  {data.detalye || "The parties have agreed to resolve the matter peacefully without further claims."}
                </p>
              </div>
              <p>
                We confirm that this agreement was made without coercion or intimidation from either party. Failure to comply with these terms may result in legal action.
              </p>
            </div>
          </div>

          {/* Signatures */}
          <div className="pt-20 grid grid-cols-2 gap-16">
            <div className="text-center space-y-2">
              <div className="border-b border-slate-900 mx-8" />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em]">{data.reporter_name}</p>
              <p className="text-[9px] text-slate-400 italic">Complainant Signature</p>
            </div>
            <div className="text-center space-y-2">
              <div className="border-b border-slate-900 mx-8" />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em]">{data.nireklamo_pangalan || '------'}</p>
              <p className="text-[9px] text-slate-400 italic">Respondent Signature</p>
            </div>
          </div>

          <div className="pt-12 text-center space-y-2">
            <div className="border-b border-slate-900 mx-32" />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Barangay Mediation Council / Secretary</p>
            <p className="text-[9px] text-slate-400 italic">Witness Signature</p>
          </div>

          {/* Document Footer */}
          <div className="pt-16 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-slate-400 font-mono">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1"><Calendar size={12} /> {format(new Date(data.petsa), 'PPPP')}</span>
              <span className="flex items-center gap-1"><MapPin size={12} /> {data.lokasyon}</span>
            </div>
            <div className="uppercase tracking-widest">Barangay San Andres Digital Records</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { apiUrl } from '../lib/api';
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import BrandLogo from '../components/BrandLogo';
import { Printer, ChevronLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Mediation {
  id: number;
  complaint_id: number;
  blotter_number: string;
  complaint_date: string;
  petsa: string;
  lokasyon: string;
  detalye: string;
  uri_ng_reklamo: string;
  category?: string;
  complaint_detail: string;
  nireklamo_pangalan: string;
  reporter_name: string;
  assigned_personnel?: string;
  summons_details?: Record<string, string> | string | null;
}

export default function NoticeToAppear() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [data, setData] = React.useState<Mediation | null>(null);
  const [error, setError] = React.useState('');
  const [savedFields, setSavedFields] = React.useState({
    issueDate: format(new Date(), 'yyyy-MM-dd'),
    recipient: '',
    address: '',
    secretary: '',
    secretaryPosition: 'Lupon Secretary',
    chairperson: '',
    chairpersonPosition: 'Punong Barangay / Lupon Chairperson',
  });
  const [isSaveConfirmOpen, setIsSaveConfirmOpen] = React.useState(false);
  const [printAfterSave, setPrintAfterSave] = React.useState(false);
  const [isSavingSummons, setIsSavingSummons] = React.useState(false);
  const isStaff = user?.role !== 'mamamayan';
  const [fields, setFields] = React.useState({
    issueDate: format(new Date(), 'yyyy-MM-dd'),
    recipient: '',
    address: '',
    secretary: '',
    secretaryPosition: 'Lupon Secretary',
    chairperson: '',
    chairpersonPosition: 'Punong Barangay / Lupon Chairperson',
  });

  React.useEffect(() => {
    if (!token) return;
    fetch(apiUrl(`/api/mediation/${id}`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load summons details.');
        setData(result);
        const stored = typeof result.summons_details === 'string'
          ? JSON.parse(result.summons_details)
          : result.summons_details || {};
        const loadedFields = {
          issueDate: stored.issueDate || format(new Date(), 'yyyy-MM-dd'),
          recipient: result.nireklamo_pangalan || '',
          address: '',
          secretary: result.assigned_personnel || '',
          secretaryPosition: 'Lupon Secretary',
          chairperson: '',
          chairpersonPosition: 'Punong Barangay / Lupon Chairperson',
          ...stored,
        };
        setFields(loadedFields);
        setSavedFields(loadedFields);
      })
      .catch((fetchError) => setError(fetchError instanceof Error ? fetchError.message : 'Unable to load summons details.'));
  }, [id, token]);

  const updateField = (key: keyof typeof fields, value: string) => setFields((previous) => ({ ...previous, [key]: value }));
  const printDocument = () => {
    const cleanup = () => document.body.classList.remove('print-summons');
    document.body.classList.add('print-summons');
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
  };

  const handlePrint = () => {
    if (isStaff && JSON.stringify(fields) !== JSON.stringify(savedFields)) {
      setPrintAfterSave(true);
      setIsSaveConfirmOpen(true);
      return;
    }
    printDocument();
  };

  const saveSummons = async () => {
    if (!data || !isStaff || isSavingSummons) return;
    setIsSavingSummons(true);
    try {
      const response = await fetch(apiUrl(`/api/mediation/${data.id}/summons`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(fields),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save summons details.');
      toast.success(result.message || 'Summons details saved.');
      setSavedFields(fields);
      setIsSaveConfirmOpen(false);
      if (printAfterSave) printDocument();
      setPrintAfterSave(false);
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Unable to save summons details.');
    } finally {
      setIsSavingSummons(false);
    }
  };

  if (error) return <div className="p-8 text-center text-destructive">{error}</div>;
  if (!data) return <div className="p-8 text-center text-muted-foreground">Loading document...</div>;

  const editable = (key: keyof typeof fields, label: string, className = '') => (
    <label className={`block ${className}`}>
      <span className="sr-only">{label}</span>
      <Input
        aria-label={label}
        value={fields[key]}
        readOnly={!isStaff}
        onChange={(event) => updateField(key, event.target.value)}
        className="summons-field h-auto min-h-8 rounded-none border-0 border-b border-black/70 bg-transparent px-1 py-1 text-center text-sm text-black shadow-none focus-visible:ring-0"
      />
    </label>
  );

  return (
    <div className="print-summons min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="no-print flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ChevronLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> Print Notice
          </Button>
          {isStaff && (
            <Button variant="outline" onClick={() => {
              setPrintAfterSave(false);
              setIsSaveConfirmOpen(true);
            }}>
              Save summons
            </Button>
          )}
        </div>

        <Card className="rounded-none border border-black bg-white text-black shadow-none print:border-0">
          <CardContent className="p-8 md:p-14">
            <header className="grid grid-cols-[84px_1fr_84px] items-center border-b-2 border-black pb-5 text-center">
              <BrandLogo className="mx-auto h-16 w-16" />
              <div className="space-y-1 font-serif">
                <p className="text-sm uppercase">Republic of the Philippines</p>
                <p className="text-sm">Province of Rizal</p>
                <p className="text-sm">Municipality of Cainta</p>
                <h1 className="text-lg font-bold uppercase">Barangay San Andres</h1>
                <p className="text-xs uppercase tracking-wide">Office of the Lupong Tagapamayapa</p>
              </div>
              <div aria-hidden="true" />
            </header>

            <div className="mt-8 flex justify-between gap-8 text-sm">
              <p>Ref. No.: <strong>{data.blotter_number || `Case ${data.complaint_id}`}</strong></p>
              <p className="flex items-center gap-2">
                Date issued:
                <Input
                  aria-label="Summons issue date"
                  type="date"
                  value={fields.issueDate}
                  readOnly={!isStaff}
                  onChange={(event) => updateField('issueDate', event.target.value)}
                  className="summons-field h-auto w-40 rounded-none border-0 border-b border-black/70 bg-transparent px-1 py-1 text-sm text-black shadow-none focus-visible:ring-0"
                />
              </p>
            </div>

            <h2 className="my-8 text-center font-serif text-xl font-bold uppercase underline underline-offset-4">
              Summons / Notice to Appear
            </h2>

            <section className="space-y-1 text-sm">
              <p className="font-bold uppercase">To:</p>
              {editable('recipient', 'Recipient name')}
              <p className="pt-2 text-xs uppercase">Address / service details</p>
              {editable('address', 'Recipient address')}
            </section>

            <section className="mt-7 space-y-4 font-serif text-sm leading-7">
              <p>
                You are hereby notified to appear before the Lupong Tagapamayapa of Barangay San Andres in connection
                with the complaint identified below. Please attend personally at the date, time, and venue stated in
                this notice.
              </p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 border-y border-black py-4 font-sans text-sm">
                <p><strong>Case reference:</strong> {data.blotter_number || `Case ${data.complaint_id}`}</p>
                <p><strong>Complaint date:</strong> {format(new Date(data.complaint_date), 'MMMM d, yyyy')}</p>
                <p><strong>Nature of complaint:</strong> {data.uri_ng_reklamo}</p>
                <p><strong>Category:</strong> {data.category || 'Not recorded'}</p>
                <p><strong>Complainant:</strong> {data.reporter_name || '—'}</p>
                <p><strong>Respondent:</strong> {data.nireklamo_pangalan || '—'}</p>
                <p><strong>Assigned personnel:</strong> {data.assigned_personnel || '—'}</p>
                <p><strong>Schedule:</strong> {format(new Date(data.petsa), "MMMM d, yyyy 'at' h:mm a")}</p>
                <p><strong>Venue:</strong> {data.lokasyon}</p>
              </div>
              {data.detalye && <p><strong>Additional instructions:</strong> {data.detalye}</p>}
              <p>
                Proceedings are governed by the Local Government Code of 1991 (Republic Act No. 7160), including
                Sections 408, 410, 412, and 415, and applicable barangay procedure. Parties are generally required to
                appear personally as provided by Section 415. If a party does not appear, the Lupon will determine any
                next procedural action only as permitted by applicable law and after considering proper service.
                This notice does not impose a fine or other independent penalty.
              </p>
              <p>Please bring relevant documents and arrive at the stated venue on time.</p>
            </section>

            <div className="mt-16 grid grid-cols-2 gap-12 text-center">
              <div className="space-y-1">
                {editable('secretary', 'Issuing official name')}
                {editable('secretaryPosition', 'Issuing official position')}
                <p className="mt-2 border-t border-black pt-2 text-xs">Issued by</p>
              </div>
              <div className="space-y-1">
                {editable('chairperson', 'Chairperson name')}
                {editable('chairpersonPosition', 'Chairperson position')}
                <p className="mt-2 border-t border-black pt-2 text-xs">Punong Barangay / Lupon Chairperson</p>
              </div>
            </div>

            <div className="mt-14 grid grid-cols-2 gap-12 text-center text-sm">
              <div className="border-t border-black pt-2">Signature of recipient</div>
              <div className="border-t border-black pt-2">Date and time received</div>
            </div>
          </CardContent>
        </Card>
      </div>
      <Dialog open={isSaveConfirmOpen} onOpenChange={(open) => {
        if (!isSavingSummons) setIsSaveConfirmOpen(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm official summons changes</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Save the recipient, issuing officials, positions, and issue date to this mediation record and audit history?
          </p>
          <DialogFooter>
            <Button variant="outline" disabled={isSavingSummons} onClick={() => {
              setIsSaveConfirmOpen(false);
              setPrintAfterSave(false);
            }}>Cancel</Button>
            <Button disabled={isSavingSummons} onClick={saveSummons}>
              {isSavingSummons ? 'Saving...' : printAfterSave ? 'Save and print' : 'Confirm and save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <style>{`
        @media print {
          body { background: #fff !important; }
          .summons-field { color: #000 !important; print-color-adjust: exact; }
          @page { margin: 16mm; }
        }
      `}</style>
    </div>
  );
}

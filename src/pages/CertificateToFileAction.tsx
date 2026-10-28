import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import BrandLogo from '../components/BrandLogo';
import { Printer, ChevronLeft } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'sonner';

interface Complaint {
  id: number;
  blotter_number: string;
  uri_ng_reklamo: string;
  detalye: string;
  nireklamo_pangalan: string;
  reporter: string;
  created_at: string;
}

export default function CertificateToFileAction() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [data, setData] = React.useState<Complaint | null>(null);
  const [error, setError] = React.useState('');
  const [basis, setBasis] = React.useState('');
  const [officialName, setOfficialName] = React.useState('');
  const [officialPosition, setOfficialPosition] = React.useState('');
  const [isConfirming, setIsConfirming] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isStaff = user?.role !== 'mamamayan';

  const printCertificate = () => {
    const cleanup = () => document.body.classList.remove('print-certificate');
    document.body.classList.add('print-certificate');
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
  };

  React.useEffect(() => {
    if (!token) return;
    fetch(`/api/complaints/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load the complaint.');
        setData(result);
      })
      .catch((fetchError) => setError(fetchError instanceof Error ? fetchError.message : 'Unable to load the complaint.'));
  }, [id, token]);

  const prepareDocument = async () => {
    if (!data || !isStaff || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/complaints/${data.id}/certificate-to-file-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          basis: basis.trim(),
          official_name: officialName.trim(),
          official_position: officialPosition.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to record document preparation.');
      toast.success(result.message || 'Document preparation recorded.');
      setIsConfirming(false);
      printCertificate();
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : 'Unable to prepare this document.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (error) return <div className="p-8 text-center text-destructive">{error}</div>;
  if (!data) return <div className="p-8 text-center text-muted-foreground">Loading document...</div>;

  return (
    <div className="certificate-print min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="no-print flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ChevronLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          {isStaff && (
            <Button onClick={() => setIsConfirming(true)}>
              <Printer className="mr-2 h-4 w-4" /> Review and print
            </Button>
          )}
        </div>

        <Card className="rounded-none border border-black bg-white text-black shadow-none print:border-0">
          <CardContent className="p-8 md:p-14">
            <header className="grid grid-cols-[84px_1fr_84px] items-center border-b-2 border-black pb-5 text-center font-serif">
              <BrandLogo className="mx-auto h-16 w-16" />
              <div className="space-y-1">
                <p className="text-sm uppercase">Republic of the Philippines</p>
                <p className="text-sm">Province of Rizal</p>
                <p className="text-sm">Municipality of Cainta</p>
                <h1 className="text-lg font-bold uppercase">Barangay San Andres</h1>
                <p className="text-xs uppercase tracking-wide">Office of the Lupong Tagapamayapa</p>
              </div>
              <div aria-hidden="true" />
            </header>

            <div className="mt-8 flex justify-between gap-6 text-sm">
              <p>Blotter No.: <strong>{data.blotter_number || `Case ${data.id}`}</strong></p>
              <p>Date prepared: {format(new Date(), 'MMMM d, yyyy')}</p>
            </div>

            <div className="my-8 text-center">
              <h2 className="font-serif text-xl font-bold uppercase underline underline-offset-4">Certificate to File Action</h2>
              <p className="mt-2 text-xs font-bold uppercase tracking-wide">Draft for authorized staff verification</p>
            </div>

            <section className="space-y-3 border-y border-black py-4 text-sm">
              <p><strong>Complainant:</strong> {data.reporter || '—'}</p>
              <p><strong>Respondent:</strong> {data.nireklamo_pangalan || '—'}</p>
              <p><strong>Nature of complaint:</strong> {data.uri_ng_reklamo}</p>
              <p><strong>Complaint date:</strong> {format(new Date(data.created_at), 'MMMM d, yyyy')}</p>
            </section>

            <section className="mt-8 space-y-4 font-serif text-sm leading-7">
              <p>
                This draft records the procedural basis entered by the issuing barangay official in relation to the
                complaint identified above. The information below must be checked against the case file before this
                certificate is issued or relied upon.
              </p>
              <div className="space-y-2">
                <label className="block font-sans text-sm font-semibold" htmlFor="certificate-basis">
                  Verified proceedings and procedural basis
                </label>
                <Textarea
                  id="certificate-basis"
                  readOnly={!isStaff}
                  minLength={20}
                  maxLength={5000}
                  value={basis}
                  onChange={(event) => setBasis(event.target.value)}
                  className="min-h-32 rounded-none border border-black bg-white text-black"
                  placeholder={isStaff ? 'Record the verified notices, service, proceedings, outcome, and basis for preparing this certificate.' : 'No verified procedural basis has been recorded.'}
                />
              </div>
              <p>
                This document does not itself determine jurisdiction, establish facts not recorded above, dispense with
                statutory prerequisites, or impose a fine or other penalty. The Local Government Code of 1991
                (Republic Act No. 7160) and applicable barangay procedure govern any further action.
              </p>
            </section>

            <div className="mt-16 ml-auto max-w-sm space-y-1 text-center">
              <Input
                aria-label="Issuing official name"
                readOnly={!isStaff}
                value={officialName}
                onChange={(event) => setOfficialName(event.target.value)}
                className="h-auto rounded-none border-0 border-b border-black bg-transparent text-center text-sm text-black shadow-none"
                placeholder="Name of issuing official"
              />
              <Input
                aria-label="Issuing official position"
                readOnly={!isStaff}
                value={officialPosition}
                onChange={(event) => setOfficialPosition(event.target.value)}
                className="h-auto rounded-none border-0 border-b border-black bg-transparent text-center text-xs text-black shadow-none"
                placeholder="Official position"
              />
              <p className="pt-2 text-xs">Signature and official seal</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isConfirming} onOpenChange={(open) => {
        if (!isSubmitting) setIsConfirming(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm document preparation</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Confirm that the proceedings and procedural basis entered above have been checked against the case file and
            that you are authorized to prepare this document.
          </p>
          <DialogFooter>
            <Button variant="outline" disabled={isSubmitting} onClick={() => setIsConfirming(false)}>Cancel</Button>
            <Button
              disabled={isSubmitting || basis.trim().length < 20 || !officialName.trim() || !officialPosition.trim()}
              onClick={prepareDocument}
            >
              {isSubmitting ? 'Recording...' : 'Confirm and print'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <style>{`
        @media print {
          body.print-certificate * { visibility: hidden !important; }
          .certificate-print, .certificate-print * { visibility: visible !important; }
          .certificate-print { position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}

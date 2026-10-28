import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { safeJson, maskEmail } from '../lib/utils';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Search, UsersRound, UserRoundCheck } from 'lucide-react';
import { toast } from 'sonner';

type VerifiedAccount = { id: number; pangalan: string; email: string; username?: string; is_resident: 'Resident' | 'Non Resident'; account_type?: string };

export default function VerifiedAccounts() {
  const { token, user } = useAuth();
  const [accounts, setAccounts] = React.useState<VerifiedAccount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [scope, setScope] = React.useState<'Resident' | 'Non Resident'>('Resident');
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    if (!token) return;
    fetch('/api/admin/verified-accounts', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const data = await safeJson(response);
        if (!response.ok) throw new Error(data.error || 'Unable to load verified accounts.');
        setAccounts(Array.isArray(data) ? data : []);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Unable to load verified accounts.'))
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = accounts.filter((account) => account.is_resident === scope && `${account.pangalan} ${account.email} ${account.username || ''}`.toLowerCase().includes(query.toLowerCase()));
  const countFor = (residency: VerifiedAccount['is_resident']) => accounts.filter((account) => account.is_resident === residency).length;

  if (!['admin', 'official'].includes(user?.role || '')) return <div className="p-8 text-center text-muted-foreground">Staff access is required.</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-widest text-primary">Directory</p><h1 className="mt-1 text-2xl font-semibold text-foreground md:text-3xl">Verified Accounts</h1><p className="mt-1 text-sm text-muted-foreground">Email-verified accounts grouped by each user&apos;s selected residency status.</p></div>
        <div className="relative w-full sm:max-w-xs"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, or username" className="pl-9" /></div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {(['Resident', 'Non Resident'] as const).map((residency) => <button key={residency} type="button" onClick={() => setScope(residency)} className={`rounded-lg border p-4 text-left transition-colors ${scope === residency ? 'border-primary bg-primary/5' : 'border-border/60 bg-card hover:bg-muted/30'}`}>
          <span className="flex items-center justify-between text-xs font-semibold text-muted-foreground"><span>{residency === 'Resident' ? 'Residents' : 'Non-Residents'}</span><UsersRound size={16} /></span>
          <span className="mt-2 block text-2xl font-bold tabular-nums text-foreground">{loading ? '—' : countFor(residency)}</span>
        </button>)}
      </div>

      <Card className="overflow-hidden border-border/60 shadow-sm">
        <CardContent className="p-0">
          <div className="border-b border-border/60 px-4 py-3"><div className="flex items-center gap-2 text-sm font-semibold"><UserRoundCheck className="h-4 w-4 text-primary" />{scope === 'Resident' ? 'Residents' : 'Non-Residents'}</div></div>
          <div className="max-h-[65vh] overflow-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-muted/95 text-[10px] uppercase tracking-wider text-muted-foreground backdrop-blur"><tr><th className="px-4 py-3">Account</th><th className="px-4 py-3">Username</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Selected Residency</th><th className="px-4 py-3">Verification</th></tr></thead>
              <tbody className="divide-y divide-border/60">
                {loading ? <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">Loading accounts...</td></tr>
                  : filtered.length === 0 ? <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">No verified accounts found.</td></tr>
                    : filtered.map((account) => <tr key={account.id} className="hover:bg-muted/20"><td className="px-4 py-3 font-medium">{account.pangalan}</td><td className="px-4 py-3 text-muted-foreground">{account.username || '—'}</td><td className="px-4 py-3 text-muted-foreground">{maskEmail(account.email)}</td><td className="px-4 py-3"><Badge variant="outline">{account.is_resident}</Badge></td><td className="px-4 py-3"><Badge className="bg-emerald-600 text-white">Verified</Badge></td></tr>)}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { apiUrl } from '../lib/api';
import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../store/useAuthStore';
import { safeJson } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Save, ShieldCheck, UserRound } from 'lucide-react';

export default function UserSettings() {
  const { user, token } = useAuth();
  const [name, setName] = React.useState(user?.pangalan || '');
  const [phone, setPhone] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!token) return;
    fetch(apiUrl('/api/auth/profile/details'), { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const profile = await safeJson(response);
        if (!response.ok) throw new Error(profile.error || 'Unable to load your profile details.');
        return profile;
      })
      .then((profile) => {
        if (profile && typeof profile === 'object') {
          setName(profile.profile_completed === 0 || profile.profile_completed === false ? '' : profile.pangalan || '');
          setPhone(profile.phone_number || '');
          setAddress(profile.address || '');
        }
      })
      .catch(() => toast.error('Unable to load your profile details.'));
  }, [token]);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(apiUrl('/api/auth/profile'), {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pangalan: name, phone_number: phone, address }),
      });
      const data = await safeJson(response);
      if (!response.ok) throw new Error(data.error || 'Unable to update your profile.');
      if (data.user && token) useAuthStore.getState().login(token, { ...user, ...data.user });
      toast.success('Your profile has been updated.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Account</p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">Profile Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">Update the contact details used for your account. Phone number and address are optional.</p>
      </header>

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="flex items-center gap-2 text-lg"><UserRound className="h-5 w-5 text-primary" />Personal information</CardTitle>
          <CardDescription>Your registered residency classification cannot be changed here.</CardDescription>
        </CardHeader>
        <CardContent className="p-5 md:p-7">
          <form onSubmit={saveProfile} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="profile-name" className="text-sm font-medium">Full name</label>
              <Input id="profile-name" required maxLength={255} value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label htmlFor="profile-email" className="text-sm font-medium">Email address</label>
              <Input id="profile-email" type="email" value={user?.email || ''} disabled />
            </div>
            <div className="space-y-2">
              <label htmlFor="profile-phone" className="text-sm font-medium">Phone number</label>
              <Input id="profile-phone" maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label htmlFor="profile-address" className="text-sm font-medium">Address</label>
              <Input id="profile-address" maxLength={500} value={address} onChange={(event) => setAddress(event.target.value)} />
            </div>
            <div className="flex items-center justify-between border-t border-border/50 pt-5">
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                {user?.account_type || user?.is_resident || 'Resident'}
              </span>
              <Button type="submit" disabled={saving}>
                <Save className="mr-2 h-4 w-4" />{saving ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
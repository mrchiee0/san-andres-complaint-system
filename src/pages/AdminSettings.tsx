import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { Upload, Save, ShieldCheck, Plus, Trash2, Edit2, X, Activity, Settings as SettingsIcon, Layout as LayoutIcon } from 'lucide-react';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAuthStore } from '../store/useAuthStore';
import { useAuth } from '../hooks/useAuth';
import { ComplaintType } from '../types';
import { safeJson, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { COMPLAINT_CATEGORIES } from '../data/complaintTaxonomy';
import { OFFICIAL_BARANGAY_ADDRESS, OFFICIAL_PIO_EMAIL } from '../constants';

export default function AdminSettings() {
  const { user, token } = useAuth();
  const { settings, fetchSettings } = useSettingsStore();
  const [formData, setFormData] = React.useState(settings);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null);

  // Complaint Types state
  const [types, setTypes] = React.useState<ComplaintType[]>([]);
  const [loadingTypes, setLoadingTypes] = React.useState(true);
  const [newTypeCategory, setNewTypeCategory] = React.useState(COMPLAINT_CATEGORIES[0]);
  const [newTypeName, setNewTypeName] = React.useState('');
  const [newTypeDescription, setNewTypeDescription] = React.useState('');
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editCategory, setEditCategory] = React.useState('');
  const [editName, setEditName] = React.useState('');
  const [editDescription, setEditDescription] = React.useState('');
  React.useEffect(() => {
    setFormData(settings);
    setLogoPreview(settings.logo_path || null);
  }, [settings]);

  React.useEffect(() => {
    if (token) {
      fetchTypes();
    }
  }, [token]);

  const fetchTypes = async () => {
    setLoadingTypes(true);
    try {
      const res = await fetch('/api/admin/complaint-types', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await safeJson(res);
      setTypes(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error('Unable to load complaint types.');
    } finally {
      setLoadingTypes(false);
    }
  };

  const handleAddType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName.trim()) return;

    try {
      const res = await fetch('/api/admin/complaint-types', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ category: newTypeCategory, name: newTypeName, description: newTypeDescription })
      });
      if (res.ok) {
        toast.success('New complaint type added.');
        setNewTypeName('');
        setNewTypeDescription('');
        fetchTypes();
      } else {
        const error = await safeJson(res);
        toast.error(error.error || 'Unable to add complaint type.');
      }
    } catch (e) {
      toast.error('Unable to add complaint type.');
    }
  };

  const handleUpdateType = async (type: ComplaintType) => {
    try {
      const res = await fetch(`/api/admin/complaint-types/${type.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ category: editCategory, name: editName, description: editDescription, is_active: type.is_active })
      });
      if (res.ok) {
        toast.success('Updated successfully.');
        setEditingId(null);
        fetchTypes();
      } else {
        const error = await safeJson(res);
        toast.error(error.error || 'Unable to update complaint type.');
      }
    } catch (e) {
      toast.error('Unable to update complaint type.');
    }
  };

  const handleToggleTypeStatus = async (type: ComplaintType) => {
    try {
      const res = await fetch(`/api/admin/complaint-types/${type.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ category: type.category, name: type.name, description: type.description, is_active: type.is_active === 1 ? 0 : 1 })
      });
      if (res.ok) {
        toast.success(type.is_active === 1 ? 'Deactivated successfully.' : 'Activated successfully.');
        fetchTypes();
      }
    } catch (e) {
      toast.error('Unable to update complaint type status.');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveTextSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          system_name: formData.system_name,
          hero_title: formData.hero_title,
          hero_subtitle: formData.hero_subtitle,
          about_text: formData.about_text,
          footer_heading: formData.footer_heading,
          footer_description: formData.footer_description,
          footer_address: OFFICIAL_BARANGAY_ADDRESS,
          footer_email: OFFICIAL_PIO_EMAIL,
          footer_phone: formData.footer_phone,
          footer_hours: formData.footer_hours,
          footer_text: formData.footer_text,
          population: Math.max(0, Number(formData.population) || 0),
          barangay_area: Math.max(0, Number(formData.barangay_area) || 0),
          households: Math.max(0, Number(formData.households) || 0),
        }),
      });

      if (res.ok) {
        toast.success('Site settings updated successfully');
        fetchSettings(); // Refresh global store
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to update settings');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const objectUrl = URL.createObjectURL(file);
    setLogoPreview(objectUrl);

    setIsUploading(true);
    const form = new FormData();
    form.append('logo', file);

    try {
      const res = await fetch('/api/admin/upload-logo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: form,
      });

      if (res.ok) {
        toast.success('Logo uploaded successfully');
        fetchSettings(); // Refresh global store
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to upload logo');
      }
    } catch (err) {
      toast.error('Network error during upload');
    } finally {
      setIsUploading(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center text-destructive animate-bounce">
          <ShieldCheck size={40} />
        </div>
        <h2 className="text-2xl font-serif italic font-bold">Access Denied</h2>
        <p className="text-muted-foreground">Admin only area. You are not authorized to view this page.</p>
        <Button onClick={() => window.history.back()}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-4xl font-serif italic font-bold">Administration Settings</h1>
          <p className="text-muted-foreground mt-1 text-sm uppercase tracking-widest font-bold opacity-70">
            Manage system content and configurations
          </p>
        </div>
      </div>

      <Tabs defaultValue="site" className="space-y-8">
        <TabsList className="bg-card border border-border/50 p-1 rounded-2xl w-full md:w-auto h-auto grid grid-cols-2 md:inline-flex">
          <TabsTrigger value="site" className="rounded-xl px-8 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
            <LayoutIcon size={18} className="mr-2" /> Site Content
          </TabsTrigger>
          <TabsTrigger value="types" className="rounded-xl px-8 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
            <SettingsIcon size={18} className="mr-2" /> Complaint Types
          </TabsTrigger>
        </TabsList>

        <TabsContent value="site" className="space-y-8 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <Card className="border-border/50 shadow-xl rounded-[2.5rem] overflow-hidden sticky top-24">
                <CardHeader className="bg-muted/30 border-b border-border/50 p-8">
                  <CardTitle className="text-xl">System Logo</CardTitle>
                  <CardDescription>Upload a custom logo for branding.</CardDescription>
                </CardHeader>
                <CardContent className="p-8 flex flex-col items-center space-y-8">
                  <div className="w-48 h-48 rounded-[2rem] border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/20 shadow-inner group relative">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo Preview" className="w-full h-full object-contain p-4 transition-transform group-hover:scale-105" />
                    ) : (
                      <ShieldCheck size={64} className="text-muted-foreground opacity-30" />
                    )}
                    {isUploading && (
                      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  
                  <div className="w-full relative">
                    <input
                      type="file"
                      accept="image/jpeg, image/png, image/webp"
                      onChange={handleLogoUpload}
                      disabled={isUploading}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <Button className="w-full h-12 rounded-2xl font-bold" variant="outline" disabled={isUploading}>
                      {isUploading ? 'Uploading...' : <><Upload size={18} className="mr-2" /> Upload New Logo</>}
                    </Button>
                  </div>
                  <p className="text-[10px] text-center text-muted-foreground uppercase tracking-widest font-bold">
                    PNG, JPG or WEBP. Max 5MB.
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card className="border-border/50 shadow-xl rounded-[2.5rem] overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border/50 p-8">
                  <CardTitle className="text-xl">Content Management</CardTitle>
                  <CardDescription>Manage the textual content of the landing page.</CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                  <form onSubmit={handleSaveTextSettings} className="space-y-8">
                    <div className="grid grid-cols-1 gap-6">
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">System Name</label>
                        <Input
                          name="system_name"
                          value={formData.system_name || ''}
                          onChange={handleChange}
                          className="h-14 rounded-2xl bg-muted/30 border-border/50 focus:ring-2 focus:ring-primary/20 transition-all text-lg font-medium"
                          placeholder="e.g. San Andres Complaint System"
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">Hero Title (HTML Supported)</label>
                        <Input
                          name="hero_title"
                          value={formData.hero_title || ''}
                          onChange={handleChange}
                          className="h-14 rounded-2xl bg-muted/30 border-border/50 focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">Hero Subtitle</label>
                        <textarea
                          name="hero_subtitle"
                          value={formData.hero_subtitle || ''}
                          onChange={handleChange}
                          className="w-full p-4 rounded-2xl bg-muted/30 border border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none min-h-[120px] resize-none"
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">About Us Section</label>
                        <textarea
                          name="about_text"
                          value={formData.about_text || ''}
                          onChange={handleChange}
                          className="w-full p-4 rounded-2xl bg-muted/30 border border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none min-h-[120px] resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border/50 bg-muted/20 p-5 sm:grid-cols-3">
                        <label className="space-y-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Population<Input type="number" min={0} name="population" value={formData.population ?? 14318} onChange={handleChange} /></label>
                        <label className="space-y-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Barangay Area (km²)<Input type="number" min={0} step="0.01" name="barangay_area" value={formData.barangay_area ?? 0.86} onChange={handleChange} /></label>
                        <label className="space-y-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Households<Input type="number" min={0} name="households" value={formData.households ?? 3421} onChange={handleChange} /></label>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-3">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">Footer Heading</label>
                          <Input
                            name="footer_heading"
                            value={formData.footer_heading || ''}
                            onChange={handleChange}
                            className="h-14 rounded-2xl bg-muted/30 border-border/50 focus:ring-2 focus:ring-primary/20 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">Footer Copyright Text</label>
                          <Input
                            name="footer_text"
                            value={formData.footer_text || ''}
                            onChange={handleChange}
                            className="h-14 rounded-2xl bg-muted/30 border-border/50 focus:ring-2 focus:ring-primary/20 transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">Footer Description</label>
                        <textarea
                          name="footer_description"
                          value={formData.footer_description || ''}
                          onChange={handleChange}
                          className="w-full p-4 rounded-2xl bg-muted/30 border border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none min-h-[100px] resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-3">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">Footer Address</label>
                          <Input
                            name="footer_address"
                            value={OFFICIAL_BARANGAY_ADDRESS}
                            readOnly
                            onChange={handleChange}
                            className="h-14 rounded-2xl bg-muted/30 border-border/50 focus:ring-2 focus:ring-primary/20 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">Footer Email</label>
                          <Input
                            name="footer_email"
                            value={OFFICIAL_PIO_EMAIL}
                            readOnly
                            onChange={handleChange}
                            className="h-14 rounded-2xl bg-muted/30 border-border/50 focus:ring-2 focus:ring-primary/20 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">Footer Phone</label>
                          <Input
                            name="footer_phone"
                            value={formData.footer_phone || ''}
                            onChange={handleChange}
                            className="h-14 rounded-2xl bg-muted/30 border-border/50 focus:ring-2 focus:ring-primary/20 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">Footer Hours</label>
                          <Input
                            name="footer_hours"
                            value={formData.footer_hours || ''}
                            onChange={handleChange}
                            className="h-14 rounded-2xl bg-muted/30 border-border/50 focus:ring-2 focus:ring-primary/20 transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 rounded-2xl border border-border/50 bg-muted/20 p-5">
                      <div><h3 className="text-sm font-semibold text-foreground">Barangay Demographics</h3><p className="mt-1 text-xs text-muted-foreground">These values appear in the homepage community summary.</p></div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <label className="space-y-2 text-xs font-semibold text-muted-foreground">Total population<Input type="number" min={0} name="population" value={formData.population ?? 0} onChange={handleChange} /></label>
                        <label className="space-y-2 text-xs font-semibold text-muted-foreground">Area (km²)<Input type="number" min={0} step="0.01" name="barangay_area" value={formData.barangay_area ?? 0} onChange={handleChange} /></label>
                        <label className="space-y-2 text-xs font-semibold text-muted-foreground">Households<Input type="number" min={0} name="households" value={formData.households ?? 0} onChange={handleChange} /></label>
                      </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                      <Button type="submit" size="lg" className="rounded-2xl px-12 h-14 font-bold shadow-lg shadow-primary/20" disabled={isSaving}>
                        {isSaving ? 'Saving...' : <><Save size={20} className="mr-2" /> Save All Changes</>}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="types" className="space-y-8 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4">
              <Card className="border-border/50 shadow-xl rounded-[2.5rem] overflow-hidden sticky top-24">
                <CardHeader className="bg-primary/5 border-b border-border/50 p-8">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Plus className="w-5 h-5 text-primary" />
                    Add Complaint Type
                  </CardTitle>
                  <CardDescription>Add a type under one of the shared complaint categories.</CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                  <form onSubmit={handleAddType} className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">Category</label>
                      <select value={newTypeCategory} onChange={event => setNewTypeCategory(event.target.value)} className="h-12 w-full rounded-xl border border-border/50 bg-background px-3 text-sm text-foreground">
                        {COMPLAINT_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">Complaint Type</label>
                      <Input 
                        placeholder="e.g. Broken streetlights" 
                        value={newTypeName}
                        onChange={e => setNewTypeName(e.target.value)}
                        maxLength={255}
                        required
                        className="h-12 rounded-xl bg-muted/30 border-border/50"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">Description</label>
                      <textarea value={newTypeDescription} onChange={event => setNewTypeDescription(event.target.value)} maxLength={2000} required placeholder="Explain what issues belong in this type." className="min-h-24 w-full rounded-xl border border-border/50 bg-muted/30 p-3 text-sm text-foreground" />
                    </div>
                    <Button type="submit" className="w-full h-12 rounded-xl font-semibold shadow-sm">
                      Add Type
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-8">
              <div className="space-y-4">
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {loadingTypes ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-20 bg-muted/20 animate-pulse rounded-3xl border border-border/30" />
                      ))
                    ) : types.length === 0 ? (
                      <div className="p-20 text-center text-muted-foreground bg-muted/20 rounded-[3rem] border-2 border-dashed border-border/50">
                        <Activity className="mx-auto mb-4 opacity-20" size={48} />
                        <p className="font-serif italic text-xl">No categories found.</p>
                      </div>
                    ) : types.map((type) => (
                      <motion.div
                        key={type.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={cn(
                          "grid grid-cols-1 gap-4 p-5 bg-card rounded-xl border border-border/50 shadow-sm transition-all hover:shadow-md md:grid-cols-[minmax(0,1fr),auto] md:p-6",
                          type.is_active === 0 && "opacity-60 bg-muted/30"
                        )}
                      >
                        <div className="min-w-0">
                          {editingId === type.id ? (
                            <div className="space-y-3">
                              <select value={editCategory} onChange={event => setEditCategory(event.target.value)} className="h-10 w-full rounded-lg border border-border/50 bg-background px-3 text-sm text-foreground">
                                {COMPLAINT_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
                              </select>
                              <Input value={editName} onChange={e => setEditName(e.target.value)} maxLength={255} className="h-10 rounded-lg text-sm" autoFocus />
                              <textarea value={editDescription} onChange={event => setEditDescription(event.target.value)} maxLength={2000} required className="min-h-20 w-full rounded-lg border border-border/50 bg-background p-3 text-sm text-foreground" />
                            </div>
                          ) : (
                            <>
                              <p className="text-xs font-semibold text-primary">{type.category}</p>
                              <p className="mt-1 font-semibold text-foreground">{type.name}</p>
                              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{type.description}</p>
                            </>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
                          <Badge 
                            variant={type.is_active === 1 ? 'default' : 'secondary'} 
                            className={cn(
                              "rounded-full px-4 py-1 text-[9px] font-bold uppercase tracking-widest cursor-pointer transition-all",
                              type.is_active === 1 
                                ? "bg-green-500/10 text-green-600 border-green-200 hover:bg-green-500/20" 
                                : "hover:bg-muted-foreground/10"
                            )}
                            onClick={() => handleToggleTypeStatus(type)}
                          >
                            {type.is_active === 1 ? 'Active' : 'Hidden'}
                          </Badge>
                        </div>
                        <div className="flex justify-end gap-2">
                          {editingId === type.id ? (
                            <>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-10 w-10 rounded-full text-green-600 hover:bg-green-50"
                                onClick={() => handleUpdateType(type)}
                              >
                                <Save className="w-5 h-5" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-10 w-10 rounded-full text-destructive hover:bg-destructive/10"
                                onClick={() => setEditingId(null)}
                              >
                                <X className="w-5 h-5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-10 w-10 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/5"
                                onClick={() => {
                                  setEditingId(type.id);
                                  setEditCategory(type.category);
                                  setEditName(type.name);
                                  setEditDescription(type.description);
                                }}
                              >
                                <Edit2 className="w-5 h-5" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-10 w-10 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                                onClick={() => handleToggleTypeStatus(type)}
                              >
                                <Trash2 className="w-5 h-5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

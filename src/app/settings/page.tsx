"use client"

import { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { 
  Settings, 
  Printer, 
  CreditCard, 
  User, 
  LogOut, 
  Bluetooth, 
  CheckCircle2, 
  Save, 
  RefreshCw,
  ShieldCheck,
  Building2,
  Phone,
  MapPin,
  MessageSquare,
  Lock,
  Crown,
  UserCheck,
  ShieldAlert,
  Moon,
  Sun,
  ChevronRight,
  Mail,
  Key,
  Edit2,
  Camera,
  Trash2,
  Loader2,
  AlertCircle,
  Zap,
  Info
} from 'lucide-react';
import { useFirestore, useDoc, useMemoFirebase, useUser, useAuth, useCollection, useStorage } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { printerService } from '@/lib/bluetooth-printer';
import { ReceiptConfig } from '@/lib/types';
import { useTheme } from '@/components/theme-provider';
import { updateProfile } from 'firebase/auth';
import { initiatePasswordReset } from '@/firebase/non-blocking-login';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import Link from 'next/link';

const PRIMARY_ADMIN_EMAIL = 'jayyudyoga@gmail.com';

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Super Administrator',
  admin: 'Administrator',
  teacher: 'Faculty / Teacher',
  payment_handler: 'Payment Handler',
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('account');
  const [isBluetoothSupported, setIsBluetoothSupported] = useState(false);
  const [lastPrinter, setLastPrinter] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isEditPhotoOpen, setIsEditPhotoOpen] = useState(false);
  
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const configRef = useMemoFirebase(() => 
    (firestore && user) ? doc(firestore, 'settings', 'receipt_config') : null, 
    [firestore, user]
  );
  const { data: config, isLoading: isConfigLoading } = useDoc<ReceiptConfig>(configRef);

  const userProfileRef = useMemoFirebase(() => 
    (firestore && user) ? doc(firestore, 'users_directory', user.uid) : null,
    [firestore, user]
  );
  const { data: userProfile } = useDoc(userProfileRef);

  const superAdminsQuery = useMemoFirebase(() => 
    (firestore && user) ? collection(firestore, 'roles_super_admin') : null, 
    [firestore, user]
  );
  const { data: superAdmins } = useCollection(superAdminsQuery);

  const isSuperAdmin = user?.email === PRIMARY_ADMIN_EMAIL || superAdmins?.some(a => a.id === user?.uid);

  useEffect(() => {
    setIsBluetoothSupported(printerService.isSupported());
    setLastPrinter(localStorage.getItem('last_printer_name'));
  }, []);

  const handleConnectPrinter = async () => {
    try {
      await printerService.connect();
      setLastPrinter(localStorage.getItem('last_printer_name'));
      toast({ title: "Printer Connected", description: "Standard PT-210 paired successfully." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Connection Failed", description: err.message });
    }
  };

  const handleTestPrint = async () => {
    setIsTesting(true);
    try {
      await printerService.printTest();
      toast({ title: "Test Success", description: "Verification receipt sent to printer." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Print Failed", description: "Ensure printer is on and in range." });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveReceiptConfig = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!configRef || !isSuperAdmin) return;

    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    const data: ReceiptConfig = {
      instituteName: formData.get('instituteName') as string,
      address1: formData.get('address1') as string,
      address2: formData.get('address2') as string,
      phone: formData.get('phone') as string,
      footerMessage: formData.get('footerMessage') as string,
    };

    setDocumentNonBlocking(configRef, data, { merge: true });
    
    setTimeout(() => {
      setIsSaving(false);
      toast({ title: "Branding Updated", description: "Global receipt settings have been saved." });
    }, 500);
  };

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !firestore) return;

    setIsUpdatingProfile(true);
    const formData = new FormData(e.currentTarget);
    const displayName = formData.get('displayName') as string;

    try {
      await updateProfile(user, { displayName });
      const userRef = doc(firestore, 'users_directory', user.uid);
      updateDocumentNonBlocking(userRef, { displayName });

      toast({ title: "Profile Updated", description: "Your display name has been changed." });
      setIsEditProfileOpen(false);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Update Failed", description: err.message });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (fileInputRef.current) fileInputRef.current.value = '';

    if (!user || !firestore || !storage) {
      toast({ variant: "destructive", title: "System Error", description: "Cloud services are initializing. Please wait." });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File Too Large", description: "Please upload an image smaller than 5MB." });
      return;
    }

    setIsUpdatingProfile(true);
    try {
      const storageRef = ref(storage, `profile_photos/${user.uid}`);
      const uploadTask = await uploadBytes(storageRef, file);
      const photoURL = await getDownloadURL(uploadTask.ref);

      await updateProfile(user, { photoURL });
      
      const userRef = doc(firestore, 'users_directory', user.uid);
      updateDocumentNonBlocking(userRef, { photoURL });

      if (userProfile?.role === 'teacher' && userProfile.referenceId) {
        const teacherRef = doc(firestore, 'teachers', userProfile.referenceId);
        updateDocumentNonBlocking(teacherRef, { photoURL });
      }

      toast({ title: "Photo Updated", description: "Your profile picture has been synced successfully." });
      setIsEditPhotoOpen(false);
    } catch (err: any) {
      toast({ 
        variant: "destructive", 
        title: "Upload Failed", 
        description: err.message || "An error occurred while uploading your photo." 
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!user || !firestore || !storage) return;
    setIsUpdatingProfile(true);
    try {
      try {
        const storageRef = ref(storage, `profile_photos/${user.uid}`);
        await deleteObject(storageRef);
      } catch (e) {
        console.error("Profile photo delete from storage failed (may not exist):", e);
      }

      await updateProfile(user, { photoURL: '' });
      
      const userRef = doc(firestore, 'users_directory', user.uid);
      updateDocumentNonBlocking(userRef, { photoURL: null });

      if (userProfile?.role === 'teacher' && userProfile.referenceId) {
        const teacherRef = doc(firestore, 'teachers', userProfile.referenceId);
        updateDocumentNonBlocking(teacherRef, { photoURL: null });
      }

      toast({ title: "Photo Removed", description: "Reverted to default initial-based avatar." });
      setIsEditPhotoOpen(false);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Action Failed", description: err.message });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email || !auth) return;
    try {
      await initiatePasswordReset(auth, user.email);
      toast({ title: "Reset Email Sent", description: "Check your inbox to securely change your password." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed", description: err.message });
    }
  };

  const handleLogout = () => {
    auth?.signOut();
  };

  if (!user) return null;

  const roleLabel = userProfile?.role ? ROLE_LABELS[userProfile.role] : (isSuperAdmin ? 'Super Administrator' : 'Staff Member');
  const userInitials = (userProfile?.displayName || user.displayName || user.email || 'S').charAt(0).toUpperCase();

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-primary/10 text-primary">
          <Settings className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-black font-headline uppercase tracking-tight text-foreground">Profile & Settings</h1>
          <p className="text-muted-foreground text-sm">Manage your account and app preferences.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full sm:w-fit h-12 p-1 bg-muted/50 border rounded-xl">
          <TabsTrigger value="account" className="gap-2 font-bold text-[10px] uppercase rounded-lg">
            <User className="size-3.5" /> Account
          </TabsTrigger>
          <TabsTrigger value="printer" className="gap-2 font-bold text-[10px] uppercase rounded-lg">
            <Printer className="size-3.5" /> Printer
          </TabsTrigger>
          <TabsTrigger value="receipt" className="gap-2 font-bold text-[10px] uppercase rounded-lg">
            <CreditCard className="size-3.5" /> Receipt
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
          <Card className="border-none shadow-lg overflow-hidden bg-card">
            <CardContent className="p-0">
              <div className="h-24 bg-primary/10 w-full" />
              <div className="px-6 pb-6 -mt-12 flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="relative group shrink-0">
                  <Avatar className={`size-24 rounded-3xl border-4 border-background shadow-2xl overflow-hidden ${isSuperAdmin ? 'bg-primary' : 'bg-emerald-600'}`}>
                    <AvatarImage src={userProfile?.photoURL || user.photoURL || ''} className="object-cover h-full w-full" />
                    <AvatarFallback className="bg-transparent text-white font-black text-3xl">
                      {userInitials}
                    </AvatarFallback>
                    {isUpdatingProfile && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <Loader2 className="size-8 animate-spin text-white" />
                      </div>
                    )}
                  </Avatar>
                  <button 
                    onClick={() => setIsEditPhotoOpen(true)}
                    className="absolute -bottom-1 -right-1 size-8 rounded-full bg-primary border-2 border-background flex items-center justify-center text-white shadow-lg hover:scale-110 transition-transform active:scale-95"
                  >
                    <Camera className="size-4" />
                  </button>
                </div>
                <div className="space-y-1 flex-1 min-w-0">
                  <h3 className="text-2xl font-black tracking-tight truncate uppercase font-headline">
                    {userProfile?.displayName || user.displayName || 'Staff Member'}
                  </h3>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Mail className="size-3.5" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border mt-2 ${isSuperAdmin ? 'bg-primary/10 text-primary border-primary/20' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                    {isSuperAdmin ? <Crown className="size-3" /> : (userProfile?.role === 'teacher' ? <UserCheck className="size-3" /> : <ShieldAlert className="size-3" />)}
                    {roleLabel}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Account Security</h4>
            <Card className="border-none shadow-sm divide-y divide-border">
              <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
                <DialogTrigger asChild>
                  <button className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors text-left group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                        <Edit2 className="size-4" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-sm font-bold uppercase tracking-tight">Edit Profile</p>
                        <p className="text-[10px] text-muted-foreground">Update your public display name.</p>
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleUpdateProfile}>
                    <DialogHeader>
                      <DialogTitle className="uppercase tracking-tight font-black">Update Name</DialogTitle>
                      <DialogDescription>How should your name appear on receipts and logs?</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Full Display Name</Label>
                      <Input name="displayName" defaultValue={userProfile?.displayName || user.displayName || ''} className="h-12 mt-1.5" required />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={isUpdatingProfile} className="w-full font-black uppercase tracking-widest">
                        {isUpdatingProfile ? <RefreshCw className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
                        Save Changes
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              <button 
                onClick={handlePasswordReset}
                className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600">
                    <Key className="size-4" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold uppercase tracking-tight">Change Password</p>
                    <p className="text-[10px] text-muted-foreground">Send a secure reset link to your email.</p>
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </button>
            </Card>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">App Information</h4>
            <Card className="border-none shadow-sm divide-y divide-border">
              <Link href="/about" className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors text-left group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Zap className="size-4" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold uppercase tracking-tight">About Developer</p>
                    <p className="text-[10px] text-muted-foreground">System version and developer credits.</p>
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </Link>
              
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {theme === 'dark' ? <Moon className="size-4" /> : <Sun className="size-4" />}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold uppercase tracking-tight">Dark Mode</p>
                    <p className="text-[10px] text-muted-foreground">Adjust app theme for low-light use.</p>
                  </div>
                </div>
                <Switch 
                  checked={theme === 'dark'} 
                  onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')} 
                />
              </div>
            </Card>
          </div>

          <Button 
            variant="destructive" 
            onClick={handleLogout} 
            className="w-full h-14 gap-2 font-black uppercase tracking-widest text-xs shadow-xl shadow-destructive/10 rounded-xl"
          >
            <LogOut className="size-4" /> End Current Session
          </Button>
        </TabsContent>

        <TabsContent value="printer" className="animate-in fade-in slide-in-from-right-4 duration-300">
          <Card className="border-none shadow-lg">
            <CardHeader className="bg-blue-50/50 border-b dark:bg-blue-900/10">
              <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400 uppercase tracking-tight text-lg">
                <Bluetooth className="size-5" /> Printer Setup
              </CardTitle>
              <CardDescription>Manage your direct connection to thermal POS devices.</CardDescription>
            </CardHeader>
            <CardContent className="pt-8 space-y-8">
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl bg-muted/5">
                <div className={`size-16 rounded-full flex items-center justify-center mb-4 ${lastPrinter ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' : 'bg-muted text-muted-foreground'}`}>
                  <Printer className="size-8" />
                </div>
                {lastPrinter ? (
                  <div className="text-center space-y-1">
                    <p className="font-black uppercase tracking-widest text-xs">Paired Device</p>
                    <h3 className="text-xl font-bold">{lastPrinter}</h3>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center justify-center gap-1">
                      <CheckCircle2 className="size-3 text-emerald-500" /> Connection Verified
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="font-bold text-muted-foreground">No printer paired yet</p>
                    <p className="text-xs text-muted-foreground/60 max-w-xs mt-1">Connect your PT-210 or compatible ESC/POS thermal printer via Bluetooth.</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button 
                  onClick={handleConnectPrinter} 
                  className="h-14 gap-2 font-black uppercase tracking-widest text-xs shadow-xl rounded-xl"
                  disabled={!isBluetoothSupported}
                >
                  <RefreshCw className="size-4" /> {lastPrinter ? "Pair New Device" : "Pair Printer"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleTestPrint} 
                  className="h-14 gap-2 font-black uppercase tracking-widest text-xs border-dashed rounded-xl"
                  disabled={isTesting}
                >
                  {isTesting ? <RefreshCw className="size-4 animate-spin" /> : <Printer className="size-4" />}
                  Test Connection
                </Button>
              </div>

              {!isBluetoothSupported && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-400 text-xs">
                  <p className="font-bold uppercase tracking-tight flex items-center gap-2 mb-1">
                    Web Bluetooth Unavailable
                  </p>
                  <p>Direct printing requires a secure connection (HTTPS) and a compatible browser like Chrome, Edge, or Opera.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipt" className="animate-in fade-in slide-in-from-right-4 duration-300">
          <Card className="border-none shadow-lg">
            <CardHeader className="bg-primary/5 border-b">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 uppercase tracking-tight text-lg">
                    <CreditCard className="size-5 text-primary" /> Receipt Branding
                  </CardTitle>
                  <CardDescription>Customize the header and footer of your official receipts.</CardDescription>
                </div>
                {!isSuperAdmin && (
                  <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-600 border-amber-200 uppercase font-black">
                    <Lock className="size-3 mr-1" /> View Only
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-8">
              {isConfigLoading ? (
                <div className="py-20 text-center animate-pulse">
                  <RefreshCw className="size-10 mx-auto text-primary animate-spin opacity-20" />
                </div>
              ) : (
                <form onSubmit={handleSaveReceiptConfig} className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 ml-1">
                        <Building2 className="size-3 text-primary" /> Institute Name
                      </Label>
                      <Input 
                        name="instituteName" 
                        defaultValue={config?.instituteName} 
                        placeholder="SHILPA HIGHER EDUCATION" 
                        className="h-12 border-primary/20 rounded-xl" 
                        required 
                        disabled={!isSuperAdmin}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 ml-1">
                          <MapPin className="size-3 text-primary" /> Address Line 1
                        </Label>
                        <Input 
                          name="address1" 
                          defaultValue={config?.address1} 
                          placeholder="123 Education Lane" 
                          className="h-12 border-primary/20 rounded-xl" 
                          disabled={!isSuperAdmin}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 ml-1">
                          <MapPin className="size-3 text-primary" /> Address Line 2
                        </Label>
                        <Input 
                          name="address2" 
                          defaultValue={config?.address2} 
                          placeholder="Suite 456" 
                          className="h-12 border-primary/20 rounded-xl" 
                          disabled={!isSuperAdmin}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 ml-1">
                        <Phone className="size-3 text-primary" /> Contact Number
                      </Label>
                      <Input 
                        name="phone" 
                        defaultValue={config?.phone} 
                        placeholder="+94 11 222 3333" 
                        className="h-12 border-primary/20 rounded-xl" 
                        disabled={!isSuperAdmin}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 ml-1">
                        <MessageSquare className="size-3 text-primary" /> Receipt Footer Message
                      </Label>
                      <Textarea 
                        name="footerMessage" 
                        defaultValue={config?.footerMessage} 
                        placeholder="Thank you for your trust in Shilpa Institute!" 
                        className="min-h-[100px] border-primary/20 rounded-xl" 
                        disabled={!isSuperAdmin}
                      />
                    </div>
                  </div>

                  {isSuperAdmin && (
                    <Button type="submit" className="w-full h-14 gap-2 font-black uppercase tracking-widest shadow-xl rounded-xl" disabled={isSaving}>
                      {isSaving ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
                      Save Branding Settings
                    </Button>
                  )}
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Photo Edit Dialog */}
      <Dialog open={isEditPhotoOpen} onOpenChange={setIsEditPhotoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-tight font-black">Profile Photo</DialogTitle>
            <DialogDescription>Update your personal avatar for receipts and logs.</DialogDescription>
          </DialogHeader>
          <div className="py-6 flex flex-col items-center gap-6">
            <div className="relative">
              <Avatar className="size-32 rounded-3xl border-4 border-muted shadow-xl overflow-hidden">
                <AvatarImage src={userProfile?.photoURL || user.photoURL || ''} className="object-cover h-full w-full" />
                <AvatarFallback className="text-4xl font-black bg-primary text-white">
                  {userInitials}
                </AvatarFallback>
                {isUpdatingProfile && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <Loader2 className="size-10 animate-spin text-white" />
                  </div>
                )}
              </Avatar>
            </div>
            <div className="grid grid-cols-1 w-full gap-2">
              <Input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileChange}
              />
              <Button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full font-black uppercase tracking-widest h-12"
                disabled={isUpdatingProfile}
              >
                {isUpdatingProfile ? <RefreshCw className="size-4 animate-spin mr-2" /> : <Camera className="size-4 mr-2" />}
                {userProfile?.photoURL || user.photoURL ? "Upload New Photo" : "Upload Photo"}
              </Button>
              {(userProfile?.photoURL || user.photoURL) && (
                <Button 
                  variant="outline" 
                  className="w-full font-black uppercase tracking-widest h-12 text-destructive border-destructive/20 hover:bg-destructive/5"
                  onClick={handleDeletePhoto}
                  disabled={isUpdatingProfile}
                >
                  <Trash2 className="size-4 mr-2" /> Remove Photo
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

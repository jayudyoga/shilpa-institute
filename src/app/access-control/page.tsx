
"use client"

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  UserPlus, 
  Trash2, 
  MoreVertical,
  Lock,
  LayoutGrid,
  Settings2,
  Mail,
  Key,
  UserCheck,
  ShieldCheck,
  RefreshCw,
  RotateCcw,
  UserCog,
  QrCode,
  CreditCard,
  History,
  CalendarCheck,
  Users,
  BookOpen,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Activity,
  Fingerprint
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter,
  DialogDescription 
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc, createStaffUserWithoutLogout, useFunctions } from '@/firebase';
import { collection, doc, query, orderBy } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { httpsCallable } from 'firebase/functions';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const PRIMARY_ADMIN_EMAIL = 'jayyudyoga@gmail.com';

const DASHBOARD_MODULES = [
  { id: 'scan', title: 'Scan QR Code', icon: QrCode },
  { id: 'payment', title: 'New Payment', icon: CreditCard },
  { id: 'history', title: 'Payment History', icon: History },
  { id: 'attendance', title: 'Attendance', icon: CalendarCheck },
  { id: 'students', title: 'Manage Students', icon: Users },
  { id: 'teachers', title: 'Teacher Directory', icon: UserCheck },
  { id: 'classes', title: 'Class Schedules', icon: BookOpen },
  { id: 'access', title: 'Access Control', icon: Shield },
  { id: 'teacher-payroll', title: 'Teacher Payroll', icon: DollarSign },
  { id: 'my-earnings', title: 'My Earnings', icon: DollarSign },
  { id: 'settings', title: 'System Settings', icon: Settings2 },
];

export default function AccessControl() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [isRoleChangeOpen, setIsRoleChangeOpen] = useState(false);
  const [isCredentialsOpen, setIsCredentialsOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [userForPermissionsUid, setUserForPermissionsUid] = useState<string | null>(null);
  const [userForRoleChange, setUserForRoleChange] = useState<any>(null);
  const [userForCredentials, setUserForCredentials] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedNewRole, setSelectedNewRole] = useState<string>('');
  
  const firestore = useFirestore();
  const functions = useFunctions();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const usersQuery = useMemoFirebase(() => 
    (firestore && user) ? query(collection(firestore, 'users_directory'), orderBy('displayName', 'asc')) : null, 
    [firestore, user]
  );
  const superAdminsQuery = useMemoFirebase(() => 
    (firestore && user) ? collection(firestore, 'roles_super_admin') : null, 
    [firestore, user]
  );
  const teachersQuery = useMemoFirebase(() => 
    (firestore && user) ? collection(firestore, 'teachers') : null, 
    [firestore, user]
  );

  const { data: usersData, isLoading: isUsersLoading } = useCollection(usersQuery);
  const { data: superAdminsData } = useCollection(superAdminsQuery);
  const { data: teachersData } = useCollection(teachersQuery);

  const userForPermissionsRef = useMemoFirebase(() => 
    (firestore && userForPermissionsUid) ? doc(firestore, 'users_directory', userForPermissionsUid) : null,
    [firestore, userForPermissionsUid]
  );
  const { data: userForPermissions, isLoading: isUserForPermissionsLoading } = useDoc(userForPermissionsRef);

  const isSuperAdmin = (uid: string, email?: string) => {
    return superAdminsData?.some(a => a.id === uid) || email === PRIMARY_ADMIN_EMAIL;
  };

  const handleUpdateRole = async () => {
    if (!firestore || !userForRoleChange || !selectedNewRole) return;

    const uid = userForRoleChange.uid;
    const email = userForRoleChange.email;

    if (email === PRIMARY_ADMIN_EMAIL) {
      toast({ variant: "destructive", title: "Access Denied", description: "Root account roles cannot be modified." });
      setIsRoleChangeOpen(false);
      return;
    }

    setIsProcessing(true);
    const userRef = doc(firestore, 'users_directory', uid);
    const adminRef = doc(firestore, 'roles_admin', uid);
    const superRef = doc(firestore, 'roles_super_admin', uid);

    try {
      updateDocumentNonBlocking(userRef, { role: selectedNewRole });

      if (selectedNewRole === 'superadmin') {
        setDocumentNonBlocking(adminRef, { id: uid, uid }, { merge: true });
        setDocumentNonBlocking(superRef, { id: uid, uid }, { merge: true });
      } else if (selectedNewRole === 'admin') {
        setDocumentNonBlocking(adminRef, { id: uid, uid }, { merge: true });
        deleteDocumentNonBlocking(superRef);
      } else {
        deleteDocumentNonBlocking(adminRef);
        deleteDocumentNonBlocking(superRef);
      }

      toast({ title: "Role Updated", description: `${userForRoleChange.displayName}'s role updated.` });
      setIsRoleChangeOpen(false);
      setUserForRoleChange(null);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Update Failed", description: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleActive = (uid: string, currentStatus: boolean) => {
    if (!firestore) return;
    updateDocumentNonBlocking(doc(firestore, 'users_directory', uid), { isActive: !currentStatus });
    toast({ title: "Status Toggled", description: currentStatus ? "Access suspended." : "Access restored." });
  };

  const handleAddUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore) return;

    setIsProcessing(true);
    const formData = new FormData(e.currentTarget);
    const email = (formData.get('email') as string).trim().toLowerCase();
    const password = (formData.get('password') as string) || 'test@1234';
    const displayName = (formData.get('displayName') as string).trim();
    const role = formData.get('role') as string;
    const referenceId = formData.get('referenceId') as string || null;
    const isSuper = formData.get('isSuper') === 'on';

    try {
      const newUid = await createStaffUserWithoutLogout(email, password, displayName);
      const userRef = doc(firestore, 'users_directory', newUid);
      
      let initialPrefs = ['dashboard', 'settings'];
      if (role === 'payment_handler') {
        initialPrefs = ['dashboard', 'scan', 'payment', 'history', 'settings'];
      } else if (role === 'teacher') {
        initialPrefs = ['dashboard', 'scan', 'attendance', 'my-earnings', 'my-students', 'settings'];
      } else {
        initialPrefs = DASHBOARD_MODULES.map(m => m.id);
      }

      setDocumentNonBlocking(userRef, {
        uid: newUid,
        email,
        displayName,
        role: isSuper ? 'superadmin' : role,
        referenceId,
        isActive: true,
        requirePasswordChange: true,
        lastLogin: null,
        initialPassword: password,
        createdAt: new Date().toISOString(),
        dashboardPreferences: initialPrefs
      }, { merge: true });

      if (role === 'admin' || isSuper || role === 'superadmin') {
        setDocumentNonBlocking(doc(firestore, 'roles_admin', newUid), { id: newUid, uid: newUid }, { merge: true });
      }
      if (isSuper || role === 'superadmin') {
        setDocumentNonBlocking(doc(firestore, 'roles_super_admin', newUid), { id: newUid, uid: newUid }, { merge: true });
      }

      toast({ title: "Account Provisioned", description: `${displayName} has been added.` });
      setIsAddUserOpen(false);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Provisioning Error", description: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const togglePermission = (moduleId: string) => {
    if (!userForPermissionsRef || !userForPermissions) return;
    const currentPrefs = userForPermissions.dashboardPreferences || DASHBOARD_MODULES.map(m => m.id);
    const newPrefs = currentPrefs.includes(moduleId) 
      ? currentPrefs.filter((id: string) => id !== moduleId) 
      : [...currentPrefs, moduleId];
    updateDocumentNonBlocking(userForPermissionsRef, { dashboardPreferences: newPrefs });
  };

  const resetToDefaultPermissions = () => {
    if (!userForPermissionsRef) return;
    const defaultPrefs = DASHBOARD_MODULES.map(m => m.id);
    updateDocumentNonBlocking(userForPermissionsRef, { dashboardPreferences: defaultPrefs });
    toast({ title: "Permissions Reset" });
  };

  const handleDeleteUser = async () => {
    if (!functions || !userToDelete) return;
    
    if (deleteConfirmation !== 'DELETE') {
      toast({ variant: "destructive", title: "Verification Error", description: "Please type DELETE to confirm." });
      return;
    }

    setIsProcessing(true);
    try {
      const purgeAccount = httpsCallable(functions, 'deleteUserAccount');
      await purgeAccount({ targetUid: userToDelete.uid });
      
      toast({ title: "Account Purged", description: "The user has been completely removed from the system." });
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
      setDeleteConfirmation('');
    } catch (err: any) {
      toast({ variant: "destructive", title: "Action Failed", description: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredUsers = usersData?.filter(u => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (isUserLoading) return null;

  const currentUserIsSuperAdmin = superAdminsData?.some(a => a.id === user?.uid) || user?.email === PRIMARY_ADMIN_EMAIL;

  if (!user || !currentUserIsSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4 gap-4">
        <Lock className="size-16 text-destructive/20" />
        <h2 className="text-2xl font-bold font-headline text-destructive uppercase">Access Restricted</h2>
        <Button asChild variant="outline" className="rounded-full h-12 px-8"><Link href="/">Dashboard</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-4xl font-black tracking-tight text-foreground font-headline uppercase">Identity <span className="text-primary">Registry</span></h1>
          <p className="text-muted-foreground text-sm md:text-base">System-wide audit of registered login emails and operational roles.</p>
        </div>
        
        <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto gap-2 shadow-lg h-12 bg-primary font-bold rounded-full px-6 transition-transform hover:scale-105">
              <UserPlus className="size-4" /> Provision Staff
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg rounded-[2rem]">
            <form onSubmit={handleAddUser}>
              <DialogHeader>
                <DialogTitle className="uppercase tracking-tight font-black">New Staff Identity</DialogTitle>
                <DialogDescription>Create a managed account. New users will be forced to change their password on first login.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Full Name</Label>
                    <Input name="displayName" placeholder="Sarah Connor" required className="h-12 rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Staff Email</Label>
                    <Input 
                      name="email" 
                      type="email" 
                      list="teacher-emails-datalist"
                      placeholder="staff@shilpa.edu" 
                      required 
                      className="h-12 rounded-xl" 
                    />
                    <datalist id="teacher-emails-datalist">
                      {teachersData?.map(t => (
                        <option key={t.id} value={t.email}>{t.fullName} ({t.subject})</option>
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Temporary Password</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input name="password" type="password" className="pl-9 h-12 rounded-xl" defaultValue="test@1234" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Primary Role</Label>
                  <select name="role" defaultValue="payment_handler" className="w-full h-12 rounded-xl border border-input bg-background px-3 py-2 text-sm font-bold">
                    <option value="admin">Admin</option>
                    <option value="teacher">Teacher</option>
                    <option value="payment_handler">Payment Handler</option>
                    <option value="superadmin">Superadmin</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Link Profile (Optional)</Label>
                  <select name="referenceId" className="w-full h-12 rounded-xl border border-input bg-background px-3 py-2 text-sm">
                    <option value="">No linked profile</option>
                    {teachersData?.map(t => (
                      <option key={t.id} value={t.id}>{t.fullName}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center space-x-3 border p-5 rounded-2xl bg-primary/5 border-primary/10">
                  <Switch name="isSuper" />
                  <div className="space-y-0.5">
                    <Label className="text-primary font-black uppercase text-[10px] tracking-widest cursor-pointer">Grant Superadmin Privileges</Label>
                    <p className="text-[10px] text-muted-foreground">Allows full system management and identity deletion.</p>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="font-black uppercase tracking-widest text-[10px] w-full h-14 shadow-xl rounded-2xl" disabled={isProcessing}>
                  {isProcessing ? <><RefreshCw className="size-4 mr-2 animate-spin" /> Provisioning...</> : "Confirm Provisioning"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
        <div className="hud-stat flex items-center gap-4">
          <div className="size-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100"><Fingerprint className="size-6" /></div>
          <div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Login Identities</p><h3 className="text-2xl font-black">{filteredUsers.length}</h3></div>
        </div>
        <div className="hud-stat flex items-center gap-4">
          <div className="size-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100"><ShieldCheck className="size-6" /></div>
          <div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Active Access</p><h3 className="text-2xl font-black">{filteredUsers.filter(u => u.isActive !== false).length}</h3></div>
        </div>
        <div className="hud-stat flex items-center gap-4">
          <div className="size-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100"><Activity className="size-6" /></div>
          <div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Superadmins</p><h3 className="text-2xl font-black">{superAdminsData?.length || 0}</h3></div>
        </div>
      </div>

      <div className="relative w-full max-w-md">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input 
          placeholder="Search by registered email or name..." 
          className="pl-9 h-12 shadow-sm rounded-2xl border-primary/10" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Card className="border-none shadow-xl overflow-hidden bg-card rounded-[2rem]">
        <Table>
          <TableHeader className="bg-muted/10">
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-black text-[10px] uppercase tracking-widest px-6">System Identity</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Access Level</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Registry State</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isUsersLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-20">
                  <RefreshCw className="size-8 animate-spin text-primary opacity-20 mx-auto" />
                </TableCell>
              </TableRow>
            ) : filteredUsers.map((u) => {
              const isRoot = u.email === PRIMARY_ADMIN_EMAIL;
              const hasSuper = isSuperAdmin(u.uid, u.email);
              const isActive = u.isActive !== false;

              return (
                <TableRow key={u.uid} className={`group transition-colors ${!isActive ? 'opacity-60 bg-muted/20' : 'hover:bg-primary/5'}`}>
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className={`size-10 rounded-2xl flex items-center justify-center border shadow-sm ${hasSuper ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted text-muted-foreground'}`}>
                        {hasSuper ? <ShieldCheck className="size-5" /> : <UserCheck className="size-5" />}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-black text-sm uppercase tracking-tight truncate text-foreground leading-none mb-1">{u.displayName || 'Staff Identity'}</span>
                        <span className="text-[10px] text-muted-foreground font-mono truncate">{u.email}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={hasSuper ? 'default' : 'secondary'} className="text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                      {u.role?.replace('_', ' ') || 'Registered'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Switch 
                        disabled={isRoot || isProcessing}
                        checked={isActive} 
                        onCheckedChange={() => handleToggleActive(u.uid, isActive)} 
                      />
                      <span className={`text-[9px] font-black uppercase tracking-widest ${isActive ? 'text-emerald-600' : 'text-destructive'}`}>
                        {isActive ? 'Verified' : 'Revoked'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="pr-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full"><MoreVertical className="size-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-2xl border-none shadow-2xl p-2 min-w-[180px]">
                        <DropdownMenuItem className="rounded-xl px-3 py-2 cursor-pointer" onClick={() => { setUserForPermissionsUid(u.uid); setIsPermissionsOpen(true); }}>
                          <LayoutGrid className="size-4 mr-2 text-primary" /> 
                          <span className="text-xs font-bold uppercase tracking-tight">Module Access</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={isRoot} className="rounded-xl px-3 py-2 cursor-pointer" onClick={() => { setUserForRoleChange(u); setSelectedNewRole(u.role || 'payment_handler'); setIsRoleChangeOpen(true); }}>
                          <UserCog className="size-4 mr-2 text-primary" /> 
                          <span className="text-xs font-bold uppercase tracking-tight">Modify Role</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="rounded-xl px-3 py-2 cursor-pointer" onClick={() => { setUserForCredentials(u); setIsCredentialsOpen(true); }}>
                          <Eye className="size-4 mr-2 text-primary" /> 
                          <span className="text-xs font-bold uppercase tracking-tight">View Credentials</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="my-2" />
                        <DropdownMenuItem className="text-destructive rounded-xl px-3 py-2 cursor-pointer focus:bg-destructive/10 focus:text-destructive" disabled={isRoot} onClick={() => { setUserToDelete(u); setIsDeleteDialogOpen(true); }}>
                          <Trash2 className="size-4 mr-2" /> 
                          <span className="text-xs font-bold uppercase tracking-tight text-destructive">Nuclear Purge</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => { if (!isProcessing) { setIsDeleteDialogOpen(open); if(!open) setDeleteConfirmation(''); } }}>
        <AlertDialogContent className="rounded-[2.5rem]">
          <AlertDialogHeader>
            <div className="size-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
              <AlertTriangle className="size-8" />
            </div>
            <AlertDialogTitle className="uppercase font-black text-destructive tracking-tight">NUCLEAR PURGE REQUEST</AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium">
              You are about to permanently delete the identity <strong>{userToDelete?.email}</strong>. This removes their Auth account and Firestore directory data. This is irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-3">
            <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Type <span className="text-destructive">DELETE</span> to confirm purge</Label>
            <Input 
              value={deleteConfirmation} 
              onChange={(e) => setDeleteConfirmation(e.target.value)} 
              placeholder="Type DELETE" 
              className="h-12 border-destructive/20 focus:ring-destructive/20"
              disabled={isProcessing}
            />
          </div>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel className="rounded-2xl h-12 font-bold" disabled={isProcessing}>Cancel</AlertDialogCancel>
            <Button onClick={handleDeleteUser} disabled={isProcessing || deleteConfirmation !== 'DELETE'} className="bg-destructive hover:bg-destructive/90 rounded-2xl h-12 font-black uppercase tracking-widest text-[10px] px-6 text-white">
              {isProcessing ? <><RefreshCw className="size-4 animate-spin mr-2" /> PURGING...</> : "CONFIRM PURGE"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permissions Dialog */}
      <Dialog open={isPermissionsOpen} onOpenChange={(open) => { 
        setIsPermissionsOpen(open); 
        if (!open) setUserForPermissionsUid(null); 
      }}>
        <DialogContent className="max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-tight flex items-center gap-2 font-black">
              <Settings2 className="size-5 text-primary" />
              Module Access
            </DialogTitle>
            <DialogDescription>Toggle specific dashboard features for this identity.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {isUserForPermissionsLoading ? (
              <RefreshCw className="size-8 animate-spin text-primary opacity-30 mx-auto py-12" />
            ) : (
              DASHBOARD_MODULES.map(module => (
                <div key={module.id} className="flex items-center justify-between p-4 rounded-2xl hover:bg-muted/50 transition-colors border bg-background group cursor-pointer" onClick={() => togglePermission(module.id)}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
                      <module.icon className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <Label className="text-[10px] font-black uppercase cursor-pointer flex-1 py-1">{module.title}</Label>
                  </div>
                  <Checkbox checked={(userForPermissions?.dashboardPreferences || DASHBOARD_MODULES.map(m => m.id)).includes(module.id)} />
                </div>
              ))
            )}
          </div>
          <DialogFooter className="flex-col gap-2">
            <Button variant="outline" className="w-full font-black uppercase tracking-widest text-[10px] h-12 rounded-xl" onClick={resetToDefaultPermissions}>Restore Defaults</Button>
            <Button className="w-full font-black uppercase tracking-widest text-[10px] h-12 rounded-xl" onClick={() => setIsPermissionsOpen(false)}>Update Preferences</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Dialog */}
      <Dialog open={isRoleChangeOpen} onOpenChange={setIsRoleChangeOpen}>
        <DialogContent className="max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-tight flex items-center gap-2 font-black">
              <UserCog className="size-5 text-primary" />
              Assign Access Level
            </DialogTitle>
            <DialogDescription>Change the operational identity and permissions.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Select New Role</Label>
              <select 
                value={selectedNewRole} 
                onChange={(e) => setSelectedNewRole(e.target.value)}
                className="w-full h-14 rounded-2xl border border-primary/10 bg-background px-4 py-2 font-bold text-sm"
              >
                <option value="superadmin">Superadmin</option>
                <option value="admin">Admin</option>
                <option value="teacher">Teacher</option>
                <option value="payment_handler">Payment Handler</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl h-12 font-bold" onClick={() => setIsRoleChangeOpen(false)} disabled={isProcessing}>Cancel</Button>
            <Button onClick={handleUpdateRole} className="font-black uppercase tracking-widest text-[10px] rounded-xl h-12 px-6" disabled={isProcessing}>
              {isProcessing ? <RefreshCw className="size-4 animate-spin mr-2" /> : null}
              Update Identity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials View Dialog */}
      <Dialog open={isCredentialsOpen} onOpenChange={setIsCredentialsOpen}>
        <DialogContent className="max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-tight flex items-center gap-2 font-black">
              <Key className="size-5 text-primary" />
              Identity Credentials
            </DialogTitle>
            <DialogDescription>Audit log of the initial security credentials assigned.</DialogDescription>
          </DialogHeader>
          <div className="py-8 text-center space-y-6">
            <div className="p-6 rounded-3xl bg-muted/30 border border-primary/5 flex flex-col items-center">
              <p className="text-[10px] font-black uppercase text-muted-foreground mb-2">Original Setup Key</p>
              <p className="text-3xl font-black font-mono tracking-tighter text-primary">
                {userForCredentials?.initialPassword || 'UNAVAILABLE'}
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground px-4">
              Note: This key reflects the initial password. If the user has completed their security update, this key is no longer active.
            </p>
          </div>
          <DialogFooter>
            <Button className="w-full font-black uppercase tracking-widest text-[10px] h-12 rounded-xl shadow-lg" onClick={() => setIsCredentialsOpen(false)}>
              Acknowledge & Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

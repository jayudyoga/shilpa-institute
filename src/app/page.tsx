
"use client"

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  UserCheck, 
  Users, 
  BookOpen, 
  CreditCard, 
  ArrowUpRight, 
  History, 
  LogIn, 
  CalendarCheck, 
  Shield,
  Crown,
  DollarSign,
  Zap,
  Activity,
  ArrowRight,
  ShieldAlert,
  Lock,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc, query, orderBy, limit, where } from 'firebase/firestore';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { updatePassword } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

const PRIMARY_ADMIN_EMAIL = 'jayyudyoga@gmail.com';

const QUICK_ACTIONS = [
  { id: 'scan', title: 'Universal Scan', desc: 'Identify Students', href: '/scan', icon: Zap, accent: 'text-blue-600 bg-blue-50' },
  { id: 'payment', title: 'Record Fee', desc: 'Secure Payment', href: '/payments', icon: CreditCard, accent: 'text-emerald-600 bg-emerald-50', staffOnly: true },
  { id: 'attendance', title: 'Attendance', desc: 'Daily Log', href: '/attendance', icon: CalendarCheck, accent: 'text-amber-600 bg-amber-50' },
  { id: 'history', title: 'Transactions', desc: 'Audit History', href: '/history', icon: History, accent: 'text-slate-600 bg-slate-50' },
  { id: 'teacher-payroll', title: 'Payroll', desc: 'Process Payouts', href: '/teacher-payments', icon: DollarSign, accent: 'text-indigo-600 bg-indigo-50', superOnly: true },
  { id: 'my-earnings', title: 'My Earnings', desc: 'Personal Node', href: '/teacher-finance', icon: DollarSign, accent: 'text-emerald-600 bg-emerald-50', teacherOnly: true },
  { id: 'my-students', title: 'My Roster', desc: 'Assigned Students', href: '/students/my-students', icon: Users, accent: 'text-blue-600 bg-blue-50', teacherOnly: true },
  { id: 'students', title: 'Student Dir', desc: 'Manage Nodes', href: '/students', icon: Users, accent: 'text-slate-600 bg-slate-50', adminOnly: true },
  { id: 'teachers', title: 'Faculty', desc: 'Manage Staff', href: '/teachers', icon: UserCheck, accent: 'text-slate-600 bg-slate-50', adminOnly: true },
  { id: 'classes', title: 'Class List', desc: 'Course Nodes', href: '/classes', icon: BookOpen, accent: 'text-slate-600 bg-slate-50', adminOnly: true },
  { id: 'access', title: 'Access Control', desc: 'System Roles', href: '/access-control', icon: Shield, accent: 'text-red-600 bg-red-50', superOnly: true },
];

export default function Dashboard() {
  const [isPasswordChangeOpen, setIsPasswordChangeOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => 
    (firestore && user) ? doc(firestore, 'users_directory', user.uid) : null,
    [firestore, user]
  );
  const { data: userProfile } = useDoc(userProfileRef);

  // Monitor for mandatory password change flag
  useEffect(() => {
    if (userProfile?.requirePasswordChange) {
      setIsPasswordChangeOpen(true);
    }
  }, [userProfile]);

  const teachersQuery = useMemoFirebase(() => 
    (firestore && user) ? collection(firestore, 'teachers') : null, 
    [firestore, user]
  );
  const studentsQuery = useMemoFirebase(() => 
    (firestore && user) ? collection(firestore, 'students') : null, 
    [firestore, user]
  );
  const classesQuery = useMemoFirebase(() => 
    (firestore && user) ? collection(firestore, 'classes') : null, 
    [firestore, user]
  );
  
  const recentPaymentsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !userProfile) return null;
    const role = userProfile.role;
    if (role === 'teacher' && userProfile.referenceId) {
      return query(collection(firestore, 'payments'), where('teacherId', '==', userProfile.referenceId), limit(10));
    }
    if (role === 'superadmin' || role === 'admin' || role === 'payment_handler' || user.email === PRIMARY_ADMIN_EMAIL) {
      return query(collection(firestore, 'payments'), orderBy('paymentDate', 'desc'), limit(15));
    }
    return null;
  }, [firestore, user, userProfile]);

  const { data: teachers } = useCollection(teachersQuery);
  const { data: students } = useCollection(studentsQuery);
  const { data: classes } = useCollection(classesQuery);
  const { data: rawRecentPayments } = useCollection(recentPaymentsQuery);

  const sortedRecentPayments = useMemo(() => {
    if (!rawRecentPayments) return [];
    return [...rawRecentPayments]
      .sort((a, b) => {
        const dateA = a.paymentDate?.toDate ? a.paymentDate.toDate() : new Date(a.paymentDate);
        const dateB = b.paymentDate?.toDate ? b.paymentDate.toDate() : new Date(b.paymentDate);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 5);
  }, [rawRecentPayments]);

  const isSuperAdmin = user?.email === PRIMARY_ADMIN_EMAIL || userProfile?.role === 'superadmin';
  const isAdmin = isSuperAdmin || userProfile?.role === 'admin';
  const isTeacher = userProfile?.role === 'teacher';
  const isPaymentHandler = userProfile?.role === 'payment_handler';
  const isStaff = isAdmin || isPaymentHandler;

  const allowedByAdmin = userProfile?.dashboardPreferences || QUICK_ACTIONS.map(a => a.id);
  const filteredActions = QUICK_ACTIONS.filter(action => {
    if (action.superOnly && !isSuperAdmin) return false;
    if (action.adminOnly && !isAdmin) return false;
    if (action.teacherOnly && !isTeacher) return false;
    if (action.staffOnly && !isStaff) return false;
    return allowedByAdmin.includes(action.id);
  });

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfileRef) return;
    if (newPassword !== confirmPassword) {
      toast({ variant: "destructive", title: "Mismatch", description: "Passwords do not match." });
      return;
    }
    if (newPassword.length < 6) {
      toast({ variant: "destructive", title: "Too Weak", description: "Password must be at least 6 characters." });
      return;
    }

    setIsProcessing(true);
    try {
      await updatePassword(user, newPassword);
      updateDocumentNonBlocking(userProfileRef, { requirePasswordChange: false });
      toast({ title: "Security Updated", description: "Your personal password has been set." });
      setIsPasswordChangeOpen(false);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isUserLoading) return null;

  if (!user) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4 space-y-8">
      <div className="size-20 rounded-3xl bg-blue-50 flex items-center justify-center text-primary shadow-sm">
        <Zap className="size-10 fill-current" />
      </div>
      <div className="space-y-2">
        <h2 className="text-3xl font-bold font-headline uppercase tracking-tight text-foreground">SHILPA CORE</h2>
        <p className="text-muted-foreground max-w-sm font-medium">Please sign in to access your administrative dashboard.</p>
      </div>
      <Button size="lg" asChild className="tech-button bg-primary text-primary-foreground font-bold px-10 h-14 shadow-lg shadow-blue-200">
        <Link href="/auth"><LogIn className="size-5 mr-2" /> Authorized Access</Link>
      </Button>
    </div>
  );

  const dashboardTitle = isTeacher ? 'FACULTY' : (isStaff ? 'OPERATIONS' : 'USER');
  const dashboardSubtitle = isTeacher 
    ? `Welcome back, Instructor ${userProfile?.displayName || user.displayName || 'Staff'}.`
    : `Welcome back, ${userProfile?.displayName || user.displayName || 'Staff'}.`;

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary font-bold">
            <Activity className="size-4" />
            <span className="text-[10px] uppercase tracking-widest">System Online</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold font-headline tracking-tight text-foreground">
            {dashboardTitle} <span className="text-primary">HUB</span>
          </h1>
          <p className="text-muted-foreground font-medium text-sm">
            {dashboardSubtitle}
          </p>
        </div>
        
        {isSuperAdmin && (
          <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full border border-blue-100 text-[10px] font-bold uppercase tracking-widest shadow-sm">
            <Crown className="size-3.5" /> Super Administrator
          </div>
        )}
      </div>

      <div className="grid gap-4 md:gap-6 grid-cols-2 lg:grid-cols-4">
        {[
          { title: 'Faculty', value: teachers?.length || '0', icon: UserCheck, color: 'text-blue-600' },
          { title: 'Students', value: students?.length || '0', icon: Users, color: 'text-indigo-600' },
          { title: 'Active Classes', value: classes?.length || '0', icon: BookOpen, color: 'text-amber-600' },
          { title: isTeacher ? 'My Payments' : 'Total Revenue', value: rawRecentPayments?.length || '0', icon: CreditCard, color: 'text-emerald-600' },
        ].map((stat) => (
          <div key={stat.title} className="hud-stat group transition-all hover:border-primary/30">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{stat.title}</p>
              <stat.icon className={`size-4 ${stat.color} opacity-60 group-hover:opacity-100 transition-opacity`} />
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <p className="text-3xl font-bold tabular-nums text-foreground">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-10 grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          <h2 className="text-lg font-bold font-headline uppercase tracking-widest text-foreground flex items-center gap-2">
            Quick Actions
          </h2>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
            {filteredActions.map((action) => (
              <Link key={action.id} href={action.href} className="group">
                <div className="tech-card p-6 h-full flex flex-col justify-between hover:border-primary/40 transition-all">
                  <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-2xl ${action.accent} transition-transform group-hover:scale-110`}>
                      <action.icon className="size-6" />
                    </div>
                    <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-primary transition-all" />
                  </div>
                  <div className="mt-6">
                    <h3 className="font-bold text-sm uppercase tracking-tight text-foreground">{action.title}</h3>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">{action.desc}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold font-headline uppercase tracking-widest text-foreground">
              {isTeacher ? 'My Recent Logs' : 'Recent Ledger'}
            </h2>
            <Link href="/history" className="text-primary hover:underline font-bold text-[10px] uppercase tracking-widest transition-colors flex items-center gap-1">
              View All <ArrowRight className="size-3" />
            </Link>
          </div>
          <Card className="border border-border shadow-sm overflow-hidden rounded-2xl">
            <div className="divide-y divide-border">
              {sortedRecentPayments?.map((payment: any) => (
                <div key={payment.id} className="p-4 hover:bg-muted/30 transition-colors flex items-center justify-between group">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="size-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600 font-bold text-xs shrink-0 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all border border-transparent group-hover:border-blue-100">
                      {payment.studentName?.charAt(0)}
                    </div>
                    <div className="truncate min-w-0">
                      <p className="font-bold text-[13px] text-foreground leading-none mb-1">{payment.studentName}</p>
                      <p className="text-[10px] text-muted-foreground font-medium truncate uppercase">{payment.className}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="font-bold text-emerald-600 tabular-nums text-sm">${payment.amountPaid.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">{format(new Date(payment.paymentDate?.toDate?.() || new Date()), 'MMM dd')}</p>
                  </div>
                </div>
              ))}
              {(!sortedRecentPayments || sortedRecentPayments.length === 0) && (
                <div className="p-12 text-center text-muted-foreground font-medium text-[11px] uppercase tracking-widest italic">
                   No recent records found
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={isPasswordChangeOpen} onOpenChange={() => {}}>
        <DialogContent className="max-w-[400px] rounded-[2rem] p-8" hideClose>
          <DialogHeader className="space-y-4">
            <div className="size-16 rounded-3xl bg-primary/10 flex items-center justify-center text-primary mb-2">
              <ShieldAlert className="size-8" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Security Update</DialogTitle>
            <DialogDescription className="font-medium text-muted-foreground">
              You are using a temporary password. For institute security, please set a personal password before continuing.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdatePassword} className="space-y-5 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input 
                  type={showPass ? "text" : "password"} 
                  className="pl-9 h-12 rounded-xl" 
                  placeholder="Min. 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input 
                  type={showPass ? "text" : "password"} 
                  className="pl-9 h-12 rounded-xl" 
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-14 font-black uppercase tracking-widest text-xs shadow-xl rounded-2xl mt-4" disabled={isProcessing}>
              {isProcessing ? <><RefreshCw className="size-4 animate-spin mr-2" /> Saving...</> : "Update & Enter Dashboard"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

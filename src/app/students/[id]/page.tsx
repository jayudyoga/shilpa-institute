"use client"

import { use, useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  User, 
  Phone, 
  MessageSquare, 
  BookOpen, 
  History, 
  CalendarCheck, 
  ArrowLeft, 
  QrCode, 
  Printer,
  ChevronRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  Trash2,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { useFirestore, useDoc, useMemoFirebase, useCollection, useUser, useFunctions } from '@/firebase';
import { doc, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { httpsCallable } from 'firebase/functions';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { printerService } from '@/lib/bluetooth-printer';

const PRIMARY_ADMIN_EMAIL = 'jayyudyoga@gmail.com';

export default function StudentProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id: studentId } = use(params);
  const [activeTab, setActiveTab] = useState('classes');
  const [isPurgeOpen, setIsPurgeOpen] = useState(false);
  const [purgeConfirmation, setPurgeConfirmation] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const firestore = useFirestore();
  const functions = useFunctions();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  // 1. Student Core Data
  const studentRef = useMemoFirebase(() => 
    (firestore && user) ? doc(firestore, 'students', studentId) : null,
    [firestore, studentId, user]
  );
  const { data: student, isLoading: isStudentLoading } = useDoc(studentRef);

  // 2. Auth & Profiles
  const userProfileRef = useMemoFirebase(() => 
    (firestore && user) ? doc(firestore, 'users_directory', user.uid) : null,
    [firestore, user]
  );
  const { data: userProfile } = useDoc(userProfileRef);
  const isTeacher = userProfile?.role === 'teacher';
  const isSuperAdmin = userProfile?.role === 'superadmin' || user?.email === PRIMARY_ADMIN_EMAIL;

  const profileCompletion = useMemo(() => {
    if (!student) return 0;
    const fields = [
      student.fullName ? 25 : 0,
      student.grade ? 25 : 0,
      student.parentPhone ? 25 : 0,
      (student.enrolledClassIds && student.enrolledClassIds.length > 0) ? 25 : 0
    ];
    return fields.reduce((sum, val) => sum + val, 0);
  }, [student]);

  const missingFields = useMemo(() => {
    if (!student) return [];
    const missing = [];
    if (!student.fullName) missing.push("Full Name");
    if (!student.grade) missing.push("Grade");
    if (!student.parentPhone) missing.push("Parent Phone");
    if (!student.enrolledClassIds || student.enrolledClassIds.length === 0) {
      missing.push("Enrolled Courses");
    }
    return missing;
  }, [student]);

  const handleDownloadQR = () => {
    if (!student) return;
    const canvas = document.getElementById('student-qr-canvas') as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `QR_${student.fullName.replace(/\s+/g, '_')}_ID.png`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "Success", description: "QR Code PNG downloaded successfully." });
    } else {
      toast({ variant: "destructive", title: "Error", description: "Could not generate QR code PNG." });
    }
  };

  // 3. Data Collections
  const classesQuery = useMemoFirebase(() => 
    (firestore && user && student?.enrolledClassIds?.length) ? collection(firestore, 'classes') : null,
    [firestore, student?.enrolledClassIds, user]
  );
  const { data: allSharedClasses } = useCollection(classesQuery);
  const studentClasses = useMemo(() => {
    if (!allSharedClasses || !student?.enrolledClassIds) return [];
    return allSharedClasses.filter(c => student.enrolledClassIds.includes(c.id));
  }, [allSharedClasses, student?.enrolledClassIds]);

  const paymentsQuery = useMemoFirebase(() => 
    (firestore && user && !isTeacher) ? query(collection(firestore, 'payments'), where('studentId', '==', studentId)) : null,
    [firestore, studentId, isTeacher, user]
  );
  const { data: paymentsRaw } = useCollection(paymentsQuery);
  const payments = useMemo(() => {
    if (!paymentsRaw) return [];
    return [...paymentsRaw].sort((a, b) => {
      const dateA = a.paymentDate?.toDate ? a.paymentDate.toDate() : new Date(a.paymentDate);
      const dateB = b.paymentDate?.toDate ? b.paymentDate.toDate() : new Date(b.paymentDate);
      return dateB.getTime() - dateA.getTime();
    }).slice(0, 5);
  }, [paymentsRaw]);

  const attendanceQuery = useMemoFirebase(() => 
    (firestore && user) ? query(collection(firestore, 'attendance'), where('studentId', '==', studentId), orderBy('date', 'desc'), limit(20)) : null,
    [firestore, studentId, user]
  );
  const { data: attendance } = useCollection(attendanceQuery);

  const attendanceStats = useMemo(() => {
    if (!attendance || attendance.length === 0) return { percent: 0, total: 0 };
    const presentCount = attendance.filter(a => a.status === 'present').length;
    return { percent: Math.round((presentCount / attendance.length) * 100), total: attendance.length };
  }, [attendance]);

  const handlePurge = async () => {
    if (!functions || !student?.id) return;
    if (purgeConfirmation !== 'DELETE') {
      toast({ variant: "destructive", title: "Verification Required", description: "Type DELETE to confirm purge." });
      return;
    }

    setIsProcessing(true);
    try {
      const purgeAccount = httpsCallable(functions, 'deleteUserAccount');
      await purgeAccount({ targetUid: student.id });
      
      toast({ title: "Student Purged", description: "All student records and credentials have been erased." });
      setIsPurgeOpen(false);
      router.push('/students');
    } catch (err: any) {
      console.error("Student purge failed:", err);
      toast({ variant: "destructive", title: "Purge Failed", description: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isStudentLoading) return <div className="flex items-center justify-center min-h-[60vh]"><Clock className="size-8 animate-spin text-primary opacity-20" /></div>;
  if (!student) return <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4"><AlertCircle className="size-16 text-destructive opacity-20" /><h2 className="text-2xl font-bold uppercase">Record Not Found</h2><Button asChild variant="outline"><Link href="/students">Directory</Link></Button></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="rounded-full"><Link href={isTeacher ? "/students/my-students" : "/students"}><ArrowLeft className="size-5" /></Link></Button>
          <h1 className="text-xl font-black uppercase tracking-widest text-muted-foreground">Profile</h1>
        </div>
        {isSuperAdmin && (
          <Button variant="ghost" onClick={() => setIsPurgeOpen(true)} className="text-destructive hover:bg-destructive/10 font-black text-[10px] uppercase tracking-widest gap-2">
            <Trash2 className="size-4" /> Purge Record
          </Button>
        )}
      </div>

      <div className="grid gap-8 grid-cols-1 lg:grid-cols-12">
        <Card className="lg:col-span-4 border-none shadow-xl bg-card overflow-hidden h-fit">
          <div className="h-24 bg-primary/10 w-full" />
          <CardContent className="px-6 pb-8 -mt-12 flex flex-col items-center">
            <div className="size-24 rounded-3xl bg-primary border-4 border-background shadow-2xl flex items-center justify-center text-white text-4xl font-black mb-4">{student.fullName.charAt(0)}</div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-center leading-none mb-2">{student.fullName}</h2>
            <Badge variant="outline" className="mb-6 font-black uppercase tracking-widest border-primary/20 bg-primary/5 px-4 py-1">{student.grade}</Badge>

            {/* Profile Completion Progress Bar */}
            <div className="w-full space-y-2 mb-6 border-b border-primary/5 pb-4">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-[10px] uppercase text-muted-foreground tracking-wider">Enrollment Completion</span>
                <span className="font-mono font-bold text-primary">{profileCompletion}%</span>
              </div>
              <Progress value={profileCompletion} className="h-2 bg-muted transition-all" />
              {missingFields.length > 0 ? (
                <p className="text-[9px] text-amber-500 font-bold uppercase tracking-wider">
                  Missing: {missingFields.join(', ')}
                </p>
              ) : (
                <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider flex items-center gap-1 mt-1">
                  <CheckCircle2 className="size-3" /> Profile fully complete!
                </p>
              )}
            </div>

            {/* Hidden canvas for high-quality PNG download */}
            <div style={{ display: 'none' }}>
              <QRCodeCanvas id="student-qr-canvas" value={student.id} size={512} includeMargin={true} />
            </div>

            <div className="w-full space-y-3 mb-8">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-primary/5">
                <span className="text-[10px] font-black uppercase text-muted-foreground">ID Node</span>
                <span className="font-mono font-bold text-sm tracking-tighter text-primary">{student.id}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-primary/5">
                <span className="text-[10px] font-black uppercase text-muted-foreground">Parent</span>
                <span className="font-bold text-sm">{student.parentPhone}</span>
              </div>
            </div>

            <div className="w-full flex flex-col gap-2">
              <Dialog>
                <DialogTrigger asChild><Button className="w-full h-12 gap-2 shadow-xl font-black uppercase tracking-widest text-[10px]"><QrCode className="size-4" /> Digital ID Card</Button></DialogTrigger>
                <DialogContent className="max-w-[400px] p-0 overflow-hidden rounded-3xl border-none">
                  <DialogHeader className="sr-only">
                    <DialogTitle>Student ID Card - {student.fullName}</DialogTitle>
                    <DialogDescription>Digital identification credentials for {student.fullName}.</DialogDescription>
                  </DialogHeader>
                  <div className="p-8 text-center space-y-6 bg-white text-black">
                    <h3 className="text-lg font-black uppercase tracking-tighter text-primary">Shilpa Institute</h3>
                    <div className="mx-auto size-48 p-3 border-2 border-primary/10 rounded-2xl flex items-center justify-center bg-muted/5"><QRCodeSVG value={student.id} size={160} /></div>
                    <div><p className="text-2xl font-black uppercase tracking-tight">{student.fullName}</p><p className="text-sm font-bold text-primary uppercase">{student.grade}</p><p className="font-mono text-xs font-bold text-muted-foreground mt-2">SYS-ID: {student.id}</p></div>
                  </div>
                  <div className="p-4 bg-muted/30 border-t flex flex-col sm:flex-row gap-2">
                    <Button variant="outline" className="flex-1 font-bold h-11" onClick={() => window.print()}><Printer className="size-4 mr-2" /> Local Print</Button>
                    <Button 
                      variant="default" 
                      className="flex-1 font-bold h-11 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black uppercase tracking-widest" 
                      onClick={async () => {
                        try {
                          await printerService.printStudentIDCard(student.id, student.fullName, student.grade);
                          toast({ title: "Print Successful", description: "Sent card info to Bluetooth Thermal Printer." });
                        } catch (err: any) {
                          console.error("Bluetooth printer error:", err);
                          toast({ variant: "destructive", title: "Printer Error", description: err.message });
                        }
                      }}
                    >
                      <Printer className="size-4 mr-2" /> Thermal Print
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Button onClick={handleDownloadQR} variant="outline" className="w-full h-12 gap-2 font-black uppercase tracking-widest text-[10px] border-primary/20 hover:bg-primary/5 text-primary">
                <QrCode className="size-4" /> Download QR Code PNG
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-none shadow-sm bg-emerald-50 text-emerald-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2"><span className="text-[10px] font-black uppercase tracking-[0.2em]">Attendance</span><TrendingUp className="size-4 opacity-40" /></div>
                <div className="text-3xl font-black tracking-tight">{attendanceStats.percent}%</div>
                <p className="text-[10px] mt-1 opacity-70 font-bold uppercase tracking-widest">Last {attendanceStats.total} Sessions</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-blue-50 text-blue-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2"><span className="text-[10px] font-black uppercase tracking-[0.2em]">Enrollments</span><BookOpen className="size-4 opacity-40" /></div>
                <div className="text-3xl font-black tracking-tight">{studentClasses.length}</div>
                <p className="text-[10px] mt-1 opacity-70 font-bold uppercase tracking-widest">Active Classes</p>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className={`grid ${isTeacher ? 'grid-cols-2' : 'grid-cols-3'} w-full h-12 bg-muted/50 border p-1 rounded-xl`}>
              <TabsTrigger value="classes" className="gap-2 font-bold text-[10px] uppercase rounded-lg"><BookOpen className="size-3.5" /> Courses</TabsTrigger>
              {!isTeacher && <TabsTrigger value="payments" className="gap-2 font-bold text-[10px] uppercase rounded-lg"><History className="size-3.5" /> Payments</TabsTrigger>}
              <TabsTrigger value="attendance" className="gap-2 font-bold text-[10px] uppercase rounded-lg"><CalendarCheck className="size-3.5" /> Log</TabsTrigger>
            </TabsList>
            <TabsContent value="classes" className="space-y-4 animate-in fade-in slide-in-from-left-4">
              {studentClasses.map(c => (
                <Card key={c.id} className="border-none shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden group">
                  <div className="flex items-center p-4 gap-4">
                    <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors"><BookOpen className="size-6" /></div>
                    <div className="flex-1 min-w-0"><h4 className="font-black text-sm uppercase tracking-tight truncate leading-none mb-1">{c.className}</h4><p className="text-[10px] text-muted-foreground font-bold uppercase">{c.schedule}</p></div>
                    <div className="text-right">{!isTeacher && <p className="text-sm font-black text-primary">${c.feeAmount}</p>}<p className="text-[8px] font-black uppercase text-muted-foreground">{c.feeType}</p></div>
                  </div>
                </Card>
              ))}
            </TabsContent>
            {!isTeacher && <TabsContent value="payments" className="animate-in fade-in slide-in-from-right-4"><Card className="border-none shadow-sm overflow-hidden"><Table><TableHeader className="bg-muted/30"><TableRow><TableHead className="text-[10px] font-black uppercase">Date</TableHead><TableHead className="text-[10px] font-black uppercase">Class</TableHead><TableHead className="text-[10px] font-black uppercase text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{payments.map(p => (<TableRow key={p.id}><TableCell className="text-xs font-bold">{format(p.paymentDate?.toDate ? p.paymentDate.toDate() : new Date(p.paymentDate), 'MMM d, yyyy')}</TableCell><TableCell className="text-xs font-black uppercase text-muted-foreground">{p.className}</TableCell><TableCell className="text-right font-black text-primary">${p.amountPaid}</TableCell></TableRow>))}</TableBody></Table></Card></TabsContent>}
            <TabsContent value="attendance" className="animate-in fade-in slide-in-from-bottom-4"><Card className="border-none shadow-sm overflow-hidden"><Table><TableHeader className="bg-muted/30"><TableRow><TableHead className="text-[10px] font-black uppercase">Session Date</TableHead><TableHead className="text-[10px] font-black uppercase">Class</TableHead><TableHead className="text-[10px] font-black uppercase text-right">Status</TableHead></TableRow></TableHeader><TableBody>{attendance?.map(a => (<TableRow key={a.id}><TableCell className="text-xs font-bold">{format(new Date(a.date), 'MMM d, yyyy')}</TableCell><TableCell className="text-[10px] font-black uppercase text-muted-foreground">{a.className}</TableCell><TableCell className="text-right"><Badge variant={a.status === 'present' ? 'default' : 'destructive'} className="text-[8px] font-black uppercase tracking-widest h-5">{a.status}</Badge></TableCell></TableRow>))}</TableBody></Table></Card></TabsContent>
          </Tabs>
        </div>
      </div>

      <AlertDialog open={isPurgeOpen} onOpenChange={(open) => { if (!isProcessing) { setIsPurgeOpen(open); if(!open) setPurgeConfirmation(''); } }}>
        <AlertDialogContent className="rounded-[2.5rem]">
          <AlertDialogHeader>
            <div className="size-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4"><AlertTriangle className="size-8" /></div>
            <AlertDialogTitle className="uppercase font-black text-destructive tracking-tight">NUCLEAR RECORD PURGE</AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium">You are about to permanently erase <strong>{student?.fullName}</strong> from the institute registry. All enrollment history and digital credentials will be destroyed.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-3">
            <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Type <span className="text-destructive">DELETE</span> to confirm record purge</Label>
            <Input value={purgeConfirmation} onChange={(e) => setPurgeConfirmation(e.target.value)} placeholder="Type DELETE" className="h-12 border-destructive/20 focus:ring-destructive/20" disabled={isProcessing} />
          </div>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel className="rounded-2xl h-12 font-bold" disabled={isProcessing}>Cancel</AlertDialogCancel>
            <Button onClick={handlePurge} disabled={isProcessing || purgeConfirmation !== 'DELETE'} className="bg-destructive hover:bg-destructive/90 rounded-2xl h-12 font-black uppercase tracking-widest text-[10px] px-6 text-white">{isProcessing ? <><RefreshCw className="size-4 animate-spin mr-2" /> PURGING...</> : "ERASE STUDENT"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

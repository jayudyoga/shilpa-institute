"use client"

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Camera, 
  Users, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  User,
  Zap,
  ChevronRight,
  LayoutGrid,
  Clock,
  Target,
  Scan,
  Cpu,
  X,
  UserPlus
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { processScannedId, ScanResult } from '@/lib/qr-routing-service';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';

export default function QRScanHub() {
  const [scannedResult, setScannedResult] = useState<ScanResult | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const router = useRouter();
  
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => 
    (firestore && user) ? doc(firestore, 'users_directory', user.uid) : null,
    [firestore, user]
  );
  const { data: userProfile } = useDoc(userProfileRef);

  const classesQuery = useMemoFirebase(() => {
    if (!firestore || !userProfile?.referenceId) return null;
    if (userProfile.role === 'teacher') {
      return query(collection(firestore, 'classes'), where('teacherId', '==', userProfile.referenceId));
    }
    return collection(firestore, 'classes');
  }, [firestore, userProfile]);
  const { data: classes } = useCollection(classesQuery);

  const handleScanSuccess = useCallback(async (decodedText: string) => {
    if (!firestore || !user || !userProfile || isProcessing) return;

    const id = decodedText.toUpperCase();
    setIsProcessing(true);
    
    try {
      const result = await processScannedId(
        firestore, 
        id, 
        userProfile.role, 
        user.email || 'Admin', 
        selectedClassId,
        classes || []
      );

      setIsScanning(false);
      setScannedResult(result);

      if (result.canAutoExecute) {
        if (result.recommendedAction === 'payment') {
          toast({ title: "ID IDENTIFIED", description: `Rerouting to Payment Interface...` });
          setTimeout(() => router.push(`/payments?studentId=${result.studentId}`), 1000);
        } else if (result.recommendedAction === 'attendance') {
          toast({ title: "LOG SUCCESS", description: `Attendance confirmed for ${result.studentName}.` });
          setTimeout(() => handleReset(), 2000);
        }
      }
    } catch (err: any) {
      console.error("Scanner scan success callback failed:", err);
      toast({ variant: "destructive", title: "SCAN ERROR", description: err.message });
      handleReset();
    } finally {
      setIsProcessing(false);
    }
  }, [firestore, user, userProfile, selectedClassId, classes, isProcessing, router, toast]);

  useEffect(() => {
    if (!isScanning) return;

    const initTimer = setTimeout(() => {
      const element = document.getElementById("qr-reader");
      if (!element) return;

      if (!scannerRef.current) {
        const scanner = new Html5QrcodeScanner(
          "qr-reader",
          { fps: 20, qrbox: { width: 250, height: 250 } },
          false
        );

        scanner.render(handleScanSuccess, () => {});
        scannerRef.current = scanner;
      }
    }, 100);

    return () => {
      clearTimeout(initTimer);
      if (scannerRef.current) {
        const scanner = scannerRef.current;
        scannerRef.current = null;
        scanner.clear().catch(() => {});
      }
    };
  }, [isScanning, handleScanSuccess]);

  const handleEnrollNow = async () => {
    if (!firestore || !scannedResult || !selectedClassId) return;

    try {
      const studentRef = doc(firestore, 'students', scannedResult.studentId);
      const studentSnap = await (await import('firebase/firestore')).getDoc(studentRef);
      const studentData = studentSnap.data();
      
      const currentEnrollments = studentData?.enrolledClassIds || [];
      if (!currentEnrollments.includes(selectedClassId)) {
        updateDocumentNonBlocking(studentRef, {
          enrolledClassIds: [...currentEnrollments, selectedClassId]
        });
        toast({ title: "Enrolled Successfully", description: `${scannedResult.studentName} added to class.` });
      } else {
        toast({ title: "Already Enrolled", description: "This student is already in the selected class." });
      }
      handleReset();
    } catch (err: any) {
      console.error("Scan enrollment failed:", err);
      toast({ variant: "destructive", title: "Enrollment Failed", description: err.message });
    }
  };

  const handleReset = () => {
    setScannedResult(null);
    setIsScanning(true);
  };

  if (!user || !userProfile) return null;

  const isTeacher = userProfile.role === 'teacher';

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground font-headline uppercase">
            STUDENT <span className="text-primary">SCAN</span>
          </h1>
          <p className="text-muted-foreground font-medium text-sm mt-1 uppercase tracking-widest">Identify Student Nodes</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-full">
            <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Scanner Active</span>
          </div>
        </div>
      </div>

      <div className="grid gap-10 grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-7 relative">
          <div className="bg-slate-50 border border-border overflow-hidden rounded-3xl aspect-square sm:aspect-video lg:aspect-square relative shadow-inner">
            <div id="qr-reader" className="w-full h-full !border-none"></div>
            
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
               <div className="size-[260px] relative">
                  <div className="absolute top-0 left-0 size-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                  <div className="absolute top-0 right-0 size-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 size-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 size-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                  <div className="absolute top-0 left-0 w-full h-0.5 scanner-laser z-10" />
               </div>
            </div>

            {isProcessing && (
              <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-20">
                <div className="flex flex-col items-center gap-4">
                  <RefreshCw className="size-12 text-primary animate-spin" />
                  <div className="text-center space-y-1">
                    <p className="text-sm font-bold uppercase tracking-widest text-foreground">Validating ID</p>
                    <p className="text-[10px] font-bold text-muted-foreground">FETCHING REGISTRY DATA...</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-8">
          <Card className="p-8 rounded-[2.5rem] h-full border-border shadow-sm relative overflow-hidden bg-card">
            <div className="space-y-8">
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Target className="size-3" /> Scan Context
                </h3>
                <div className="space-y-3">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-foreground ml-1">Current Class Session</Label>
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                    <SelectTrigger className="h-14 border-border rounded-2xl bg-slate-50 font-bold text-sm uppercase tracking-widest text-foreground">
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes?.map(c => (
                        <SelectItem key={c.id} value={c.id} className="font-bold uppercase text-[10px] py-3">{c.className}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!scannedResult ? (
                <div className="py-20 text-center space-y-6">
                  <div className="size-24 rounded-full border border-border bg-slate-50 mx-auto flex items-center justify-center relative shadow-inner">
                    <Scan className="size-10 text-muted-foreground/30" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Align ID code within the frame</p>
                    <p className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-tighter italic">Optimized for high-speed identification</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-8 animate-in zoom-in-95 duration-500">
                  <div className="p-6 rounded-[2rem] border border-blue-100 bg-blue-50/50 relative overflow-hidden">
                    <div className="flex items-center gap-6 relative z-10">
                      <div className="size-20 rounded-[1.5rem] bg-primary flex items-center justify-center text-primary-foreground font-black text-4xl shadow-lg shadow-blue-200/50">
                        {scannedResult.studentName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-black text-2xl tracking-tight truncate text-foreground leading-none mb-2">{scannedResult.studentName}</h3>
                        <Badge variant="outline" className="text-[10px] font-mono font-bold border-blue-200 text-blue-700 bg-white px-3 py-0.5 tracking-tight uppercase">ID: {scannedResult.studentId}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Available Actions</h4>
                    
                    {isTeacher && selectedClassId && (
                      <Button className="tech-button w-full h-14 bg-emerald-600 text-white font-black uppercase tracking-widest text-[11px] shadow-lg shadow-emerald-100 group rounded-2xl" onClick={handleEnrollNow}>
                        <UserPlus className="size-4 mr-3" /> Enroll in Class
                        <ChevronRight className="size-3 ml-auto opacity-40 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    )}

                    <Button className="tech-button w-full h-14 bg-primary text-primary-foreground font-black uppercase tracking-widest text-[11px] shadow-lg shadow-blue-100 group rounded-2xl" asChild>
                      <Link href={`/payments?studentId=${scannedResult.studentId}`}>
                        <CreditCard className="size-4 mr-3" /> Record Payment
                        <ChevronRight className="size-3 ml-auto opacity-40 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </Button>

                    <Button className="tech-button w-full h-14 bg-white border border-border text-foreground font-black uppercase tracking-widest text-[11px] hover:bg-slate-50 transition-all group rounded-2xl" asChild>
                      <Link href={`/students/${scannedResult.studentId}`}>
                        <User className="size-4 mr-3" /> View Profile
                        <ChevronRight className="size-3 ml-auto opacity-40 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </Button>

                    <Button variant="ghost" className="w-full h-14 border-2 border-dashed border-slate-200 font-black uppercase tracking-widest text-[11px] text-muted-foreground hover:text-foreground hover:border-slate-300 transition-all mt-4 rounded-2xl" onClick={handleReset}>
                      <RefreshCw className="size-4 mr-3" /> Reset Scanner
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

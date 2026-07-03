"use client"

import { useState, useEffect, useMemo, Suspense, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ReceiptTemplate } from '@/components/receipt-template';
import { 
  CreditCard, 
  Printer, 
  CheckCircle2, 
  User, 
  BookOpen, 
  DollarSign, 
  LogIn, 
  Bluetooth, 
  QrCode, 
  RefreshCw,
  Camera,
  X
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { printerService } from '@/lib/bluetooth-printer';
import { ReceiptConfig } from '@/lib/types';
import { Html5QrcodeScanner } from 'html5-qrcode';
import Link from 'next/link';

function PaymentFlowContent() {
  const searchParams = useSearchParams();
  const urlStudentId = searchParams.get('studentId');
  
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBluetoothPrinting, setIsBluetoothPrinting] = useState(false);
  const [isBluetoothSupported, setIsBluetoothSupported] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  const configRef = useMemoFirebase(() => 
    (firestore && user) ? doc(firestore, 'settings', 'receipt_config') : null, 
    [firestore, user]
  );
  const { data: config } = useDoc<ReceiptConfig>(configRef);

  useEffect(() => {
    setIsBluetoothSupported(printerService.isSupported());
  }, []);

  const studentsQuery = useMemoFirebase(() => 
    (firestore && user) ? collection(firestore, 'students') : null, 
    [firestore, user]
  );
  const classesQuery = useMemoFirebase(() => 
    (firestore && user) ? collection(firestore, 'classes') : null, 
    [firestore, user]
  );
  
  const { data: students } = useCollection(studentsQuery);
  const { data: classes } = useCollection(classesQuery);

  // Auto-select student if ID is in URL
  useEffect(() => {
    if (urlStudentId && students) {
      const student = students.find(s => s.id === urlStudentId);
      if (student) {
        setSelectedStudentId(urlStudentId);
      }
    }
  }, [urlStudentId, students]);

  // QR Scanner Initialization
  useEffect(() => {
    if (!isScannerOpen) return;

    const timer = setTimeout(() => {
      const element = document.getElementById("payment-qr-reader");
      if (!element) return;

      if (!scannerRef.current) {
        const scanner = new Html5QrcodeScanner(
          "payment-qr-reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        );

        scanner.render((decodedText) => {
          const id = decodedText.toUpperCase();
          const student = students?.find(s => s.id === id);
          
          if (student) {
            setSelectedStudentId(id);
            setIsScannerOpen(false);
            toast({ title: "Student Identified", description: student.fullName });
          } else {
            toast({ variant: "destructive", title: "Invalid QR Code", description: `Student ID ${id} not found in directory.` });
          }
        }, () => {});
        
        scannerRef.current = scanner;
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => console.warn("Scanner cleanup warning:", e));
        scannerRef.current = null;
      }
    };
  }, [isScannerOpen, students, toast]);

  // Filter classes: Show enrolled classes first, fallback to all if none enrolled
  const filteredClasses = useMemo(() => {
    if (!classes) return [];
    if (!selectedStudentId || !students) return classes;
    
    const student = students.find(s => s.id === selectedStudentId);
    if (!student || !student.enrolledClassIds || student.enrolledClassIds.length === 0) return classes;
    
    return classes.filter(c => student.enrolledClassIds.includes(c.id));
  }, [selectedStudentId, students, classes]);

  const handleStudentChange = (id: string) => {
    setSelectedStudentId(id);
    setSelectedClassId('');
    setAmount('');
    setReceiptData(null);
  };

  const handleClassChange = (id: string) => {
    setSelectedClassId(id);
    setReceiptData(null);
    const selectedClass = classes?.find(c => c.id === id);
    if (selectedClass) {
      const fee = selectedClass.feeAmount;
      setAmount(fee.toString());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !selectedStudentId || !selectedClassId || !amount || !user) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill in all fields' });
      return;
    }

    setIsSubmitting(true);
    
    const student = students?.find(s => s.id === selectedStudentId);
    const tuitionClass = classes?.find(c => c.id === selectedClassId);
    const paymentId = `PAY-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const paymentMonth = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date());

    const recorderName = user.displayName || user.email || 'Administrator';

    const paymentData = {
      id: paymentId,
      studentId: selectedStudentId,
      studentName: student?.fullName || 'Unknown',
      classId: selectedClassId,
      className: tuitionClass?.className || 'Unknown',
      teacherId: tuitionClass?.teacherId || 'unknown',
      amountPaid: parseFloat(amount),
      paymentDate: serverTimestamp(),
      paymentMonth,
      recordedBy: recorderName
    };

    setDocumentNonBlocking(doc(firestore, 'payments', paymentId), paymentData, {});

    // Ensure student is enrolled in this class
    if (student && !student.enrolledClassIds?.includes(selectedClassId)) {
      const updatedClassIds = [...(student.enrolledClassIds || []), selectedClassId];
      updateDocumentNonBlocking(doc(firestore, 'students', selectedStudentId), {
        enrolledClassIds: updatedClassIds
      });
    }

    const newReceipt = {
      receiptNumber: paymentId,
      studentName: student?.fullName,
      className: tuitionClass?.className,
      amount: parseFloat(amount),
      date: new Date(),
      recordedBy: recorderName
    };

    setReceiptData(newReceipt);
    setIsSubmitting(false);
    toast({ title: 'Payment Recorded', description: 'Successfully saved to history.' });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleBluetoothPrint = async () => {
    if (!receiptData) return;
    setIsBluetoothPrinting(true);
    try {
      await printerService.printReceipt({
        ...receiptData,
        config: {
          instituteName: config?.instituteName,
          address1: config?.address1,
          address2: config?.address2,
          phone: config?.phone,
          footer: config?.footerMessage
        }
      });
      toast({ title: "Print Successful" });
    } catch (err: any) {
      console.error("Bluetooth receipt printing failed:", err);
      toast({ 
        variant: "destructive", 
        title: "Print Failed", 
        description: err.message || "Ensure printer is on." 
      });
    } finally {
      setIsBluetoothPrinting(false);
    }
  };

  const handleReset = () => {
    setSelectedStudentId('');
    setSelectedClassId('');
    setAmount('');
    setReceiptData(null);
  };

  if (isUserLoading) return null;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4 space-y-4">
        <CreditCard className="size-16 text-primary/20" />
        <h2 className="text-2xl font-bold font-headline">Authentication Required</h2>
        <Button asChild><Link href="/auth"><LogIn className="size-4 mr-2" /> Sign In</Link></Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 no-print">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground font-headline uppercase">New Payment</h1>
        <p className="text-muted-foreground">Record a tuition fee payment and generate a receipt.</p>
      </div>

      <div className="grid gap-8 grid-cols-1 lg:grid-cols-5">
        <Card className="lg:col-span-3 border-none shadow-lg">
          <CardHeader className="bg-primary/5 border-b">
            <CardTitle className="flex items-center gap-2 text-lg uppercase tracking-tight">
              <CreditCard className="size-5 text-primary" />
              Payment Details
            </CardTitle>
            <CardDescription>Enter the payment information below</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="student" className="flex items-center gap-2 font-bold text-xs uppercase text-muted-foreground">
                  <User className="size-4 text-primary" /> Student Selection
                </Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Select onValueChange={handleStudentChange} value={selectedStudentId} disabled={!!receiptData}>
                      <SelectTrigger className="h-12 border-primary/20">
                        <SelectValue placeholder="Select a student" />
                      </SelectTrigger>
                      <SelectContent>
                        {students?.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.fullName} ({s.id})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon" 
                    className="h-12 w-12 border-primary/20 shrink-0 shadow-sm hover:bg-primary/5 hover:text-primary transition-colors"
                    onClick={() => setIsScannerOpen(true)}
                    disabled={!!receiptData}
                  >
                    <QrCode className="size-5" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="class" className="flex items-center gap-2 font-bold text-xs uppercase text-muted-foreground">
                  <BookOpen className="size-4 text-primary" /> Class / Course
                </Label>
                <Select 
                  onValueChange={handleClassChange} 
                  value={selectedClassId}
                  disabled={!selectedStudentId || !!receiptData}
                >
                  <SelectTrigger className="h-12 border-primary/20">
                    <SelectValue placeholder={selectedStudentId ? "Select a class" : "Select a student first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredClasses.length > 0 ? (
                      filteredClasses.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.className}</SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-xs text-muted-foreground italic">No classes found</div>
                    )}
                  </SelectContent>
                </Select>
                {selectedStudentId && filteredClasses.length < (classes?.length || 0) && (
                  <p className="text-[10px] text-muted-foreground italic">Showing only enrolled classes for this student.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount" className="flex items-center gap-2 font-bold text-xs uppercase text-muted-foreground">
                  <DollarSign className="size-4 text-primary" /> Amount Paid
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input 
                    id="amount" 
                    type="number" 
                    placeholder="0.00" 
                    className="pl-9 h-12 text-lg font-bold border-primary/20" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={!!receiptData}
                  />
                </div>
              </div>

              {receiptData ? (
                <Button type="button" variant="outline" className="w-full h-12 text-base font-bold uppercase tracking-tight" onClick={handleReset}>
                  New Transaction
                </Button>
              ) : (
                <Button type="submit" className="w-full h-12 text-base font-bold shadow-xl uppercase tracking-tight" disabled={isSubmitting}>
                  {isSubmitting ? "Processing..." : "Confirm Payment"}
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-md overflow-hidden bg-muted/30">
            <CardHeader className="p-4 border-b bg-muted/50">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Receipt Preview</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center p-4 bg-white/50">
              <div className="scale-90 origin-top py-6">
                {receiptData ? (
                  <ReceiptTemplate {...receiptData} />
                ) : (
                  <div className="aspect-[3/4] h-[350px] w-full min-w-[280px] bg-card border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                    <Printer className="size-12 mb-4 opacity-20" />
                    <p className="text-sm font-medium">Complete the form to see a preview of the receipt here.</p>
                  </div>
                )}
              </div>
            </CardContent>
            {receiptData && (
              <CardFooter className="bg-emerald-50 text-emerald-700 p-6 border-t border-emerald-100 flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="size-4" />
                  <span className="text-sm font-bold uppercase tracking-tight">Payment Recorded</span>
                </div>
                <div className="grid grid-cols-1 w-full gap-2">
                  {isBluetoothSupported ? (
                    <Button 
                      onClick={handleBluetoothPrint} 
                      className="w-full gap-2 shadow-md bg-blue-600 hover:bg-blue-700 text-white font-bold h-11" 
                      disabled={isBluetoothPrinting}
                    >
                      <Bluetooth className="size-4" /> {isBluetoothPrinting ? "Printing..." : "Bluetooth Print"}
                    </Button>
                  ) : (
                    <div className="p-3 bg-amber-100/50 border border-amber-200 rounded-lg text-amber-800 text-[10px] text-center">
                      Bluetooth Unavailable (Requires HTTPS)
                    </div>
                  )}
                  <Button onClick={handlePrint} variant="outline" className="w-full gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-bold h-11">
                    <Printer className="size-4" /> Standard Print
                  </Button>
                </div>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>

      {/* QR Scanner Dialog */}
      <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
        <DialogContent className="max-w-[400px] p-0 overflow-hidden bg-slate-950 border-none shadow-2xl">
          <DialogHeader className="p-6 bg-slate-900 border-b border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="size-4 text-primary" />
                <DialogTitle className="text-xs uppercase font-black tracking-widest text-slate-400">Scan Student ID</DialogTitle>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={() => setIsScannerOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <DialogDescription className="sr-only">Position the student's QR code within the frame.</DialogDescription>
          </DialogHeader>
          <div className="p-0 relative">
            <div id="payment-qr-reader" className="w-full !border-none"></div>
            <div className="absolute inset-0 pointer-events-none border-[40px] border-slate-950/40"></div>
          </div>
          <div className="p-6 bg-slate-900 border-t border-white/5 text-center">
            <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Awaiting Identification...</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Portal for printing */}
      {mounted && receiptData && createPortal(
        <div className="fixed inset-0 z-[999] bg-white p-10 flex flex-col items-center">
          <ReceiptTemplate {...receiptData} />
        </div>,
        document.getElementById('print-root')!
      )}
    </div>
  );
}

export default function PaymentFlow() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><RefreshCw className="size-8 animate-spin text-primary opacity-20" /></div>}>
      <PaymentFlowContent />
    </Suspense>
  );
}

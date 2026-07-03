
"use client"

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Printer, 
  History, 
  LogIn, 
  Trash2, 
  Filter, 
  Eye, 
  RotateCcw, 
  Recycle,
  Bluetooth,
  Download,
  Calendar as CalendarIcon,
  X,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  UserCheck
} from 'lucide-react';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ReceiptTemplate } from '@/components/receipt-template';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, where } from 'firebase/firestore';
import { deleteDocumentNonBlocking, setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { printerService } from '@/lib/bluetooth-printer';
import { ReceiptConfig } from '@/lib/types';
import Link from 'next/link';

const PRIMARY_ADMIN_EMAIL = 'jayyudyoga@gmail.com';

export default function PaymentHistory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isBluetoothPrinting, setIsBluetoothPrinting] = useState(false);
  const [isBluetoothSupported, setIsBluetoothSupported] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<any>(null);
  const [showBin, setShowBin] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
    setIsBluetoothSupported(printerService.isSupported());
  }, []);

  const userProfileRef = useMemoFirebase(() => 
    (firestore && user) ? doc(firestore, 'users_directory', user.uid) : null,
    [firestore, user]
  );
  const { data: userProfile } = useDoc(userProfileRef);

  const configRef = useMemoFirebase(() => 
    (firestore && user) ? doc(firestore, 'settings', 'receipt_config') : null, 
    [firestore, user]
  );
  const { data: config } = useDoc<ReceiptConfig>(configRef);

  const activePaymentsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !userProfile) return null;
    const role = userProfile.role;
    const baseQuery = collection(firestore, 'payments');
    
    // For Teachers: strictly filter to show only their classes
    if (role === 'teacher') {
      if (!userProfile.referenceId) return null;
      return query(baseQuery, where('teacherId', '==', userProfile.referenceId));
    }
    
    // For Admins: Fetch all, sorted by date
    if (role === 'admin' || role === 'superadmin' || role === 'payment_handler' || user.email === PRIMARY_ADMIN_EMAIL) {
      return query(baseQuery, orderBy('paymentDate', 'desc'));
    }
    
    return null;
  }, [firestore, user, userProfile]);
  
  const deletedPaymentsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !userProfile) return null;
    const isAuthorized = userProfile.role === 'admin' || userProfile.role === 'superadmin' || user.email === PRIMARY_ADMIN_EMAIL;
    if (!isAuthorized) return null;
    return query(collection(firestore, 'deleted_payments'), orderBy('paymentDate', 'desc'));
  }, [firestore, user, userProfile]);

  const superAdminsQuery = useMemoFirebase(() => 
    (firestore && user) ? collection(firestore, 'roles_super_admin') : null, 
    [firestore, user]
  );

  const { data: activePayments, isLoading: isActiveLoading } = useCollection(activePaymentsQuery);
  const { data: deletedPayments, isLoading: isBinLoading } = useCollection(deletedPaymentsQuery);
  const { data: superAdmins } = useCollection(superAdminsQuery);

  const isSuperAdmin = user?.email === PRIMARY_ADMIN_EMAIL || superAdmins?.some(a => a.id === user?.uid);
  const isTeacher = userProfile?.role === 'teacher';
  const rawPayments = showBin ? deletedPayments : activePayments;
  const isLoading = showBin ? isBinLoading : isActiveLoading;

  const filteredPayments = useMemo(() => {
    if (!rawPayments) return [];

    // 1. Client-side sort to ensure consistent display even without server-side composite indexes
    const sorted = [...rawPayments].sort((a, b) => {
      const dateA = a.paymentDate?.toDate ? a.paymentDate.toDate() : new Date(a.paymentDate);
      const dateB = b.paymentDate?.toDate ? b.paymentDate.toDate() : new Date(b.paymentDate);
      return dateB.getTime() - dateA.getTime();
    });

    // 2. Apply filters
    return sorted.filter(p => {
      const matchesSearch = p.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           p.className?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           p.id?.toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesDate = true;
      if (dateRange.from) {
        const pDate = p.paymentDate?.toDate ? p.paymentDate.toDate() : new Date(p.paymentDate);
        const start = startOfDay(dateRange.from);
        const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        matchesDate = isWithinInterval(pDate, { start, end });
      }
      
      return matchesSearch && matchesDate;
    });
  }, [rawPayments, searchTerm, dateRange]);

  const exportToCSV = () => {
    if (filteredPayments.length === 0) return;
    const headers = ['Date', 'Receipt No', 'Student', 'Class', 'Amount', 'Recorded By'];
    const rows = filteredPayments.map(p => [
      format(p.paymentDate?.toDate ? p.paymentDate.toDate() : new Date(p.paymentDate), 'yyyy-MM-dd HH:mm'),
      p.id,
      p.studentName,
      p.className,
      p.amountPaid,
      p.recordedBy
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `shilpa_payments_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Export Complete", description: `${filteredPayments.length} records exported to CSV.` });
  };

  const handlePrint = (payment: any) => {
    setSelectedReceipt({
      receiptNumber: payment.id,
      studentName: payment.studentName,
      className: payment.className,
      amount: payment.amountPaid,
      date: payment.paymentDate?.toDate ? payment.paymentDate.toDate() : new Date(payment.paymentDate),
      recordedBy: payment.recordedBy
    });
    setTimeout(() => window.print(), 150);
  };

  const handleBluetoothPrint = async (payment: any) => {
    const data = {
      receiptNumber: payment.id,
      studentName: payment.studentName,
      className: payment.className,
      amount: payment.amountPaid,
      date: payment.paymentDate?.toDate ? payment.paymentDate.toDate() : new Date(payment.paymentDate),
      recordedBy: payment.recordedBy,
      config: {
        instituteName: config?.instituteName,
        address1: config?.address1,
        address2: config?.address2,
        phone: config?.phone,
        footer: config?.footerMessage
      }
    };
    setIsBluetoothPrinting(true);
    try {
      await printerService.printReceipt(data);
      toast({ title: "Print Successful" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Print Failed", description: err.message });
    } finally {
      setIsBluetoothPrinting(false);
    }
  };

  const handleView = (payment: any) => {
    setSelectedReceipt({
      receiptNumber: payment.id,
      studentName: payment.studentName,
      className: payment.className,
      amount: payment.amountPaid,
      date: payment.paymentDate?.toDate ? payment.paymentDate.toDate() : new Date(payment.paymentDate),
      recordedBy: payment.recordedBy
    });
    setIsViewOpen(true);
  };

  const confirmDelete = () => {
    if (!firestore || !paymentToDelete || !user) return;
    if (showBin) {
      deleteDocumentNonBlocking(doc(firestore, 'deleted_payments', paymentToDelete.id));
      toast({ title: "Permanently Purged" });
    } else {
      const paymentRef = doc(firestore, 'payments', paymentToDelete.id);
      const binRef = doc(firestore, 'deleted_payments', paymentToDelete.id);
      if (isSuperAdmin) {
        setDocumentNonBlocking(binRef, { ...paymentToDelete, deletedAt: new Date().toISOString(), deletedBy: user.email }, {});
        deleteDocumentNonBlocking(paymentRef);
        toast({ title: "Moved to Bin" });
      } else {
        updateDocumentNonBlocking(paymentRef, { deleteRequested: true, deleteRequestedBy: user.email });
        toast({ title: "Deletion Requested", description: "Waiting for superadmin approval." });
      }
    }
    setIsDeleteOpen(false);
    setPaymentToDelete(null);
  };

  const handleRestore = (payment: any) => {
    if (!firestore) return;
    const { deletedAt, deletedBy, ...rest } = payment;
    setDocumentNonBlocking(doc(firestore, 'payments', payment.id), rest, {});
    deleteDocumentNonBlocking(doc(firestore, 'deleted_payments', payment.id));
    toast({ title: "Payment Restored" });
  };

  if (isUserLoading) return null;

  if (!user) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
      <History className="size-16 text-primary/20 mb-4" />
      <h2 className="text-2xl font-bold font-headline uppercase">Login Required</h2>
      <Button asChild className="mt-4"><Link href="/auth">Sign In</Link></Button>
    </div>
  );

  return (
    <div className="space-y-8 no-print animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-4xl font-black tracking-tighter text-foreground font-headline uppercase">
            {showBin ? 'Recycle Bin' : (isTeacher ? 'My Audit Log' : 'Payment History')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            {showBin ? 'Manage and restore deleted transactions.' : (isTeacher ? 'Audit of fees collected for your assigned classes.' : 'Global transaction audit and reporting hub.')}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {!showBin && (
            <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-2 h-10 font-bold border-dashed shadow-sm">
              <Download className="size-4 text-emerald-600" /> Export CSV
            </Button>
          )}
          {isSuperAdmin && (
            <div className="flex items-center space-x-2 bg-muted/50 p-2 rounded-xl border px-3">
              <Switch id="bin-mode" checked={showBin} onCheckedChange={setShowBin} />
              <Label htmlFor="bin-mode" className="text-[10px] font-black uppercase cursor-pointer flex items-center gap-2">
                <Recycle className={`size-4 ${showBin ? 'text-primary' : ''}`} /> Bin
              </Label>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input 
            placeholder="Search by student, class, or receipt ID..." 
            className="pl-9 h-12 shadow-sm rounded-xl border-primary/10 focus:ring-primary/20" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={`h-12 px-4 rounded-xl border-primary/10 font-bold gap-2 min-w-[200px] justify-start ${dateRange.from ? 'text-primary border-primary/30 bg-primary/5' : ''}`}>
              <CalendarIcon className="size-4" />
              {dateRange.from ? (
                dateRange.to ? (
                  <span className="text-xs uppercase">{format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d')}</span>
                ) : (
                  <span className="text-xs uppercase">{format(dateRange.from, 'MMM d, yyyy')}</span>
                )
              ) : (
                <span className="text-xs uppercase">Filter by Date</span>
              )}
              {dateRange.from && (
                <X 
                  className="size-3 ml-auto hover:text-destructive" 
                  onClick={(e) => { e.stopPropagation(); setDateRange({ from: undefined, to: undefined }); }} 
                />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              initialFocus
              mode="range"
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>

      <Card className="border-none shadow-xl overflow-hidden bg-card">
        <Table>
          <TableHeader className={showBin ? 'bg-destructive/5' : 'bg-muted/30'}>
            <TableRow className="hover:bg-transparent border-b">
              <TableHead className="text-[10px] font-black uppercase tracking-widest px-6">ID & Date</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Student & Class</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Status</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Amount</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-20">
                  <div className="flex flex-col items-center gap-2">
                    <RotateCcw className="size-8 animate-spin text-primary opacity-20" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Syncing Audit Log...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredPayments.map((p) => {
              const pDate = p.paymentDate?.toDate ? p.paymentDate.toDate() : new Date(p.paymentDate);
              return (
                <TableRow key={p.id} className={`group hover:bg-primary/5 transition-colors ${p.deleteRequested && !showBin ? 'bg-amber-50/50' : ''}`}>
                  <TableCell className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-mono text-[10px] font-black text-primary leading-none mb-1">#{p.id}</span>
                      <span className="text-[10px] text-muted-foreground font-bold uppercase">{format(pDate, 'MMM d, yyyy • h:mm a')}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-black text-xs uppercase tracking-tight leading-none mb-1">{p.studentName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase truncate max-w-[150px]">{p.className}</span>
                        {!isTeacher && (
                          <Badge variant="outline" className="h-4 px-1.5 text-[7px] font-black uppercase bg-primary/5 border-primary/10">Faculty ID: {p.teacherId}</Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {p.deleteRequested && !showBin ? (
                      <Badge variant="outline" className="text-[8px] bg-amber-100 text-amber-700 border-amber-200 uppercase font-black tracking-widest">
                        Void Requested
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[8px] bg-emerald-50 text-emerald-700 border-emerald-200 uppercase font-black tracking-widest">
                        {showBin ? 'Deleted' : 'Paid'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-black text-primary text-sm tracking-tight">${p.amountPaid.toLocaleString()}</span>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex justify-end gap-1">
                      {!showBin && (
                        <>
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/10 rounded-full" onClick={() => handleView(p)}>
                            <Eye className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:bg-muted rounded-full" onClick={() => handlePrint(p)}>
                            <Printer className="size-4" />
                          </Button>
                        </>
                      )}
                      {showBin ? (
                        <>
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-emerald-600 hover:bg-emerald-50 rounded-full" onClick={() => handleRestore(p)}>
                            <RotateCcw className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10 rounded-full" onClick={() => {setPaymentToDelete(p); setIsDeleteOpen(true);}}>
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={`h-9 w-9 rounded-full ${p.deleteRequested ? 'text-amber-600 hover:bg-amber-100' : 'text-destructive/40 hover:text-destructive hover:bg-destructive/10'}`} 
                          onClick={() => {setPaymentToDelete(p); setIsDeleteOpen(true);}}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {!isLoading && filteredPayments.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-32">
                  <div className="flex flex-col items-center gap-4 opacity-30">
                    <Filter className="size-12" />
                    <p className="text-xs font-black uppercase tracking-[0.2em]">No matching transactions</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-[400px] p-0 overflow-hidden no-print bg-white rounded-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Audit Breakdown</DialogTitle>
            <DialogDescription>Detailed receipt information for transaction auditing.</DialogDescription>
          </DialogHeader>
          <div className="p-8 bg-white overflow-y-auto max-h-[80vh]">
            {selectedReceipt && <ReceiptTemplate {...selectedReceipt} />}
          </div>
          <div className="p-6 bg-muted/20 border-t flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Button className="w-full font-black uppercase tracking-widest text-[10px] h-12 shadow-lg" onClick={() => {setIsViewOpen(false); setTimeout(() => window.print(), 300);}}>
                <Printer className="size-4 mr-2" /> Standard
              </Button>
              <Button variant="secondary" className="w-full font-black uppercase tracking-widest text-[10px] h-12 border shadow-sm" onClick={() => {const p = rawPayments?.find(ap => ap.id === selectedReceipt.receiptNumber); if(p) handleBluetoothPrint(p);}} disabled={isBluetoothPrinting}>
                <Bluetooth className="size-4 mr-2" /> Bluetooth
              </Button>
            </div>
            <Button variant="ghost" className="w-full font-bold text-xs" onClick={() => setIsViewOpen(false)}>Dismiss Audit</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="no-print rounded-2xl">
          <AlertDialogHeader>
            <div className="size-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mb-4">
              <Trash2 className="size-6" />
            </div>
            <AlertDialogTitle className="uppercase font-black text-lg tracking-tight">
              {showBin ? 'Purge Record?' : (isSuperAdmin ? 'Void Transaction?' : 'Request Deletion?')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium">
              {showBin 
                ? 'This action is final and will permanently erase this financial record from the system.' 
                : (isSuperAdmin 
                    ? 'This will move the payment to the Recycle Bin. You can restore it later if needed.' 
                    : 'A void request will be submitted to the Superadmin for verification.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90 rounded-xl font-black uppercase tracking-widest text-[10px] px-6">
              Confirm Action
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {mounted && selectedReceipt && createPortal(
        <div className="fixed inset-0 z-[999] bg-white p-10 flex flex-col items-center">
          <ReceiptTemplate {...selectedReceipt} />
        </div>,
        document.getElementById('print-root')!
      )}
    </div>
  );
}


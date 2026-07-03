"use client"

import { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, UserCheck, Calendar, Save, History, Search, Trash2, ShieldCheck, RefreshCw } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { format, subMonths } from 'date-fns';
import Link from 'next/link';

const PRIMARY_ADMIN_EMAIL = 'jayyudyoga@gmail.com';

export default function TeacherPaymentsAdmin() {
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  // Generate the last 12 months as selectable options
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = subMonths(now, i);
      options.push(format(d, 'MMMM yyyy'));
    }
    return options;
  }, []);

  // Initialize with current month on mount
  useEffect(() => {
    if (!selectedMonth) {
      setSelectedMonth(format(new Date(), 'MMMM yyyy'));
    }
  }, [selectedMonth]);

  const superAdminsQuery = useMemoFirebase(() => 
    (firestore && user) ? collection(firestore, 'roles_super_admin') : null, 
    [firestore, user]
  );
  const { data: superAdmins, isLoading: isAuthLoading } = useCollection(superAdminsQuery);

  const isSuperAdmin = user?.email === PRIMARY_ADMIN_EMAIL || superAdmins?.some(a => a.id === user?.uid);

  const teachersQuery = useMemoFirebase(() => 
    (firestore && user && isSuperAdmin) ? collection(firestore, 'teachers') : null, 
    [firestore, user, isSuperAdmin]
  );
  
  const paymentsQuery = useMemoFirebase(() => 
    (firestore && user && isSuperAdmin) ? collection(firestore, 'teacher_payments') : null, 
    [firestore, user, isSuperAdmin]
  );

  const { data: teachers } = useCollection(teachersQuery);
  const { data: allPaymentsRaw, isLoading: isPaymentsLoading } = useCollection(paymentsQuery);

  const filteredPayments = useMemo(() => {
    if (!allPaymentsRaw) return [];
    return allPaymentsRaw
      .filter(p => {
        const teacherName = p.teacherName || '';
        const month = p.month || '';
        return teacherName.toLowerCase().includes(searchTerm.toLowerCase()) || 
               month.toLowerCase().includes(searchTerm.toLowerCase());
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allPaymentsRaw, searchTerm]);

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !selectedTeacherId || !amount || !user) return;

    setIsSubmitting(true);
    const paymentId = `TP-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const teacher = teachers?.find(t => t.id === selectedTeacherId);

    const paymentData = {
      id: paymentId,
      teacherId: selectedTeacherId,
      teacherName: teacher?.fullName || 'Unknown',
      amountPaid: parseFloat(amount),
      date: new Date().toISOString(),
      month: selectedMonth,
      recordedBy: user.email
    };

    setDocumentNonBlocking(doc(firestore, 'teacher_payments', paymentId), paymentData, { merge: true });
    
    setAmount('');
    setSelectedTeacherId('');
    setIsSubmitting(false);
    toast({ title: "Payment Recorded", description: `Paid ${teacher?.fullName} for ${selectedMonth}.` });
  };

  const handleDelete = (id: string) => {
    if (!firestore) return;
    deleteDocumentNonBlocking(doc(firestore, 'teacher_payments', id));
    toast({ title: "Record Deleted" });
  };

  if (isUserLoading || isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="size-8 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4 space-y-4">
        <ShieldCheck className="size-16 text-destructive/20" />
        <h2 className="text-2xl font-bold font-headline text-destructive uppercase">Access Restricted</h2>
        <p className="text-muted-foreground">Only Super Admins can manage teacher payroll.</p>
        <Button asChild variant="outline"><Link href="/">Return to Dashboard</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground font-headline uppercase">Teacher Payroll</h1>
        <p className="text-muted-foreground mt-1">Record and manage payments made from the institute to instructors.</p>
      </div>

      <div className="grid gap-8 grid-cols-1 lg:grid-cols-3">
        <Card className="border-none shadow-lg h-fit">
          <CardHeader className="bg-primary/5 border-b">
            <CardTitle className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">
              <DollarSign className="size-4 text-primary" /> New Teacher Payment
            </CardTitle>
            <CardDescription>Authorize institute payroll disbursements.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="space-y-2">
                <Label>Select Teacher</Label>
                <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose instructor" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers?.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Payment Month</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Amount Paid ($)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    className="pl-9 h-12 text-lg font-bold" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full gap-2 font-bold h-11" disabled={isSubmitting || !selectedTeacherId || !amount}>
                <Save className="size-4" /> Record Payment
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold uppercase flex items-center gap-2">
                  <History className="size-4 text-primary" /> Payroll History
                </CardTitle>
                <div className="relative w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search..." 
                    className="pl-9 h-8 text-xs bg-background" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] font-bold uppercase">Teacher</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Month</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-right">Amount</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isPaymentsLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-10">
                          <RefreshCw className="size-6 animate-spin mx-auto text-primary opacity-20" />
                        </TableCell>
                      </TableRow>
                    ) : filteredPayments.map((p) => {
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <UserCheck className="size-3 text-primary" />
                              <span className="font-bold text-sm truncate max-w-[150px]">{p.teacherName || 'Unknown Teacher'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{p.month}</TableCell>
                          <TableCell className="text-right font-black text-primary">${p.amountPaid}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(p.id)}>
                              <Trash2 className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredPayments.length === 0 && !isPaymentsLoading && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic">
                          No payroll records found matching your search.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


"use client"

import { useMemo, useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CreditCard, DollarSign, Calendar, TrendingUp, UserCheck, History, Loader2 } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { format } from 'date-fns';
import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip } from 'recharts';

export default function TeacherFinance() {
  const [mounted, setMounted] = useState(false);
  const firestore = useFirestore();
  const { user } = useUser();

  useEffect(() => {
    setMounted(true);
  }, []);

  const userProfileRef = useMemoFirebase(() => 
    (firestore && user) ? doc(firestore, 'users_directory', user.uid) : null,
    [firestore, user]
  );
  const { data: profile } = useDoc(userProfileRef);

  const teacherId = profile?.referenceId;

  // Fetching all payroll to filter/sort client-side (avoids composite index requirement)
  const teacherPaymentsQuery = useMemoFirebase(() => 
    (firestore && teacherId) ? collection(firestore, 'teacher_payments') : null,
    [firestore, teacherId]
  );

  const classesQuery = useMemoFirebase(() => 
    (firestore && teacherId) ? collection(firestore, 'classes') : null,
    [firestore, teacherId]
  );

  const { data: allPaymentsData } = useCollection(teacherPaymentsQuery);
  const { data: allClassesData } = useCollection(classesQuery);

  const payments = useMemo(() => {
    if (!allPaymentsData || !teacherId) return [];
    return allPaymentsData
      .filter(p => p.teacherId === teacherId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allPaymentsData, teacherId]);

  const myClasses = useMemo(() => {
    if (!allClassesData || !teacherId) return [];
    return allClassesData.filter(c => c.teacherId === teacherId);
  }, [allClassesData, teacherId]);

  const totalEarnings = payments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
  const lastPayment = payments[0];

  const chartData = useMemo(() => {
    if (payments.length === 0) return [];
    const monthly = payments.reduce((acc: any, p) => {
      const month = p.month || 'Unknown';
      acc[month] = (acc[month] || 0) + p.amountPaid;
      return acc;
    }, {});
    return Object.entries(monthly).map(([month, amount]) => ({ month, amount }));
  }, [payments]);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="size-8 animate-spin text-primary/20" />
      </div>
    );
  }

  if (!user || profile?.role !== 'teacher') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
        <CreditCard className="size-16 text-muted-foreground/20 mb-4" />
        <h2 className="text-2xl font-bold font-headline uppercase">Teacher Access Only</h2>
        <p className="text-muted-foreground">This dashboard is reserved for linked teacher profiles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground font-headline uppercase">My Finance Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of earnings and payments from the institute.</p>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
        <Card className="border-none shadow-sm bg-primary text-primary-foreground">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest opacity-80">Total Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black tracking-tighter">${totalEarnings.toLocaleString()}</div>
            <p className="text-[10px] mt-2 opacity-70 flex items-center gap-1 uppercase font-bold">
              <TrendingUp className="size-3" /> Cumulative Total
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Last Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter">
              {lastPayment ? `$${lastPayment.amountPaid.toLocaleString()}` : '$0'}
            </div>
            <p className="text-[10px] mt-2 text-muted-foreground flex items-center gap-1 uppercase font-bold">
              <Calendar className="size-3" /> {lastPayment ? lastPayment.month : 'No records'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Active Classes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter">{myClasses.length}</div>
            <p className="text-[10px] mt-2 text-muted-foreground flex items-center gap-1 uppercase font-bold">
              <UserCheck className="size-3" /> Currently Teaching
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 grid-cols-1 lg:grid-cols-2">
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-sm font-bold uppercase flex items-center gap-2">
              <History className="size-4 text-primary" /> Recent Payment History
            </CardTitle>
            <CardDescription>Direct payments from the institute directory.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] font-bold uppercase">Month</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-right">Amount</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-bold">{p.month}</TableCell>
                    <TableCell className="text-right font-black text-primary">${p.amountPaid}</TableCell>
                    <TableCell className="text-right text-[10px] text-muted-foreground">
                      {p.date ? format(new Date(p.date), 'MMM d, yyyy') : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
                {payments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-10 text-muted-foreground italic">
                      No payment records found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase">Earnings Trend</CardTitle>
            <CardDescription>Monthly earnings breakdown.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" fontSize={10} fontWeight="bold" />
                  <YAxis fontSize={10} fontWeight="bold" />
                  <Tooltip 
                    cursor={{fill: 'hsl(var(--muted))'}} 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border p-2 rounded-lg shadow-xl">
                            <p className="text-xs font-bold uppercase">{payload[0].payload.month}</p>
                            <p className="text-lg font-black text-primary">${payload[0].value}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-xs italic">
                Insufficient data to generate trend chart.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

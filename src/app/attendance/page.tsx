"use client"

import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  CalendarCheck, 
  Users, 
  Search, 
  Save, 
  Calendar as CalendarIcon, 
  LogIn, 
  CheckCircle2, 
  History, 
  Filter,
  UserCheck,
  XCircle,
  Clock,
  ArrowRight,
  BookOpen,
  RotateCcw
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc, query, where, orderBy } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import Link from 'next/link';

export default function AttendanceManagement() {
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [attendanceStates, setAttendanceStates] = useState<Record<string, 'present' | 'absent' | 'late'>>({});
  const [searchTerm, setSearchTerm] = useState('');
  
  // History Filters
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all');
  const [historyClassFilter, setHistoryClassFilter] = useState('all');
  const [historyDateFilter, setHistoryDateFilter] = useState('');
  
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => 
    (firestore && user) ? doc(firestore, 'users_directory', user.uid) : null,
    [firestore, user]
  );
  const { data: profile } = useDoc(userProfileRef);

  const classesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    if (profile?.role === 'teacher' && profile.referenceId) {
      return query(collection(firestore, 'classes'), where('teacherId', '==', profile.referenceId));
    }
    return collection(firestore, 'classes');
  }, [firestore, user, profile]);

  const studentsQuery = useMemoFirebase(() => 
    (firestore && user) ? collection(firestore, 'students') : null, 
    [firestore, user]
  );
  
  const attendanceQuery = useMemoFirebase(() => 
    (firestore && user) ? query(collection(firestore, 'attendance'), orderBy('date', 'desc')) : null, 
    [firestore, user]
  );

  const { data: classes } = useCollection(classesQuery);
  const { data: students } = useCollection(studentsQuery);
  const { data: allAttendance } = useCollection(attendanceQuery);

  const filteredStudents = useMemo(() => {
    if (!selectedClassId || !students) return [];
    return students.filter(s => 
      s.enrolledClassIds?.includes(selectedClassId) &&
      s.fullName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [selectedClassId, students, searchTerm]);

  const filteredHistory = useMemo(() => {
    if (!allAttendance) return [];
    return allAttendance.filter(record => {
      const matchesSearch = record.studentName.toLowerCase().includes(historySearch.toLowerCase()) || 
                           record.className.toLowerCase().includes(historySearch.toLowerCase());
      const matchesStatus = historyStatusFilter === 'all' || record.status === historyStatusFilter;
      const matchesClass = historyClassFilter === 'all' || record.classId === historyClassFilter;
      const matchesDate = !historyDateFilter || record.date === historyDateFilter;
      
      return matchesSearch && matchesStatus && matchesClass && matchesDate;
    });
  }, [allAttendance, historySearch, historyStatusFilter, historyClassFilter, historyDateFilter]);

  useEffect(() => {
    if (!selectedClassId || !selectedDate || !allAttendance) return;
    
    const relevantRecords = allAttendance.filter(a => 
      a.classId === selectedClassId && a.date === selectedDate
    );

    const newState: Record<string, 'present' | 'absent' | 'late'> = {};
    relevantRecords.forEach(record => {
      newState[record.studentId] = record.status;
    });
    setAttendanceStates(newState);
  }, [selectedClassId, selectedDate, allAttendance]);

  const handleStatusChange = (studentId: string, status: 'present' | 'absent' | 'late') => {
    setAttendanceStates(prev => ({ ...prev, [studentId]: status }));
  };

  const handleSaveAttendance = () => {
    if (!firestore || !selectedClassId || !user) return;

    const tuitionClass = classes?.find(c => c.id === selectedClassId);
    const recordedBy = user.displayName || user.email || 'Admin';

    Object.entries(attendanceStates).forEach(([studentId, status]) => {
      const student = students?.find(s => s.id === studentId);
      if (!student) return;

      const recordId = `${selectedClassId}_${studentId}_${selectedDate}`;
      const recordData = {
        id: recordId,
        studentId,
        studentName: student.fullName,
        classId: selectedClassId,
        className: tuitionClass?.className || 'Unknown Class',
        date: selectedDate,
        status,
        recordedBy
      };

      setDocumentNonBlocking(doc(firestore, 'attendance', recordId), recordData, { merge: true });
    });

    toast({ 
      title: "Attendance Saved", 
      description: `Attendance for ${format(new Date(selectedDate), 'MMM d, yyyy')} updated.` 
    });
  };

  const resetHistoryFilters = () => {
    setHistorySearch('');
    setHistoryStatusFilter('all');
    setHistoryClassFilter('all');
    setHistoryDateFilter('');
  };

  if (isUserLoading) return null;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4 space-y-4">
        <CalendarCheck className="size-16 text-primary/20" />
        <h2 className="text-2xl font-bold font-headline uppercase">Authentication Required</h2>
        <Button asChild><Link href="/auth"><LogIn className="size-4 mr-2" /> Sign In</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-black tracking-tight text-foreground font-headline uppercase">Student Attendance</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">Track and audit student presence across all tuition sessions.</p>
        </div>
      </div>

      <Tabs defaultValue="marking" className="space-y-6">
        <TabsList className="grid grid-cols-2 w-full max-w-[400px] h-12 p-1 bg-muted/50 border">
          <TabsTrigger value="marking" className="gap-2 font-bold text-[10px] uppercase">
            <CalendarCheck className="size-3.5" /> Mark Entry
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 font-bold text-[10px] uppercase">
            <History className="size-3.5" /> History Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="marking" className="animate-in fade-in slide-in-from-left-4 duration-500">
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-4">
            <Card className="lg:col-span-1 border-none shadow-sm h-fit lg:sticky lg:top-24">
              <CardHeader className="pb-4">
                <CardTitle className="text-xs font-black uppercase tracking-wider text-primary">Session Selection</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Select Class</Label>
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Choose a class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes?.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.className}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Select Date</Label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input 
                      type="date" 
                      className="pl-9 h-11" 
                      value={selectedDate} 
                      onChange={(e) => setSelectedDate(e.target.value)} 
                    />
                  </div>
                </div>

                <Button 
                  className="w-full h-12 gap-2 shadow-lg bg-emerald-600 hover:bg-emerald-700 font-black uppercase tracking-widest text-[10px]"
                  onClick={handleSaveAttendance}
                  disabled={!selectedClassId}
                >
                  <Save className="size-4" /> Save Attendance
                </Button>
              </CardContent>
            </Card>

            <div className="lg:col-span-3 space-y-4">
              {!selectedClassId ? (
                <div className="flex flex-col items-center justify-center py-24 bg-muted/20 rounded-2xl border-2 border-dashed border-muted-foreground/10 text-center p-6">
                  <Users className="size-12 mb-4 text-muted-foreground/30" />
                  <p className="text-sm font-bold uppercase text-muted-foreground tracking-widest">Select a class to view enrollment</p>
                </div>
              ) : (
                <Card className="border-none shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
                  <CardHeader className="bg-muted/30 pb-4 border-b border-border/50">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <Users className="size-5 text-primary" />
                        <CardTitle className="text-base uppercase font-black">Students Enrolled</CardTitle>
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black bg-primary/10 text-primary uppercase">
                          {filteredStudents.length} Total
                        </span>
                      </div>
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input 
                          placeholder="Search name..." 
                          className="pl-9 bg-background h-10 text-sm" 
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border/50">
                      {filteredStudents.map((student) => (
                        <div key={student.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 hover:bg-muted/10 transition-colors gap-4">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="size-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black border border-primary/5">
                              {student.fullName.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-black text-sm uppercase tracking-tight text-foreground truncate leading-none mb-1">{student.fullName}</p>
                              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider truncate">Parent: {student.parentPhone}</p>
                            </div>
                          </div>

                          <div className="flex items-center overflow-x-auto no-scrollbar py-1">
                            <RadioGroup 
                              className="flex gap-1.5 md:gap-2" 
                              value={attendanceStates[student.id] || ''}
                              onValueChange={(val) => handleStatusChange(student.id, val as any)}
                            >
                              {[
                                { id: 'present', label: 'Present', color: 'emerald' },
                                { id: 'absent', label: 'Absent', color: 'red' },
                                { id: 'late', label: 'Late', color: 'amber' }
                              ].map((s) => (
                                <div key={s.id} className="flex items-center">
                                  <RadioGroupItem value={s.id} id={`${s.id}-${student.id}`} className="sr-only" />
                                  <Label 
                                    htmlFor={`${s.id}-${student.id}`}
                                    className={`px-3 md:px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border cursor-pointer transition-all whitespace-nowrap ${
                                      attendanceStates[student.id] === s.id 
                                        ? s.id === 'present' ? 'bg-emerald-100 text-emerald-700 border-emerald-500 shadow-sm' :
                                          s.id === 'absent' ? 'bg-red-100 text-red-700 border-red-500 shadow-sm' :
                                          'bg-amber-100 text-amber-700 border-amber-500 shadow-sm'
                                        : 'bg-background text-muted-foreground border-border hover:border-muted-foreground/30'
                                    }`}
                                  >
                                    {s.label}
                                  </Label>
                                </div>
                              ))}
                            </RadioGroup>
                          </div>
                        </div>
                      ))}
                      {filteredStudents.length === 0 && (
                        <div className="p-16 text-center text-muted-foreground italic text-xs uppercase font-bold tracking-widest">
                          No matching student records.
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="bg-muted/20 border-t border-border/50 p-4 flex justify-end">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-bold uppercase tracking-widest">
                      <CheckCircle2 className="size-3 text-emerald-600" />
                      Synced with Live Directory
                    </p>
                  </CardFooter>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <History className="size-5 text-primary" />
                      <CardTitle className="text-base uppercase font-black">History Logs</CardTitle>
                    </div>
                    <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase tracking-widest h-8" onClick={resetHistoryFilters}>
                      <RotateCcw className="size-3 mr-1.5" /> Reset Filters
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Search Student</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <Input 
                          placeholder="Name..." 
                          className="pl-9 h-10 text-xs bg-muted/20 border-none shadow-none" 
                          value={historySearch}
                          onChange={(e) => setHistorySearch(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Filter by Class</Label>
                      <Select value={historyClassFilter} onValueChange={setHistoryClassFilter}>
                        <SelectTrigger className="h-10 text-xs bg-muted/20 border-none shadow-none">
                          <BookOpen className="size-3.5 mr-2 opacity-50" />
                          <SelectValue placeholder="All Classes" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Classes</SelectItem>
                          {classes?.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.className}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Filter by Date</Label>
                      <div className="relative">
                        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <Input 
                          type="date"
                          className="pl-9 h-10 text-xs bg-muted/20 border-none shadow-none" 
                          value={historyDateFilter}
                          onChange={(e) => setHistoryDateFilter(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Status</Label>
                      <Select value={historyStatusFilter} onValueChange={setHistoryStatusFilter}>
                        <SelectTrigger className="h-10 text-xs bg-muted/20 border-none shadow-none">
                          <Filter className="size-3.5 mr-2 opacity-50" />
                          <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="present">Present</SelectItem>
                          <SelectItem value="absent">Absent</SelectItem>
                          <SelectItem value="late">Late</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="border-t border-muted/50">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="font-bold text-[10px] uppercase">Date</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase">Student</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase">Class</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase">Status</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase text-right">Recorded By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredHistory.map((record) => (
                        <TableRow key={record.id} className="group">
                          <TableCell className="font-medium text-xs">
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="size-3 text-muted-foreground" />
                              {format(new Date(record.date), 'MMM d, yyyy')}
                            </div>
                          </TableCell>
                          <TableCell className="font-black text-xs uppercase tracking-tight">
                            {record.studentName}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-bold uppercase">
                            {record.className}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={record.status === 'present' ? 'default' : record.status === 'absent' ? 'destructive' : 'secondary'}
                              className={`text-[8px] font-black uppercase tracking-widest ${
                                record.status === 'present' ? 'bg-emerald-500 hover:bg-emerald-600' :
                                record.status === 'late' ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''
                              }`}
                            >
                              {record.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground font-bold uppercase">
                              <Clock className="size-3" />
                              {record.recordedBy}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredHistory.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-24 italic text-muted-foreground">
                            <div className="flex flex-col items-center gap-3">
                              <Filter className="size-8 opacity-10" />
                              <p className="text-xs font-bold uppercase tracking-widest">No matching history records</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
              {filteredHistory.length > 0 && (
                <CardFooter className="bg-muted/20 border-t p-4 flex justify-between items-center">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    Showing {filteredHistory.length} Record{filteredHistory.length !== 1 ? 's' : ''}
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="size-2 rounded-full bg-emerald-500" />
                      <span className="text-[10px] font-bold uppercase tracking-tighter">
                        {Math.round((filteredHistory.filter(r => r.status === 'present').length / filteredHistory.length) * 100)}% Present
                      </span>
                    </div>
                  </div>
                </CardFooter>
              )}
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

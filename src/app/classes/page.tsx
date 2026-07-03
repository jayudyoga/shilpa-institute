
"use client"

import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Search, User, Edit2, Trash2, Calendar, Plus, LogIn, Clock, Users, UserPlus, CheckCircle2, X, Percent, UserCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const DAYS_OF_WEEK = [
  { id: 'Mon', label: 'Mon' },
  { id: 'Tue', label: 'Tue' },
  { id: 'Wed', label: 'Wed' },
  { id: 'Thu', label: 'Thu' },
  { id: 'Fri', label: 'Fri' },
  { id: 'Sat', label: 'Sat' },
  { id: 'Sun', label: 'Sun' },
];

export default function ClassManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEnrollmentOpen, setIsEnrollmentOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<any>(null);
  const [enrollmentClass, setEnrollmentClass] = useState<any>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState('09:00');
  
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => 
    (firestore && user) ? doc(firestore, 'users_directory', user.uid) : null,
    [firestore, user]
  );
  const { data: profile } = useDoc(userProfileRef);

  const classesQuery = useMemoFirebase(() => {
    if (!firestore || !user || !profile) return null;
    
    // If teacher, strictly show ONLY their classes
    if (profile.role === 'teacher' && profile.referenceId) {
      return query(collection(firestore, 'classes'), where('teacherId', '==', profile.referenceId));
    }
    
    return collection(firestore, 'classes');
  }, [firestore, user, profile]);

  const teachersQuery = useMemoFirebase(() => 
    (firestore && user) ? collection(firestore, 'teachers') : null, 
    [firestore, user]
  );
  const studentsQuery = useMemoFirebase(() => 
    (firestore && user) ? collection(firestore, 'students') : null, 
    [firestore, user]
  );
  
  const { data: classes, isLoading } = useCollection(classesQuery);
  const { data: teachers } = useCollection(teachersQuery);
  const { data: students } = useCollection(studentsQuery);

  const isTeacher = profile?.role === 'teacher';
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin' || user?.email === 'jayyudyoga@gmail.com';

  useEffect(() => {
    if (editingClass?.schedule) {
      const parts = editingClass.schedule.split(' ');
      const time = parts.pop();
      const daysStr = parts.join(' ').replace(/,/g, '');
      const days = daysStr.split(' ').filter(Boolean);
      
      setSelectedDays(days);
      setSelectedTime(time || '09:00');
    } else {
      setSelectedDays([]);
      setSelectedTime('09:00');
    }
  }, [editingClass]);

  const filteredClasses = classes?.filter(c => 
    c.className.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const filteredStudents = useMemo(() => {
    if (!students) return [];
    return students.filter(s => 
      s.fullName.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.grade.toLowerCase().includes(studentSearch.toLowerCase())
    );
  }, [students, studentSearch]);

  const handleDayToggle = (dayId: string) => {
    setSelectedDays(prev => 
      prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]
    );
  };

  const handleSaveClass = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore) return;

    const formData = new FormData(e.currentTarget);
    const className = formData.get('className') as string;
    const teacherId = formData.get('teacherId') as string;
    const feeAmount = parseFloat(formData.get('feeAmount') as string);
    const feeType = formData.get('feeType') as string;
    const teacherCommissionPercentage = parseFloat(formData.get('commission') as string) || 70;
    
    const sortedDays = DAYS_OF_WEEK
      .filter(d => selectedDays.includes(d.id))
      .map(d => d.id);
    
    if (sortedDays.length === 0) {
      toast({ variant: 'destructive', title: "Schedule Error", description: "Please select at least one day." });
      return;
    }

    const schedule = `${sortedDays.join(', ')} ${selectedTime}`;

    const classId = editingClass?.id || Math.random().toString(36).substring(2, 11);
    const classData = { 
      id: classId, 
      className, 
      teacherId, 
      feeAmount, 
      feeType, 
      schedule,
      teacherCommissionPercentage
    };

    setDocumentNonBlocking(doc(firestore, 'classes', classId), classData, { merge: true });
    
    setIsDialogOpen(false);
    setEditingClass(null);
    toast({ title: editingClass ? "Class Updated" : "Class Created" });
  };

  const handleDelete = (id: string) => {
    if (!firestore) return;
    deleteDocumentNonBlocking(doc(firestore, 'classes', id));
    toast({ title: "Class Deleted" });
  };

  const toggleStudentEnrollment = (student: any) => {
    if (!firestore || !enrollmentClass) return;

    const currentEnrollments = student.enrolledClassIds || [];
    const isEnrolled = currentEnrollments.includes(enrollmentClass.id);
    
    const newEnrollments = isEnrolled
      ? currentEnrollments.filter((id: string) => id !== enrollmentClass.id)
      : [...currentEnrollments, enrollmentClass.id];
    
    updateDocumentNonBlocking(doc(firestore, 'students', student.id), {
      enrolledClassIds: newEnrollments
    });

    toast({ 
      title: isEnrolled ? "Student Removed" : "Student Enrolled",
      description: `${student.fullName} ${isEnrolled ? 'removed from' : 'added to'} ${enrollmentClass.className}.`
    });
  };

  if (isUserLoading) return null;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4 space-y-4">
        <BookOpen className="size-16 text-primary/20" />
        <h2 className="text-2xl font-bold font-headline">Authentication Required</h2>
        <p className="text-muted-foreground max-w-md">Please sign in to view and manage tuition classes.</p>
        <Button asChild><Link href="/auth"><LogIn className="size-4 mr-2" /> Sign In</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground font-headline uppercase">
            {isTeacher ? "My Assigned Classes" : "Class Management"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            {isTeacher ? "View your schedule and enrolled student nodes." : "Define course schedules, teachers, and student assignments."}
          </p>
        </div>
        
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingClass(null); }}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto gap-2 shadow-lg h-11 bg-primary font-bold">
                <Plus className="size-4" /> Create Class
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
              <form onSubmit={handleSaveClass} key={editingClass?.id || 'new'}>
                <DialogHeader>
                  <DialogTitle className="uppercase tracking-tight">{editingClass ? "Edit Class" : "Create New Class"}</DialogTitle>
                  <DialogDescription>
                    Configure the course details, scheduling, and payroll.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4 max-h-[70vh] overflow-y-auto pr-2">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Class Name</Label>
                    <Input name="className" defaultValue={editingClass?.className} placeholder="e.g. Physics Grade 12" required />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Assign Teacher</Label>
                    <Select name="teacherId" defaultValue={editingClass?.teacherId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a teacher" />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers?.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.fullName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Fee Type</Label>
                      <Select name="feeType" defaultValue={editingClass?.feeType || "monthly"}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Fee Amount ($)</Label>
                      <Input name="feeAmount" type="number" defaultValue={editingClass?.feeAmount} placeholder="150" required />
                    </div>
                  </div>

                  <div className="space-y-2 border p-4 rounded-xl bg-primary/5 border-primary/10">
                    <Label className="text-[10px] font-black uppercase text-primary flex items-center gap-2">
                      <Percent className="size-3" /> Teacher Commission (%)
                    </Label>
                    <div className="relative mt-1.5">
                      <Input 
                        name="commission" 
                        type="number" 
                        defaultValue={editingClass?.teacherCommissionPercentage || 70} 
                        placeholder="70" 
                        className="pr-8 h-11"
                        required 
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">%</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground italic">Percentage of student fees this teacher earns from this class.</p>
                  </div>

                  <div className="space-y-4 border rounded-xl p-4 bg-muted/20">
                    <Label className="flex items-center gap-2 mb-2 text-foreground font-black text-[10px] uppercase tracking-widest">
                      <Calendar className="size-3.5" /> Schedule Details
                    </Label>
                    
                    <div className="space-y-3">
                      <Label className="text-[9px] text-muted-foreground uppercase font-bold">Select Days</Label>
                      <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2">
                        {DAYS_OF_WEEK.map((day) => (
                          <div key={day.id} className="flex items-center space-x-2 bg-background p-2 rounded-md border shadow-sm">
                            <Checkbox 
                              id={`day-${day.id}`} 
                              checked={selectedDays.includes(day.id)}
                              onCheckedChange={() => handleDayToggle(day.id)}
                            />
                            <label
                              htmlFor={`day-${day.id}`}
                              className="text-xs font-medium leading-none cursor-pointer"
                            >
                              {day.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <Label className="text-[9px] text-muted-foreground uppercase font-bold">Start Time</Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input 
                          type="time" 
                          value={selectedTime} 
                          onChange={(e) => setSelectedTime(e.target.value)}
                          className="pl-9 h-11"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" className="font-bold">Save Class</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input 
          placeholder="Search classes..." 
          className="pl-9 h-11 shadow-sm rounded-xl border-primary/10" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {filteredClasses.map((tuitionClass) => {
          const teacher = teachers?.find(t => t.id === tuitionClass.teacherId);
          const isOwnClass = isTeacher && tuitionClass.teacherId === profile?.referenceId;
          const classStudents = students?.filter(s => s.enrolledClassIds?.includes(tuitionClass.id)) || [];
          
          return (
            <Card key={tuitionClass.id} className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden flex flex-col bg-card rounded-2xl border-l-4 border-l-transparent hover:border-l-primary transition-all">
              <CardHeader className="pb-4 bg-primary/5">
                <div className="flex items-start justify-between">
                  <div className="size-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm shrink-0">
                    <BookOpen className="size-5" />
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <div className="text-xl font-black text-primary">${tuitionClass.feeAmount}</div>
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">
                      {tuitionClass.feeType === 'daily' ? 'Per Day' : 'Per Month'}
                    </div>
                  </div>
                </div>
                <CardTitle className="mt-4 text-lg leading-tight truncate uppercase tracking-tight font-black">{tuitionClass.className}</CardTitle>
                {isAdmin && (
                  <Badge variant="outline" className="w-fit text-[8px] font-black uppercase tracking-widest border-primary/20 bg-primary/5 mt-1">
                    Commission: {tuitionClass.teacherCommissionPercentage || 70}%
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-4 pt-6 flex-1">
                <div className="flex items-center gap-3 text-sm">
                  <div className={`p-1.5 rounded-full shrink-0 ${isOwnClass ? 'bg-emerald-100' : 'bg-muted'}`}>
                    <UserCheck className={`size-3.5 ${isOwnClass ? 'text-emerald-600' : 'text-primary'}`} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground truncate uppercase text-xs">
                      {teacher?.fullName || 'Unassigned Teacher'}
                    </span>
                    {isOwnClass && (
                      <Badge className="h-4 px-1.5 text-[8px] font-black uppercase bg-emerald-500 hover:bg-emerald-500">You</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="p-1.5 rounded-full bg-muted shrink-0">
                    <Clock className="size-3.5 text-primary" />
                  </div>
                  <span className="text-muted-foreground truncate font-bold text-[10px] uppercase">{tuitionClass.schedule}</span>
                </div>
                <div className="pt-2 flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {classStudents.slice(0, 3).map((s, i) => (
                      <div key={s.id} className="size-7 rounded-full bg-accent border-2 border-background flex items-center justify-center text-[10px] text-accent-foreground font-bold shadow-sm">
                        {s.fullName.charAt(0)}
                      </div>
                    ))}
                    {classStudents.length > 3 && (
                      <div className="size-7 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                        +{classStudents.length - 3}
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-bold text-muted-foreground uppercase text-[10px] tracking-widest">
                    {classStudents.length} {classStudents.length === 1 ? 'Student' : 'Students'}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="p-2 bg-muted/30 flex justify-between gap-1 border-t">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="gap-2 h-9 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 font-bold text-[10px] uppercase"
                  onClick={() => { setEnrollmentClass(tuitionClass); setIsEnrollmentOpen(true); }}
                >
                  <UserPlus className="size-4" /> {isTeacher ? "My Students" : "Enrollment"}
                </Button>
                {isAdmin && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-9 w-9 p-0 hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => { setEditingClass(tuitionClass); setIsDialogOpen(true); }}>
                      <Edit2 className="size-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive/40 hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => handleDelete(tuitionClass.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </CardFooter>
            </Card>
          );
        })}
        {!isLoading && filteredClasses.length === 0 && (
          <div className="col-span-full py-20 text-center text-muted-foreground bg-muted/10 rounded-2xl border-2 border-dashed">
            <BookOpen className="size-12 mx-auto mb-4 opacity-10" />
            <p className="font-bold uppercase text-[10px] tracking-widest">No assigned classes found.</p>
          </div>
        )}
      </div>

      <Dialog open={isEnrollmentOpen} onOpenChange={setIsEnrollmentOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-tight flex items-center gap-2 font-black">
              <Users className="size-5 text-primary" />
              {isTeacher ? "Class Roster" : "Manage Enrollment"}
            </DialogTitle>
            <DialogDescription>
              {isTeacher 
                ? `Enrolled students for ${enrollmentClass?.className}.`
                : `Assign students to ${enrollmentClass?.className}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {!isTeacher && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input 
                  placeholder="Search students to enroll..." 
                  className="pl-9 h-11 rounded-xl" 
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
              </div>
            )}
            
            <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-2">
              {isTeacher ? (
                // Teacher view: Only show enrolled students
                students?.filter(s => s.enrolledClassIds?.includes(enrollmentClass?.id)).map(student => (
                  <div 
                    key={student.id} 
                    className="flex items-center justify-between p-3 rounded-xl border bg-primary/5 border-primary/10"
                  >
                    <div className="flex flex-col">
                      <span className="font-black text-sm uppercase tracking-tight">{student.fullName}</span>
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{student.grade}</span>
                    </div>
                    <Badge variant="secondary" className="text-[8px] font-black uppercase">Enrolled</Badge>
                  </div>
                ))
              ) : (
                // Admin view: Show all for toggle
                filteredStudents.map((student) => {
                  const isEnrolled = student.enrolledClassIds?.includes(enrollmentClass?.id);
                  return (
                    <div 
                      key={student.id} 
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isEnrolled ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/50'}`}
                    >
                      <div className="flex flex-col">
                        <span className="font-black text-sm uppercase tracking-tight">{student.fullName}</span>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{student.grade}</span>
                      </div>
                      <Checkbox 
                        checked={isEnrolled}
                        onCheckedChange={() => toggleStudentEnrollment(student)}
                        className="size-5 rounded-md"
                      />
                    </div>
                  );
                })
              )}
              {filteredStudents.length === 0 && (
                <div className="text-center py-8 text-muted-foreground italic text-[10px] uppercase font-bold tracking-widest">
                  No students found.
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full font-black uppercase tracking-widest text-[10px] h-12 shadow-lg" onClick={() => setIsEnrollmentOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


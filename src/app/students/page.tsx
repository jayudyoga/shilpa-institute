
"use client"

import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Phone, GraduationCap, Edit2, Trash2, LogIn, QrCode, User, ChevronRight, Filter } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function StudentManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('All');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
   
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const studentsQuery = useMemoFirebase(() => 
     (firestore && user) ? collection(firestore, 'students') : null, 
    [firestore, user]
  );

  const { data: students, isLoading } = useCollection(studentsQuery);

  // Derive unique grades for filtering
  const uniqueGrades = useMemo(() => {
    if (!students) return ['All'];
    const grades = Array.from(new Set(students.map(s => s.grade))).filter(Boolean);
    return ['All', ...grades.sort()];
  }, [students]);

  // Combined local search and grade filtering logic
  const filteredStudents = useMemo(() => {
    if (!students) return [];
    return students.filter(s => {
      const matchesSearch = s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           s.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGrade = selectedGrade === 'All' || s.grade === selectedGrade;
      return matchesSearch && matchesGrade;
    });
  }, [students, searchTerm, selectedGrade]);

  const handleSaveStudent = (e: React.FormEvent<HTMLFormElement>) => { 
    e.preventDefault();
    if (!firestore) return;

    const formData = new FormData(e.currentTarget);
    const fullName = formData.get('fullName') as string;
    const grade = formData.get('grade') as string;
    const parentPhone = formData.get('parentPhone') as string;

    const studentId = editingStudent?.id || Math.random().toString(36).substring(2, 11).toUpperCase();
    const studentData = { 
      id: studentId, 
      fullName, 
      grade, 
      parentPhone, 
      enrolledClassIds: editingStudent?.enrolledClassIds || [] 
    };

    setDocumentNonBlocking(doc(firestore, 'students', studentId), studentData, { merge: true });
    
    setIsDialogOpen(false);
    setEditingStudent(null);
    toast({ title: editingStudent ? "Student Updated" : "Student Enrolled" });
  };

  const handleDelete = (id: string) => {
    if (!firestore) return;
    deleteDocumentNonBlocking(doc(firestore, 'students', id));
    toast({ title: "Student Record Removed" });
  };

  if (isUserLoading) return null;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4 space-y-4">
        <GraduationCap className="size-16 text-primary/20" />
        <h2 className="text-2xl font-bold font-headline">Authentication Required</h2>
        <Button asChild><Link href="/auth"><LogIn className="size-4 mr-2" /> Sign In</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-4xl font-black tracking-tight text-foreground font-headline uppercase">Student Directory</h1>
          <p className="text-muted-foreground mt-1">Manage enrollments, academic levels, and communication profiles.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="gap-2 h-11 border-dashed font-bold shadow-sm">
            <Link href="/scan"><QrCode className="size-4" /> Scan to Find</Link>
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingStudent(null); }}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-lg h-11 bg-primary font-bold">
                <Plus className="size-4" /> Enroll New
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-lg">
              <form onSubmit={handleSaveStudent} key={editingStudent?.id || 'new'}>
                <DialogHeader>
                  <DialogTitle className="uppercase tracking-tight">{editingStudent ? "Edit Student" : "New Enrollment"}</DialogTitle>
                  <DialogDescription>Enter the student's personal and academic information.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Full Name</Label>
                    <Input name="fullName" defaultValue={editingStudent?.fullName} placeholder="e.g. John Doe" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase font-bold text-muted-foreground">Grade / Level</Label>
                      <Input name="grade" defaultValue={editingStudent?.grade} placeholder="e.g. Grade 10" required />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase font-bold text-muted-foreground">Parent Phone</Label>
                      <Input name="parentPhone" defaultValue={editingStudent?.parentPhone} placeholder="+94..." required />
                    </div>
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" className="font-bold">{editingStudent ? "Update" : "Enroll"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name or student ID..." 
              className="pl-9 h-12 shadow-sm rounded-xl border-primary/10" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/50 rounded-xl border text-[10px] font-black uppercase text-muted-foreground shrink-0">
              <Filter className="size-3" /> Filter
            </div>
            {uniqueGrades.map(grade => (
              <Button
                key={grade}
                variant={selectedGrade === grade ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedGrade(grade)}
                className={`h-9 rounded-xl font-bold text-[10px] uppercase tracking-wider px-4 transition-all ${selectedGrade === grade ? 'shadow-md scale-105' : 'border-primary/10'}`}
              >
                {grade}
              </Button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="animate-pulse bg-muted/20 border-none h-48 rounded-2xl" />
          ))
        ) : filteredStudents.map(student => (
          <Link key={student.id} href={`/students/${student.id}`}>
            <Card className="group relative overflow-hidden border-none shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-card rounded-2xl">
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight className="size-5 text-primary" />
              </div>
              <CardHeader className="pb-2">
                <div className="flex items-start gap-4">
                  <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                    <User className="size-6" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <CardTitle className="text-base font-black uppercase tracking-tight truncate leading-tight group-hover:text-primary transition-colors">
                      {student.fullName}
                    </CardTitle>
                    <Badge variant="outline" className="w-fit mt-1 text-[8px] font-black uppercase border-primary/20 bg-primary/5">
                      {student.grade}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-muted-foreground bg-muted/30 px-2 py-1 rounded-md w-fit">
                  ID: {student.id}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                  <Phone className="size-3 text-primary/40" />
                  {student.parentPhone}
                </div>
              </CardContent>
              <CardFooter className="p-2 pt-0 flex gap-1 mt-auto">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-9 w-9 rounded-full ml-auto hover:bg-primary/10 hover:text-primary"
                  onClick={(e) => {
                    e.preventDefault();
                    setEditingStudent(student);
                    setIsDialogOpen(true);
                  }}
                >
                  <Edit2 className="size-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-9 w-9 rounded-full text-destructive/40 hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete(student.id);
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </CardFooter>
            </Card>
          </Link>
        ))}
        {!isLoading && filteredStudents.length === 0 && (
          <div className="col-span-full py-20 text-center bg-muted/10 rounded-3xl border-2 border-dashed">
            <User className="size-16 mx-auto mb-4 opacity-10" />
            <p className="font-black text-xs uppercase tracking-widest text-muted-foreground">No students found matching your criteria</p>
          </div>
        )}
      </div>
    </div>
  );
}

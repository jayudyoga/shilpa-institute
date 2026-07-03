"use client"

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Search, 
  UserPlus, 
  BookOpen, 
  ChevronRight, 
  Phone,
  Filter,
  RefreshCw,
  Plus
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter, 
  DialogDescription 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function MyStudentsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [enrollSearch, setEnrollSearch] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [isEnrollOpen, setIsEnrollOpen] = useState(false);
  const [enrollmentTargetClassId, setEnrollmentTargetClassId] = useState('');
  
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => 
    (firestore && user) ? doc(firestore, 'users_directory', user.uid) : null,
    [firestore, user]
  );
  const { data: profile } = useDoc(userProfileRef);

  // 1. Fetch Teacher's Classes
  const myClassesQuery = useMemoFirebase(() => {
    if (!firestore || !user || !profile?.referenceId) return null;
    return query(collection(firestore, 'classes'), where('teacherId', '==', profile.referenceId));
  }, [firestore, profile, user]);
  const { data: myClasses } = useCollection(myClassesQuery);

  // 2. Fetch Students (Local directory filter)
  const studentsQuery = useMemoFirebase(() => 
    (firestore && user) ? collection(firestore, 'students') : null, 
    [firestore, user]
  );
  const { data: allStudents, isLoading: isStudentsLoading } = useCollection(studentsQuery);

  // Derived: Students in MY classes
  const myStudents = useMemo(() => {
    if (!allStudents || !myClasses) return [];
    const classIds = myClasses.map(c => c.id);
    return allStudents.filter(s => 
      s.enrolledClassIds?.some((id: string) => classIds.includes(id))
    );
  }, [allStudents, myClasses]);

  const filteredMyStudents = useMemo(() => {
    return myStudents.filter(s => {
      const matchesSearch = s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           s.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesClass = selectedClassId === 'all' || s.enrolledClassIds?.includes(selectedClassId);
      return matchesSearch && matchesClass;
    });
  }, [myStudents, searchTerm, selectedClassId]);

  const studentsToEnroll = useMemo(() => {
    if (!allStudents || !enrollmentTargetClassId) return [];
    return allStudents.filter(s => 
      !s.enrolledClassIds?.includes(enrollmentTargetClassId) &&
      (s.fullName.toLowerCase().includes(enrollSearch.toLowerCase()) || s.id.toLowerCase().includes(enrollSearch.toLowerCase()))
    ).slice(0, 10);
  }, [allStudents, enrollmentTargetClassId, enrollSearch]);

  const handleEnroll = (student: any) => {
    if (!firestore || !enrollmentTargetClassId) return;

    const newEnrollments = [...(student.enrolledClassIds || []), enrollmentTargetClassId];
    updateDocumentNonBlocking(doc(firestore, 'students', student.id), {
      enrolledClassIds: newEnrollments
    });

    const cls = myClasses?.find(c => c.id === enrollmentTargetClassId);
    toast({ 
      title: "Student Enrolled", 
      description: `${student.fullName} added to ${cls?.className}.` 
    });
  };

  if (isUserLoading) return null;

  if (!user || profile?.role !== 'teacher') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
        <Users className="size-16 text-muted-foreground/20 mb-4" />
        <h2 className="text-2xl font-bold font-headline uppercase text-muted-foreground">Faculty Access Only</h2>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground font-headline uppercase">My Students</h1>
          <p className="text-muted-foreground font-medium text-sm">Managing students enrolled in your class nodes.</p>
        </div>
        
        <Dialog open={isEnrollOpen} onOpenChange={setIsEnrollOpen}>
          <DialogTrigger asChild>
            <Button className="tech-button bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] h-12 px-6 shadow-lg shadow-blue-100 rounded-full group transition-all">
              <UserPlus className="size-4 mr-2" /> Add Student to Class
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-3xl">
            <DialogHeader>
              <DialogTitle className="uppercase tracking-tight font-black">Student Enrollment</DialogTitle>
              <DialogDescription>Assign a student from the directory to one of your class nodes.</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Target Class</Label>
                <Select value={enrollmentTargetClassId} onValueChange={setEnrollmentTargetClassId}>
                  <SelectTrigger className="h-12 border-primary/20 rounded-xl font-bold">
                    <SelectValue placeholder="Select one of your classes" />
                  </SelectTrigger>
                  <SelectContent>
                    {myClasses?.map(c => (
                      <SelectItem key={c.id} value={c.id} className="font-bold uppercase text-[10px]">{c.className}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {enrollmentTargetClassId && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search global directory..." 
                      className="pl-9 h-11 border-primary/10 rounded-xl"
                      value={enrollSearch}
                      onChange={(e) => setEnrollSearch(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                    {studentsToEnroll.map(s => (
                      <div key={s.id} className="flex items-center justify-between p-3 rounded-2xl border bg-muted/20 hover:bg-primary/5 transition-colors group cursor-pointer" onClick={() => handleEnroll(s)}>
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-lg bg-white border flex items-center justify-center text-[10px] font-black">{s.fullName.charAt(0)}</div>
                          <div className="flex flex-col">
                            <span className="font-bold text-xs uppercase">{s.fullName}</span>
                            <span className="text-[8px] text-muted-foreground font-mono">ID: {s.id}</span>
                          </div>
                        </div>
                        <Button size="icon" variant="ghost" className="size-8 rounded-full text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus className="size-4" />
                        </Button>
                      </div>
                    ))}
                    {studentsToEnroll.length === 0 && (
                      <div className="text-center py-10 opacity-40 italic text-xs uppercase font-bold">No results found</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" className="w-full font-bold uppercase tracking-widest text-[10px]" onClick={() => setIsEnrollOpen(false)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input 
            placeholder="Search my roster..." 
            className="pl-9 h-12 shadow-sm rounded-2xl border-primary/10 focus:ring-primary/20" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <Button
            variant={selectedClassId === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedClassId('all')}
            className={`h-10 rounded-xl font-black text-[9px] uppercase tracking-widest px-4 ${selectedClassId === 'all' ? 'shadow-md scale-105' : 'border-primary/10'}`}
          >
            All Classes
          </Button>
          {myClasses?.map(c => (
            <Button
              key={c.id}
              variant={selectedClassId === c.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedClassId(c.id)}
              className={`h-10 rounded-xl font-black text-[9px] uppercase tracking-widest px-4 whitespace-nowrap ${selectedClassId === c.id ? 'shadow-md scale-105' : 'border-primary/10'}`}
            >
              {c.className}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {isStudentsLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="animate-pulse bg-muted/20 border-none h-48 rounded-3xl" />
          ))
        ) : filteredMyStudents.map(student => (
          <Link key={student.id} href={`/students/${student.id}`}>
            <Card className="group relative overflow-hidden border-none shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-card rounded-[2rem]">
              <div className="absolute top-0 right-0 p-5 opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight className="size-5 text-primary" />
              </div>
              <CardHeader className="pb-2">
                <div className="flex items-start gap-4">
                  <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300 shadow-inner">
                    <Users className="size-7" />
                  </div>
                  <div className="flex flex-col min-w-0 pt-1">
                    <CardTitle className="text-base font-black uppercase tracking-tight truncate leading-tight group-hover:text-primary transition-colors">
                      {student.fullName}
                    </CardTitle>
                    <Badge variant="outline" className="w-fit mt-1 text-[8px] font-black uppercase border-primary/20 bg-primary/5 tracking-widest">
                      {student.grade}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                  <div className="size-8 rounded-full bg-slate-50 flex items-center justify-center border shrink-0">
                    <Phone className="size-3.5 text-primary/40" />
                  </div>
                  <span className="font-bold tracking-tight">{student.parentPhone}</span>
                </div>
                
                <div className="pt-2 border-t border-dashed">
                  <p className="text-[8px] font-black uppercase text-muted-foreground mb-2 tracking-widest">Enrolled In</p>
                  <div className="flex flex-wrap gap-1.5">
                    {student.enrolledClassIds?.map((cid: string) => {
                      const cls = myClasses?.find(c => c.id === cid);
                      if (!cls) return null;
                      return (
                        <Badge key={cid} variant="secondary" className="text-[7px] font-black uppercase bg-muted/50 border-none tracking-tight">
                          {cls.className}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {!isStudentsLoading && filteredMyStudents.length === 0 && (
          <div className="col-span-full py-32 text-center bg-muted/10 rounded-[3rem] border-2 border-dashed border-primary/5">
            <Users className="size-20 mx-auto mb-6 text-primary/5" />
            <div className="space-y-1">
              <p className="font-black text-sm uppercase tracking-[0.2em] text-muted-foreground">No students found</p>
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase">Add students to your classes to see them here.</p>
            </div>
            <Button variant="outline" className="mt-8 rounded-full h-12 px-8 font-black uppercase tracking-widest text-[10px]" onClick={() => setIsEnrollOpen(true)}>
              Enroll First Student
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

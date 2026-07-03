"use client"

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Search, UserCheck, Phone, Book, Edit2, Trash2, LogIn, Mail, RefreshCw, BookOpen } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function TeacherManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<any>(null);
  
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const teachersQuery = useMemoFirebase(() => 
    (firestore && user) ? collection(firestore, 'teachers') : null, 
    [firestore, user]
  );
  const { data: teachers, isLoading } = useCollection(teachersQuery);

  const classesQuery = useMemoFirebase(() => 
    (firestore && user) ? collection(firestore, 'classes') : null, 
    [firestore, user]
  );
  const { data: classes } = useCollection(classesQuery);

  const filteredTeachers = useMemo(() => {
    if (!teachers) return [];
    return teachers.filter(t => 
      t.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [teachers, searchTerm]);

  const handleSaveTeacher = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore) return;

    setIsProcessing(true);
    const formData = new FormData(e.currentTarget);
    
    const fullName = (formData.get('fullName') as string).trim();
    const email = (formData.get('email') as string).trim().toLowerCase();
    const subject = (formData.get('subject') as string).trim();
    const phone = (formData.get('phone') as string).trim();
    const isActive = formData.get('isActive') === 'on';

    const teacherId = editingTeacher?.id || Math.random().toString(36).substring(2, 11);
    
    try {
      const teacherData = { 
        id: teacherId, 
        fullName, 
        email,
        subject, 
        phone, 
        isActive,
        userId: editingTeacher?.userId || null,
        photoURL: editingTeacher?.photoURL || null
      };

      setDocumentNonBlocking(doc(firestore, 'teachers', teacherId), teacherData, { merge: true });
      
      setIsDialogOpen(false);
      setEditingTeacher(null);
      
      if (!editingTeacher) {
        toast({ 
          title: "Teacher Added", 
          description: "Processing secure login... Check Auth tab in 5 seconds." 
        });
      } else {
        toast({ title: "Profile Updated" });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Operation Failed", description: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = (id: string) => {
    if (!firestore) return;
    deleteDocumentNonBlocking(doc(firestore, 'teachers', id));
    toast({ title: "Teacher Removed" });
  };

  if (isUserLoading) return null;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4 space-y-4">
        <UserCheck className="size-16 text-primary/20" />
        <h2 className="text-2xl font-bold font-headline uppercase">Authentication Required</h2>
        <p className="text-muted-foreground max-w-md">Please sign in to manage teachers and assignments.</p>
        <Button asChild><Link href="/auth"><LogIn className="size-4 mr-2" /> Sign In</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black font-headline uppercase tracking-tight text-foreground">Teacher Directory</h1>
          <p className="text-muted-foreground mt-1">Manage instructor profiles and automatic login provisioning.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!isProcessing) { setIsDialogOpen(open); if (!open) setEditingTeacher(null); } }}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto gap-2 shadow-lg h-11 bg-primary font-bold">
              <Plus className="size-4" /> Add Teacher
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[90vw] sm:max-w-lg">
            <form onSubmit={handleSaveTeacher} key={editingTeacher?.id || 'new'}>
              <DialogHeader>
                <DialogTitle className="uppercase tracking-tight">{editingTeacher ? "Edit Teacher" : "Add New Teacher"}</DialogTitle>
                <DialogDescription>
                  {editingTeacher ? "Update faculty member records." : "Enrolling a new teacher will automatically generate their system login via cloud automation."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Full Name</Label>
                  <Input name="fullName" defaultValue={editingTeacher?.fullName} placeholder="e.g. Dr. Jane Doe" required disabled={isProcessing} />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Work Email (Login Identity)</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input name="email" type="email" defaultValue={editingTeacher?.email} className="pl-9" placeholder="jane@shilpa.edu" required disabled={isProcessing || !!editingTeacher} />
                  </div>
                  {!editingTeacher && <p className="text-[9px] text-muted-foreground italic">System will auto-provision account with 'test@1234' as initial password.</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Subject</Label>
                    <Input name="subject" defaultValue={editingTeacher?.subject} placeholder="e.g. Mathematics" required disabled={isProcessing} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Phone Number</Label>
                    <Input name="phone" defaultValue={editingTeacher?.phone} placeholder="+94..." required disabled={isProcessing} />
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/20">
                  <Label className="text-xs font-bold uppercase cursor-pointer">Active Status</Label>
                  <Switch name="isActive" defaultChecked={editingTeacher ? editingTeacher.isActive : true} disabled={isProcessing} />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isProcessing}>Cancel</Button>
                <Button type="submit" className="font-bold min-w-[120px]" disabled={isProcessing}>
                  {isProcessing ? <RefreshCw className="size-4 animate-spin mr-2" /> : null}
                  {editingTeacher ? "Save Changes" : "Enroll & Provision"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input 
          placeholder="Search by name, subject, or email..." 
          className="pl-9 h-11 shadow-sm rounded-xl border-primary/10" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTeachers.map((teacher) => {
          const initials = teacher.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
          const assignedClasses = classes?.filter(c => c.teacherId === teacher.id) || [];
          
          return (
            <Card key={teacher.id} className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden flex flex-col bg-card rounded-[2rem]">
              <CardHeader className="pb-4 bg-muted/5">
                <div className="flex items-start justify-between">
                  <Avatar className="size-16 rounded-[1.5rem] border-2 border-background shadow-md overflow-hidden">
                    <AvatarImage src={teacher.photoURL} className="object-cover" />
                    <AvatarFallback className="bg-primary/10 text-primary font-black text-xl">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <Badge variant={teacher.isActive ? "default" : "secondary"} className="text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                    {teacher.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="mt-6 space-y-1">
                  <CardTitle className="text-xl truncate uppercase tracking-tight font-black">{teacher.fullName}</CardTitle>
                  <div className="flex flex-col gap-1">
                    <span className="flex items-center gap-1.5 truncate font-bold text-[10px] uppercase text-primary tracking-widest">
                      <Book className="size-3 shrink-0" /> {teacher.subject}
                    </span>
                    <span className="flex items-center gap-1.5 truncate font-bold text-[10px] uppercase text-muted-foreground tracking-tighter">
                      <Mail className="size-3 shrink-0" /> {teacher.email}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 flex-1 pt-6">
                <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                  <div className="size-8 rounded-full bg-slate-50 flex items-center justify-center border shrink-0">
                    <Phone className="size-3.5 text-primary/40" />
                  </div>
                  <span className="font-bold tracking-tight">{teacher.phone}</span>
                </div>

                <div className="pt-4 border-t border-dashed">
                  <p className="text-[8px] font-black uppercase text-muted-foreground mb-3 tracking-[0.2em] flex items-center gap-2">
                    <BookOpen className="size-3" /> Assigned Classes
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {assignedClasses.length > 0 ? assignedClasses.map(c => (
                      <Badge key={c.id} variant="secondary" className="text-[8px] font-black uppercase bg-primary/5 text-primary border-primary/10 tracking-tight py-1">
                        {c.className}
                      </Badge>
                    )) : (
                      <span className="text-[9px] text-muted-foreground italic font-medium">No classes assigned.</span>
                    )}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="p-2 bg-muted/20 flex justify-end gap-1 border-t">
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => { setEditingTeacher(teacher); setIsDialogOpen(true); }}>
                  <Edit2 className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-destructive/40 hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => handleDelete(teacher.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </CardFooter>
            </Card>
          );
        })}
        {!isLoading && filteredTeachers.length === 0 && (
          <div className="col-span-full py-32 text-center bg-muted/10 rounded-[3rem] border-2 border-dashed border-primary/5">
            <UserCheck className="size-16 mx-auto mb-4 opacity-10" />
            <p className="font-bold uppercase text-xs tracking-widest text-muted-foreground">No matching instructor records found.</p>
          </div>
        )}
      </div>
    </div>
  );
}

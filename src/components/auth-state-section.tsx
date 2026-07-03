
"use client"

import { useUser, useFirestore, useAuth, useCollection, useMemoFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { LogIn, ShieldCheck, LogOut, User, Crown, UserCheck, ShieldAlert } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import Link from 'next/link';
import { useEffect } from 'react';
import { doc, collection } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useSidebar } from '@/components/ui/sidebar';
import { useDoc } from '@/firebase/firestore/use-doc';

const PRIMARY_ADMIN_EMAIL = 'jayyudyoga@gmail.com';

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Super Administrator',
  admin: 'Administrator',
  teacher: 'Faculty / Teacher',
  payment_handler: 'Payment Handler',
};

export function AuthStateSection() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();

  const userProfileRef = useMemoFirebase(() => 
    (firestore && user) ? doc(firestore, 'users_directory', user.uid) : null,
    [firestore, user]
  );
  const { data: userProfile } = useDoc(userProfileRef);

  const superAdminsQuery = useMemoFirebase(() => 
    (firestore && user) ? collection(firestore, 'roles_super_admin') : null, 
    [firestore, user]
  );
  const { data: superAdmins } = useCollection(superAdminsQuery);

  useEffect(() => {
    if (user && firestore) {
      const userRef = doc(firestore, 'users_directory', user.uid);
      
      const updateData: any = {
        uid: user.uid,
        email: user.email || 'anonymous',
        lastLogin: new Date().toISOString()
      };

      if (user.displayName) {
        updateData.displayName = user.displayName;
      }
      
      if (user.photoURL) {
        updateData.photoURL = user.photoURL;
      }

      // Elevate root user to superadmin role explicitly
      if (user.email === PRIMARY_ADMIN_EMAIL) {
        updateData.role = 'superadmin';
        setDocumentNonBlocking(doc(firestore, 'roles_super_admin', user.uid), { uid: user.uid }, { merge: true });
        setDocumentNonBlocking(doc(firestore, 'roles_admin', user.uid), { uid: user.uid }, { merge: true });
      }

      setDocumentNonBlocking(userRef, updateData, { merge: true });
    }
  }, [user, firestore]);

  if (isUserLoading) return null;

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  if (!user) {
    return (
      <div className="px-3 py-4 space-y-2">
        <Button variant="outline" className="w-full gap-2 border-dashed h-11 font-bold uppercase text-[10px] tracking-widest" asChild>
          <Link href="/auth" onClick={handleLinkClick}><LogIn className="size-4" /> Sign In</Link>
        </Button>
      </div>
    );
  }

  const isSuperAdmin = superAdmins?.some(a => a.id === user.uid) || user.email === PRIMARY_ADMIN_EMAIL;
  const displayName = userProfile?.displayName || user.displayName || user.email?.split('@')[0] || 'Staff User';
  const roleLabel = userProfile?.role ? ROLE_LABELS[userProfile.role] : (isSuperAdmin ? 'Super Administrator' : 'Staff Member');
  const userInitials = displayName.charAt(0).toUpperCase();

  return (
    <div className="px-3 py-4 space-y-3">
      <Link 
        href="/settings" 
        onClick={handleLinkClick}
        className="flex items-center gap-3 px-3 mb-2 group hover:bg-slate-100 p-3 rounded-2xl transition-colors cursor-pointer border border-transparent hover:border-slate-200"
      >
        <Avatar className={`size-10 rounded-xl border shadow-sm shrink-0 transition-transform group-hover:scale-105 ${isSuperAdmin ? 'bg-primary text-primary-foreground border-primary/20' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
          <AvatarImage src={userProfile?.photoURL || user.photoURL || ''} className="object-cover" />
          <AvatarFallback className="bg-transparent font-black text-xs">
            {userInitials}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col min-w-0">
          <p className="text-sm font-bold truncate leading-tight text-foreground group-hover:text-primary transition-colors">
            {displayName}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 font-bold uppercase tracking-widest">
            {roleLabel}
          </p>
        </div>
      </Link>

      <div className={`flex items-center gap-2 p-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest border shadow-sm ${isSuperAdmin ? 'bg-primary text-primary-foreground border-primary shadow-blue-100' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
        {isSuperAdmin ? <ShieldCheck className="size-3.5" /> : <ShieldAlert className="size-3.5" />} 
        {isSuperAdmin ? 'Full Access' : 'Operations'}
      </div>
      
      <Button 
        variant="ghost" 
        size="sm" 
        className="w-full gap-2 text-slate-500 hover:bg-red-50 hover:text-red-600 font-bold text-[10px] uppercase tracking-widest h-9" 
        onClick={() => auth?.signOut()}
      >
        <LogOut className="size-3.5" /> Sign Out
      </Button>
    </div>
  );
}

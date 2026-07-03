
"use client"

import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton, useSidebar } from '@/components/ui/sidebar';
import { LayoutDashboard, Users, BookOpen, UserCheck, CreditCard, History, CalendarCheck, Shield, QrCode, DollarSign, Settings, Zap } from 'lucide-react';
import { collection, doc } from 'firebase/firestore';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const PRIMARY_ADMIN_EMAIL = 'jayyudyoga@gmail.com';

const navItems = [
  { id: 'dashboard', title: 'Dashboard', href: '/', icon: LayoutDashboard },
  { id: 'scan', title: 'Universal Scan', href: '/scan', icon: Zap, highlight: true },
  { id: 'teachers', title: 'Teachers', href: '/teachers', icon: UserCheck, adminOnly: true },
  { id: 'students', title: 'Students', href: '/students', icon: Users, adminOnly: true },
  { id: 'my-students', title: 'My Students', href: '/students/my-students', icon: Users, teacherOnly: true },
  { id: 'classes', title: 'Classes', href: '/classes', icon: BookOpen }, // Shared, filtered internally
  { id: 'attendance', title: 'Attendance', href: '/attendance', icon: CalendarCheck },
  { id: 'payment', title: 'New Payment', href: '/payments', icon: CreditCard, staffOnly: true },
  { id: 'history', title: 'History Log', href: '/history', icon: History },
  { id: 'teacher-payroll', title: 'Staff Payroll', href: '/teacher-payments', icon: DollarSign, superOnly: true },
  { id: 'my-earnings', title: 'My Earnings', href: '/teacher-finance', icon: DollarSign, teacherOnly: true },
  { id: 'access', title: 'Access Control', href: '/access-control', icon: Shield, superOnly: true },
  { id: 'settings', title: 'System Settings', href: '/settings', icon: Settings },
];

export function MainNav() {
  const { user } = useUser();
  const firestore = useFirestore();
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  const userRef = useMemoFirebase(() => 
    (firestore && user) ? doc(firestore, 'users_directory', user.uid) : null,
    [firestore, user]
  );
  const { data: userProfile } = useDoc(userRef);

  const adminsQuery = useMemoFirebase(() => 
    (firestore && user) ? collection(firestore, 'roles_admin') : null, 
    [firestore, user]
  );
  const superAdminsQuery = useMemoFirebase(() => 
    (firestore && user) ? collection(firestore, 'roles_super_admin') : null, 
    [firestore, user]
  );

  const { data: admins } = useCollection(adminsQuery);
  const { data: superAdmins } = useCollection(superAdminsQuery);

  const isSuperAdmin = user?.email === PRIMARY_ADMIN_EMAIL || (superAdmins && superAdmins.some(a => a.id === user?.uid));
  const isAdmin = isSuperAdmin || (admins && admins.some(a => a.id === user?.uid));
  const isTeacher = userProfile?.role === 'teacher';
  const isPaymentHandler = userProfile?.role === 'payment_handler';
  const isStaff = isAdmin || isPaymentHandler;

  const allowedModules = userProfile?.dashboardPreferences || navItems.map(i => i.id);

  const filteredItems = navItems.filter(item => {
    if (item.id === 'dashboard') return true;
    
    // Check specific role restrictions
    if (item.superOnly && !isSuperAdmin) return false;
    if (item.adminOnly && !isAdmin) return false;
    if (item.teacherOnly && !isTeacher) return false;
    if (item.staffOnly && !isStaff) return false;

    // Finally check administrative module visibility preferences
    if (!allowedModules.includes(item.id)) {
        // Special case: Ensure teachers can see classes even if not explicitly in prefs yet
        if (item.id === 'classes' && isTeacher) return true;
        return false;
    }

    return true;
  });

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <SidebarMenu className="px-3 gap-1.5">
      {filteredItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton 
              asChild 
              tooltip={item.title} 
              isActive={isActive}
              className={`rounded-xl py-6 transition-all font-bold ${item.highlight ? 'bg-primary text-primary-foreground shadow-sm shadow-blue-100 hover:bg-primary/90' : 'hover:bg-slate-100'}`}
            >
              <Link href={item.href} className="flex items-center gap-3" onClick={handleLinkClick}>
                <item.icon className={`size-5 ${item.highlight ? 'text-primary-foreground' : (isActive ? 'text-primary' : 'text-slate-500')}`} />
                <span className={`uppercase text-[10px] tracking-widest ${item.highlight ? 'text-primary-foreground' : (isActive ? 'text-foreground font-black' : 'text-slate-600')}`}>
                  {item.title}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

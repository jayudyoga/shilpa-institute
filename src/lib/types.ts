
export type UserRole = 'superadmin' | 'admin' | 'teacher' | 'payment_handler';

export interface Teacher {
  id: string;
  fullName: string;
  email: string;
  subject: string;
  phone: string;
  isActive: boolean;
  userId?: string;
  photoURL?: string;
}

export interface Student {
  id: string;
  fullName: string;
  grade: string;
  parentPhone: string;
  enrolledClassIds: string[];
}

export interface TuitionClass {
  id: string;
  className: string;
  teacherId: string;
  feeAmount: number;
  feeType: 'monthly' | 'daily';
  schedule: string;
  teacherCommissionPercentage?: number;
}

export interface Payment {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  teacherId: string;
  amountPaid: number;
  paymentDate: any;
  paymentMonth: string;
  recordedBy: string;
  deleteRequested?: boolean;
  deleteRequestedBy?: string;
}

export interface TeacherPayment {
  id: string;
  teacherId: string;
  teacherName?: string;
  amountPaid: number;
  totalCollected?: number;
  commissionPercentage?: number;
  date: any;
  month: string;
  recordedBy: string;
}

export interface Attendance {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  date: string; // YYYY-MM-DD
  status: 'present' | 'absent' | 'late';
  recordedBy: string;
}

export interface AppUser {
  uid: string;
  email: string;
  role: UserRole;
  referenceId?: string;
  displayName?: string;
  photoURL?: string;
  lastLogin?: string;
  isActive?: boolean;
  dashboardPreferences?: string[];
  pushToken?: string;
}

export interface ReceiptConfig {
  instituteName: string;
  address1?: string;
  address2?: string;
  phone?: string;
  footerMessage?: string;
}

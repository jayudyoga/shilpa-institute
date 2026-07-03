'use client';

import { Firestore, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { format } from 'date-fns';

/**
 * @fileOverview Universal QR Routing Service
 * Handles contextual role-based logic for scanned student IDs.
 */

export type QRAction = 'attendance' | 'payment' | 'profile' | 'enroll' | 'none';

export interface ScanResult {
  studentId: string;
  studentName: string;
  recommendedAction: QRAction;
  canAutoExecute: boolean;
}

export async function processScannedId(
  db: Firestore,
  studentId: string,
  userRole: string,
  userEmail: string,
  activeClassId?: string,
  classes?: any[]
): Promise<ScanResult> {
  // 1. Identify Student
  const studentRef = doc(db, 'students', studentId);
  const studentSnap = await getDoc(studentRef);

  if (!studentSnap.exists()) {
    throw new Error(`Student ID ${studentId} not found in directory.`);
  }

  const studentData = studentSnap.data();
  const studentName = studentData.fullName;
  const enrolledClasses = studentData.enrolledClassIds || [];

  // 2. Execute Smart Routing Logic
  if (userRole === 'teacher') {
    // Teachers: Auto-Attendance Mode if already enrolled
    if (activeClassId) {
      if (enrolledClasses.includes(activeClassId)) {
        const today = format(new Date(), 'yyyy-MM-dd');
        const tuitionClass = classes?.find(c => c.id === activeClassId);
        const recordId = `${activeClassId}_${studentId}_${today}`;

        setDocumentNonBlocking(doc(db, 'attendance', recordId), {
          id: recordId,
          studentId,
          studentName,
          classId: activeClassId,
          className: tuitionClass?.className || 'Unknown',
          date: today,
          status: 'present',
          recordedBy: userEmail
        }, { merge: true });

        return {
          studentId,
          studentName,
          recommendedAction: 'attendance',
          canAutoExecute: true
        };
      } else {
        // Recommend enrollment if class active but student not in it
        return {
          studentId,
          studentName,
          recommendedAction: 'enroll',
          canAutoExecute: false
        };
      }
    }
    return { studentId, studentName, recommendedAction: 'profile', canAutoExecute: false };
  }

  if (userRole === 'payment_handler') {
    // Payment Handlers: Auto-Redirect to Payment
    return {
      studentId,
      studentName,
      recommendedAction: 'payment',
      canAutoExecute: true
    };
  }

  // Admins/Superadmins: Interactive Choice
  return {
    studentId,
    studentName,
    recommendedAction: 'profile',
    canAutoExecute: false
  };
}


'use client';

import { collection, query, where, getDocs, Firestore } from 'firebase/firestore';
import { TuitionClass, Payment } from './types';

/**
 * @fileOverview Payroll Calculation Engine for Tuition Management System.
 * 
 * Provides utility functions to calculate teacher earnings based on 
 * student fees collected and class-specific commission rates.
 */

export interface PayrollSummary {
  teacherId: string;
  month: string;
  totalCollected: number;
  calculatedPayout: number;
  classBreakdown: {
    classId: string;
    className: string;
    collected: number;
    commissionRate: number;
    earned: number;
  }[];
}

/**
 * Calculates the total revenue and teacher commission for a specific month.
 * 
 * @param db The Firestore instance.
 * @param teacherId The ID of the teacher to calculate for.
 * @param month The month string (e.g., "March 2026").
 * @returns A breakdown of earnings per class and overall totals.
 */
export async function calculateTeacherPayroll(
  db: Firestore,
  teacherId: string,
  month: string
): Promise<PayrollSummary> {
  // 1. Get all classes associated with this teacher to find their commission rates
  const classesRef = collection(db, 'classes');
  const classesQuery = query(classesRef, where('teacherId', '==', teacherId));
  const classesSnap = await getDocs(classesQuery);
  
  const teacherClassesMap = new Map<string, TuitionClass>();
  classesSnap.forEach(doc => {
    teacherClassesMap.set(doc.id, { id: doc.id, ...doc.data() } as TuitionClass);
  });

  // 2. Get all payments made to this teacher's classes for the target month
  // We use the denormalized teacherId on the payment document for efficiency
  const paymentsRef = collection(db, 'payments');
  const paymentsQuery = query(
    paymentsRef, 
    where('teacherId', '==', teacherId),
    where('paymentMonth', '==', month)
  );
  
  const paymentsSnap = await getDocs(paymentsQuery);
  const payments = paymentsSnap.docs.map(doc => doc.data() as Payment);

  // 3. Group and calculate totals
  const classBreakdownMap = new Map<string, { collected: number; earned: number }>();
  let overallCollected = 0;
  let overallEarned = 0;

  payments.forEach(p => {
    const tClass = teacherClassesMap.get(p.classId);
    // Use the class commission percentage, or fallback to a default if not set
    const rate = tClass?.teacherCommissionPercentage ?? 70; 
    const earnedAmount = (p.amountPaid * rate) / 100;

    const current = classBreakdownMap.get(p.classId) || { collected: 0, earned: 0 };
    classBreakdownMap.set(p.classId, {
      collected: current.collected + p.amountPaid,
      earned: current.earned + earnedAmount
    });

    overallCollected += p.amountPaid;
    overallEarned += earnedAmount;
  });

  // 4. Transform breakdown map into array for UI consumption
  const breakdown = Array.from(classBreakdownMap.entries()).map(([classId, data]) => {
    const tClass = teacherClassesMap.get(classId);
    return {
      classId,
      className: tClass?.className || 'Deleted Class',
      collected: data.collected,
      commissionRate: tClass?.teacherCommissionPercentage ?? 70,
      earned: data.earned
    };
  });

  return {
    teacherId,
    month,
    totalCollected: overallCollected,
    calculatedPayout: overallEarned,
    classBreakdown: breakdown
  };
}

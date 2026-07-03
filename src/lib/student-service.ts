'use client';

import { collection, query, where, getDocs, Firestore } from 'firebase/firestore';
import { Student } from './types';

/**
 * @fileOverview Student Management Service for Teachers.
 * 
 * Provides logic to fetch students specifically associated with a teacher's classes,
 * handling Firestore query limits and deduplication.
 */

/**
 * Fetches all students enrolled in any class taught by a specific teacher.
 * 
 * @param db The Firestore instance.
 * @param teacherId The ID of the teacher (referenceId).
 * @returns A list of unique students taught by the teacher.
 */
export async function fetchMyStudents(db: Firestore, teacherId: string): Promise<Student[]> {
  // 1. Get IDs of all classes assigned to this teacher
  const classesRef = collection(db, 'classes');
  const qClasses = query(classesRef, where('teacherId', '==', teacherId));
  const classesSnap = await getDocs(qClasses);
  
  const classIds = classesSnap.docs.map(doc => doc.id);

  if (classIds.length === 0) {
    return [];
  }

  // 2. Fetch students who are enrolled in any of these classes.
  // Note: Firestore 'array-contains-any' has a limit of 10 items.
  // We chunk the classIds and perform parallel queries to handle teachers with 10+ classes.
  const studentsRef = collection(db, 'students');
  const allStudentsMap = new Map<string, Student>();

  const CHUNK_SIZE = 10;
  const chunks = [];
  for (let i = 0; i < classIds.length; i += CHUNK_SIZE) {
    chunks.push(classIds.slice(i, i + CHUNK_SIZE));
  }

  const queryPromises = chunks.map(chunk => {
    const qStudents = query(studentsRef, where('enrolledClassIds', 'array-contains-any', chunk));
    return getDocs(qStudents);
  });

  const querySnapshots = await Promise.all(queryPromises);

  // 3. Merge results into a Map to ensure unique student records
  querySnapshots.forEach(snap => {
    snap.forEach(doc => {
      if (!allStudentsMap.has(doc.id)) {
        allStudentsMap.set(doc.id, { id: doc.id, ...doc.data() } as Student);
      }
    });
  });

  return Array.from(allStudentsMap.values());
}

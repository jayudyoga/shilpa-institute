'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, Firestore } from 'firebase/firestore'
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFunctions, Functions } from 'firebase/functions';

// Cache for SDK instances to ensure singleton behavior across the app lifecycle
let firestoreInstance: Firestore | null = null;
let authInstance: Auth | null = null;
let storageInstance: FirebaseStorage | null = null;
let functionsInstance: Functions | null = null;

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  let app: FirebaseApp;
  
  if (!getApps().length) {
    try {
      app = initializeApp();
    } catch (e) {
      if (process.env.NODE_ENV === "production") {
        console.warn('Automatic initialization failed. Falling back to firebase config object.', e);
      }
      app = initializeApp(firebaseConfig);
    }
  } else {
    app = getApp();
  }

  return getSdks(app);
}

/**
 * Retrieves or initializes singleton instances of Firebase services.
 * This prevents "INTERNAL ASSERTION FAILED" errors by ensuring consistent instance usage.
 */
export function getSdks(firebaseApp: FirebaseApp) {
  if (!firestoreInstance) {
    try {
      firestoreInstance = initializeFirestore(firebaseApp, {
        experimentalForceLongPolling: true,
      });
    } catch (e) {
      firestoreInstance = getFirestore(firebaseApp);
    }
  }

  if (!authInstance) {
    authInstance = getAuth(firebaseApp);
  }

  if (!storageInstance) {
    storageInstance = getStorage(firebaseApp);
  }

  if (!functionsInstance) {
    functionsInstance = getFunctions(firebaseApp);
  }

  return {
    firebaseApp,
    auth: authInstance,
    firestore: firestoreInstance,
    storage: storageInstance,
    functions: functionsInstance
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
export * from './user-management';

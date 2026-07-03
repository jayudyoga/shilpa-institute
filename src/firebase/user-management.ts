'use client';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { firebaseConfig } from './config';

/**
 * Creates a new Firebase Auth user using a secondary app instance.
 * This prevents the current user (the Admin) from being signed out of the main app.
 * 
 * @param email The new user's email address.
 * @param password The new user's password.
 * @param displayName The new user's display name.
 * @returns The UID of the newly created user.
 */
export async function createStaffUserWithoutLogout(email: string, password: string, displayName: string): Promise<string> {
  // Use a unique name for the secondary app instance
  const secondaryAppName = `admin-provisioning-${Math.random().toString(36).substring(7)}`;
  
  // Initialize a secondary Firebase App
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    // Create the user on the secondary Auth instance
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    
    // Update the profile on the secondary instance
    if (displayName && userCredential.user) {
      await updateProfile(userCredential.user, { displayName });
    }
    
    const uid = userCredential.user.uid;

    // Sign out of the secondary instance immediately
    await signOut(secondaryAuth);
    
    // Delete the secondary app instance to release resources
    await deleteApp(secondaryApp);
    
    return uid;
  } catch (error) {
    // Cleanup if something goes wrong
    try {
      await deleteApp(secondaryApp);
    } catch (e) {
      // Ignore cleanup errors
    }
    throw error;
  }
}

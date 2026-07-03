
'use client';
import {
  Auth,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile,
  UserCredential,
} from 'firebase/auth';

/** Initiate anonymous sign-in (returns promise for error handling). */
export function initiateAnonymousSignIn(authInstance: Auth): Promise<UserCredential> {
  return signInAnonymously(authInstance);
}

/** 
 * Initiate email/password sign-up.
 * Includes profile update for displayName.
 */
export async function initiateEmailSignUp(authInstance: Auth, email: string, password: string, displayName?: string): Promise<UserCredential> {
  const credential = await createUserWithEmailAndPassword(authInstance, email, password);
  if (displayName && credential.user) {
    await updateProfile(credential.user, { displayName });
  }
  return credential;
}

/** Initiate email/password sign-in (returns promise for error handling). */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(authInstance, email, password);
}

/** Initiate Google sign-in (returns promise for error handling). */
export function initiateGoogleSignIn(authInstance: Auth): Promise<UserCredential> {
  const provider = new GoogleAuthProvider();
  // Ensure the provider prompts for account selection
  provider.setCustomParameters({
    prompt: 'select_account'
  });
  return signInWithPopup(authInstance, provider);
}

/** Send a password reset email. */
export function initiatePasswordReset(authInstance: Auth, email: string): Promise<void> {
  return sendPasswordResetEmail(authInstance, email);
}

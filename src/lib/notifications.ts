
'use client';

/**
 * @fileOverview Client-side notification routing logic for React/Next.js.
 * 
 * Provides an equivalent to Flutter's onMessageOpenedApp for the web platform.
 */

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Hook to handle incoming notification interaction/routing.
 */
export function useNotificationRouter() {
  const router = useRouter();

  useEffect(() => {
    // In a real PWA/Web-Push environment, this would be handled via the Service Worker
    // or the 'notificationclick' event listener.
    const handleNotificationClick = (event: any) => {
      const payload = event.data || {};
      const targetRoute = payload.route || '/';
      
      console.log(`Notification clicked. Routing to: ${targetRoute}`);
      router.push(targetRoute);
    };

    // Check if the app was launched from a notification payload (simulated)
    if (typeof window !== 'undefined' && (window as any).notificationLaunchData) {
      handleNotificationClick((window as any).notificationLaunchData);
      (window as any).notificationLaunchData = null;
    }
  }, [router]);
}

/**
 * Utility to save the current device FCM token to the user profile.
 */
export async function registerPushToken(firestore: any, uid: string, token: string) {
  const { doc, updateDoc } = await import('firebase/firestore');
  const userRef = doc(firestore, 'users_directory', uid);
  
  try {
    await updateDoc(userRef, { pushToken: token });
    console.log('Device push token registered successfully.');
  } catch (err) {
    console.error('Failed to register device token:', err);
  }
}


import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Automatically creates a Firebase Auth account when a new teacher is added.
 */
export const onTeacherAdded = functions.firestore
  .document('teachers/{teacherId}')
  .onCreate(async (snapshot, context) => {
    const teacherId = context.params.teacherId;
    const data = snapshot.data();
    if (!data) return;

    const email = (data.email || '').trim().toLowerCase();
    const fullName = data.fullName || 'New Teacher';
    const defaultPassword = 'test@1234';

    if (!email) return;

    try {
      console.log(`[onTeacherAdded] Provisioning teacher: ${email}`);
      
      let userRecord;
      try {
        userRecord = await admin.auth().getUserByEmail(email);
        console.log(`[onTeacherAdded] User already exists in Auth: ${userRecord.uid}`);
      } catch (e) {
        userRecord = await admin.auth().createUser({
          email: email,
          password: defaultPassword,
          displayName: fullName,
        });
        console.log(`[onTeacherAdded] New Auth account created: ${userRecord.uid}`);
      }

      const uid = userRecord.uid;

      // Sync to users_directory with the security flag
      await admin.firestore().collection('users_directory').doc(uid).set({
        uid: uid,
        email: email,
        displayName: fullName,
        role: 'teacher',
        referenceId: teacherId,
        isActive: true,
        requirePasswordChange: true, // MANDATORY security flag
        initialPassword: defaultPassword,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        dashboardPreferences: ['dashboard', 'classes', 'my-students', 'attendance', 'my-earnings', 'settings']
      }, { merge: true });

      // Update the teacher document with the linked UID
      await admin.firestore().collection('teachers').doc(teacherId).update({
        userId: uid,
        email: email
      });
      
      console.log(`[onTeacherAdded] Directory sync complete for ${uid}`);
    } catch (error: any) {
      console.error(`[onTeacherAdded] Error provisioning teacher:`, error);
    }
  });

/**
 * Nuclear purge of a user account.
 * Deletes from Auth, users_directory, roles, and linked profiles (teacher/student).
 */
export const deleteUserAccount = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const callerUid = context.auth.uid;
  const callerDoc = await admin.firestore().collection('users_directory').doc(callerUid).get();
  const callerData = callerDoc.data();
  const isSuper = callerData?.role === 'superadmin' || callerData?.email === 'jayyudyoga@gmail.com';

  if (!isSuper) {
    throw new functions.https.HttpsError('permission-denied', 'Only Superadmins can purge system accounts.');
  }

  const targetUid = data.targetUid;
  if (!targetUid) {
    throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a targetUid.');
  }

  if (targetUid === callerUid) {
    throw new functions.https.HttpsError('permission-denied', 'You cannot purge your own root account.');
  }

  try {
    const targetDoc = await admin.firestore().collection('users_directory').doc(targetUid).get();
    const targetData = targetDoc.data();

    // 1. Delete from Firebase Authentication
    await admin.auth().deleteUser(targetUid);

    // 2. Batch delete from Firestore
    const batch = admin.firestore().batch();
    
    batch.delete(admin.firestore().collection('users_directory').doc(targetUid));
    batch.delete(admin.firestore().collection('roles_admin').doc(targetUid));
    batch.delete(admin.firestore().collection('roles_super_admin').doc(targetUid));

    if (targetData?.referenceId) {
      if (targetData.role === 'teacher') {
        batch.delete(admin.firestore().collection('teachers').doc(targetData.referenceId));
      } else if (targetData.role === 'student') {
        batch.delete(admin.firestore().collection('students').doc(targetData.referenceId));
      }
    }

    await batch.commit();
    return { success: true, message: `Account for ${targetUid} has been permanently purged.` };
  } catch (error: any) {
    console.error('Account Purge Error:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Failed to complete account purge.');
  }
});

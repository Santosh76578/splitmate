import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

export const generateInvite = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { groupId } = data;
  if (!groupId) {
    throw new functions.https.HttpsError('invalid-argument', 'Group ID is required');
  }

  try {
    // Generate a short unique code
    const inviteId = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Create invite document
    const inviteRef = admin.firestore().collection('invites').doc(inviteId);
    await inviteRef.set({
      groupId,
      invitedBy: context.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      used: false
    });

    // Return the full invite link
    return {
      inviteId,
      inviteLink: `https://heroic-cannoli-2a304c.netlify.app/invite/${inviteId}`
    };
  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Failed to generate invite');
  }
}); 
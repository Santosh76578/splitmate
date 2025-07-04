const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.createCustomToken = functions.https.onCall(async (data, context) => {
  try {
    const { uid } = data;
    
    // Verify the user exists in Firestore
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    // Create custom token
    const token = await admin.auth().createCustomToken(uid);
    
    return { token };
  } catch (error) {
    throw new functions.https.HttpsError('internal', error.message);
  }
}); 
import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

let firebaseApp = null;

export function initializeFirebase() {
  if (!firebaseApp) {
    try {
      const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      };

      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: `${process.env.FIREBASE_PROJECT_ID}.appspot.com`
      });

      console.log('✅ Firebase initialized successfully');
    } catch (error) {
      console.error('❌ Firebase initialization error:', error);
      process.exit(1);
    }
  }
  return firebaseApp;
}

export const db = admin.firestore();
export const auth = admin.auth();
export const storage = admin.storage();

// Initialize Firestore with indexes
export const initFirestore = async () => {
  try {
    const collections = ['users', 'games', 'categories', 'wallets', 'transactions', 'purchases', 'downloads', 'notifications', 'settings'];
    for (const collection of collections) {
      const snapshot = await db.collection(collection).limit(1).get();
      if (snapshot.empty) {
        await db.collection(collection).add({
          _created: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`📁 Collection ${collection} created`);
      }
    }
    console.log('✅ Firestore initialized');
  } catch (error) {
    console.error('❌ Firestore initialization error:', error);
  }
};

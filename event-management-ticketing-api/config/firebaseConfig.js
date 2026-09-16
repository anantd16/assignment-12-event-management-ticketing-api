const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

/**
 * Initializes the Firebase Admin SDK using a service account key.
 * The path is read from GOOGLE_APPLICATION_CREDENTIALS in .env
 * (defaults to ./serviceAccountKey.json in the project root).
 */
function initializeFirebase() {
  if (admin.apps.length) {
    return admin;
  }

  const keyPath = path.resolve(
    process.cwd(),
    process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json'
  );

  let serviceAccount;
  try {
    serviceAccount = require(keyPath);
  } catch (err) {
    console.error(
      '\n[Firebase] Could not load service account key at:',
      keyPath,
      '\nDownload it from Firebase Console > Project Settings > Service Accounts',
      'and place it at that path, or set GOOGLE_APPLICATION_CREDENTIALS in .env.\n'
    );
    throw err;
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  console.log('[Firebase] Admin SDK initialized');
  return admin;
}

const firebaseAdmin = initializeFirebase();
const db = firebaseAdmin.firestore();

module.exports = { admin: firebaseAdmin, db };

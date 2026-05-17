import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.databaseURL &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
)

export const isLocalFallbackEnabled = !isFirebaseConfigured && import.meta.env.DEV

export const firebaseApp = initializeApp(
  isFirebaseConfigured
    ? firebaseConfig
    : {
        apiKey: 'local-dev',
        authDomain: 'local-dev.firebaseapp.com',
        databaseURL: 'https://local-dev.firebaseio.com',
        projectId: 'local-dev',
        appId: 'local-dev',
      },
)

export const database = getDatabase(firebaseApp)

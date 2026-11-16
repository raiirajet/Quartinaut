const QUARTINAUT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCHjuUe-QYCMFrrHImL_XEaVo5ifDw9-DM',
  authDomain: 'quartinaut.web.app',
  projectId: 'quartinaut',
  storageBucket: 'quartinaut.firebasestorage.app',
  messagingSenderId: '815175119171',
  appId: '1:815175119171:web:bf5ffa78acafeee2e23ff6'
};

const QUARTINAUT_FIREBASE_VAPID_KEY = 'BM8sGGlxBCNhgj1KCxFK3hv3dmGRD4BLYBbJbrvqpjmQOe3F76rqmpQPGZ3CKAvHlnvMvjz1r9v3lKVdceFof7k';
// Firebase App Check: reCAPTCHA-v3/Enterprise Site-Key hier eintragen, sobald
// App Check in der Firebase Console fuer quartinaut.web.app registriert ist.
const QUARTINAUT_APP_CHECK_SITE_KEY = '';

if (typeof window !== 'undefined') {
  window.QUARTINAUT_FIREBASE_CONFIG = QUARTINAUT_FIREBASE_CONFIG;
  window.QUARTINAUT_FIREBASE_VAPID_KEY = QUARTINAUT_FIREBASE_VAPID_KEY;
  window.QUARTINAUT_APP_CHECK_SITE_KEY = QUARTINAUT_APP_CHECK_SITE_KEY;
}

if (typeof self !== 'undefined') {
  self.QUARTINAUT_FIREBASE_CONFIG = QUARTINAUT_FIREBASE_CONFIG;
  self.QUARTINAUT_FIREBASE_VAPID_KEY = QUARTINAUT_FIREBASE_VAPID_KEY;
  self.QUARTINAUT_APP_CHECK_SITE_KEY = QUARTINAUT_APP_CHECK_SITE_KEY;
}

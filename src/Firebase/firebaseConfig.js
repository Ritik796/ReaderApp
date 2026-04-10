// Production config (Bharatpur)
const BHARATPUR_CONFIG = {
  apiKey: 'AIzaSyBGZ_IB4y5Ov1nuqIhWndGU8hfJadlE85I',
  authDomain: 'dtdnavigator.firebaseapp.com',
  databaseURL: 'https://dtdbharatpur.firebaseio.com',
  projectId: 'dtdnavigator',
  storageBucket: 'dtdnavigator.appspot.com',
  messagingSenderId: '381118272786',
  appId: '1:381118272786:android:8580682aed749a06ec0fcb',
};

export const BHARATPUR_CITY = {
  cityName: 'Bharatpur',
  city: 'Bharatpur',
  key: 'BTPR',
  dbPath: `${BHARATPUR_CONFIG.databaseURL}/`,
  empCode: 'BHA',
  storagePath: 'gs://dtdnavigator.appspot.com/Bharatpur',
  firebaseStoragePath:
    'https://firebasestorage.googleapis.com/v0/b/dtdnavigator.appspot.com/o/',
  apiKey: BHARATPUR_CONFIG.apiKey,
  appId: BHARATPUR_CONFIG.appId,
  authDomain: BHARATPUR_CONFIG.authDomain,
  databaseURL: BHARATPUR_CONFIG.databaseURL,
  projectId: BHARATPUR_CONFIG.projectId,
  storageBucket: BHARATPUR_CONFIG.storageBucket,
  messagingSenderId: BHARATPUR_CONFIG.messagingSenderId,
  databaseName: 'dtdbharatpur',
  isUCCApplied: 'no',
};

// Test config (default active, same pattern as Survey-Huf)
const DEVTEST_CONFIG = {
  apiKey: 'AIzaSyBNHi7UP5nwqLnFU2tuKpArS1MhZDYsiLM',
  authDomain: 'devtest-62768.firebaseapp.com',
  databaseURL: 'https://devtest-62768-default-rtdb.firebaseio.com',
  projectId: 'devtest-62768',
  storageBucket: 'devtest-62768.firebasestorage.app',
  messagingSenderId: '799504409644',
  appId: '1:799504409644:android:8ce294ed91867118cedd89',
};

export const DEVTEST_CITY = {
  cityName: 'DevTest',
  city: 'DevTest',
  key: 'MNZ',
  dbPath: `${DEVTEST_CONFIG.databaseURL}/`,
  empCode: 'DEV',
  storagePath: 'gs://devtest-62768.firebasestorage.app/DevTest',
  firebaseStoragePath:
    'https://firebasestorage.googleapis.com/v0/b/devtest-62768.firebasestorage.app/o/',
  apiKey: DEVTEST_CONFIG.apiKey,
  appId: DEVTEST_CONFIG.appId,
  authDomain: DEVTEST_CONFIG.authDomain,
  databaseURL: DEVTEST_CONFIG.databaseURL,
  projectId: DEVTEST_CONFIG.projectId,
  storageBucket: DEVTEST_CONFIG.storageBucket,
  messagingSenderId: DEVTEST_CONFIG.messagingSenderId,
  databaseName: 'devtest-62768-default-rtdb',
  isUCCApplied: 'yes',
};

const FIREBASE_CONFIG_1 = BHARATPUR_CONFIG;
const CITY_CONFIG_1 = BHARATPUR_CITY;

const ACTIVE_CONFIG = FIREBASE_CONFIG_1;
const ACTIVE_CITY = CITY_CONFIG_1;

export const CITY = ACTIVE_CITY;
export const FIREBASE_CONFIG = ACTIVE_CONFIG;

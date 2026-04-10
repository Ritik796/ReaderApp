import {FIREBASE_CONFIG} from './firebaseConfig';
import {
  equalTo,
  get,
  getDatabase,
  orderByChild,
  query,
  ref as dbRef,
  runTransaction,
  set,
  update,
} from '@react-native-firebase/database';

let _rnApp = null;
const DB_LOG = (...args) => console.log('[FirebaseDB]', ...args);

const ensureApp = () => {
  if (_rnApp) return _rnApp;
  const {getApp, getApps, initializeApp} = require('@react-native-firebase/app');
  const existing = getApps();
  if (existing.length > 0) {
    _rnApp = getApp();
  } else {
    _rnApp = initializeApp({
      apiKey: FIREBASE_CONFIG.apiKey,
      appId: FIREBASE_CONFIG.appId,
      projectId: FIREBASE_CONFIG.projectId,
      databaseURL: FIREBASE_CONFIG.databaseURL,
      storageBucket: FIREBASE_CONFIG.storageBucket,
      messagingSenderId: FIREBASE_CONFIG.messagingSenderId,
    });
  }
  return _rnApp;
};

const getDb = () => getDatabase(ensureApp());

export const getData = async path => {
  DB_LOG('getData:start', {path});
  const snapshot = await get(dbRef(getDb(), path));
  const data = snapshot.exists() ? snapshot.val() : null;
  DB_LOG('getData:done', {path, found: snapshot.exists()});
  return data;
};

export const queryByChildEqualTo = async (path, childKey, value) => {
  DB_LOG('query:start', {path, childKey, value});
  const snapshot = await get(
    query(dbRef(getDb(), path), orderByChild(childKey), equalTo(value)),
  );
  const data = snapshot.exists() ? snapshot.val() : null;
  DB_LOG('query:done', {path, childKey, value, found: snapshot.exists()});
  return data;
};

export const saveData = async (path, data) => {
  DB_LOG('saveData', {path, data});
  await set(dbRef(getDb(), path), data);
};

export const updateData = async (path, data) => {
  DB_LOG('updateData', {path, data});
  await update(dbRef(getDb(), path), data);
};

export const incrementAndGet = async (path, initialValue = 1) => {
  DB_LOG('incrementAndGet:start', {path, initialValue});
  const targetRef = dbRef(getDb(), path);

  const result = await runTransaction(targetRef, currentValue => {
    const currentNum = Number.parseInt(String(currentValue ?? ''), 10);
    if (!Number.isFinite(currentNum)) {
      return String(initialValue);
    }
    return String(currentNum + 1);
  });

  if (!result?.committed) {
    throw new Error(`Transaction not committed for path: ${path}`);
  }

  const value = result.snapshot?.val();
  DB_LOG('incrementAndGet:done', {path, value});
  return String(value ?? initialValue);
};

export const uploadFileToStorage = async (storagePath, localFilePath) => {
  try {
    if (!storagePath || !localFilePath) {
      return {success: false, error: 'Missing storagePath/localFilePath'};
    }

    const {getStorage} = require('@react-native-firebase/storage');
    const rawPath = String(localFilePath);
    const normalizedPath = rawPath.startsWith('file://')
      ? rawPath.slice(7)
      : rawPath;

    const fileRef = getStorage(ensureApp()).ref(storagePath);
    try {
      await fileRef.putFile(normalizedPath, {contentType: 'image/jpeg'});
    } catch {
      await fileRef.putFile(rawPath, {contentType: 'image/jpeg'});
    }

    const directUrl = await fileRef.getDownloadURL();
    return {success: true, data: directUrl};
  } catch (error) {
    return {success: false, error: error?.message || String(error)};
  }
};

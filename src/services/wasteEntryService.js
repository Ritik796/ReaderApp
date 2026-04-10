import RNFS from 'react-native-fs';
import ImageResizer from 'react-native-image-resizer';
import {CITY} from '../Firebase/firebaseConfig';
import {
  incrementAndGet,
  updateData,
  uploadFileToStorage,
} from '../Firebase/dbServices';
import {upsertDailyScanCacheEntry} from './scanCacheService';

const MAX_IMAGE_SIZE_BYTES = 50 * 1024;

const normalizeFilePath = (uri = '') =>
  uri.startsWith('file://') ? uri.replace('file://', '') : uri;

const ensureFileUri = (uri = '') =>
  uri.startsWith('file://') ? uri : `file://${uri}`;

const sanitizePathPart = value =>
  String(value ?? '')
    .trim()
    .replace(/[.#$/[\]]/g, '_')
    .replace(/\s+/g, '_');

const getFileSizeInBytes = async uri => {
  const stat = await RNFS.stat(normalizeFilePath(uri));
  const fileSize = Number(stat?.size || 0);
  return Number.isFinite(fileSize) && fileSize > 0 ? fileSize : 0;
};

const toDateMeta = (date = new Date()) => {
  const year = String(date.getFullYear());
  const month = date.toLocaleString('en-US', {month: 'long'});
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const dateOnly = `${yyyy}-${mm}-${dd}`;
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const scanTime = `${hh}:${min}:${ss}`;
  const scanDateTime = `${dateOnly} ${scanTime}`;
  return {year, month, dateOnly, scanTime, scanDateTime};
};

const buildHouseCollectionBasePath = ({wardNo, year, month, dateOnly}) =>
  `HousesCollectionInfo/${wardNo}/${year}/${month}/${dateOnly}`;

export const compressWastePhoto = async photoUri => {
  const originalUri = ensureFileUri(photoUri);
  const originalSizeBytes = await getFileSizeInBytes(originalUri);

  let quality = 85;
  let finalUri = originalUri;
  let finalSizeBytes = originalSizeBytes;
  let cleanupPath = null;

  try {
    while (quality >= 30) {
      const resized = await ImageResizer.createResizedImage(
        originalUri,
        800,
        800,
        'JPEG',
        quality,
        0,
        undefined,
        false,
        {mode: 'cover', onlyScaleDown: true},
      );
      const resizedUri = ensureFileUri(resized?.uri || resized?.path || originalUri);
      const resizedSizeBytes = await getFileSizeInBytes(resizedUri);

      finalUri = resizedUri;
      finalSizeBytes = resizedSizeBytes;
      cleanupPath =
        resizedUri !== originalUri ? normalizeFilePath(resizedUri) : null;

      if (resizedSizeBytes <= MAX_IMAGE_SIZE_BYTES) {
        break;
      }
      quality -= 10;
    }
  } catch {
    return {
      uri: originalUri,
      sizeBytes: originalSizeBytes,
      originalSizeBytes,
      overLimit: originalSizeBytes > MAX_IMAGE_SIZE_BYTES,
      cleanupPath: null,
    };
  }

  return {
    uri: finalUri,
    sizeBytes: finalSizeBytes,
    originalSizeBytes,
    overLimit: finalSizeBytes > MAX_IMAGE_SIZE_BYTES,
    cleanupPath,
  };
};

const uploadSegregatedImage = async ({
  wardNo,
  year,
  month,
  dateOnly,
  cardNumber,
  photoPath,
}) => {
  const imageName = `${cardNumber}.jpg`;
  const storageRelativePath = `${CITY.cityName}/ScanCardImages/${wardNo}/${year}/${month}/${dateOnly}/${imageName}`;
  const normalizedPath = normalizeFilePath(photoPath);
  const uploadRes = await uploadFileToStorage(storageRelativePath, normalizedPath);

  if (!uploadRes?.success) {
    throw new Error(uploadRes?.error || 'Image upload failed');
  }

  return {imageName};
};

const syncSegregatedImageInBackground = async ({
  basePath,
  wardNo,
  year,
  month,
  dateOnly,
  safeCardNumber,
  scanBy,
  scanTime,
  latLng,
  wasteCategory,
  photoPath,
}) => {
  try {
    console.log('[saveScanDetails] image background sync started', {
      basePath,
      safeCardNumber,
    });

    const imageMeta = await uploadSegregatedImage({
      wardNo,
      year,
      month,
      dateOnly,
      cardNumber: safeCardNumber,
      photoPath,
    });

    await upsertDailyScanCacheEntry({
      wardNo,
      cardNumber: safeCardNumber,
      scanBy,
      scanTime,
      latLng,
      wasteCategory,
    });

    console.log('[saveScanDetails] image background sync done', {
      basePath,
      safeCardNumber,
      imageName: imageMeta.imageName,
    });
  } catch (error) {
    console.log('[saveScanDetails] image background sync failed', {
      basePath,
      safeCardNumber,
      message: error?.message,
    });
  }
};

export const saveScanDetails = async ({
  cardNumber,
  wasteCategory,
  photoPath,
  wardNo = '',
  line = '',
  helperId = '',
  latLng = '',
  isNewScan = true,
}) => {
  console.log('[saveScanDetails] input', {
    cardNumber,
    wasteCategory,
    wardNo,
    line,
    helperId,
    latLng,
    isNewScan,
    hasPhoto: !!photoPath,
  });

  if (!cardNumber || !wasteCategory) {
    console.warn('[saveScanDetails] blocked: missing required params', {
      hasCardNumber: !!cardNumber,
      hasWasteCategory: !!wasteCategory,
    });
    return {ok: false, message: 'Missing required params'};
  }

  const now = new Date();
  const {year, month, dateOnly, scanTime} = toDateMeta(now);
  const ward = sanitizePathPart(wardNo || 'UnknownWard');
  const safeCardNumber = sanitizePathPart(cardNumber);
  const basePath = buildHouseCollectionBasePath({
    wardNo: ward,
    year,
    month,
    dateOnly,
  });
  const scanBy = String(helperId || '');
  const lineNo = String(line || '');
  const latLngValue = String(latLng || '');

  console.log('[saveScanDetails] resolved meta', {
    year,
    month,
    dateOnly,
    scanTime,
    ward,
    safeCardNumber,
    basePath,
    scanBy,
    lineNo,
    latLngValue,
  });

  const recentScanned = {
    cardNo: String(cardNumber),
    scanTime,
    line: lineNo,
    isShowMessage: 'yes',
    scanBy,
  };

  const cardPayload = {
    latLng: latLngValue,
    scanBy,
    scanTime,
    wasteCategory: String(wasteCategory),
  };

  console.log('[saveScanDetails] prepared payload', {
    recentScanned,
    cardPayload,
  });

  console.log('[saveScanDetails] writing base scan data', {
    basePath,
    safeCardNumber,
  });

  await updateData(basePath, {
    recentScanned,
    [safeCardNumber]: cardPayload,
  });

  await upsertDailyScanCacheEntry({
    wardNo: ward,
    cardNumber: safeCardNumber,
    line: lineNo,
    scanBy,
    scanTime,
    latLng: latLngValue,
    wasteCategory: String(wasteCategory),
  });

  console.log('[saveScanDetails] base scan data saved', {
    recentScannedPath: `${basePath}/recentScanned`,
    cardPath: `${basePath}/${safeCardNumber}`,
  });

  if (wasteCategory === 'Segregated' && photoPath) {
    console.log('[saveScanDetails] segregated image queued in background', {
      photoPath,
      cardNumber: safeCardNumber,
    });
    syncSegregatedImageInBackground({
      basePath,
      wardNo: ward,
      year,
      month,
      dateOnly,
      safeCardNumber,
      scanBy,
      scanTime,
      latLng: latLngValue,
      wasteCategory: String(wasteCategory),
      photoPath,
    }).catch(error => {
      console.log('[saveScanDetails] image background sync promise rejected', {
        basePath,
        safeCardNumber,
        message: error?.message,
      });
    });
  }

  if (isNewScan) {
    console.log('[saveScanDetails] incrementing counters', {
      totalScannedPath: `${basePath}/totalScanned`,
      totalActualScannedPath: `${basePath}/totalActualScanned`,
    });

    await incrementAndGet(`${basePath}/totalScanned`, 1);
    await incrementAndGet(`${basePath}/totalActualScanned`, 1);
  }

  console.log('[saveScanDetails] success', {
    basePath,
    cardNumber: safeCardNumber,
    wasteCategory,
    isNewScan,
  });

  return {
    ok: true,
    message: 'Scan complete successfully.',
    data: {
      basePath,
      cardKeyPath: `${basePath}/${safeCardNumber}`,
      payload: cardPayload,
    },
  };
};

export const saveWasteEntry = saveScanDetails;

export const cleanupPhotoIfNeeded = async cleanupPath => {
  if (!cleanupPath) return;
  try {
    await RNFS.unlink(cleanupPath);
  } catch {
    // ignore cleanup errors
  }
};

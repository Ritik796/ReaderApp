import AsyncStorage from '@react-native-async-storage/async-storage';
import {getData} from '../Firebase/dbServices';
import {CITY} from '../Firebase/firebaseConfig';

const CACHE_PREFIX = 'reader_scan_cache';
const ACTIVE_LINE_PREFIX = 'reader_active_line';
const WARD_LINE_PREFIX = 'reader_ward_lines';
const METADATA_KEYS = new Set(['recentScanned', 'totalScanned', 'totalActualScanned']);
const INVALID_SCAN_BY_VALUES = new Set(['', '-1', '0', 'null', 'undefined']);

const sanitizePathPart = value =>
  String(value ?? '')
    .trim()
    .replace(/[.#$/[\]]/g, '_')
    .replace(/\s+/g, '_');

export const getDateMeta = (date = new Date()) => {
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
  return {year, month, dateOnly, scanTime};
};

const buildCacheKey = ({wardNo = '', dateOnly = ''}) => {
  const cityKey = sanitizePathPart(CITY?.cityName || CITY?.key || 'default');
  const wardKey = sanitizePathPart(wardNo || 'ward');
  return `${CACHE_PREFIX}_${cityKey}_${wardKey}_${dateOnly}`;
};

const buildActiveLineKey = ({wardNo = '', dateOnly = ''}) => {
  const cityKey = sanitizePathPart(CITY?.cityName || CITY?.key || 'default');
  const wardKey = sanitizePathPart(wardNo || 'ward');
  return `${ACTIVE_LINE_PREFIX}_${cityKey}_${wardKey}_${dateOnly}`;
};

const extractDateSuffix = key => {
  const parts = String(key || '').split('_');
  return parts[parts.length - 1] || '';
};

export const purgeStaleDailyCaches = async (date = new Date()) => {
  const {dateOnly} = getDateMeta(date);
  try {
    const keys = await AsyncStorage.getAllKeys();
    const staleKeys = keys.filter(key => {
      if (
        !key.startsWith(`${CACHE_PREFIX}_`) &&
        !key.startsWith(`${WARD_LINE_PREFIX}_`) &&
        !key.startsWith(`${ACTIVE_LINE_PREFIX}_`)
      ) {
        return false;
      }

      const suffix = extractDateSuffix(key);
      return suffix && suffix !== dateOnly;
    });

    if (staleKeys.length > 0) {
      await AsyncStorage.multiRemove(staleKeys);
      console.log('[scanCacheService] stale caches purged', {
        today: dateOnly,
        removedCount: staleKeys.length,
      });
    }
  } catch (error) {
    console.log('[scanCacheService] purge stale cache failed', {
      message: error?.message,
    });
  }
};

export const loadActiveLineState = async ({wardNo = '', date = new Date()} = {}) => {
  const {dateOnly} = getDateMeta(date);
  const cacheKey = buildActiveLineKey({wardNo, dateOnly});
  try {
    const raw = await AsyncStorage.getItem(cacheKey);
    if (!raw) {
      return {
        source: 'empty',
        cacheKey,
        wardNo: String(wardNo || '').trim(),
        dateOnly,
        lineId: '',
        lineIndex: 0,
      };
    }
    const parsed = JSON.parse(raw);
    return {
      source: 'storage',
      cacheKey,
      wardNo: String(parsed?.wardNo || wardNo || '').trim(),
      dateOnly: String(parsed?.dateOnly || dateOnly).trim(),
      lineId: String(parsed?.lineId || '').trim(),
      lineIndex: Number.isFinite(Number(parsed?.lineIndex))
        ? Number(parsed.lineIndex)
        : 0,
      updatedAt: String(parsed?.updatedAt || ''),
    };
  } catch (error) {
    console.log('[scanCacheService] load active line failed', {
      cacheKey,
      message: error?.message,
    });
    return {
      source: 'empty',
      cacheKey,
      wardNo: String(wardNo || '').trim(),
      dateOnly,
      lineId: '',
      lineIndex: 0,
    };
  }
};

export const saveActiveLineState = async ({
  wardNo = '',
  lineId = '',
  lineIndex = 0,
  date = new Date(),
} = {}) => {
  const {dateOnly} = getDateMeta(date);
  const cacheKey = buildActiveLineKey({wardNo, dateOnly});
  const payload = {
    wardNo: String(wardNo || '').trim(),
    lineId: String(lineId || '').trim(),
    lineIndex: Number.isFinite(Number(lineIndex)) ? Number(lineIndex) : 0,
    dateOnly,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(cacheKey, JSON.stringify(payload));
  return payload;
};

export const clearActiveLineState = async ({wardNo = '', date = new Date()} = {}) => {
  const {dateOnly} = getDateMeta(date);
  const cacheKey = buildActiveLineKey({wardNo, dateOnly});
  try {
    await AsyncStorage.removeItem(cacheKey);
  } catch (error) {
    console.log('[scanCacheService] clear active line failed', {
      cacheKey,
      message: error?.message,
    });
  }
};

const normalizeRecord = (value, key) => {
  if (!value || typeof value !== 'object') return null;

  const cardNumber = String(value.cardNumber || value.cardNo || key || '').trim().toUpperCase();
  if (!cardNumber) return null;

  const scanBy = String(value.scanBy || '').trim();
  const hasValidScanBy = !INVALID_SCAN_BY_VALUES.has(scanBy.toLowerCase());
  const hasScannedFlag = String(value.isScanned || '')
    .trim()
    .toLowerCase();
  const hasScanMarker =
    hasValidScanBy ||
    Boolean(String(value.scanTime || '').trim()) ||
    Boolean(String(value.lastScanTime || '').trim()) ||
    ['yes', 'true', '1'].includes(hasScannedFlag);

  if (!hasScanMarker) {
    return null;
  }

  return {
    cardNumber,
    uid: String(value.uid || '').trim().toUpperCase(),
    line: String(value.line || '').trim(),
    scanBy,
    scanTime: String(value.scanTime || '').trim(),
    latLng: String(value.latLng || '').trim(),
    wasteCategory: String(value.wasteCategory || '').trim(),
    imgName: String(value.imgName || '').trim(),
    isScanned: true,
    updatedAt: String(value.updatedAt || new Date().toISOString()),
  };
};

const normalizeRecords = records => {
  if (!records || typeof records !== 'object') return {};
  return Object.entries(records).reduce((acc, [key, value]) => {
    const normalized = normalizeRecord(value, key);
    if (normalized) {
      acc[normalized.cardNumber] = normalized;
      if (normalized.uid) {
        acc[normalized.uid] = normalized;
      }
    }
    return acc;
  }, {});
};

const getCountSummary = records => {
  const uniqueRecords = new Map();
  Object.values(records || {}).forEach(record => {
    if (!record || typeof record !== 'object') return;
    const cardKey = String(record.cardNumber || '').trim().toUpperCase();
    if (!cardKey || uniqueRecords.has(cardKey)) return;
    uniqueRecords.set(cardKey, record);
  });

  const byLine = {};
  let scannedCount = 0;

  uniqueRecords.forEach(record => {
    const lineKey = String(record.line || '').trim() || '0';
    if (!byLine[lineKey]) {
      byLine[lineKey] = {
        lineId: lineKey,
        totalCount: 0,
        scannedCount: 0,
      };
    }

    byLine[lineKey].totalCount += 1;

    const isScanned = !INVALID_SCAN_BY_VALUES.has(
      String(record.scanBy || '').trim().toLowerCase(),
    );
    if (isScanned) {
      byLine[lineKey].scannedCount += 1;
      scannedCount += 1;
    }
  });

  return {
    totalCount: uniqueRecords.size,
    scannedCount,
    byLine,
  };
};

const normalizeCachePayload = payload => {
  if (!payload || typeof payload !== 'object') {
    return {
      wardNo: '',
      dateOnly: '',
      updatedAt: '',
      records: {},
    };
  }

  return {
    wardNo: String(payload.wardNo || '').trim(),
    dateOnly: String(payload.dateOnly || '').trim(),
    updatedAt: String(payload.updatedAt || ''),
    records: normalizeRecords(payload.records || payload.scans || {}),
    counts: payload.counts || {},
  };
};

const buildCachePayload = ({wardNo, dateOnly, records}) => ({
  wardNo: String(wardNo || '').trim(),
  dateOnly: String(dateOnly || '').trim(),
  updatedAt: new Date().toISOString(),
  records,
  counts: getCountSummary(records),
});

export const loadDailyScanCache = async ({wardNo = '', date = new Date()} = {}) => {
  const {dateOnly} = getDateMeta(date);
  const cacheKey = buildCacheKey({wardNo, dateOnly});

  try {
    const cachedRaw = await AsyncStorage.getItem(cacheKey);
    if (cachedRaw) {
      const cachedPayload = normalizeCachePayload(JSON.parse(cachedRaw));
      if (cachedPayload.records && Object.keys(cachedPayload.records).length > 0) {
        return {
          source: 'storage',
          cacheKey,
          ...cachedPayload,
        };
      }
    }
  } catch (error) {
    console.log('[scanCacheService] storage read failed', {cacheKey, message: error?.message});
  }

  if (!wardNo) {
    return {
      source: 'empty',
      cacheKey,
      wardNo: '',
      dateOnly,
      updatedAt: '',
      records: {},
    };
  }

  const {year, month} = getDateMeta(date);
  const dbPath = `HousesCollectionInfo/${sanitizePathPart(wardNo)}/${year}/${month}/${dateOnly}`;

  try {
    const dbPayload = (await getData(dbPath)) || {};
    const records = Object.entries(dbPayload)
      .filter(([key]) => !METADATA_KEYS.has(key))
      .reduce((acc, [key, value]) => {
        const normalized = normalizeRecord(
          {
            cardNumber: key,
            uid: value?.uid || value?.UID || '',
            line: value?.line || '',
            scanBy: value?.scanBy || '',
            scanTime: value?.scanTime || '',
            lastScanTime: value?.lastScanTime || '',
            isScanned: value?.isScanned || '',
            latLng: value?.latLng || '',
            wasteCategory: value?.wasteCategory || '',
            imgName: value?.imgName || '',
            updatedAt: value?.updatedAt || '',
          },
          key,
        );

        if (normalized) {
          acc[normalized.cardNumber] = normalized;
          if (normalized.uid) {
            acc[normalized.uid] = normalized;
          }
        }
        return acc;
      }, {});

    const payload = buildCachePayload({wardNo, dateOnly, records});
    if (Object.keys(records).length > 0) {
      await AsyncStorage.setItem(cacheKey, JSON.stringify(payload));
    }

    return {
      source: Object.keys(records).length > 0 ? 'database' : 'empty',
      cacheKey,
      ...payload,
    };
  } catch (error) {
    console.log('[scanCacheService] db hydrate failed', {
      cacheKey,
      dbPath,
      message: error?.message,
    });
    return {
      source: 'empty',
      cacheKey,
      wardNo: String(wardNo || '').trim(),
      dateOnly,
      updatedAt: '',
      records: {},
    };
  }
};

export const upsertDailyScanCacheEntry = async ({
  wardNo = '',
  cardNumber = '',
  uid = '',
  line = '',
  scanBy = '',
  scanTime = '',
  latLng = '',
  wasteCategory = '',
  imgName = '',
  date = new Date(),
} = {}) => {
  const {dateOnly} = getDateMeta(date);
  const cacheKey = buildCacheKey({wardNo, dateOnly});
  const normalizedCard = String(cardNumber || '').trim().toUpperCase();
  const normalizedUid = String(uid || '').trim().toUpperCase();

  if (!normalizedCard && !normalizedUid) {
    return null;
  }

  const current = await loadDailyScanCache({wardNo, date});
  const existingRecords = current?.records && typeof current.records === 'object'
    ? {...current.records}
    : {};

  const nextRecord = {
    cardNumber: normalizedCard || normalizedUid,
    uid: normalizedUid,
    line: String(line || '').trim(),
    scanBy: String(scanBy || '').trim(),
    scanTime: String(scanTime || '').trim(),
    latLng: String(latLng || '').trim(),
    wasteCategory: String(wasteCategory || '').trim(),
    imgName: String(imgName || '').trim(),
    isScanned: true,
    updatedAt: new Date().toISOString(),
  };

  existingRecords[nextRecord.cardNumber] = nextRecord;
  if (nextRecord.uid) {
    existingRecords[nextRecord.uid] = nextRecord;
  }

  const payload = buildCachePayload({
    wardNo,
    dateOnly,
    records: existingRecords,
  });

  await AsyncStorage.setItem(cacheKey, JSON.stringify(payload));
  return payload;
};

export const mergeWardLinesWithScanCache = (wardLines = [], cachePayload = null) => {
  const records = cachePayload?.records && typeof cachePayload.records === 'object'
    ? cachePayload.records
    : {};

  const lookup = new Map();
  Object.values(records).forEach(record => {
    if (!record || typeof record !== 'object') return;
    const cardKey = String(record.cardNumber || '').trim().toUpperCase();
    const uidKey = String(record.uid || '').trim().toUpperCase();
    if (cardKey) lookup.set(cardKey, record);
    if (uidKey) lookup.set(uidKey, record);
  });

  return (Array.isArray(wardLines) ? wardLines : []).map(line => ({
    ...line,
    houses: Array.isArray(line?.houses)
      ? line.houses.map(house => {
          const cardKey = String(house?.cardNumber || '').trim().toUpperCase();
          const uidKey = String(house?.uid || '').trim().toUpperCase();
          const record = lookup.get(cardKey) || lookup.get(uidKey);
          if (!record) return house;

          return {
            ...house,
            scanBy: record.scanBy || house.scanBy || '',
            scanTime: record.scanTime || house.scanTime || '',
            lastScanTime: record.scanTime || house.lastScanTime || '',
            isScanned: 'yes',
            wasteCategory: record.wasteCategory || house.wasteCategory || '',
            imgName: record.imgName || house.imgName || '',
            localScanSource: cachePayload?.source || 'storage',
          };
        })
      : [],
  }));
};

export const getCacheCounts = (cachePayload = null) => {
  const counts = cachePayload?.counts || {};
  const byLine = counts?.byLine && typeof counts.byLine === 'object' ? counts.byLine : {};

  return {
    totalCount: Number(counts?.totalCount || 0),
    scannedCount: Number(counts?.scannedCount || 0),
    byLine,
  };
};

export const isCardAlreadyScanned = (cachePayload = null, cardNumber = '', uid = '') => {
  const records = cachePayload?.records && typeof cachePayload.records === 'object'
    ? cachePayload.records
    : {};
  const cardKey = String(cardNumber || '').trim().toUpperCase();
  const uidKey = String(uid || '').trim().toUpperCase();
  const matched = (cardKey && records[cardKey]) || (uidKey && records[uidKey]);
  if (!matched) return false;
  return !INVALID_SCAN_BY_VALUES.has(String(matched.scanBy || '').trim().toLowerCase());
};

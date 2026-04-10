import AsyncStorage from '@react-native-async-storage/async-storage';
import {CITY} from '../Firebase/firebaseConfig';
import {purgeStaleDailyCaches} from './scanCacheService';

const isValidPoint = point =>
  Array.isArray(point) &&
  point.length >= 2 &&
  Number.isFinite(Number(point[0])) &&
  Number.isFinite(Number(point[1]));

const getTodayDateOnly = (date = new Date()) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const parseCoordinate = value => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const normalizeHouse = (house, fallbackLineId) => {
  if (!house || typeof house !== 'object') return null;

  const basicInfo = house.Basicinfo || house.basicInfo || {};
  const latLong = house.latlong || house.latLong || house.latlng || {};
  const latitude = parseCoordinate(latLong.latitude);
  const longitude = parseCoordinate(latLong.longitude);

  if (latitude == null || longitude == null) return null;

  const cardNumber = String(
    basicInfo.CardNumber || basicInfo.cardNumber || house.cardNumber || '',
  )
    .trim()
    .toUpperCase();
  const uid = String(house.UID || house.uid || '').trim();

  if (!cardNumber && !uid) return null;

  return {
    cardNumber,
    uid,
    line: String(fallbackLineId || ''),
    latitude,
    longitude,
    scanBy: String(house.scanBy || house.ScanBy || house.scanby || ''),
    scanTime: String(house.scanTime || house.ScanTime || house.scantime || ''),
    lastScanTime: String(
      house.lastScanTime || house.LastScanTime || house.lastscantime || '',
    ),
    isScanned: String(house.isScanned || house.IsScanned || '')
      .trim()
      .toLowerCase(),
  };
};

const normalizeWardLines = rawData => {
  if (!rawData || typeof rawData !== 'object') return [];

  return Object.entries(rawData)
    .filter(([lineId, value]) => {
      if (!value || typeof value !== 'object') return false;
      const numericLine = Number(lineId);
      return Number.isFinite(numericLine) && numericLine > 0;
    })
    .map(([lineId, value]) => {
      const points = Array.isArray(value.points)
        ? value.points
            .filter(isValidPoint)
            .map(([latitude, longitude]) => ({
              latitude: Number(latitude),
              longitude: Number(longitude),
            }))
        : [];

      const houses = Array.isArray(value.Houses)
        ? value.Houses.map(house => normalizeHouse(house, lineId)).filter(Boolean)
        : [];

      return {
        id: String(lineId),
        lineLength: Number(value.lineLength) || 0,
        points,
        houses,
      };
    })
    .filter(line => line.points.length > 1 || line.houses.length > 0)
    .sort((a, b) => Number(a.id) - Number(b.id));
};

const normalizeCardValue = value =>
  String(value || '')
    .trim()
    .toUpperCase();

export const findHouseInWardLines = (wardLines = [], cardNumber = '') => {
  const target = normalizeCardValue(cardNumber);
  if (!target || !Array.isArray(wardLines)) {
    return {
      found: false,
      target,
      matchedHouse: null,
      matchedLine: null,
    };
  }

  for (const line of wardLines) {
    const houses = Array.isArray(line?.houses) ? line.houses : [];
    const match = houses.find(house => {
      const houseCard = normalizeCardValue(house?.cardNumber);
      const houseUid = normalizeCardValue(house?.uid);
      return houseCard === target || houseUid === target;
    });

    if (match) {
      return {
        found: true,
        target,
        matchedHouse: match,
        matchedLine: String(line?.id || ''),
      };
    }
  }

  return {
    found: false,
    target,
    matchedHouse: null,
    matchedLine: null,
  };
};

const buildStorageUrl = (zone, fileName) => {
  const storagePath = `${CITY.cityName}/WardLinesHouseJson/${zone}/${fileName}`;
  return `${CITY.firebaseStoragePath}${encodeURIComponent(storagePath)}?alt=media`;
};

const parseHistoryDate = historyPayload => {
  const historyList = Array.isArray(historyPayload)
    ? historyPayload
    : historyPayload && typeof historyPayload === 'object'
      ? Object.values(historyPayload)
      : [];

  const cleaned = historyList
    .filter(item => item !== null && item !== undefined && item !== '')
    .map(item => String(item).trim());

  return cleaned.length > 0 ? cleaned[cleaned.length - 1] : null;
};

const getCache = async zone => {
  const dateOnly = getTodayDateOnly();
  const cacheKey = `reader_ward_lines_${zone}_${dateOnly}`;
  const dateKey = `reader_ward_lines_date_${zone}`;
  const [linesRaw, dateRaw] = await Promise.all([
    AsyncStorage.getItem(cacheKey),
    AsyncStorage.getItem(dateKey),
  ]);

  let lines = [];
  try {
    lines = linesRaw ? JSON.parse(linesRaw) : [];
  } catch {
    lines = [];
  }

  return {
    cacheKey,
    dateKey,
    cachedDate: dateRaw || null,
    cachedLines: Array.isArray(lines) ? lines : [],
    dateOnly,
  };
};

export const getWardLinesDynamic = async zoneRaw => {
  const zone = String(zoneRaw || '').trim();
  if (!zone) {
    console.log('[getWardLinesDynamic] blocked: empty zone');
    return {ok: false, data: [], message: 'Invalid ward/zone'};
  }

  await purgeStaleDailyCaches();
  const {cacheKey, dateKey, cachedDate, cachedLines, dateOnly} = await getCache(zone);
  const cacheHasHouses = cachedLines.some(line => Array.isArray(line?.houses));

  console.log('[getWardLinesDynamic] start', {
    zone,
    cachedDate,
    dateOnly,
    cachedLinesCount: cachedLines.length,
    cacheHasHouses,
  });

  try {
    if (cachedLines.length > 0 && cacheHasHouses) {
      console.log('[getWardLinesDynamic] using daily cached lines', {
        zone,
        cacheKey,
        cachedLinesCount: cachedLines.length,
      });
      return {
        ok: true,
        data: cachedLines,
        latestDate: cachedDate,
        fromCache: true,
        message: 'Success (cached)',
      };
    }

    const historyResp = await fetch(buildStorageUrl(zone, 'mapUpdateHistoryJson.json'));
    if (!historyResp.ok) {
      throw new Error(`History fetch failed (${historyResp.status})`);
    }
    const historyPayload = await historyResp.json();
    const latestDate = parseHistoryDate(historyPayload);

    console.log('[getWardLinesDynamic] history loaded', {
      zone,
      latestDate,
      historyPayload,
    });

    if (!latestDate) {
      console.log('[getWardLinesDynamic] no latest date, using cache if available', {
        cacheLines: cachedLines.length,
      });
      return {
        ok: cachedLines.length > 0,
        data: cachedLines,
        latestDate: cachedDate,
        fromCache: cachedLines.length > 0,
        message: cachedLines.length > 0 ? 'Using cached ward lines' : 'No map history found',
      };
    }

    const linesResp = await fetch(buildStorageUrl(zone, `${latestDate}.json`));
    if (!linesResp.ok) {
      throw new Error(`Line data fetch failed (${linesResp.status})`);
    }
    const linePayload = await linesResp.json();
    const normalizedLines = normalizeWardLines(linePayload);

    console.log('[getWardLinesDynamic] line json loaded', {
      zone,
      latestDate,
      rawLineKeys: Object.keys(linePayload || {}),
      normalizedLinesCount: normalizedLines.length,
      lineSummary: normalizedLines.map(line => ({
        id: line.id,
        points: line.points.length,
        houses: line.houses.length,
      })),
    });

    if (normalizedLines.length === 0) {
      console.log('[getWardLinesDynamic] invalid ward line format', {
        zone,
        latestDate,
      });
      return {
        ok: false,
        data: [],
        latestDate,
        fromCache: false,
        message: 'Invalid ward line format',
      };
    }

    await Promise.all([
      AsyncStorage.setItem(cacheKey, JSON.stringify(normalizedLines)),
      AsyncStorage.setItem(dateKey, latestDate),
    ]);

    console.log('[getWardLinesDynamic] cache saved', {
      zone,
      latestDate,
      normalizedLinesCount: normalizedLines.length,
    });

    return {
      ok: true,
      data: normalizedLines,
      latestDate,
      fromCache: false,
      message: 'Success',
    };
  } catch (error) {
    console.log('[getWardLinesDynamic] error', {
      zone,
      message: error?.message,
      cachedLinesCount: cachedLines.length,
    });
    if (cachedLines.length > 0) {
      return {
        ok: true,
        data: cachedLines,
        latestDate: cachedDate,
        fromCache: true,
        message: 'Network failed, using cached lines',
      };
    }
    return {
      ok: false,
      data: [],
      latestDate: null,
      fromCache: false,
      message: error?.message || 'Unable to load ward lines',
    };
  }
};

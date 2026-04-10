import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import {CITY} from '../Firebase/firebaseConfig';
import {getData, saveData, updateData} from '../Firebase/dbServices';

const DEVICE_LOG = (...args) => console.log('[DeviceService]', ...args);

const STORAGE_KEYS = {
  DEVICE_ID: 'reader_app_device_id_v1',
  DEVICE_NAME: 'reader_app_device_name_v1',
};

const toDateTimeString = (date = new Date()) => {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${d}/${m}/${y} ${hh}:${mm}`;
};

const getCityPrefix = fallbackPrefix => {
  if (fallbackPrefix) return String(fallbackPrefix).toUpperCase();
  if (CITY?.empCode) return String(CITY.empCode).toUpperCase();
  const city = String(CITY?.city || CITY?.cityName || 'BTP');
  return city.slice(0, 3).toUpperCase();
};

async function getOrCreateDeviceIdentity(prefix) {
  const androidId = await DeviceInfo.getAndroidId();
  const appVersion = DeviceInfo.getVersion();
  const city = String(CITY?.city || 'bharatpur');
  const path = `Devices/${city}/${androidId}`;
  const now = toDateTimeString(new Date());
  DEVICE_LOG('init', {androidId, appVersion, city, path, now});

  const existing = await getData(path);
  if (existing?.name) {
    const updatePayload = {
      appType: '1',
      readerAppVersion: appVersion,
      lastActive: now,
    };
    DEVICE_LOG('existing_device_found', {
      path,
      existingName: existing.name,
      updatePayload,
    });
    await updateData(path, {
      ...updatePayload,
    });
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.DEVICE_ID, androidId],
      [STORAGE_KEYS.DEVICE_NAME, existing.name],
    ]);
    DEVICE_LOG('local_storage_saved', {
      deviceId: androidId,
      deviceName: existing.name,
      isNewDevice: false,
    });
    return {
      deviceId: androidId,
      deviceName: existing.name,
      isNewDevice: false,
    };
  }

  const lastNoRaw = await getData('Devices/LastConfigurationNo');
  const lastNo = Number.parseInt(String(lastNoRaw || '0'), 10) || 0;
  const newNo = lastNo + 1;
  const suffix = String(newNo).padStart(2, '0');
  const deviceName = `${getCityPrefix(prefix)}-${suffix}`;
  const createPayload = {
    appType: '1',
    status: '1',
    readerAppVersion: appVersion,
    lastActive: now,
    name: deviceName,
  };
  DEVICE_LOG('new_device_creating', {
    path,
    lastConfigurationNo: lastNo,
    newConfigurationNo: newNo,
    deviceId: androidId,
    deviceName,
    payload: createPayload,
  });

  await saveData(path, createPayload);
  await saveData('Devices/LastConfigurationNo', String(newNo));
  DEVICE_LOG('firebase_saved', {
    devicePath: path,
    lastConfigPath: 'Devices/LastConfigurationNo',
    lastConfigValue: String(newNo),
  });

  await AsyncStorage.multiSet([
    [STORAGE_KEYS.DEVICE_ID, androidId],
    [STORAGE_KEYS.DEVICE_NAME, deviceName],
  ]);
  DEVICE_LOG('local_storage_saved', {
    deviceId: androidId,
    deviceName,
    isNewDevice: true,
  });

  return {
    deviceId: androidId,
    deviceName,
    isNewDevice: true,
  };
}

export {getOrCreateDeviceIdentity};

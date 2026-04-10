import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Image,
  Linking,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import Geolocation from '@react-native-community/geolocation';
import MapView, {AnimatedRegion, Marker, Polyline, PROVIDER_GOOGLE} from 'react-native-maps';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import appTheme from '../theme/appTheme';
import {ms, mvs, scale} from '../utils/responsive';
import {useLoader} from '../context/LoaderContext';
import {useToast} from '../context/ToastContext';
import {getWardLinesDynamic} from '../services/mapLineService';
import {
  getCacheCounts,
  loadActiveLineState,
  loadDailyScanCache,
  mergeWardLinesWithScanCache,
  purgeStaleDailyCaches,
  saveActiveLineState,
} from '../services/scanCacheService';

const DEFAULT_REGION = {
  latitude: 27.2152,
  longitude: 77.4892,
  latitudeDelta: 0.006,
  longitudeDelta: 0.006,
};

const WATCH_OPTIONS = {
  enableHighAccuracy: true,
  distanceFilter: 10,
  interval: 8000,
  fastestInterval: 5000,
  timeout: 20000,
  maximumAge: 1000,
};

const CURRENT_POSITION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 30000,
  maximumAge: 0,
};

const LAST_USER_LOCATION_KEY = 'reader_last_user_location';

const getLineEndBearing = (points = []) => {
  if (!Array.isArray(points) || points.length < 2) {
    return 0;
  }

  const from = points[points.length - 2];
  const to = points[points.length - 1];
  const lat1 = (Number(from.latitude) * Math.PI) / 180;
  const lat2 = (Number(to.latitude) * Math.PI) / 180;
  const dLon = ((Number(to.longitude) - Number(from.longitude)) * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;

  return (bearing + 360) % 360;
};

const MOCK = {
  deviceName: 'BTP-01',
  ward: 'Ward 12',
  vehicle: 'LEY-AT-1607',
  workerName: 'Ramesh Kumar',
  profileImage: null, // replace with real URL or require() path
  currentLine: 5,
  lineScanCount: 12,
  lineTotal: 26,
  wardScanCount: 104,
  wardTotal: 485,
  currentLineCoords: [
    {latitude: 27.2148, longitude: 77.488},
    {latitude: 27.2155, longitude: 77.4895},
    {latitude: 27.2162, longitude: 77.4905},
  ],
  currentLocation: null,
};

function InfoRow({icon, label, value}) {
  return (
    <View style={s.infoRow}>
      <View style={s.infoIconWrap}>
        <MaterialCommunityIcons
          name={icon}
          size={scale(15)}
          color={appTheme.colors.accentPrimary}
        />
      </View>
      <View style={s.infoTextWrap}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function MapScreen({route, navigation}) {
  const mapRef = useRef(null);
  const locationWatchIdRef = useRef(null);
  const userLocationRef = useRef(null);
  const isInitialLocationSettledRef = useRef(false);
  const locationIssueShownRef = useRef(false);
  const hasAnimatedToUserRef = useRef(false);
  const userAnimatedCoordinate = useRef(
    new AnimatedRegion({
      latitude: DEFAULT_REGION.latitude,
      longitude: DEFAULT_REGION.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
    }),
  ).current;
  const [currentLine, setCurrentLine] = useState(MOCK.currentLine);
  const [, setLineScanCount] = useState(MOCK.lineScanCount);
  const [infoVisible, setInfoVisible] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [wardLines, setWardLines] = useState([]);
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [cacheCounts, setCacheCounts] = useState({
    totalCount: 0,
    scannedCount: 0,
    byLine: {},
  });
  const {showLoader, hideLoader} = useLoader();
  const {showToast} = useToast();

  const payload = useMemo(() => {
    const params = route?.params ?? {};
    const helperId = params.assignData?.helperId || params.assignData?.empId || '';
    return {
      ward: params.assignData?.ward || MOCK.ward,
      deviceName: params.deviceData?.deviceName || MOCK.deviceName,
      workerName: params.assignData?.userName || MOCK.workerName,
      vehicle: params.assignData?.vehicle || MOCK.vehicle,
      profileImage: params.assignData?.profileImage || MOCK.profileImage,
      helperId,
    };
  }, [route?.params]);

  const currentLineData = wardLines[activeLineIndex] || null;
  const allWardHouses = useMemo(
    () =>
      wardLines.flatMap(line =>
        Array.isArray(line?.houses) ? line.houses : [],
      ),
    [wardLines],
  );
  const housesToRender = useMemo(
    () =>
      Array.isArray(currentLineData?.houses)
        ? currentLineData.houses.map(house => ({
            ...house,
            lineId: String(currentLineData.id || ''),
          }))
        : [],
    [currentLineData],
  );
  const isHouseScanned = house => {
    const scanBy = String(house?.scanBy || '').trim();
    const scanTime = String(house?.scanTime || '').trim();
    const lastScanTime = String(house?.lastScanTime || '').trim();
    const flag = String(house?.isScanned || '').trim().toLowerCase();
    return Boolean(
      (scanBy && scanBy !== '-1' && scanBy !== '0') ||
        scanTime ||
        lastScanTime ||
        ['yes', 'true', '1'].includes(flag),
    );
  };
  const lineCacheSummary = String(currentLineData?.id || '')
    ? cacheCounts.byLine?.[String(currentLineData.id || '')] || null
    : null;
  const lineScanCountValue = lineCacheSummary
    ? Number(lineCacheSummary.scannedCount || 0)
    : currentLineData?.houses?.filter(isHouseScanned).length || 0;
  const lineHouseTotal = currentLineData?.houses?.length || 0;
  const wardHouseTotal = allWardHouses.length;
  const wardScanCountValue = cacheCounts.scannedCount || allWardHouses.filter(isHouseScanned).length;
  const currentLinePoints = currentLineData?.points?.length
    ? currentLineData.points
    : MOCK.currentLineCoords;
  const endArrowRotation = useMemo(
    () => getLineEndBearing(currentLinePoints),
    [currentLinePoints],
  );
  const linePct = lineHouseTotal
    ? Math.round((lineScanCountValue / lineHouseTotal) * 100)
    : 0;
  const wardPct = wardHouseTotal
    ? Math.round((wardScanCountValue / wardHouseTotal) * 100)
    : 0;

  const onQrScan = () => {
    navigation.navigate('QRScanner', {
      wardNo: payload.ward || '',
      line: String(currentLine || ''),
      helperId: payload.helperId || '',
      latLng: userLocation
        ? `${userLocation.latitude},${userLocation.longitude}`
        : '',
    });
  };

  const onChangeLine = () => {
    if (!wardLines.length) {
      setCurrentLine(prev => prev + 1);
      setLineScanCount(0);
      return;
    }
    const nextIndex = (activeLineIndex + 1) % wardLines.length;
    setActiveLineIndex(nextIndex);
    const nextLine = wardLines[nextIndex];
    setCurrentLine(Number(nextLine?.id) || nextIndex + 1);
    saveActiveLineState({
      wardNo: payload.ward || '',
      lineId: String(nextLine?.id || ''),
      lineIndex: nextIndex,
    }).catch(error => {
      console.log('[MapScreen] save active line failed', {message: error?.message});
    });
    if (nextLine?.points?.[0]) {
      animateToLocation(nextLine.points[0]);
    }
    setLineScanCount(0);
  };

  const animateToLocation = useCallback(coords => {
    if (!coords) return;
    const region = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      latitudeDelta: 0.0045,
      longitudeDelta: 0.0045,
    };
    mapRef.current?.animateToRegion(region, 450);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const restoreLastUserLocation = async () => {
      try {
        const raw = await AsyncStorage.getItem(LAST_USER_LOCATION_KEY);
        if (!isMounted || !raw) return;

        const parsed = JSON.parse(raw);
        const latitude = Number(parsed?.latitude);
        const longitude = Number(parsed?.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return;
        }

        const restored = {latitude, longitude};
        userLocationRef.current = restored;
        setUserLocation(restored);
        userAnimatedCoordinate.setValue({
          latitude,
          longitude,
        });
        hasAnimatedToUserRef.current = true;
        animateToLocation(restored);
      } catch (_error) {
        // best effort restore only
      }
    };

    restoreLastUserLocation();

    return () => {
      isMounted = false;
    };
  }, [animateToLocation, userAnimatedCoordinate]);

  const onCenterLocation = () => {
    if (!userLocation) {
      showToast('warning', 'Current location अभी नहीं मिली। GPS/Location ON करें।');
      return;
    }
    animateToLocation(userLocation);
  };

  const onNavigateToLine = () => {
    const start = currentLinePoints?.[0] || MOCK.currentLineCoords[0];
    const {latitude, longitude} = start;
    const label = encodeURIComponent(`Line ${currentLine} Start`);
    const url =
      Platform.OS === 'ios'
        ? `maps://?daddr=${latitude},${longitude}&dirflg=d`
        : `google.navigation:q=${latitude},${longitude}&title=${label}`;
    Linking.openURL(url).catch(() => {
      const fallback = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
      Linking.openURL(fallback);
    });
  };

  const loadMapData = useCallback(async () => {
    const ward = String(payload.ward || '').trim();
    if (!ward) return;

    console.log('[MapScreen] loadWardLines start', {ward});
    showLoader('Loading map lines...');
    try {
      await purgeStaleDailyCaches();
      const [resp, cache] = await Promise.all([
        getWardLinesDynamic(ward),
        loadDailyScanCache({wardNo: ward}),
      ]);
      const activeLineState = await loadActiveLineState({wardNo: ward});

      console.log('[MapScreen] scan cache summary', {
        ward,
        source: cache?.source,
        recordsCount: cache?.records ? Object.keys(cache.records).length : 0,
        dateOnly: cache?.dateOnly,
      });
      setCacheCounts(getCacheCounts(cache));
      console.log('[MapScreen] active line state', activeLineState);

      console.log('[MapScreen] loadWardLines response', {
        ward,
        ok: resp?.ok,
        message: resp?.message,
        latestDate: resp?.latestDate,
        fromCache: resp?.fromCache,
        linesCount: Array.isArray(resp?.data) ? resp.data.length : 0,
      });

      if (!resp?.ok || !Array.isArray(resp.data) || resp.data.length === 0) {
        showToast('warning', 'Ward line JSON नहीं मिला, default line दिख रही है।');
        return;
      }

      const mergedLines = mergeWardLinesWithScanCache(resp.data, cache);
      setWardLines(mergedLines);
      const resolvedIndex = mergedLines.findIndex(
        line => String(line?.id || '') === String(activeLineState?.lineId || ''),
      );
      const activeIndex =
        resolvedIndex >= 0 ? resolvedIndex : Number(activeLineState?.lineIndex) || 0;
      const safeActiveIndex =
        activeIndex >= 0 && activeIndex < mergedLines.length ? activeIndex : 0;
      setActiveLineIndex(safeActiveIndex);
      const first = mergedLines[safeActiveIndex] || mergedLines[0];
      console.log('[MapScreen] ward lines applied', {
        firstLineId: first?.id,
        housesCount: first?.houses?.length || 0,
        pointsCount: first?.points?.length || 0,
      });
      setCurrentLine(Number(first?.id) || 1);
      if (first?.id) {
        saveActiveLineState({
          wardNo: ward,
          lineId: String(first.id || ''),
          lineIndex: safeActiveIndex,
        }).catch(error => {
          console.log('[MapScreen] persist active line after load failed', {
            message: error?.message,
          });
        });
      }
      if (userLocationRef.current) {
        animateToLocation(userLocationRef.current);
      } else if (first?.points?.[0]) {
        animateToLocation(first.points[0]);
      }
    } catch (error) {
      console.log('[MapScreen] loadWardLines error', {ward, message: error?.message});
      showToast('error', 'Line data load नहीं हो सका।');
    } finally {
      hideLoader();
    }
  }, [
    animateToLocation,
    hideLoader,
    payload.ward,
    showLoader,
    showToast,
  ]);

  const updateLocation = useCallback(coords => {
    // ALWAYS hide the loader on the first response to prevent screen frozen/deadlock
    if (!isInitialLocationSettledRef.current) {
      isInitialLocationSettledRef.current = true;
      setIsLocating(false);
      hideLoader();
      locationIssueShownRef.current = false;
    }

    // Now securely filter out inaccurate locations without blocking the UI
    if (coords?.accuracy && coords.accuracy > 50) return;
    if (coords?.latitude == null || coords?.longitude == null) return;
    
    const next = {
      latitude: Number(coords.latitude),
      longitude: Number(coords.longitude),
    };
    userLocationRef.current = next;
    setUserLocation(next);
    AsyncStorage.setItem(LAST_USER_LOCATION_KEY, JSON.stringify(next)).catch(() => {});
    if (!hasAnimatedToUserRef.current) {
      userAnimatedCoordinate.setValue({
        latitude: next.latitude,
        longitude: next.longitude,
      });
      hasAnimatedToUserRef.current = true;
    } else {
      userAnimatedCoordinate.timing({
        latitude: next.latitude,
        longitude: next.longitude,
        duration: 800,
        useNativeDriver: false,
      }).start();
    }
  }, [hideLoader, userAnimatedCoordinate]);

  useEffect(() => {
    Geolocation.setRNConfiguration({
      skipPermissionRequests: true,
      authorizationLevel: 'whenInUse',
    });

    const stopTracking = () => {
      if (locationWatchIdRef.current != null) {
        Geolocation.clearWatch(locationWatchIdRef.current);
        locationWatchIdRef.current = null;
      }
      Geolocation.stopObserving();
    };

    const requestLocationPermission = async () => {
      if (Platform.OS !== 'android') return true;
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'Map पर current location दिखाने के लिए location अनुमति दें।',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    };

    const initTracking = async () => {
      try {
        const hasPermission = await requestLocationPermission();
        if (!hasPermission) {
          setIsLocating(false);
          hideLoader();
          if (!locationIssueShownRef.current) {
            locationIssueShownRef.current = true;
            showToast('warning', 'Location permission allow करें।');
          }
          return;
        }

        setIsLocating(true);
        showLoader('Fetching location...');

        Geolocation.getCurrentPosition(
          position => {
            updateLocation(position.coords);
            animateToLocation(position.coords);
          },
          error => {
            if (isInitialLocationSettledRef.current || userLocationRef.current) {
              return;
            }

            let message = 'GPS signal नहीं मिला। कृपया खुले स्थान में जाकर दोबारा कोशिश करें।';
            if (error?.code === 1) {
              message = 'Location permission allow करें।';
            } else if (error?.code === 3) {
              message = 'GPS signal नहीं मिला (timeout)। कृपया खुले स्थान में रहें।';
            } else if (error?.code === 2) {
              message = 'GPS signal नहीं मिला। थोड़ी देर बाद फिर कोशिश करें।';
            }

            setIsLocating(false);
            hideLoader();
            if (!locationIssueShownRef.current) {
              locationIssueShownRef.current = true;
              showToast('warning', message);
            }
          },
          CURRENT_POSITION_OPTIONS,
        );

        const watchId = Geolocation.watchPosition(
          position => {
            updateLocation(position.coords);
          },
          error => {
            if (isInitialLocationSettledRef.current || userLocationRef.current) {
              return;
            }
            if (!locationIssueShownRef.current) {
              locationIssueShownRef.current = true;
              if (error?.code === 1) {
                showToast('warning', 'Location permission allow करें।');
              } else {
                showToast('warning', 'GPS signal नहीं मिला। Live location update रुक गई है।');
              }
            }
          },
          WATCH_OPTIONS,
        );
        locationWatchIdRef.current = watchId;
      } catch {
        setIsLocating(false);
        hideLoader();
        if (!locationIssueShownRef.current) {
          locationIssueShownRef.current = true;
          showToast('warning', 'GPS signal नहीं मिला। कृपया location on करके retry करें।');
        }
      }
    };

    initTracking();

    return () => {
      stopTracking();
      hideLoader();
      locationIssueShownRef.current = false;
    };
  }, [animateToLocation, hideLoader, showLoader, showToast, updateLocation]);

  useFocusEffect(
    useCallback(() => {
      loadMapData();
      return undefined;
    }, [loadMapData]),
  );

  return (
    <SafeAreaView style={s.root}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={appTheme.colors.safeAreaBackground}
      />

      {/* ── Top Panel ── */}
      <View style={s.topPanel}>
        <View style={s.topLeft}>
          <Text style={s.title}>{payload.ward}</Text>
          <Text style={s.subTitle}>
            {isLocating ? 'Location syncing...' : 'Live location active'}
          </Text>
        </View>
        <Pressable style={s.infoBtn} onPress={() => setInfoVisible(true)}>
          <MaterialCommunityIcons
            name="information-outline"
            size={scale(18)}
            color={appTheme.colors.accentPrimary}
          />
        </Pressable>
      </View>

      {/* ── Stats Row ── */}
      <View style={s.statsRow}>
        {/* Line card */}
        <View style={s.statCard}>
          <View style={s.statHeader}>
            <MaterialCommunityIcons
              name="map-marker-path"
              size={scale(13)}
              color={appTheme.colors.accentPrimary}
            />
            <Text style={s.statLabel}>Line {currentLine}</Text>
            <Text style={[s.statPct, {color: appTheme.colors.accentPrimary}]}>
              {linePct}%
            </Text>
          </View>
          <View style={s.progressBg}>
            <View
              style={[
                s.progressFill,
                {
                  width: `${linePct}%`,
                  backgroundColor: appTheme.colors.accentPrimary,
                },
              ]}
            />
          </View>
          <Text style={s.statCount}>
            {lineScanCountValue} / {lineHouseTotal} scanned
          </Text>
        </View>

        {/* Ward card */}
        <View style={s.statCard}>
          <View style={s.statHeader}>
            <MaterialCommunityIcons
              name="city-variant-outline"
              size={scale(13)}
              color="#7B61FF"
            />
            <Text style={s.statLabel}>Ward</Text>
            <Text style={[s.statPct, {color: '#7B61FF'}]}>{wardPct}%</Text>
          </View>
          <View style={[s.progressBg, {backgroundColor: '#EDE7FF'}]}>
            <View
              style={[
                s.progressFill,
                {width: `${wardPct}%`, backgroundColor: '#7B61FF'},
              ]}
            />
          </View>
          <Text style={s.statCount}>
            {wardScanCountValue} / {wardHouseTotal} scanned
          </Text>
        </View>
      </View>

      {/* ── Map + FABs wrapper ── */}
      {/*
        FABs MUST be siblings of mapWrap (not children) because mapWrap
        has overflow:hidden for rounded corners — that clips absolute children.
      */}
      <View style={s.mapContainer}>
        <View style={s.mapWrap}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={s.map}
            initialRegion={{
              ...DEFAULT_REGION,
              latitude:
                userLocation?.latitude ||
                currentLinePoints?.[0]?.latitude ||
                DEFAULT_REGION.latitude,
              longitude:
                userLocation?.longitude ||
                currentLinePoints?.[0]?.longitude ||
                DEFAULT_REGION.longitude,
            }}
            toolbarEnabled={false}
            showsMyLocationButton={false}
            showsUserLocation={false}
            mapType="standard">
            <Polyline
              key={`poly-line-${currentLine}`}
              coordinates={currentLinePoints}
              strokeColor={appTheme.colors.accentPrimary}
              strokeWidth={4}
              zIndex={10}
              geodesic={false}
              lineCap="round"
              lineJoin="round"
            />
            {currentLinePoints?.length ? (
              <Marker
                key={`start-marker-${currentLine}`}
                coordinate={currentLinePoints[0]}
                anchor={{x: 0.5, y: 0.5}}
                zIndex={20}
                tracksViewChanges={false}>
                <View style={s.startDot} />
              </Marker>
            ) : null}
            {currentLinePoints?.length ? (
              <Marker
                key={`line-end-arrow-${currentLine?.id || currentLine}-${endArrowRotation}`}
                coordinate={currentLinePoints[currentLinePoints.length - 1]}
                anchor={{x: 0.5, y: 0.5}}
                zIndex={20}
                flat
                rotation={endArrowRotation}
                tracksViewChanges={true}>
                <View style={s.lineEndArrowShape} />
              </Marker>
            ) : null}
            {userLocation ? (
              <Marker.Animated
                key="user-marker"
                coordinate={userAnimatedCoordinate}
                anchor={{x: 0.5, y: 0.5}}
                zIndex={30}
                tracksViewChanges={true}
              >
                <Image
                  source={require('../Assets/Images/person.png')}
                  style={s.userMarkerImage}
                  resizeMode="contain"
                  fadeDuration={0}
                />
              </Marker.Animated>
            ) : null}
            {housesToRender.map((house, index) => (
              <Marker
                key={`${house.lineId}_${house.cardNumber || house.uid || index}`}
                coordinate={{
                  latitude: Number(house.latitude),
                  longitude: Number(house.longitude),
                }}
                // Keep tracking on so the custom bitmap renders correctly on first load.
                tracksViewChanges={true}
                anchor={{x: 0.5, y: 0.5}}
                title={house.cardNumber || 'House'}
                description={`Line ${house.lineId || house.line || '-'}`}
              >
                <Image
                  source={
                    isHouseScanned(house)
                      ? require('../Assets/Images/scanned.png')
                      : require('../Assets/Images/Notscanned.png')
                  }
                  style={s.houseMarkerImage}
                  resizeMode="contain"
                  fadeDuration={0}
                />
              </Marker>
            ))}
          </MapView>
        </View>

        {/* FABs — sibling of mapWrap, not clipped */}
        <View style={s.fabStack}>
          {/* Route */}
          <Pressable
            style={({pressed}) => [s.fab, s.routeFab, pressed && s.fabPressed]}
            onPress={onNavigateToLine}
            android_ripple={{color: appTheme.colors.accentSoft, borderless: false}}>
            <FontAwesome5
              name="route"
              size={scale(17)}
              color={appTheme.colors.accentPrimary}
            />
          </Pressable>

          {/* Current location */}
          <Pressable
            style={({pressed}) => [s.fab, pressed && s.fabPressed]}
            onPress={onCenterLocation}
            android_ripple={{color: appTheme.colors.accentSoft, borderless: false}}>
            <MaterialCommunityIcons
              name="crosshairs-gps"
              size={scale(18)}
              color={appTheme.colors.accentPrimary}
            />
          </Pressable>
        </View>
      </View>

      {/* ── Control Panel ── */}
      <View style={s.controlPanel}>
        <View style={s.actionRow}>
          <Pressable style={s.secondaryBtn} onPress={onChangeLine}>
            <MaterialCommunityIcons
              name="swap-horizontal"
              size={scale(16)}
              color={appTheme.colors.accentPrimary}
            />
            <Text style={s.secondaryBtnText}>Next Line</Text>
          </Pressable>
          <Pressable style={s.primaryBtn} onPress={onQrScan}>
            <MaterialCommunityIcons
              name="qrcode-scan"
              size={scale(20)}
              color="#FFFFFF"
            />
            <Text style={s.primaryBtnText}>QR Scan</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Info Modal ── */}
      <Modal
        visible={infoVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setInfoVisible(false)}>
        <Pressable
          style={s.modalOverlay}
          onPress={() => setInfoVisible(false)}>
          <Pressable style={s.infoCard} onPress={() => {}}>
            {/* Header */}
            <View style={s.infoCardHeader}>
              <View style={s.infoCardTitleRow}>
                <MaterialCommunityIcons
                  name="badge-account-outline"
                  size={scale(18)}
                  color={appTheme.colors.accentPrimary}
                />
                <Text style={s.infoCardTitle}>Worker Details</Text>
              </View>
              <Pressable
                style={s.closeBtn}
                onPress={() => setInfoVisible(false)}>
                <MaterialCommunityIcons
                  name="close"
                  size={scale(16)}
                  color={appTheme.colors.textSecondary}
                />
              </Pressable>
            </View>

            {/* Profile */}
            <View style={s.profileSection}>
              {payload.profileImage ? (
                <Image
                  source={{uri: payload.profileImage}}
                  style={s.profileImg}
                />
              ) : (
                <View style={s.profileAvatar}>
                  <Text style={s.profileInitials}>
                    {payload.workerName
                      .split(' ')
                      .slice(0, 2)
                      .map(w => w[0])
                      .join('')
                      .toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={s.profileName}>{payload.workerName}</Text>
              <Text style={s.profileRole}>{payload.ward}</Text>
            </View>

            <View style={s.infoDivider} />

            <InfoRow
              icon="tablet-android"
              label="Device ID"
              value={payload.deviceName}
            />
            <InfoRow
              icon="truck-outline"
              label="Vehicle Number"
              value={payload.vehicle}
            />
            <InfoRow
              icon="map-marker-radius-outline"
              label="Assigned Ward"
              value={payload.ward}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: {flex: 1, backgroundColor: appTheme.colors.safeAreaBackground},

  // ── Top panel ──
  topPanel: {
    marginHorizontal: scale(12),
    marginTop: mvs(8),
    paddingHorizontal: scale(14),
    paddingVertical: mvs(10),
    backgroundColor: appTheme.colors.surfacePrimary,
    borderRadius: scale(14),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: appTheme.colors.surfaceBorder,
  },
  topLeft: {flex: 1},
  title: {
    fontSize: ms(15),
    fontWeight: '800',
    color: appTheme.colors.textPrimary,
  },
  subTitle: {
    fontSize: ms(11),
    color: appTheme.colors.textSecondary,
    marginTop: mvs(2),
  },
  infoBtn: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appTheme.colors.chipBg,
    borderWidth: 1,
    borderColor: appTheme.colors.chipBorder,
    marginLeft: scale(10),
  },

  // ── Stats ──
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: scale(12),
    marginTop: mvs(8),
    gap: scale(8),
  },
  statCard: {
    flex: 1,
    backgroundColor: appTheme.colors.surfacePrimary,
    borderRadius: scale(12),
    paddingHorizontal: scale(12),
    paddingVertical: mvs(9),
    borderWidth: 1,
    borderColor: appTheme.colors.surfaceBorder,
    gap: mvs(5),
  },
  statHeader: {flexDirection: 'row', alignItems: 'center', gap: scale(5)},
  statLabel: {
    flex: 1,
    fontSize: ms(11),
    fontWeight: '600',
    color: appTheme.colors.textSecondary,
  },
  statPct: {fontSize: ms(12), fontWeight: '800'},
  progressBg: {
    height: mvs(4),
    backgroundColor: appTheme.colors.backgroundSecondary,
    borderRadius: scale(4),
    overflow: 'hidden',
  },
  progressFill: {height: '100%', borderRadius: scale(4)},
  statCount: {fontSize: ms(10), color: appTheme.colors.textMuted},

  // ── Map container (flex wrapper so FABs aren't clipped) ──
  mapContainer: {
    flex: 1,
    marginTop: mvs(8),
    marginHorizontal: scale(12),
  },
  mapWrap: {
    flex: 1,
    borderWidth: 1,
    borderColor: appTheme.colors.surfaceBorder,
    borderRadius: scale(12),
    overflow: 'hidden', // rounds map corners — FABs must live outside this
  },
  map: {flex: 1},

  // ── FABs — absolutely positioned inside mapContainer, NOT inside mapWrap ──
  fabStack: {
    position: 'absolute',
    bottom: mvs(14),
    right: scale(12),
    gap: mvs(8),
    alignItems: 'flex-end',
  },
  fab: {
    width: scale(42),
    height: scale(42),
    borderRadius: scale(10),
    backgroundColor: appTheme.colors.surfacePrimary,
    borderWidth: 1,
    borderColor: appTheme.colors.chipBorder,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: appTheme.colors.shadowColor,
    shadowOffset: {width: 0, height: mvs(2)},
    shadowOpacity: 0.22,
    shadowRadius: scale(6),
  },
  routeFab: {
    backgroundColor: appTheme.colors.surfacePrimary,
    borderColor: appTheme.colors.chipBorder,
  },
  fabPressed: {
    backgroundColor: appTheme.colors.accentSoft,
    borderColor: appTheme.colors.accentPrimary,
  },

  // ── Control panel ──
  controlPanel: {
    marginHorizontal: scale(12),
    marginTop: mvs(8),
    marginBottom: mvs(10),
    paddingHorizontal: scale(12),
    paddingVertical: mvs(12),
    backgroundColor: appTheme.colors.surfacePrimary,
    borderRadius: scale(14),
    borderWidth: 1,
    borderColor: appTheme.colors.surfaceBorder,
  },
  actionRow: {flexDirection: 'row', gap: scale(8)},
  secondaryBtn: {
    flex: 1,
    height: mvs(46),
    borderRadius: scale(12),
    borderWidth: 1.5,
    borderColor: appTheme.colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: scale(6),
  },
  secondaryBtnText: {
    fontSize: ms(12),
    fontWeight: '700',
    color: appTheme.colors.accentPrimary,
  },
  primaryBtn: {
    flex: 1.3,
    height: mvs(46),
    borderRadius: scale(12),
    backgroundColor: appTheme.colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: scale(6),
    elevation: 3,
    shadowColor: appTheme.colors.accentPrimary,
    shadowOffset: {width: 0, height: mvs(2)},
    shadowOpacity: 0.3,
    shadowRadius: scale(6),
  },
  primaryBtnText: {
    fontSize: ms(13),
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // ── Info Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(13,50,93,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(24),
  },
  infoCard: {
    width: '100%',
    backgroundColor: appTheme.colors.surfacePrimary,
    borderRadius: scale(18),
    paddingHorizontal: scale(18),
    paddingVertical: mvs(16),
    elevation: 10,
    shadowColor: appTheme.colors.shadowColor,
    shadowOffset: {width: 0, height: mvs(4)},
    shadowOpacity: 0.2,
    shadowRadius: scale(12),
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: mvs(10),
  },
  infoCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(7),
  },
  infoCardTitle: {
    fontSize: ms(14),
    fontWeight: '800',
    color: appTheme.colors.textPrimary,
  },
  closeBtn: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    backgroundColor: appTheme.colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: mvs(14),
    gap: mvs(4),
  },
  profileImg: {
    width: scale(72),
    height: scale(72),
    borderRadius: scale(36),
    borderWidth: 2.5,
    borderColor: appTheme.colors.chipBorder,
    marginBottom: mvs(6),
  },
  profileAvatar: {
    width: scale(72),
    height: scale(72),
    borderRadius: scale(36),
    backgroundColor: appTheme.colors.accentSoft,
    borderWidth: 2.5,
    borderColor: appTheme.colors.chipBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: mvs(6),
  },
  profileInitials: {
    fontSize: ms(24),
    fontWeight: '800',
    color: appTheme.colors.accentPrimary,
    letterSpacing: 1,
  },
  profileName: {
    fontSize: ms(15),
    fontWeight: '800',
    color: appTheme.colors.textPrimary,
  },
  profileRole: {
    fontSize: ms(11),
    color: appTheme.colors.textSecondary,
    fontWeight: '500',
  },
  infoDivider: {
    height: 1,
    backgroundColor: appTheme.colors.surfaceBorder,
    marginBottom: mvs(12),
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    paddingVertical: mvs(8),
    borderBottomWidth: 1,
    borderBottomColor: appTheme.colors.backgroundSecondary,
  },
  infoIconWrap: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(8),
    backgroundColor: appTheme.colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextWrap: {flex: 1},
  infoLabel: {
    fontSize: ms(10),
    color: appTheme.colors.textMuted,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: ms(12),
    fontWeight: '700',
    color: appTheme.colors.textPrimary,
    marginTop: mvs(1),
  },

  // ── Map markers ──
  locOuter: {
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    backgroundColor: 'rgba(15,112,194,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: appTheme.colors.accentPrimary,
  },
  locInner: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
    backgroundColor: appTheme.colors.accentPrimary,
  },
  startDot: {
    width: scale(12),
    height: scale(12),
    borderRadius: scale(6),
    backgroundColor: '#2E7D32',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  houseMarkerImage: {
    width: scale(18),
    height: scale(18),
  },
  userMarkerImage: {
    width: scale(50),
    height: scale(50),
  },
  lineEndArrowShape: {
    width: 0,
    height: 0,
    borderLeftWidth: scale(8),
    borderRightWidth: scale(8),
    borderBottomWidth: scale(14),
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FF6A00',
  },
});

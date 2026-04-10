import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Dimensions,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {scale, mvs, ms} from '../utils/responsive';
import appTheme from '../theme/appTheme';
import {CITY} from '../Firebase/firebaseConfig';
import {useToast} from '../context/ToastContext';
import {findHouseInWardLines, getWardLinesDynamic} from '../services/mapLineService';
import {isCardAlreadyScanned, loadDailyScanCache} from '../services/scanCacheService';

const SCAN_COOLDOWN = 2000;

const escapeRegex = value => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function extractCardNumber(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;

  const cityKey = String(CITY?.key || '').trim();
  if (cityKey) {
    const cityMatch = value.match(
      new RegExp(`(?:^|[\\/])${escapeRegex(cityKey)}[\\/](?<card>[A-Za-z0-9]+)$`, 'i'),
    );
    if (cityMatch?.groups?.card) {
      return cityMatch.groups.card.toUpperCase();
    }
  }

  const parts = value.split(/[\\/]+/).filter(Boolean);
  const lastPart = parts[parts.length - 1] || '';
  if (/^[A-Za-z0-9]+$/.test(lastPart)) {
    return lastPart.toUpperCase();
  }

  return null;
}

export default function MapQrScannerModal({
  visible,
  wardNo = '',
  line = '',
  helperId = '',
  latLng = '',
  onClose,
  onSuccess,
}) {
  const insets = useSafeAreaInsets();
  const {hasPermission, requestPermission} = useCameraPermission();
  const device = useCameraDevice('back');
  const scanLock = useRef(false);
  const lineAnim = useRef(new Animated.Value(0)).current;
  const dotAnim = useRef(new Animated.Value(1)).current;
  const [permRequested, setPermRequested] = useState(false);
  const [torch, setTorch] = useState(false);
  const {showToast} = useToast();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      scanLock.current = false;
      setTorch(false);
      setPermRequested(false);
      return;
    }

    if (!hasPermission && !permRequested) {
      requestPermission().then(() => setPermRequested(true));
    }
  }, [hasPermission, permRequested, requestPermission, visible]);

  // ── Scan line animation ──
  useEffect(() => {
    if (visible && hasPermission && device) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(lineAnim, {toValue: 1, duration: 1800, useNativeDriver: true}),
          Animated.timing(lineAnim, {toValue: 0, duration: 1800, useNativeDriver: true}),
        ]),
      ).start();
    } else {
      lineAnim.setValue(0);
    }
  }, [lineAnim, visible, hasPermission, device]);

  // ── Pulsing dot animation ──
  useEffect(() => {
    if (visible && hasPermission && device) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dotAnim, {toValue: 0.25, duration: 650, useNativeDriver: true}),
          Animated.timing(dotAnim, {toValue: 1, duration: 650, useNativeDriver: true}),
        ]),
      ).start();
    } else {
      dotAnim.setValue(1);
    }
  }, [dotAnim, visible, hasPermission, device]);

  const closeModal = useCallback(() => {
    scanLock.current = false;
    setTorch(false);
    onClose?.();
  }, [onClose]);

  const handleValidated = useCallback(
    payload => {
      closeModal();
      onSuccess?.(payload);
    },
    [closeModal, onSuccess],
  );

  const onCodeScanned = useCallback(
    async codes => {
      if (scanLock.current || !codes.length) return;
      const raw = codes[0].value;
      const cardNumber = extractCardNumber(raw);
      if (!cardNumber) {
        showToast('warning', 'Card Scan Again');
        return;
      }

      scanLock.current = true;
      try {
        if (!wardNo) {
          showToast('error', 'Setup failed: Ward information missing.');
          return;
        }

        const wardResp = await getWardLinesDynamic(wardNo);
        if (!wardResp?.ok || !Array.isArray(wardResp.data) || wardResp.data.length === 0) {
          showToast('warning', 'Ward JSON load नहीं हो सका. Please try again.');
          return;
        }

        const match = findHouseInWardLines(wardResp.data, cardNumber);
        if (!match.found) {
          showToast('warning', `Card Not Found: ${cardNumber}`);
          return;
        }

        const dailyCache = await loadDailyScanCache({wardNo});
        if (
          isCardAlreadyScanned(
            dailyCache,
            match.matchedHouse?.cardNumber || cardNumber,
            match.matchedHouse?.uid || '',
          )
        ) {
          showToast('warning', 'यह कार्ड पहले ही स्कैन हो चुका है।');
          return;
        }

        if (line && match.matchedLine && String(line) !== String(match.matchedLine)) {
          showToast('warning', `Card Not Found: line ${match.matchedLine} का card है.`);
          return;
        }

        handleValidated({
          cardNumber,
          wardNo,
          line,
          helperId,
          latLng,
        });
      } catch (error) {
        showToast('error', error?.message || 'Unable to validate card');
      } finally {
        setTimeout(() => {
          scanLock.current = false;
        }, SCAN_COOLDOWN);
      }
    },
    [handleValidated, helperId, latLng, line, showToast, wardNo],
  );

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned,
  });

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {toValue: 1, duration: 250, useNativeDriver: true}).start();
      const handleBack = () => {
        closeModal();
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', handleBack);
      return () => subscription.remove();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, fadeAnim, closeModal]);

  if (!visible) {
    return null;
  }

  let modalContent = null;

  if (!hasPermission) {
    modalContent = (
      <View style={s.permContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#080F18" />
        <View style={s.permIconCircle}>
          <MaterialCommunityIcons
            name="camera-lock-outline"
            size={scale(48)}
            color="#fff"
          />
        </View>
        <Text style={s.permTitle}>Camera Permission Required</Text>
        <Text style={s.permSub}>
          Allow camera access to scan QR codes for waste entry
        </Text>
        <Pressable
          style={({pressed}) => [s.permBtn, pressed && {opacity: 0.85}]}
          onPress={() => requestPermission()}>
          {permRequested ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons
                name="camera-outline"
                size={scale(16)}
                color="#fff"
              />
              <Text style={s.permBtnText}>Grant Permission</Text>
            </>
          )}
        </Pressable>
        <Pressable style={s.permBack} onPress={closeModal}>
          <Text style={s.permBackText}>Go Back</Text>
        </Pressable>
      </View>
    );
  } else if (!device) {
    modalContent = (
      <View style={s.permContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#080F18" />
        <View style={s.permIconCircle}>
          <MaterialCommunityIcons
            name="camera-off-outline"
            size={scale(48)}
            color="#fff"
          />
        </View>
        <Text style={s.permTitle}>Camera Not Available</Text>
        <Text style={s.permSub}>No camera was found on this device</Text>
        <Pressable style={s.permBack} onPress={closeModal}>
          <Text style={s.permBackText}>Go Back</Text>
        </Pressable>
      </View>
    );
  } else {
    const scanLineY = lineAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, scale(VF - 4)],
    });

    modalContent = (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor="#000" translucent />

        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={visible}
          codeScanner={codeScanner}
          torch={torch ? 'on' : 'off'}
        />

        {/* ── Dark overlay with transparent cutout ── */}
        <View style={s.overlay}>
          {/* Top dark band */}
          <View style={s.overlayTop} />

          {/* Middle row: dark | viewfinder | dark */}
          <View style={s.middleRow}>
            <View style={s.overlaySide} />

            {/* Viewfinder box */}
            <View style={s.viewfinder}>
              {/* Corner marks */}
              <View style={[s.corner, s.cornerTL]} />
              <View style={[s.corner, s.cornerTR]} />
              <View style={[s.corner, s.cornerBL]} />
              <View style={[s.corner, s.cornerBR]} />
              {/* Scan line */}
              <Animated.View
                style={[s.scanLine, {transform: [{translateY: scanLineY}]}]}
              />
            </View>

            <View style={s.overlaySide} />
          </View>

          {/* Bottom dark band */}
          <View style={s.overlayBottom}>
            {/* Scanning status pill */}
            <View style={s.scanPill}>
              <Animated.View style={[s.scanDot, {opacity: dotAnim}]} />
              <Text style={s.scanPillText}>Scanning for QR code…</Text>
            </View>
            <Text style={s.hint}>Position the QR code within the frame</Text>
          </View>
        </View>

        {/* ── Back button (top-left) ── */}
        <Pressable
          style={({pressed}) => [
            s.iconBtn,
            {top: insets.top + mvs(12)},
            s.backBtn,
            pressed && s.iconBtnPressed,
          ]}
          onPress={closeModal}>
          <MaterialCommunityIcons name="arrow-left" size={scale(20)} color="#fff" />
        </Pressable>

        {/* ── Title ── */}
        <View style={[s.titleWrap, {top: insets.top + mvs(14)}]}>
          <Text style={s.title}>Scan QR Code</Text>
        </View>

        {/* ── Torch button (top-right) ── */}
        <Pressable
          style={({pressed}) => [
            s.iconBtn,
            {top: insets.top + mvs(12)},
            s.torchBtn,
            torch && s.torchActive,
            pressed && s.iconBtnPressed,
          ]}
          onPress={() => setTorch(v => !v)}>
          <MaterialCommunityIcons
            name={torch ? 'flashlight' : 'flashlight-off'}
            size={scale(20)}
            color={torch ? '#FFD600' : '#fff'}
          />
        </Pressable>
      </View>
    );
  }

  return (
    <Animated.View style={[StyleSheet.absoluteFill, {zIndex: 999, elevation: 99, opacity: fadeAnim}]}>
      {modalContent}
    </Animated.View>
  );
}

const VF = scale(260);
const CORNER = scale(26);
const CORNER_T = 3.5;

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('screen');

const s = StyleSheet.create({
  root: {
    height: SCREEN_HEIGHT,
    width: SCREEN_WIDTH,
    backgroundColor: '#000',
  },

  // ── Overlay ──
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: 'transparent',
  },
  overlayTop: {
    backgroundColor: 'rgba(0,0,0,0.68)',
    height: scale(160),
  },
  middleRow: {flexDirection: 'row'},
  overlaySide: {flex: 1, backgroundColor: 'rgba(0,0,0,0.68)'},
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    alignItems: 'center',
    paddingTop: mvs(22),
    gap: mvs(10),
  },

  // ── Viewfinder ──
  viewfinder: {
    width: VF,
    height: VF,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: '#fff',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_T,
    borderLeftWidth: CORNER_T,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_T,
    borderRightWidth: CORNER_T,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_T,
    borderLeftWidth: CORNER_T,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_T,
    borderRightWidth: CORNER_T,
    borderBottomRightRadius: 4,
  },
  scanLine: {
    position: 'absolute',
    left: 6,
    right: 6,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: appTheme.colors.accentPrimary,
    shadowColor: appTheme.colors.accentPrimary,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
  },

  // ── Scanning status pill ──
  scanPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: scale(16),
    paddingVertical: mvs(9),
    borderRadius: scale(24),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  scanDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
    backgroundColor: appTheme.colors.accentSecondary,
  },
  scanPillText: {
    color: '#fff',
    fontSize: ms(12),
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // ── Hint ──
  hint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: ms(11),
    textAlign: 'center',
    letterSpacing: 0.3,
  },

  // ── Icon buttons (back / torch) ──
  iconBtn: {
    position: 'absolute',
    top: mvs(52),
    width: scale(42),
    height: scale(42),
    borderRadius: scale(21),
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  iconBtnPressed: {backgroundColor: 'rgba(0,0,0,0.72)'},
  backBtn: {left: scale(16)},
  torchBtn: {right: scale(16)},
  torchActive: {
    backgroundColor: 'rgba(255,214,0,0.14)',
    borderColor: 'rgba(255,214,0,0.4)',
  },

  // ── Title ──
  titleWrap: {
    position: 'absolute',
    top: mvs(54),
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: ms(16),
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // ── Permission / no-device screen ──
  permContainer: {
    flex: 1,
    backgroundColor: '#080F18',
    alignItems: 'center',
    justifyContent: 'center',
    gap: mvs(12),
    paddingHorizontal: scale(36),
  },
  permIconCircle: {
    width: scale(96),
    height: scale(96),
    borderRadius: scale(48),
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: mvs(4),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  permTitle: {
    color: '#fff',
    fontSize: ms(17),
    fontWeight: '800',
    textAlign: 'center',
  },
  permSub: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: ms(12),
    textAlign: 'center',
    lineHeight: mvs(19),
  },
  permBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginTop: mvs(16),
    paddingHorizontal: scale(28),
    paddingVertical: mvs(13),
    backgroundColor: appTheme.colors.accentPrimary,
    borderRadius: scale(14),
  },
  permBtnText: {color: '#fff', fontWeight: '800', fontSize: ms(13)},
  permBack: {marginTop: mvs(2)},
  permBackText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: ms(12),
    textDecorationLine: 'underline',
  },
});

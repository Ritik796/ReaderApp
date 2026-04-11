import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Animated,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
import {
  isCardAlreadyScanned,
  loadDailyScanCache,
} from '../services/scanCacheService';

const escapeRegex = value =>
  String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function extractCardNumber(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;

  const cityKey = String(CITY?.key || '').trim();
  const urlMatch = value.match(/https?:\/\/[^\s]+/i);
  if (urlMatch?.[0]) {
    const url = urlMatch[0].replace(/[),.;]+$/, '');
    const urlParts = url.split('/').filter(Boolean);
    const urlCard = urlParts[urlParts.length - 1] || '';
    if (/^[A-Za-z0-9]+$/.test(urlCard)) {
      return urlCard.toUpperCase();
    }
  }

  if (cityKey) {
    const cityMatch = value.match(
      new RegExp(`(?:^|[\\/])${escapeRegex(cityKey)}[\\/](?<card>[A-Za-z0-9]+)$`, 'i'),
    );
    if (cityMatch?.groups?.card) {
      return cityMatch.groups.card.toUpperCase();
    }
  }

  const tokens = value.match(/[A-Za-z0-9]+/g) || [];
  const digitToken = [...tokens].reverse().find(token => /\d/.test(token));
  if (digitToken) {
    return digitToken.toUpperCase();
  }

  const lastToken = tokens[tokens.length - 1] || '';
  if (/^[A-Za-z0-9]+$/.test(lastToken)) {
    return lastToken.toUpperCase();
  }

  return null;
}

export default function QRScannerScreen({navigation, route}) {
  const {hasPermission, requestPermission} = useCameraPermission();
  const device = useCameraDevice('back');
  const lineAnim = useRef(new Animated.Value(0)).current;
  const dotAnim = useRef(new Animated.Value(1)).current;
  const [permRequested, setPermRequested] = useState(false);
  const [torch, setTorch] = useState(false);
  const {showToast} = useToast();
  const {
    wardNo = '',
    line = '',
    helperId = '',
    latLng = '',
  } = route?.params ?? {};

  // ── Ask permission on mount ──
  useEffect(() => {
    if (!hasPermission && !permRequested) {
      requestPermission().then(() => setPermRequested(true));
    }
  }, [hasPermission, permRequested, requestPermission]);

  // ── Scan line animation ──
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(lineAnim, {toValue: 1, duration: 1800, useNativeDriver: true}),
        Animated.timing(lineAnim, {toValue: 0, duration: 1800, useNativeDriver: true}),
      ]),
    ).start();
  }, [lineAnim]);

  // ── Pulsing dot animation ──
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, {toValue: 0.25, duration: 650, useNativeDriver: true}),
        Animated.timing(dotAnim, {toValue: 1, duration: 650, useNativeDriver: true}),
      ]),
    ).start();
  }, [dotAnim]);

  const onCodeScanned = useCallback(
    async codes => {
      if (!codes.length) return;
      const raw = codes[0].value;
      console.log('[QRScannerScreen] raw code detected', {raw, codesCount: codes.length});
      const cardNumber = extractCardNumber(raw);
      if (!cardNumber) {
        console.log('[QRScannerScreen] ignored code: card number not matched', {raw});
        showToast('warning', 'Card Scan Again');
        return;
      }

      console.log('[QRScannerScreen] code scanned', {
        raw,
        cardNumber,
        cityKey: CITY?.key || '',
        wardNo,
        line,
        helperId,
        latLng,
      });

      try {
        console.log('[QRScannerScreen] loading ward json for validation', {
          wardNo,
          currentLine: line,
          cardNumber,
        });

        if (!wardNo) {
          console.log('[QRScannerScreen] blocked: wardNo missing');
          showToast('error', 'Setup failed: Ward information missing.');
          return;
        }

        const wardResp = await getWardLinesDynamic(wardNo);
        console.log('[QRScannerScreen] ward json response', {
          ok: wardResp?.ok,
          message: wardResp?.message,
          latestDate: wardResp?.latestDate,
          fromCache: wardResp?.fromCache,
          linesCount: Array.isArray(wardResp?.data) ? wardResp.data.length : 0,
        });
        console.log('[QRScannerScreen] ward json full data', wardResp?.data);
        try {
          console.log(
            '[QRScannerScreen] ward json stringified',
            JSON.stringify(wardResp?.data, null, 2),
          );
        } catch (jsonError) {
          console.log('[QRScannerScreen] ward json stringify failed', {
            message: jsonError?.message,
          });
        }

        if (!wardResp?.ok || !Array.isArray(wardResp.data) || wardResp.data.length === 0) {
          console.log('[QRScannerScreen] blocked: ward json unavailable');
          showToast('warning', 'Ward JSON load नहीं हो सका. Please try again.');
          return;
        }

        console.log(
          '[QRScannerScreen] ward json line summary',
          wardResp.data.map(lineItem => ({
            id: lineItem?.id,
            pointsCount: Array.isArray(lineItem?.points) ? lineItem.points.length : 0,
            housesCount: Array.isArray(lineItem?.houses) ? lineItem.houses.length : 0,
            firstHouse: Array.isArray(lineItem?.houses) && lineItem.houses[0]
              ? {
                  cardNumber: lineItem.houses[0].cardNumber,
                  uid: lineItem.houses[0].uid,
                  scanBy: lineItem.houses[0].scanBy,
                  scanTime: lineItem.houses[0].scanTime,
                  lastScanTime: lineItem.houses[0].lastScanTime,
                  isScanned: lineItem.houses[0].isScanned,
                }
              : null,
          })),
        );

        const match = findHouseInWardLines(wardResp.data, cardNumber);
        console.log('[QRScannerScreen] validation result', {
          found: match.found,
          target: match.target,
          matchedLine: match.matchedLine,
          matchedHouse: match.matchedHouse
            ? {
                cardNumber: match.matchedHouse.cardNumber,
                uid: match.matchedHouse.uid,
                line: match.matchedHouse.line,
                scanBy: match.matchedHouse.scanBy,
                scanTime: match.matchedHouse.scanTime,
                lastScanTime: match.matchedHouse.lastScanTime,
                isScanned: match.matchedHouse.isScanned,
              }
            : null,
        });

        if (!match.found) {
          console.log('[QRScannerScreen] blocked: card mismatch with ward json', {
            cardNumber,
            wardNo,
          });
          showToast('warning', `Card Not Found: ${cardNumber}`);
          return;
        }

        const dailyCache = await loadDailyScanCache({wardNo});
        console.log('[QRScannerScreen] local scan cache summary', {
          wardNo,
          source: dailyCache?.source,
          recordsCount: dailyCache?.records ? Object.keys(dailyCache.records).length : 0,
          dateOnly: dailyCache?.dateOnly,
        });

        if (
          isCardAlreadyScanned(
            dailyCache,
            match.matchedHouse?.cardNumber || cardNumber,
            match.matchedHouse?.uid || '',
          )
        ) {
          console.log('[QRScannerScreen] blocked: card already scanned', {
            cardNumber,
            wardNo,
            matchedLine: match.matchedLine,
          });
          showToast('warning', 'यह कार्ड पहले ही स्कैन हो चुका है।');
          return;
        }

        if (line && match.matchedLine && String(line) !== String(match.matchedLine)) {
          console.log('[QRScannerScreen] blocked: line mismatch', {
            scannedLine: line,
            matchedLine: match.matchedLine,
            cardNumber,
          });
          showToast('warning', `Card Not Found: line ${match.matchedLine} का card है.`);
          return;
        }

        console.log('[QRScannerScreen] validation passed, navigating to WasteEntry', {
          cardNumber,
          wardNo,
          line,
          helperId,
          latLng,
          matchedLine: match.matchedLine,
        });

        navigation.replace('WasteEntry', {
          cardNumber,
          wardNo,
          line,
          helperId,
          latLng,
        });
      } catch (error) {
        console.log('[QRScannerScreen] validation error', {
          cardNumber,
          message: error?.message,
        });
        showToast('error', error?.message || 'Unable to validate card');
      }
    },
    [helperId, latLng, line, navigation, wardNo, showToast],
  );

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned,
  });

  // ── No permission ──
  if (!hasPermission) {
    return (
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
          <MaterialCommunityIcons
            name="camera-outline"
            size={scale(16)}
            color="#fff"
          />
          <Text style={s.permBtnText}>Grant Permission</Text>
        </Pressable>
        <Pressable style={s.permBack} onPress={() => navigation.goBack()}>
          <Text style={s.permBackText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  if (!device) {
    return (
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
        <Pressable style={s.permBack} onPress={() => navigation.goBack()}>
          <Text style={s.permBackText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const scanLineY = lineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, scale(VF - 4)],
  });

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" translucent />

      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
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
        style={({pressed}) => [s.iconBtn, s.backBtn, pressed && s.iconBtnPressed]}
        onPress={() => navigation.goBack()}>
        <MaterialCommunityIcons name="arrow-left" size={scale(20)} color="#fff" />
      </Pressable>

      {/* ── Title ── */}
      <View style={s.titleWrap}>
        <Text style={s.title}>Scan QR Code</Text>
      </View>

      {/* ── Torch button (top-right) ── */}
      <Pressable
        style={({pressed}) => [
          s.iconBtn,
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

const VF = scale(260);
const CORNER = scale(26);
const CORNER_T = 3.5;

const s = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#000'},

  // ── Overlay ──
  overlay: {flex: 1, position: 'absolute', inset: 0},
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

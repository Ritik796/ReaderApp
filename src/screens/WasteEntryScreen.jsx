import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Camera, useCameraDevice, useCameraPermission} from 'react-native-vision-camera';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import appTheme from '../theme/appTheme';
import {ms, mvs, scale} from '../utils/responsive';
import {
  cleanupPhotoIfNeeded,
  compressWastePhoto,
  saveScanDetails,
} from '../services/wasteEntryService';
import {useToast} from '../context/ToastContext';

const WASTE_TYPES = [
  {
    id: 'segregated',
    value: 'Segregated',
    label: 'Segregated',
    icon: 'recycle',
    color: '#2E7D32',
    bgColor: '#E8F5E9',
    borderColor: '#A5D6A7',
    requiresPhoto: true,
  },
  {
    id: 'non_segregated',
    value: 'Non-Segregated',
    label: 'Non-Segregated',
    icon: 'trash-can-outline',
    color: '#E65100',
    bgColor: '#FFF3E0',
    borderColor: '#FFCC80',
    requiresPhoto: false,
  },
  {
    id: 'no_waste',
    value: 'No Waste',
    label: 'No Waste',
    icon: 'delete-off-outline',
    color: '#546E7A',
    bgColor: '#ECEFF1',
    borderColor: '#B0BEC5',
    requiresPhoto: false,
  },
];

function CapturingOverlay() {
  const flashAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0.78)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Quick white flash → fade out
    Animated.timing(flashAnim, {
      toValue: 0,
      duration: 280,
      useNativeDriver: true,
    }).start();

    // Card springs in
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 90,
      friction: 7,
      useNativeDriver: true,
    }).start();

    // Iris icon spins continuously
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1100,
        useNativeDriver: true,
      }),
    ).start();
  }, [flashAnim, scaleAnim, rotateAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={cs.capturingOverlay} pointerEvents="none">
      {/* White flash layer */}
      <Animated.View
        style={[StyleSheet.absoluteFill, {backgroundColor: '#fff', opacity: flashAnim}]}
      />
      {/* Centered spinner — absolutely centered */}
      <View style={cs.capturingCenter}>
        <Animated.View style={[cs.capturingIconRing, {transform: [{scale: scaleAnim}]}]}>
          <Animated.View style={{transform: [{rotate: spin}]}}>
            <MaterialCommunityIcons
              name="camera-iris"
              size={scale(36)}
              color="#fff"
            />
          </Animated.View>
        </Animated.View>
        <Text style={cs.capturingTitle}>Processing…</Text>
      </View>
    </View>
  );
}

function CameraCapture({onCapture, onClose}) {
  const {hasPermission, requestPermission} = useCameraPermission();
  const device = useCameraDevice('back');
  const cameraRef = useRef(null);
  const [capturing, setCapturing] = useState(false);
  const [flash, setFlash] = useState(false);
  const shutterScale = useRef(new Animated.Value(1)).current;

  const animateShutter = useCallback(() => {
    Animated.sequence([
      Animated.timing(shutterScale, {toValue: 0.84, duration: 80, useNativeDriver: true}),
      Animated.timing(shutterScale, {toValue: 1, duration: 160, useNativeDriver: true}),
    ]).start();
  }, [shutterScale]);

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current || capturing) return;
    try {
      animateShutter();
      setCapturing(true);
      const photo = await cameraRef.current.takePhoto({
        flash: flash ? 'on' : 'off',
      });
      onCapture(photo.path);
    } catch (e) {
      console.warn('Photo capture error:', e);
    } finally {
      setCapturing(false);
    }
  }, [capturing, flash, animateShutter, onCapture]);

  if (!hasPermission) {
    return (
      <View style={cs.permWrap}>
        <View style={cs.permIconCircle}>
          <MaterialCommunityIcons
            name="camera-lock-outline"
            size={scale(44)}
            color="#fff"
          />
        </View>
        <Text style={cs.permTitle}>Camera Permission Required</Text>
        <Text style={cs.permSub}>Allow camera to capture waste photos</Text>
        <Pressable
          style={({pressed}) => [cs.permBtn, pressed && {opacity: 0.85}]}
          onPress={requestPermission}>
          <MaterialCommunityIcons name="camera-outline" size={scale(16)} color="#fff" />
          <Text style={cs.permBtnText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }
  if (!device) {
    return (
      <View style={cs.permWrap}>
        <MaterialCommunityIcons name="camera-off-outline" size={scale(44)} color="#fff" />
        <Text style={cs.permTitle}>Camera Not Available</Text>
      </View>
    );
  }

  return (
    <View style={cs.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" translucent />
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        photo={true}
      />

      {/* ── Rule-of-thirds grid ── */}
      <View style={cs.grid} pointerEvents="none">
        <View style={cs.gridLineH} />
        <View style={[cs.gridLineH, cs.gridLineH2]} />
        <View style={cs.gridLineV} />
        <View style={[cs.gridLineV, cs.gridLineV2]} />
      </View>

      {/* ── Top bar: close + title + flash ── */}
      <View style={cs.topBar}>
        <Pressable
          style={({pressed}) => [cs.iconBtn, pressed && cs.iconBtnPressed]}
          onPress={onClose}>
          <MaterialCommunityIcons name="close" size={scale(20)} color="#fff" />
        </Pressable>

        <Text style={cs.title}>Capture Waste Photo</Text>

        <Pressable
          style={({pressed}) => [
            cs.iconBtn,
            flash && cs.flashActive,
            pressed && cs.iconBtnPressed,
          ]}
          onPress={() => setFlash(v => !v)}>
          <MaterialCommunityIcons
            name={flash ? 'flash' : 'flash-off'}
            size={scale(20)}
            color={flash ? '#FFD600' : '#fff'}
          />
        </Pressable>
      </View>

      {/* ── Bottom bar: hint + shutter ── */}
      <View style={cs.bottomBar}>
        <Text style={cs.hint}>Frame the waste clearly for best results</Text>
        <Animated.View style={{transform: [{scale: shutterScale}]}}>
          <Pressable
            style={cs.shutter}
            onPress={takePhoto}
            disabled={capturing}>
            <View
              style={[cs.shutterInner, capturing && cs.shutterCapturing]}
            />
          </Pressable>
        </Animated.View>
        {/* spacer to balance layout */}
        <View style={{height: mvs(20)}} />
      </View>

      {/* ── Capturing overlay ── */}
      {capturing && <CapturingOverlay />}
    </View>
  );
}

export default function WasteEntryScreen({route, navigation}) {
  const {
    cardNumber,
    wardNo = '',
    line = '',
    helperId = '',
    latLng = '',
  } = route.params ?? {};
  const [selectedType, setSelectedType] = useState(null);
  const [photoPath, setPhotoPath] = useState(null);
  const [photoCleanupPath, setPhotoCleanupPath] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const {showToast} = useToast();

  useEffect(() => {
    console.log('[WasteEntryScreen] opened', {
      cardNumber,
      wardNo,
      line,
      helperId,
      latLng,
    });
  }, [cardNumber, helperId, latLng, line, wardNo]);

  const onSelectType = type => {
    console.log('[WasteEntryScreen] waste type selected', {type});
    setSelectedType(type);
    // Clear photo if switching away from segregated
    if (type !== 'segregated') {
      cleanupPhotoIfNeeded(photoCleanupPath);
      setPhotoPath(null);
      setPhotoCleanupPath(null);
    }
  };

  const onCapture = useCallback(
    async path => {
      setCameraOpen(false);
      setProcessingPhoto(true);
      try {
        cleanupPhotoIfNeeded(photoCleanupPath);
        const compressed = await compressWastePhoto(path);
        setPhotoPath(compressed.uri);
        setPhotoCleanupPath(compressed.cleanupPath || null);
      } catch (error) {
        showToast('error', error?.message || 'Unable to process photo');
      } finally {
        setProcessingPhoto(false);
      }
    },
    [photoCleanupPath],
  );

  const onSave = useCallback(async () => {
    if (saving || processingPhoto) return;
    console.log('[WasteEntryScreen] save pressed', {
      cardNumber,
      selectedType,
      photoPath,
      wardNo,
      line,
      helperId,
      latLng,
    });
    setSaving(true);
    try {
      const result = await saveScanDetails({
        cardNumber,
        wasteCategory: WASTE_TYPES.find(item => item.id === selectedType)?.value || '',
        photoPath,
        wardNo,
        line,
        helperId,
        latLng,
      });
      if (!result?.ok) {
        if (result?.code === 'ALREADY_SCANNED') {
          showToast('warning', 'यह कार्ड पहले ही स्कैन हो चुका है।');
        } else {
          showToast('error', result?.message || 'Unable to save entry');
        }
        return;
      }
      showToast('success', result?.message || 'Waste entry saved successfully.');
      navigation.goBack();
    } catch (error) {
      showToast('error', error?.message || 'Unable to save entry');
    } finally {
      setSaving(false);
    }
  }, [
    cardNumber,
    helperId,
    latLng,
    line,
    navigation,
    photoPath,
    processingPhoto,
    saving,
    selectedType,
    wardNo,
  ]);

  useEffect(() => {
    return () => {
      cleanupPhotoIfNeeded(photoCleanupPath);
    };
  }, [photoCleanupPath]);

  const toDisplayUri = uri => {
    if (!uri) return '';
    return uri.startsWith('file://') ? uri : `file://${uri}`;
  };

  const canSave =
    selectedType !== null &&
    (selectedType !== 'segregated' || photoPath !== null) &&
    !processingPhoto &&
    !saving;

  return (
    <SafeAreaView style={s.root}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={appTheme.colors.safeAreaBackground}
      />

      {/* ── Header ── */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={scale(20)}
            color={appTheme.colors.textPrimary}
          />
        </Pressable>
        <Text style={s.headerTitle}>Waste Entry</Text>
        <View style={{width: scale(36)}} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}>

        {/* ── Card number chip ── */}
        <View style={s.cardChip}>
          <View style={s.cardIconWrap}>
            <MaterialCommunityIcons
              name="card-account-details-outline"
              size={scale(22)}
              color={appTheme.colors.accentPrimary}
            />
          </View>
          <View>
            <Text style={s.cardLabel}>Card Number</Text>
            <Text style={s.cardNumber}>{cardNumber}</Text>
          </View>
        </View>

        {/* ── Waste type heading ── */}
        <Text style={s.sectionTitle}>Select Waste Type</Text>

        {/* ── Waste type tiles ── */}
        <View style={s.tilesRow}>
          {WASTE_TYPES.map(type => {
            const active = selectedType === type.id;
            return (
              <Pressable
                key={type.id}
                style={({pressed}) => [
                  s.tile,
                  {
                    backgroundColor: active ? type.bgColor : appTheme.colors.surfacePrimary,
                    borderColor: active ? type.color : appTheme.colors.surfaceBorder,
                    borderWidth: active ? 2 : 1,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
                onPress={() => onSelectType(type.id)}>
                <View
                  style={[
                    s.tileIconWrap,
                    {backgroundColor: active ? type.bgColor : appTheme.colors.backgroundSecondary},
                  ]}>
                  <MaterialCommunityIcons
                    name={type.icon}
                    size={scale(26)}
                    color={active ? type.color : appTheme.colors.textSecondary}
                  />
                </View>
                <Text
                  style={[
                    s.tileLabel,
                    {color: active ? type.color : appTheme.colors.textSecondary},
                  ]}>
                  {type.label}
                </Text>
                {active && (
                  <View style={[s.checkBadge, {backgroundColor: type.color}]}>
                    <MaterialCommunityIcons
                      name="check"
                      size={scale(10)}
                      color="#fff"
                    />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* ── Photo section (Segregated only) ── */}
        {selectedType === 'segregated' && (
          <View style={s.photoSection}>
            <Text style={s.sectionTitle}>Waste Photo</Text>
            <Text style={s.photoHint}>
              Photo is required for Segregated waste
            </Text>

            {processingPhoto ? (
              <View style={s.processingWrap}>
                <ActivityIndicator
                  size="small"
                  color={appTheme.colors.accentPrimary}
                />
                <Text style={s.processingText}>Optimizing photo...</Text>
              </View>
            ) : photoPath ? (
              <View style={s.photoPreviewWrap}>
                <Image
                  source={{uri: toDisplayUri(photoPath)}}
                  style={s.photoPreview}
                  resizeMode="cover"
                />
                <Pressable
                  style={s.retakeBtn}
                  onPress={() => setCameraOpen(true)}>
                  <MaterialCommunityIcons
                    name="camera-retake-outline"
                    size={scale(16)}
                    color={appTheme.colors.accentPrimary}
                  />
                  <Text style={s.retakeBtnText}>Retake</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={({pressed}) => [s.captureBtn, pressed && {opacity: 0.8}]}
                onPress={() => setCameraOpen(true)}>
                <MaterialCommunityIcons
                  name="camera-plus-outline"
                  size={scale(28)}
                  color={appTheme.colors.accentPrimary}
                />
                <Text style={s.captureBtnText}>Tap to capture photo</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Save button ── */}
      <View style={s.footer}>
        <Pressable
          style={({pressed}) => [
            s.saveBtn,
            !canSave && s.saveBtnDisabled,
            pressed && canSave && {opacity: 0.85},
          ]}
          onPress={onSave}
          disabled={!canSave}>
          <MaterialCommunityIcons
            name="content-save-outline"
            size={scale(18)}
            color="#fff"
          />
          <Text style={s.saveBtnText}>{saving ? 'Saving...' : 'Save Entry'}</Text>
        </Pressable>
      </View>

      {/* ── Camera Modal ── */}
      <Modal
        visible={cameraOpen}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setCameraOpen(false)}>
        <CameraCapture
          onCapture={onCapture}
          onClose={() => setCameraOpen(false)}
        />
      </Modal>
    </SafeAreaView>
  );
}

// ── Camera capture styles ──
const cs = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#000'},

  // Permission screen
  permWrap: {
    flex: 1,
    backgroundColor: '#080F18',
    alignItems: 'center',
    justifyContent: 'center',
    gap: mvs(12),
    paddingHorizontal: scale(36),
  },
  permIconCircle: {
    width: scale(92),
    height: scale(92),
    borderRadius: scale(46),
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: mvs(4),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  permTitle: {
    color: '#fff',
    fontSize: ms(16),
    fontWeight: '800',
    textAlign: 'center',
  },
  permSub: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: ms(12),
    textAlign: 'center',
  },
  permBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginTop: mvs(12),
    paddingHorizontal: scale(26),
    paddingVertical: mvs(12),
    backgroundColor: appTheme.colors.accentPrimary,
    borderRadius: scale(14),
  },
  permBtnText: {color: '#fff', fontWeight: '800', fontSize: ms(13)},

  // Grid overlay
  grid: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLineH: {
    position: 'absolute',
    top: '33.33%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  gridLineH2: {top: '66.66%'},
  gridLineV: {
    position: 'absolute',
    left: '33.33%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  gridLineV2: {left: '66.66%'},

  // Top bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: mvs(52),
    paddingHorizontal: scale(16),
    paddingBottom: mvs(14),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  iconBtn: {
    width: scale(42),
    height: scale(42),
    borderRadius: scale(21),
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  iconBtnPressed: {backgroundColor: 'rgba(0,0,0,0.65)'},
  flashActive: {
    backgroundColor: 'rgba(255,214,0,0.14)',
    borderColor: 'rgba(255,214,0,0.4)',
  },
  title: {
    color: '#fff',
    fontSize: ms(15),
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: mvs(44),
    paddingTop: mvs(16),
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    gap: mvs(16),
  },
  hint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: ms(12),
    letterSpacing: 0.3,
  },
  shutter: {
    width: scale(74),
    height: scale(74),
    borderRadius: scale(37),
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    backgroundColor: '#fff',
  },
  shutterCapturing: {
    backgroundColor: 'rgba(255,255,255,0.55)',
  },

  // Capturing overlay
  capturingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  capturingCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capturingIconRing: {
    width: scale(76),
    height: scale(76),
    borderRadius: scale(38),
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  capturingTitle: {
    color: '#fff',
    fontSize: ms(13),
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: mvs(12),
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 5,
  },
});

// ── Main screen styles ──
const s = StyleSheet.create({
  root: {flex: 1, backgroundColor: appTheme.colors.safeAreaBackground},

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(12),
    paddingVertical: mvs(12),
    backgroundColor: appTheme.colors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: appTheme.colors.surfaceBorder,
  },
  backBtn: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(10),
    backgroundColor: appTheme.colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: ms(15),
    fontWeight: '800',
    color: appTheme.colors.textPrimary,
  },

  scroll: {
    padding: scale(16),
    gap: mvs(20),
    paddingBottom: mvs(20),
  },

  // Card chip
  cardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(14),
    backgroundColor: appTheme.colors.surfacePrimary,
    borderRadius: scale(14),
    paddingHorizontal: scale(16),
    paddingVertical: mvs(14),
    borderWidth: 1,
    borderColor: appTheme.colors.surfaceBorder,
    elevation: 2,
    shadowColor: appTheme.colors.shadowColor,
    shadowOffset: {width: 0, height: mvs(1)},
    shadowOpacity: 0.08,
    shadowRadius: scale(4),
  },
  cardIconWrap: {
    width: scale(46),
    height: scale(46),
    borderRadius: scale(12),
    backgroundColor: appTheme.colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: ms(10),
    color: appTheme.colors.textMuted,
    fontWeight: '500',
  },
  cardNumber: {
    fontSize: ms(18),
    fontWeight: '800',
    color: appTheme.colors.textPrimary,
    letterSpacing: 0.5,
    marginTop: mvs(2),
  },

  // Section title
  sectionTitle: {
    fontSize: ms(13),
    fontWeight: '700',
    color: appTheme.colors.textPrimary,
    marginBottom: mvs(2),
  },

  // Waste type tiles
  tilesRow: {
    flexDirection: 'row',
    gap: scale(10),
  },
  tile: {
    flex: 1,
    borderRadius: scale(14),
    paddingVertical: mvs(14),
    alignItems: 'center',
    gap: mvs(8),
    position: 'relative',
    elevation: 2,
    shadowColor: appTheme.colors.shadowColor,
    shadowOffset: {width: 0, height: mvs(1)},
    shadowOpacity: 0.08,
    shadowRadius: scale(4),
  },
  tileIconWrap: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontSize: ms(10),
    fontWeight: '700',
    textAlign: 'center',
  },
  checkBadge: {
    position: 'absolute',
    top: scale(8),
    right: scale(8),
    width: scale(16),
    height: scale(16),
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Photo section
  photoSection: {gap: mvs(8)},
  photoHint: {
    fontSize: ms(11),
    color: appTheme.colors.textMuted,
  },
  processingWrap: {
    height: mvs(110),
    borderRadius: scale(14),
    borderWidth: 1,
    borderColor: appTheme.colors.surfaceBorder,
    backgroundColor: appTheme.colors.surfacePrimary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: mvs(8),
  },
  processingText: {
    fontSize: ms(12),
    color: appTheme.colors.textSecondary,
    fontWeight: '600',
  },
  captureBtn: {
    height: mvs(110),
    borderRadius: scale(14),
    borderWidth: 2,
    borderColor: appTheme.colors.chipBorder,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appTheme.colors.surfacePrimary,
    gap: mvs(8),
  },
  captureBtnText: {
    fontSize: ms(13),
    color: appTheme.colors.textSecondary,
    fontWeight: '600',
  },
  photoPreviewWrap: {gap: mvs(10)},
  photoPreview: {
    width: '100%',
    height: mvs(200),
    borderRadius: scale(14),
    backgroundColor: appTheme.colors.backgroundSecondary,
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    paddingVertical: mvs(10),
    borderRadius: scale(10),
    borderWidth: 1.5,
    borderColor: appTheme.colors.accentPrimary,
    backgroundColor: appTheme.colors.surfacePrimary,
  },
  retakeBtnText: {
    fontSize: ms(12),
    fontWeight: '700',
    color: appTheme.colors.accentPrimary,
  },

  // Footer save button
  footer: {
    paddingHorizontal: scale(16),
    paddingVertical: mvs(12),
    backgroundColor: appTheme.colors.surfacePrimary,
    borderTopWidth: 1,
    borderTopColor: appTheme.colors.surfaceBorder,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    height: mvs(50),
    borderRadius: scale(14),
    backgroundColor: appTheme.colors.accentPrimary,
    elevation: 3,
    shadowColor: appTheme.colors.accentPrimary,
    shadowOffset: {width: 0, height: mvs(2)},
    shadowOpacity: 0.35,
    shadowRadius: scale(6),
  },
  saveBtnDisabled: {
    backgroundColor: appTheme.colors.textMuted,
    elevation: 0,
    shadowOpacity: 0,
  },
  saveBtnText: {
    fontSize: ms(14),
    fontWeight: '800',
    color: '#fff',
  },
});

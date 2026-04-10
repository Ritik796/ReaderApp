import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import appTheme from '../theme/appTheme';
import {CITY} from '../Firebase/firebaseConfig';
import {useAppSafeArea} from '../context/AppSafeAreaContext';
import {ms, mvs, scale, SW, SH} from '../utils/responsive';
import {getOrCreateDeviceIdentity} from '../services/deviceService';
import {getWorkAssignmentForDevice} from '../services/assignmentService';

const STEPS = [
  {key: 'detect',     label: 'Device',      iconName: 'cellphone'},
  {key: 'register',   label: 'Register',    iconName: 'shield-check'},
  {key: 'assignment', label: 'Assignment',  iconName: 'clipboard-list'},
];

const FLOAT      = scale(88);
const FLOAT_HALF = FLOAT / 2;
const FLOAT_RING = FLOAT + scale(18);

// ── Animated spinning arc ────────────────────────────────────────────────────
function SpinnerArc({visible, color}) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {spin.setValue(0); return;}
    const loop = Animated.loop(
      Animated.timing(spin, {toValue: 1, duration: 1000, useNativeDriver: true}),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, spin]);

  const rotate = spin.interpolate({inputRange: [0, 1], outputRange: ['0deg', '360deg']});
  if (!visible) {return null;}
  return (
    <Animated.View
      style={[
        s.spinArc,
        {width: FLOAT_RING, height: FLOAT_RING, borderRadius: FLOAT_RING / 2,
         transform: [{rotate}], borderTopColor: color, borderRightColor: color},
      ]}
    />
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function LoginScreen({navigation}) {
  const {bottom} = useAppSafeArea();

  const [currentStep, setCurrentStep] = useState(0);
  const [statusText, setStatusText]   = useState('Device ID पहचान हो रही है…');
  const [error, setError]             = useState(null);
  const [deviceData, setDeviceData]   = useState(null);
  const [assignData, setAssignData]   = useState(null);
  const [isProceeding, setIsProceeding] = useState(false);

  const allDone   = currentStep >= STEPS.length && !error;
  const activeIdx = Math.min(currentStep, STEPS.length - 1);

  const onProceed = useCallback(() => {
    setIsProceeding(true);
    setTimeout(() => {
      navigation.replace('Map', {deviceData, assignData});
    }, 150);
  }, [navigation, deviceData, assignData]);

  const runFlow = useCallback(async () => {
    setError(null);
    setDeviceData(null);
    setAssignData(null);
    setCurrentStep(0);
    setStatusText('Device ID पहचान हो रही है');

    try {
      const device = await getOrCreateDeviceIdentity();
      setDeviceData(device);

      setCurrentStep(1);
      setStatusText(
        device.isNewDevice
          ? 'नई Device Registration बन रही है…'
          : 'Registration confirm हो रही है…',
      );
      await new Promise(r => setTimeout(r, 500));

      setCurrentStep(2);
      setStatusText(`${device.deviceName} का कार्य खोजा जा रहा है…`);
      const assign = await getWorkAssignmentForDevice(device.deviceName);
      setAssignData(assign);

      setCurrentStep(3);
      setStatusText('कार्य विवरण');
    } catch (flowErr) {
      setError({
        title: 'No Assignment Found',
        message:
          flowErr?.message ||
          'इस device के लिए कोई कार्य निर्धारित नहीं है।\nकृपया अपने supervisor से संपर्क करें।',
      });
    }
  }, []);

  useEffect(() => {runFlow();}, [runFlow]);

  const floatIconName  = error ? 'alert-circle' : allDone ? 'check-circle' : STEPS[activeIdx].iconName;
  const floatIconColor = error ? '#D32F2F' : allDone ? '#2E7D32' : appTheme.colors.accentPrimary;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={appTheme.colors.accentPrimary} translucent={false} />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <View style={s.bubble1} />
        <View style={s.bubble2} />
        <View style={s.cityImageWrap}>
          <Image
            source={require('../Assets/Images/bharatpur.png')}
            style={s.cityImage}
            resizeMode="contain"
          />
        </View>
        <Text style={s.appName}>Reader App</Text>
        <Text style={s.tagline}>
          Field Assignment System · {CITY?.key || CITY?.empCode || 'BTPR'}
        </Text>
      </View>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <View style={s.body}>

        {/* Floating icon with spinner ring */}
        <View style={[s.floatOuter, {width: FLOAT_RING, height: FLOAT_RING, borderRadius: FLOAT_RING / 2}]}>
          <View style={[s.spinTrack, {width: FLOAT_RING, height: FLOAT_RING, borderRadius: FLOAT_RING / 2}]} />
          <SpinnerArc visible={!allDone && !error} color={appTheme.colors.accentPrimary} />
          <View style={[s.floatInner, {width: FLOAT, height: FLOAT, borderRadius: FLOAT / 2}]}>
            <MaterialCommunityIcons name={floatIconName} size={scale(36)} color={floatIconColor} />
          </View>
        </View>

        {error ? (
          <View style={s.section}>
            <Text style={s.errorTitle}>{error.title}</Text>
            <Text style={s.errorMsg}>{error.message}</Text>
            <Pressable style={s.retryBtn} onPress={runFlow}>
              <Text style={s.retryTxt}>↺  दोबारा कोशिश करें</Text>
            </Pressable>
          </View>
        ) : (
          <View style={s.section}>

            <Text style={s.stepName}>
            {allDone ? 'Work Assignment' : STEPS[activeIdx].label}
            </Text>
            <Text style={s.statusTxt}>{statusText}</Text>
            {!allDone && (
              <Text style={s.stepCounter}>Step {currentStep + 1} of {STEPS.length}</Text>
            )}

            {/* Progress bar */}
            <View style={s.progressTrack}>
              <View
                style={[
                  s.progressFill,
                  {width: allDone ? '100%' : `${(currentStep / STEPS.length) * 100}%`},
                ]}
              />
            </View>

            {/* Step dots */}
            <View style={s.dotsRow}>
              {STEPS.map((step, i) => {
                const done   = i < currentStep;
                const active = i === currentStep && !allDone;
                const isLast = i === STEPS.length - 1;
                return (
                  <React.Fragment key={step.key}>
                    <View style={s.dotItem}>
                      <View style={[s.dot, done && s.dotDone, active && s.dotActive]}>
                        {done
                          ? <MaterialCommunityIcons name="check" size={scale(13)} color={appTheme.colors.accentPrimary} />
                          : <MaterialCommunityIcons name={step.iconName} size={scale(13)} color={active ? '#FFFFFF' : appTheme.colors.textMuted} />
                        }
                      </View>
                      <Text style={[s.dotLabel, done && s.dotLabelDone, active && s.dotLabelActive]}>
                        {step.label}
                      </Text>
                    </View>
                    {!isLast && <View style={[s.dotLine, done && s.dotLineDone]} />}
                  </React.Fragment>
                );
              })}
            </View>

            {/* Summary card */}
            {allDone && deviceData && assignData ? (
              <>
                <View style={s.summaryCard}>
                  <View style={s.summaryRow}>
                    <MaterialCommunityIcons name="cellphone" size={scale(20)} color={appTheme.colors.accentPrimary} />
                    <View style={s.summaryTexts}>
                      <Text style={s.summaryLabel}>Device</Text>
                      <Text style={s.summaryValue}>{deviceData.deviceName}</Text>
                    </View>
                    <View style={[s.tag, deviceData.isNewDevice && s.tagNew]}>
                      <Text style={s.tagTxt}>{deviceData.isNewDevice ? 'New' : 'Verified'}</Text>
                    </View>
                  </View>
                  <View style={s.summaryDivider} />
                  <View style={s.summaryRow}>
                    <MaterialCommunityIcons name="account" size={scale(20)} color={appTheme.colors.accentPrimary} />
                    <View style={s.summaryTexts}>
                      <Text style={s.summaryLabel}>vehicle Number </Text>
                      <Text style={s.summaryValue}>{assignData.vehicle}</Text>
                    </View>
                  </View>
                  <View style={s.summaryDivider} />
                  <View style={s.summaryRow}>
                    <MaterialCommunityIcons name="clipboard-list" size={scale(20)} color={appTheme.colors.accentPrimary} />
                    <View style={s.summaryTexts}>
                      <Text style={s.summaryLabel}>Assigned Ward</Text>
                      <Text style={s.summaryValue}>{assignData['current-assignment']}</Text>
                    </View>
                    <View style={s.tag}>
                      <Text style={s.tagTxt}>Active</Text>
                    </View>
                  </View>
                </View>

                {/* Proceed button */}
                <Pressable
                  style={({pressed}) => [
                    s.proceedBtn,
                    pressed && !isProceeding && s.proceedBtnPressed,
                    isProceeding && {opacity: 0.8}
                  ]}
                  onPress={onProceed}
                  disabled={isProceeding}>
                  {isProceeding ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Text style={s.proceedTxt}>आगे बढ़ें</Text>
                      <MaterialCommunityIcons
                        name="arrow-right"
                        size={scale(20)}
                        color="#fff"
                      />
                    </>
                  )}
                </Pressable>
              </>
            ) : null}


          </View>
        )}
      </View>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <SafeAreaView edges={['bottom']} style={{paddingBottom: bottom}}>
        <Text style={s.footer}>
          Powered by  <Text style={s.footerBrand}>Wevois Labs Pvt Ltd</Text>
        </Text>
      </SafeAreaView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {flex: 1, backgroundColor: appTheme.colors.safeAreaBackground},

  // Header
  header: {
    height: SH * 0.34,
    backgroundColor: appTheme.colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: scale(44),
    borderBottomRightRadius: scale(44),
    overflow: 'hidden',
    gap: mvs(4),
    elevation: 10,
    shadowColor: appTheme.colors.shadowColor,
    shadowOffset: {width: 0, height: mvs(6)},
    shadowOpacity: 0.25,
    shadowRadius: scale(12),
  },
  bubble1: {
    position: 'absolute',
    width: SW * 0.75, height: SW * 0.75,
    borderRadius: SW * 0.375,
    backgroundColor: appTheme.colors.accentSecondary,
    opacity: 0.18,
    top: -SW * 0.3, right: -SW * 0.2,
  },
  bubble2: {
    position: 'absolute',
    width: SW * 0.45, height: SW * 0.45,
    borderRadius: SW * 0.225,
    backgroundColor: appTheme.colors.glowTop,
    opacity: 0.15,
    bottom: -SW * 0.08, left: -SW * 0.08,
  },
  cityImageWrap: {
    width: scale(90), height: scale(90),
    borderRadius: scale(45),
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: mvs(8),
    overflow: 'hidden',
  },
  cityImage: {
    width: scale(90), height: scale(90),
  },
  appName: {
    fontSize: ms(22), fontWeight: '800',
    color: '#FFFFFF', letterSpacing: 0.4,
  },
  tagline: {
    fontSize: ms(12),
    color: 'rgba(255,255,255,0.70)',
    letterSpacing: 0.3,
  },

  // Body
  body: {
    flex: 1,
    alignItems: 'center',
    marginTop: -FLOAT_HALF,
  },

  // Floating icon
  floatOuter: {
    backgroundColor: '#F0F8FF',
    borderWidth: 1, borderColor: appTheme.colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: mvs(18),
    elevation: 8,
    shadowColor: appTheme.colors.shadowColor,
    shadowOffset: {width: 0, height: mvs(4)},
    shadowOpacity: 0.15, shadowRadius: scale(10),
  },
  spinTrack: {
    position: 'absolute',
    borderWidth: 3, borderColor: appTheme.colors.surfaceBorder,
  },
  spinArc: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  floatInner: {
    backgroundColor: appTheme.colors.accentSoft,
    borderWidth: 2, borderColor: appTheme.colors.chipBorder,
    alignItems: 'center', justifyContent: 'center',
  },

  // Section
  section: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: scale(26),
  },
  stepName: {
    fontSize: ms(20), fontWeight: '800',
    color: appTheme.colors.textPrimary,
    marginBottom: mvs(4),
  },
  statusTxt: {
    fontSize: ms(13), color: appTheme.colors.textSecondary,
    fontWeight: '500', marginBottom: mvs(2), textAlign: 'center',
  },
  stepCounter: {
    fontSize: ms(11), color: appTheme.colors.textMuted,
    marginBottom: mvs(14),
  },

  // Progress bar
  progressTrack: {
    width: '55%', height: mvs(3), borderRadius: 99,
    backgroundColor: appTheme.colors.backgroundSecondary,
    marginBottom: mvs(20), overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: 99,
    backgroundColor: appTheme.colors.accentPrimary,
  },

  // Step dots
  dotsRow: {flexDirection: 'row', alignItems: 'center'},
  dotItem: {alignItems: 'center', gap: mvs(5), width: scale(74)},
  dotLine: {
    flex: 1, height: 1.5,
    backgroundColor: appTheme.colors.backgroundSecondary,
    borderRadius: 99, marginBottom: mvs(22),
  },
  dotLineDone: {backgroundColor: appTheme.colors.chipBorder},
  dot: {
    width: scale(30), height: scale(30), borderRadius: scale(15),
    backgroundColor: appTheme.colors.backgroundSecondary,
    alignItems: 'center', justifyContent: 'center',
  },
  dotActive: {
    backgroundColor: appTheme.colors.accentPrimary,
    elevation: 3,
    shadowColor: appTheme.colors.shadowColor,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.2, shadowRadius: 3,
  },
  dotDone: {
    backgroundColor: appTheme.colors.accentSoft,
    borderWidth: 1.5, borderColor: appTheme.colors.chipBorder,
  },
  dotLabel: {fontSize: ms(10), color: appTheme.colors.textMuted, fontWeight: '500', textAlign: 'center'},
  dotLabelActive: {color: appTheme.colors.accentPrimary, fontWeight: '700'},
  dotLabelDone:   {color: appTheme.colors.accentSecondary, fontWeight: '600'},

  // Summary card
  summaryCard: {
    width: '100%', marginTop: mvs(18),
    backgroundColor: appTheme.colors.surfacePrimary,
    borderRadius: scale(16), borderWidth: 1, borderColor: appTheme.colors.surfaceBorder,
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: scale(14), paddingVertical: mvs(12), gap: scale(12),
  },
  summaryDivider: {height: 1, backgroundColor: appTheme.colors.backgroundSecondary},
  summaryTexts: {flex: 1},
  summaryLabel: {fontSize: ms(10), color: appTheme.colors.textMuted, fontWeight: '500'},
  summaryValue: {fontSize: ms(13), color: appTheme.colors.textPrimary, fontWeight: '700'},
  tag: {
    backgroundColor: appTheme.colors.chipBg,
    borderRadius: scale(8), paddingHorizontal: scale(8), paddingVertical: mvs(3),
    borderWidth: 1, borderColor: appTheme.colors.chipBorder,
  },
  tagNew: {backgroundColor: '#FFF8E1', borderColor: '#FFE082'},
  tagTxt: {fontSize: ms(10), fontWeight: '700', color: appTheme.colors.accentPrimary},

  // Proceed button
  proceedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(10),
    width: '100%',
    height: mvs(52),
    borderRadius: scale(14),
    backgroundColor: appTheme.colors.accentPrimary,
    marginTop: mvs(16),
    elevation: 6,
    shadowColor: appTheme.colors.shadowColor,
    shadowOffset: {width: 0, height: mvs(3)},
    shadowOpacity: 0.25,
    shadowRadius: scale(8),
  },
  proceedBtnPressed: {
    backgroundColor: appTheme.colors.accentSecondary,
    elevation: 2,
  },
  proceedTxt: {
    fontSize: ms(15),
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },

  // Error
  errorTitle: {
    fontSize: ms(19), fontWeight: '800',
    color: appTheme.colors.textPrimary,
    textAlign: 'center', marginBottom: mvs(8),
  },
  errorMsg: {
    fontSize: ms(13), color: appTheme.colors.textSecondary,
    textAlign: 'center', lineHeight: mvs(20), marginBottom: mvs(26),
  },
  retryBtn: {
    width: '100%', height: mvs(50), borderRadius: scale(14),
    backgroundColor: appTheme.colors.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
    elevation: 5,
    shadowColor: appTheme.colors.shadowColor,
    shadowOffset: {width: 0, height: mvs(3)},
    shadowOpacity: 0.22, shadowRadius: scale(6),
  },
  retryTxt: {
    fontSize: ms(14), fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5,
  },

  // Footer
  footer: {
    textAlign: 'center', paddingBottom: mvs(12),
    fontSize: ms(10), color: appTheme.colors.textMuted, letterSpacing: 0.4,
  },
  footerBrand: {
    fontSize: ms(10), color: appTheme.colors.accentPrimary, fontWeight: '700',
  },
});

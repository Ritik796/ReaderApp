import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import appTheme from '../theme/appTheme';
import {useAppSafeArea} from '../context/AppSafeAreaContext';
import {useToast} from '../context/ToastContext';
import {checkForUpdates} from '../services/otaService';
import UpdateModal from '../Components/UpdateModal/UpdateModal';

function LauncherScreen({navigation}) {
  const {top, bottom} = useAppSafeArea();
  const {width} = useWindowDimensions();
  const {showToast} = useToast();
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(24)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const contentWidth = Math.min(width - 34, 430);
  const logoSize = Math.max(132, Math.min(178, width * 0.4));
  const navigateTimerRef = useRef(null);
  const updateActionRef = useRef(null);
  const [otaModal, setOtaModal] = useState({
    visible: false,
    title: '',
    progress: 0,
    status: '',
    version: '',
    description: '',
    actionLabel: '',
    isDownloading: false,
    canStartUpdate: false,
    showUnavailableMessage: false,
    unavailableMessage: '',
    hideActions: false,
    hideFooterNote: false,
    nonDismissible: false,
  });

  const hideUpdateModal = useCallback(() => {
    setOtaModal(prev => ({...prev, visible: false}));
    updateActionRef.current = null;
  }, []);

  const startUpdate = useCallback(() => {
    updateActionRef.current?.();
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.02,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.start();

    let cancelled = false;

    const runStartup = async () => {
      try {
        const foundUpdate = await checkForUpdates(
          {
            onUpdateFound: (version, description, onUpdatePress, options = {}) => {
              updateActionRef.current = onUpdatePress;
              setOtaModal({
                visible: true,
                title: options.modalTitle || 'New update available',
                progress: 0,
                status: options.updateType === 'native' ? 'Update required' : 'Preparing update...',
                version: String(version || '').replace(/^v/i, ''),
                description,
                actionLabel: options.actionLabel || 'Update Now',
                isDownloading: false,
                canStartUpdate: true,
                showUnavailableMessage: Boolean(options.showUnavailableMessage),
                unavailableMessage: options.unavailableMessage || '',
                hideActions: Boolean(options.hideActions),
                hideFooterNote: Boolean(options.hideFooterNote),
                nonDismissible: Boolean(options.nonDismissible),
              });
            },
            onProgress: progress => {
              setOtaModal(prev => ({
                ...prev,
                visible: true,
                isDownloading: true,
                progress: Number(progress) || 0,
                status: 'Downloading update...',
                canStartUpdate: false,
                hideActions: true,
              }));
            },
            onComplete: () => {
              hideUpdateModal();
            },
            onError: error => {
              showToast('warning', error?.message || 'Update check could not be completed.');
              hideUpdateModal();
              // Prevent screen from getting stuck if download fails
              navigateTimerRef.current = setTimeout(() => {
                if (!cancelled) {
                  navigation.replace('Login');
                }
              }, 1200);
            },
          },
          null,
          {skipNativeExit: false},
        );

        if (cancelled || foundUpdate) {
          return;
        }

        navigateTimerRef.current = setTimeout(() => {
          if (!cancelled) {
            navigation.replace('Login');
          }
        }, 1800);
      } catch (error) {
        showToast('warning', error?.message || 'Update check could not be completed.');
        navigateTimerRef.current = setTimeout(() => {
          if (!cancelled) {
            navigation.replace('Login');
          }
        }, 1800);
      }
    };

    runStartup();

    return () => {
      cancelled = true;
      pulseLoop.stop();
      if (navigateTimerRef.current) {
        clearTimeout(navigateTimerRef.current);
      }
    };
  }, [fade, hideUpdateModal, navigation, rise, pulse, showToast]);

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={[styles.screen, {paddingTop: top + 12, paddingBottom: bottom + 12}]}
    >
      <View style={styles.bgMeshA} />
      <View style={styles.bgMeshB} />
      <View style={styles.bgMeshC} />

      <Animated.View
        style={[
          styles.content,
          {width: contentWidth},
          {
            opacity: fade,
            transform: [{translateY: rise}],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.logoShell,
            {
              width: logoSize,
              height: logoSize,
              borderRadius: logoSize / 2,
              transform: [{scale: pulse}],
            },
          ]}
        >
          <Image
            source={require('../Assets/Images/ReaderAppLogo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

        <Text style={styles.title}>Reader App</Text>
        <Text style={styles.subtitle}>Smart card collection system</Text>
      </Animated.View>

      <View style={styles.footerWrap}>
        <Text style={styles.footer}>
          Powered by <Text style={styles.footerBrand}>Wevois Labs Pvt Ltd</Text>
        </Text>
      </View>

      <UpdateModal
        visible={otaModal.visible}
        title={otaModal.title}
        progress={otaModal.progress}
        status={otaModal.status}
        version={otaModal.version}
        description={otaModal.description}
        actionLabel={otaModal.actionLabel}
        onUpdatePress={startUpdate}
        isDownloading={otaModal.isDownloading}
        canStartUpdate={otaModal.canStartUpdate}
        showUnavailableMessage={otaModal.showUnavailableMessage}
        unavailableMessage={otaModal.unavailableMessage}
        hideActions={otaModal.hideActions}
        hideFooterNote={otaModal.hideFooterNote}
        nonDismissible={otaModal.nonDismissible}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: appTheme.colors.safeAreaBackground,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  bgMeshA: {
    position: 'absolute',
    top: -120,
    left: -70,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: appTheme.colors.glowTop,
    opacity: 0.45,
  },
  bgMeshB: {
    position: 'absolute',
    bottom: -130,
    right: -80,
    width: 310,
    height: 310,
    borderRadius: 155,
    backgroundColor: appTheme.colors.glowBottom,
    opacity: 0.42,
  },
  bgMeshC: {
    position: 'absolute',
    top: '36%',
    right: -90,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: appTheme.colors.backgroundSecondary,
    opacity: 0.75,
  },
  content: {
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  logoShell: {
    marginTop: 6,
    backgroundColor: appTheme.colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: appTheme.colors.surfaceBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 22,
    shadowColor: appTheme.colors.shadowColor,
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: {width: 0, height: 10},
    elevation: 6,
  },
  logoImage: {
    width: '86%',
    height: '86%',
  },
  title: {
    marginTop: 4,
    fontSize: 36,
    lineHeight: 42,
    color: appTheme.colors.textPrimary,
    fontFamily: appTheme.typography.titleFontFamily,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 16,
    color: appTheme.colors.textSecondary,
    fontWeight: '500',
    letterSpacing: 0.2,
    marginBottom: 4,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  footerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  footer: {
    textAlign: 'center',
    fontSize: 10,
    color: appTheme.colors.textMuted,
    letterSpacing: 0.4,
  },
  footerBrand: {
    fontSize: 10,
    color: appTheme.colors.accentPrimary,
    fontWeight: '700',
  },
});

export default LauncherScreen;

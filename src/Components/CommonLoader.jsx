import React, {useEffect, useRef} from 'react';
import {
  Animated,
  Easing,
  Image,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import appTheme from '../theme/appTheme';
import {ms, mvs, scale} from '../utils/responsive';

function CommonLoader({
  isLoading = false,
  text = 'Please wait...',
  smallArea = false,
}) {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    } else {
      spinAnim.setValue(0);
    }
  }, [isLoading, spinAnim]);

  if (!isLoading) return null;

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const content = (
    <View style={s.card}>
      <View style={s.spinnerWrap}>
        <View style={s.spinnerTrack} />
        <Animated.View style={[s.spinnerArc, {transform: [{rotate: spin}]}]} />
        <View style={s.logoShell}>
          <Image
            source={require('../Assets/Images/CompanyLogo.png')}
            style={s.logo}
            resizeMode="contain"
          />
        </View>
      </View>
      <Text style={s.text}>{text}</Text>
    </View>
  );

  if (smallArea) {
    return <View style={s.smallOverlay}>{content}</View>;
  }

  return (
    <Modal transparent visible={isLoading} animationType="fade">
      <View style={s.overlay}>{content}</View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(13,50,93,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13,50,93,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  card: {
    minWidth: scale(210),
    borderRadius: scale(14),
    paddingHorizontal: scale(20),
    paddingVertical: mvs(18),
    alignItems: 'center',
    backgroundColor: appTheme.colors.surfacePrimary,
    borderWidth: 1,
    borderColor: appTheme.colors.surfaceBorder,
    elevation: 8,
    shadowColor: appTheme.colors.shadowColor,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  spinnerWrap: {
    width: scale(72),
    height: scale(72),
    borderRadius: scale(36),
    backgroundColor: appTheme.colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: appTheme.colors.chipBorder,
    overflow: 'hidden',
  },
  spinnerTrack: {
    position: 'absolute',
    inset: 2,
    borderRadius: scale(34),
    borderWidth: 3,
    borderColor: appTheme.colors.chipBorder,
  },
  spinnerArc: {
    position: 'absolute',
    inset: 2,
    borderRadius: scale(34),
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: appTheme.colors.accentPrimary,
    borderRightColor: appTheme.colors.accentSecondary,
  },
  logoShell: {
    width: scale(54),
    height: scale(54),
    borderRadius: scale(27),
    backgroundColor: appTheme.colors.surfacePrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: scale(42),
    height: scale(42),
  },
  text: {
    marginTop: mvs(12),
    fontSize: ms(13),
    fontWeight: '600',
    color: appTheme.colors.textSecondary,
    textAlign: 'center',
  },
});

export default CommonLoader;

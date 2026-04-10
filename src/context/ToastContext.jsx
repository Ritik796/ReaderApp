import React, {createContext, useCallback, useContext, useRef, useState} from 'react';
import {Animated, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import appTheme from '../theme/appTheme';
import {ms, mvs, scale} from '../utils/responsive';

const ToastContext = createContext({
  showToast: () => {},
});

const TYPE_CONFIG = {
  success: {
    bg: '#EEF9F2',
    border: '#2E7D32',
    icon: 'check-circle',
  },
  error: {
    bg: '#FFF1F0',
    border: '#D32F2F',
    icon: 'alert-circle',
  },
  info: {
    bg: '#EDF5FF',
    border: appTheme.colors.accentPrimary,
    icon: 'information',
  },
  warning: {
    bg: '#FFF8E8',
    border: '#ED6C02',
    icon: 'alert',
  },
};

function ToastProvider({children}) {
  const [toast, setToast] = useState({
    visible: false,
    type: 'info',
    message: '',
  });
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef(null);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => setToast(prev => ({...prev, visible: false})));
  }, [opacity, translateY]);

  const showToast = useCallback(
    (type = 'info', message = '', duration = 2500) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      const nextType = TYPE_CONFIG[type] ? type : 'info';
      setToast({visible: true, type: nextType, message: String(message || '')});
      translateY.setValue(-120);
      opacity.setValue(0);
      progressAnim.setValue(1);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();

      Animated.timing(progressAnim, {
        toValue: 0,
        duration,
        useNativeDriver: false,
      }).start();

      timerRef.current = setTimeout(dismiss, duration);
    },
    [dismiss, opacity, progressAnim, translateY],
  );

  const cfg = TYPE_CONFIG[toast.type] || TYPE_CONFIG.info;

  return (
    <ToastContext.Provider value={{showToast}}>
      {children}
      {toast.visible ? (
        <Animated.View
          style={[
            s.toast,
            {
              backgroundColor: cfg.bg,
              borderLeftColor: cfg.border,
              transform: [{translateY}],
              opacity,
            },
          ]}>
          <View style={s.body}>
            <MaterialCommunityIcons name={cfg.icon} size={scale(21)} color={cfg.border} />
            <Text style={s.message} numberOfLines={2}>
              {toast.message}
            </Text>
            <TouchableOpacity onPress={dismiss} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <MaterialCommunityIcons
                name="close"
                size={scale(18)}
                color={appTheme.colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
          <View style={s.progressBg}>
            <Animated.View
              style={[
                s.progressFill,
                {
                  backgroundColor: cfg.border,
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

function useToast() {
  return useContext(ToastContext);
}

const s = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: mvs(52),
    left: scale(16),
    right: scale(16),
    borderRadius: scale(12),
    borderLeftWidth: 4,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: appTheme.colors.shadowColor,
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.16,
    shadowRadius: 12,
    zIndex: 9999,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    paddingHorizontal: scale(14),
    paddingTop: mvs(11),
    paddingBottom: mvs(9),
  },
  message: {
    flex: 1,
    fontSize: ms(13),
    lineHeight: mvs(18),
    color: appTheme.colors.textPrimary,
    fontWeight: '500',
  },
  progressBg: {
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  progressFill: {
    height: '100%',
    opacity: 0.75,
  },
});

export {ToastProvider, useToast};

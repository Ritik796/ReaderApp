import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import appTheme from '../../theme/appTheme';
import {mvs, scale} from '../../utils/responsive';

const HEADER_H   = mvs(58);
const STRIP_H    = mvs(72);
const TOP_OFFSET = mvs(44);

export default function MapControls({onCenterPress, onInfoPress, drawerOpen}) {
  return (
    <View style={s.wrap}>
      <Pressable style={s.btn} onPress={onCenterPress}>
        <MaterialCommunityIcons
          name="crosshairs-gps"
          size={scale(18)}
          color={appTheme.colors.accentPrimary}
        />
      </Pressable>
      <Pressable style={s.btn} onPress={onInfoPress}>
        <MaterialCommunityIcons
          name={drawerOpen ? 'chevron-down' : 'information-variant'}
          size={scale(18)}
          color={appTheme.colors.accentPrimary}
        />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: TOP_OFFSET + HEADER_H + STRIP_H + mvs(18),
    right: scale(12),
    gap: mvs(8),
  },
  btn: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(12),
    backgroundColor: appTheme.colors.surfacePrimary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: appTheme.colors.shadowColor,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
});

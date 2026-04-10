import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import appTheme from '../../theme/appTheme';
import {ms, mvs, scale} from '../../utils/responsive';

export default function LastScannedChip({lastScanned, bottomH}) {
  if (!lastScanned) {
    return null;
  }

  return (
    <View style={[s.chip, {bottom: bottomH + mvs(10)}]}>
      <MaterialCommunityIcons
        name="credit-card-scan"
        size={scale(13)}
        color={appTheme.colors.accentPrimary}
      />
      <Text style={s.txt}>
        Last: <Text style={s.id}>{lastScanned.id}</Text>
        {'  ·  '}
        {lastScanned.time}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  chip: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    backgroundColor: appTheme.colors.surfacePrimary,
    borderRadius: scale(20),
    paddingHorizontal: scale(12),
    paddingVertical: mvs(6),
    borderWidth: 1,
    borderColor: appTheme.colors.chipBorder,
    elevation: 3,
  },
  txt: {fontSize: ms(11), color: appTheme.colors.textSecondary},
  id: {fontWeight: '700', color: appTheme.colors.textPrimary},
});

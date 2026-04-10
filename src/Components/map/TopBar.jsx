import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import appTheme from '../../theme/appTheme';
import {ms, mvs, scale} from '../../utils/responsive';

const HEADER_H   = mvs(58);
const TOP_OFFSET = mvs(44);

export default function TopBar({
  deviceName,
  ward,
  assignment,
  syncing,
  netOffline,
  onSyncPress,
}) {
  const syncIcon  = syncing ? 'sync' : netOffline ? 'wifi-off' : 'cloud-check';
  const syncColor = syncing ? '#FFFFFF' : netOffline ? '#E65100' : appTheme.colors.accentPrimary;
  const syncLabel = syncing ? 'Syncing' : netOffline ? 'Offline' : 'Live';

  return (
    <View style={s.bar}>
      <View style={s.left}>
        <Text style={s.deviceName}>{deviceName}</Text>
      </View>

      <View style={s.center}>
        <Text style={s.ward}>{ward}</Text>
        <Text style={s.assignment} numberOfLines={1}>{assignment}</Text>
      </View>

      <View style={s.right}>
        <Pressable
          style={[s.syncBadge, syncing && s.syncBadgeActive]}
          onPress={onSyncPress}>
          <MaterialCommunityIcons name={syncIcon} size={scale(14)} color={syncColor} />
          <Text style={[s.syncTxt, syncing && {color: '#FFFFFF'}]}>{syncLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: TOP_OFFSET,
    left: scale(10),
    right: scale(10),
    height: HEADER_H,
    backgroundColor: appTheme.colors.surfacePrimary,
    borderRadius: scale(16),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(12),
    elevation: 6,
    shadowColor: appTheme.colors.shadowColor,
    shadowOffset: {width: 0, height: mvs(3)},
    shadowOpacity: 0.14,
    shadowRadius: scale(8),
  },
  left: {minWidth: scale(52)},
  deviceName: {
    fontSize: ms(12),
    fontWeight: '800',
    color: appTheme.colors.accentPrimary,
    letterSpacing: 0.5,
  },
  center: {flex: 1, alignItems: 'center'},
  ward: {
    fontSize: ms(13),
    fontWeight: '700',
    color: appTheme.colors.textPrimary,
  },
  assignment: {
    fontSize: ms(10),
    color: appTheme.colors.textSecondary,
    fontWeight: '500',
  },
  right: {minWidth: scale(60), alignItems: 'flex-end'},
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    backgroundColor: appTheme.colors.chipBg,
    borderRadius: scale(10),
    paddingHorizontal: scale(8),
    paddingVertical: mvs(4),
    borderWidth: 1,
    borderColor: appTheme.colors.chipBorder,
  },
  syncBadgeActive: {
    backgroundColor: appTheme.colors.accentPrimary,
    borderColor: appTheme.colors.accentPrimary,
  },
  syncTxt: {
    fontSize: ms(10),
    fontWeight: '700',
    color: appTheme.colors.accentPrimary,
  },
});

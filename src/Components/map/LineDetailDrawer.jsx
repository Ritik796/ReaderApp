import React from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import appTheme from '../../theme/appTheme';
import {ms, mvs, scale} from '../../utils/responsive';

const SNAPSHOT_ROWS = [
  {icon: 'clipboard-list', label: 'Assignment', key: 'assignment'},
  {icon: 'cellphone',      label: 'Device',     key: 'deviceName'},
  {icon: 'truck',          label: 'Vehicle',    key: 'vehicle'},
  {icon: 'account',        label: 'Worker',     key: 'workerName'},
];

export default function LineDetailDrawer({
  drawerAnim,
  drawerH,
  bottomH,
  currentLine,
  lineTotal,
  lineScanCount,
  assignment,
  deviceName,
  vehicle,
  workerName,
}) {
  const pct = Math.round((lineScanCount / lineTotal) * 100);
  const data = {assignment, deviceName, vehicle, workerName};

  return (
    <Animated.View
      style={[
        s.drawer,
        {bottom: bottomH, height: drawerH, transform: [{translateY: drawerAnim}]},
      ]}>
      <View style={s.handle} />

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Line stats */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Current Line</Text>

          <View style={s.statRow}>
            <View style={s.statBox}>
              <Text style={s.statVal}>Line {currentLine}</Text>
              <Text style={s.statLbl}>Line No.</Text>
            </View>
            <View style={s.statBox}>
              <Text style={s.statVal}>{lineTotal}</Text>
              <Text style={s.statLbl}>Total Houses</Text>
            </View>
            <View style={s.statBox}>
              <Text style={[s.statVal, {color: appTheme.colors.accentPrimary}]}>{pct}%</Text>
              <Text style={s.statLbl}>Completed</Text>
            </View>
          </View>

          <View style={s.progressTrack}>
            <View style={[s.progressFill, {width: `${pct}%`}]} />
          </View>

          <View style={s.btnRow}>
            <Pressable style={s.btn}>
              <MaterialCommunityIcons name="skip-forward" size={scale(14)} color="#FFFFFF" />
              <Text style={s.btnTxt}>Next Line</Text>
            </Pressable>
            <Pressable style={[s.btn, s.btnOutline]}>
              <MaterialCommunityIcons
                name="clock-alert-outline"
                size={scale(14)}
                color={appTheme.colors.accentPrimary}
              />
              <Text style={[s.btnTxt, {color: appTheme.colors.accentPrimary}]}>
                View Pending
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Assignment snapshot */}
        <View style={[s.section, s.sectionBorder]}>
          <Text style={s.sectionTitle}>Assignment Snapshot</Text>
          {SNAPSHOT_ROWS.map(r => (
            <View key={r.label} style={s.snapshotRow}>
              <MaterialCommunityIcons
                name={r.icon}
                size={scale(15)}
                color={appTheme.colors.textMuted}
              />
              <Text style={s.snapshotLabel}>{r.label}</Text>
              <Text style={s.snapshotVal}>{data[r.key]}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  drawer: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: appTheme.colors.surfacePrimary,
    borderTopLeftRadius: scale(22),
    borderTopRightRadius: scale(22),
    elevation: 12,
    shadowColor: appTheme.colors.shadowColor,
    shadowOffset: {width: 0, height: -mvs(4)},
    shadowOpacity: 0.15,
    shadowRadius: scale(12),
  },
  handle: {
    width: scale(40),
    height: mvs(4),
    borderRadius: 99,
    backgroundColor: appTheme.colors.surfaceBorder,
    alignSelf: 'center',
    marginTop: mvs(10),
    marginBottom: mvs(6),
  },
  section: {paddingHorizontal: scale(18), paddingBottom: mvs(14)},
  sectionBorder: {
    borderTopWidth: 1,
    borderTopColor: appTheme.colors.backgroundSecondary,
  },
  sectionTitle: {
    fontSize: ms(11),
    fontWeight: '700',
    color: appTheme.colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: mvs(10),
    marginTop: mvs(6),
  },
  statRow: {flexDirection: 'row', gap: scale(8), marginBottom: mvs(10)},
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: appTheme.colors.backgroundSecondary,
    borderRadius: scale(12),
    paddingVertical: mvs(10),
  },
  statVal: {fontSize: ms(16), fontWeight: '800', color: appTheme.colors.textPrimary},
  statLbl: {fontSize: ms(10), color: appTheme.colors.textMuted, marginTop: mvs(2)},
  progressTrack: {
    height: mvs(5),
    borderRadius: 99,
    backgroundColor: appTheme.colors.backgroundSecondary,
    marginBottom: mvs(12),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: appTheme.colors.accentPrimary,
  },
  btnRow: {flexDirection: 'row', gap: scale(10)},
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    height: mvs(40),
    backgroundColor: appTheme.colors.accentPrimary,
    borderRadius: scale(12),
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: appTheme.colors.accentPrimary,
  },
  btnTxt: {fontSize: ms(12), fontWeight: '700', color: '#FFFFFF'},
  snapshotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    paddingVertical: mvs(8),
    borderBottomWidth: 1,
    borderBottomColor: appTheme.colors.backgroundSecondary,
  },
  snapshotLabel: {flex: 1, fontSize: ms(12), color: appTheme.colors.textMuted},
  snapshotVal: {fontSize: ms(12), fontWeight: '700', color: appTheme.colors.textPrimary},
});

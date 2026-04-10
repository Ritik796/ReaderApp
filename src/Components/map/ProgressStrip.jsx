import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import appTheme from '../../theme/appTheme';
import {ms, mvs, scale} from '../../utils/responsive';

const HEADER_H   = mvs(58);
const STRIP_H    = mvs(72);
const TOP_OFFSET = mvs(44);

function StatCard({icon, label, value, sub, accent}) {
  return (
    <View style={[s.card, accent && s.cardAccent]}>
      <MaterialCommunityIcons
        name={icon}
        size={scale(16)}
        color={accent ? '#FFFFFF' : appTheme.colors.accentPrimary}
      />
      <Text style={[s.val, accent && s.valWhite]}>{value}</Text>
      <Text style={[s.label, accent && s.labelWhite]}>{label}</Text>
      {sub ? <Text style={[s.sub, accent && s.labelWhite]}>{sub}</Text> : null}
    </View>
  );
}

export default function ProgressStrip({
  lineScanCount,
  lineTotal,
  wardScanCount,
  wardTotal,
  currentLine,
}) {
  const pct     = Math.round((lineScanCount / lineTotal) * 100);
  const wardPct = Math.round((wardScanCount / wardTotal) * 100);

  return (
    <View style={s.strip}>
      <StatCard
        icon="barcode-scan"
        label="Line Scanned"
        value={`${lineScanCount}/${lineTotal}`}
        sub={`${pct}%`}
      />
      <View style={s.divider} />
      <StatCard
        icon="map-marker-check"
        label="Ward Scanned"
        value={`${wardScanCount}/${wardTotal}`}
        sub={`${wardPct}%`}
      />
      <View style={s.divider} />
      <StatCard
        icon="map-marker-path"
        label="Current Line"
        value={`Line ${currentLine}`}
        accent
      />
    </View>
  );
}

const s = StyleSheet.create({
  strip: {
    position: 'absolute',
    top: TOP_OFFSET + HEADER_H + mvs(8),
    left: scale(10),
    right: scale(10),
    height: STRIP_H,
    backgroundColor: appTheme.colors.surfacePrimary,
    borderRadius: scale(14),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(6),
    elevation: 4,
    shadowColor: appTheme.colors.shadowColor,
    shadowOffset: {width: 0, height: mvs(2)},
    shadowOpacity: 0.1,
    shadowRadius: scale(6),
  },
  card: {
    flex: 1,
    alignItems: 'center',
    gap: mvs(2),
    paddingVertical: mvs(6),
    borderRadius: scale(10),
  },
  cardAccent: {
    backgroundColor: appTheme.colors.accentPrimary,
    marginVertical: mvs(4),
  },
  val: {fontSize: ms(14), fontWeight: '800', color: appTheme.colors.textPrimary},
  valWhite: {color: '#FFFFFF'},
  label: {fontSize: ms(9), color: appTheme.colors.textMuted, fontWeight: '500'},
  labelWhite: {color: 'rgba(255,255,255,0.8)'},
  sub: {fontSize: ms(9), color: appTheme.colors.accentSecondary, fontWeight: '600'},
  divider: {width: 1, height: mvs(32), backgroundColor: appTheme.colors.surfaceBorder},
});

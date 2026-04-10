import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import appTheme from '../../theme/appTheme';
import {ms, mvs, scale} from '../../utils/responsive';

const CARD_STATUS = {
  valid: {
    color: '#2E7D32',
    bg: '#E8F5E9',
    icon: 'check-circle',
    label: 'Valid Card — Scanned',
  },
  duplicate: {
    color: '#E65100',
    bg: '#FFF3E0',
    icon: 'alert-circle',
    label: 'Duplicate — Already Scanned',
  },
  not_in_line: {
    color: '#C62828',
    bg: '#FFEBEE',
    icon: 'close-circle',
    label: 'Not In Line',
  },
};

export default function BottomPanel({
  cardStatus,
  onClearStatus,
  scanMode,
  onScanModeChange,
  onScan,
  gpsOff,
  netOffline,
  onGpsToggle,
  onNetToggle,
  bottomH,
}) {
  const statusCfg = cardStatus ? CARD_STATUS[cardStatus] : null;

  return (
    <View style={[s.panel, {height: bottomH}]}>

      {/* Scan result strip */}
      {statusCfg && (
        <View style={[s.statusStrip, {backgroundColor: statusCfg.bg}]}>
          <MaterialCommunityIcons
            name={statusCfg.icon}
            size={scale(15)}
            color={statusCfg.color}
          />
          <Text style={[s.statusTxt, {color: statusCfg.color}]}>{statusCfg.label}</Text>
          <Pressable onPress={onClearStatus} hitSlop={8}>
            <MaterialCommunityIcons name="close" size={scale(14)} color={statusCfg.color} />
          </Pressable>
        </View>
      )}

      <View style={s.row}>

        {/* RFID / QR mode tabs */}
        <View style={s.modeTabs}>
          {['rfid', 'qr'].map(mode => (
            <TouchableOpacity
              key={mode}
              style={[s.modeTab, scanMode === mode && s.modeTabActive]}
              onPress={() => onScanModeChange(mode)}
              activeOpacity={0.8}>
              <MaterialCommunityIcons
                name={mode === 'rfid' ? 'nfc' : 'qrcode-scan'}
                size={scale(15)}
                color={scanMode === mode ? '#FFFFFF' : appTheme.colors.textMuted}
              />
              <Text style={[s.modeTabTxt, scanMode === mode && s.modeTabTxtActive]}>
                {mode.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Primary scan button */}
        <Pressable style={s.scanBtn} onPress={onScan}>
          <MaterialCommunityIcons
            name={scanMode === 'rfid' ? 'nfc-tap' : 'qrcode'}
            size={scale(28)}
            color="#FFFFFF"
          />
          <Text style={s.scanBtnTxt}>
            {scanMode === 'rfid' ? 'RFID Ready' : 'Open QR'}
          </Text>
        </Pressable>

        {/* GPS / Network dev toggles */}
        <View style={s.toggleCol}>
          <Pressable style={s.toggleBtn} onPress={onGpsToggle}>
            <MaterialCommunityIcons
              name={gpsOff ? 'map-marker-off' : 'map-marker'}
              size={scale(15)}
              color={gpsOff ? '#C62828' : appTheme.colors.accentPrimary}
            />
          </Pressable>
          <Pressable style={s.toggleBtn} onPress={onNetToggle}>
            <MaterialCommunityIcons
              name={netOffline ? 'wifi-off' : 'wifi'}
              size={scale(15)}
              color={netOffline ? '#E65100' : appTheme.colors.accentPrimary}
            />
          </Pressable>
        </View>

      </View>
    </View>
  );
}

const s = StyleSheet.create({
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: appTheme.colors.surfacePrimary,
    borderTopLeftRadius: scale(20),
    borderTopRightRadius: scale(20),
    paddingHorizontal: scale(14),
    paddingTop: mvs(10),
    elevation: 14,
    shadowColor: appTheme.colors.shadowColor,
    shadowOffset: {width: 0, height: -mvs(4)},
    shadowOpacity: 0.14,
    shadowRadius: scale(10),
  },
  statusStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    borderRadius: scale(10),
    paddingHorizontal: scale(12),
    paddingVertical: mvs(7),
    marginBottom: mvs(10),
  },
  statusTxt: {flex: 1, fontSize: ms(12), fontWeight: '700'},
  row: {flexDirection: 'row', alignItems: 'center', gap: scale(10)},
  modeTabs: {gap: mvs(6)},
  modeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    paddingHorizontal: scale(10),
    paddingVertical: mvs(7),
    borderRadius: scale(10),
    backgroundColor: appTheme.colors.backgroundSecondary,
  },
  modeTabActive: {backgroundColor: appTheme.colors.accentPrimary},
  modeTabTxt: {fontSize: ms(11), fontWeight: '700', color: appTheme.colors.textMuted},
  modeTabTxtActive: {color: '#FFFFFF'},
  scanBtn: {
    flex: 1,
    height: mvs(72),
    backgroundColor: appTheme.colors.accentPrimary,
    borderRadius: scale(18),
    alignItems: 'center',
    justifyContent: 'center',
    gap: mvs(4),
    elevation: 6,
    shadowColor: appTheme.colors.shadowColor,
    shadowOffset: {width: 0, height: mvs(3)},
    shadowOpacity: 0.2,
    shadowRadius: scale(8),
  },
  scanBtnTxt: {
    fontSize: ms(12),
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  toggleCol: {gap: mvs(6)},
  toggleBtn: {
    width: scale(38),
    height: scale(32),
    backgroundColor: appTheme.colors.backgroundSecondary,
    borderRadius: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
});

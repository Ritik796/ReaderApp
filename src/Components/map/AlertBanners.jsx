import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {ms, mvs, scale} from '../../utils/responsive';

const HEADER_H   = mvs(58);
const STRIP_H    = mvs(72);
const TOP_OFFSET = mvs(44);
const BASE_TOP   = TOP_OFFSET + HEADER_H + STRIP_H + mvs(16);
const BANNER_H   = mvs(42);

export default function AlertBanners({gpsOff, netOffline}) {
  if (!gpsOff && !netOffline) {
    return null;
  }

  return (
    <>
      {gpsOff && (
        <View style={[s.banner, {top: BASE_TOP}]}>
          <MaterialCommunityIcons name="map-marker-off" size={scale(15)} color="#FFFFFF" />
          <Text style={s.txt}>GPS बंद है — Location सेवाएँ चालू करें</Text>
        </View>
      )}
      {netOffline && (
        <View style={[s.banner, s.orange, {top: BASE_TOP + (gpsOff ? BANNER_H + mvs(6) : 0)}]}>
          <MaterialCommunityIcons name="wifi-off" size={scale(15)} color="#FFFFFF" />
          <Text style={s.txt}>Network नहीं है — Offline Mode में काम हो रहा है</Text>
        </View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: scale(10),
    right: scale(10),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    backgroundColor: '#C62828',
    borderRadius: scale(10),
    paddingHorizontal: scale(12),
    paddingVertical: mvs(8),
    elevation: 5,
  },
  orange: {backgroundColor: '#E65100'},
  txt: {flex: 1, fontSize: ms(11), color: '#FFFFFF', fontWeight: '600'},
});

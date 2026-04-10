import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {ms, scale} from '../../utils/responsive';
import {CITY} from '../../Firebase/firebaseConfig';

const SmartCardMarker = ({id = 'BTPR105601'}) => {
  return (
    <View style={s.cardContainer}>
      <Text style={s.headerText}>DOOR TO DOOR SMART CARD</Text>
      <View style={s.innerBox}>
        <View style={s.qrSection}>
          <View style={s.qrFrame}>
            <MaterialCommunityIcons
              name="qrcode-scan"
              size={scale(12)}
              color="#1F1F1F"
            />
          </View>
        </View>

        <View style={s.divider} />

        <View style={s.infoSection}>
          <View style={s.logoBadge}>
            <Text style={s.keyText}>{CITY.key}</Text>
          </View>
          <Text style={s.nagarNigamText}>NAGAR NIGAM BHARATPUR</Text>
          <Text style={s.hindiText}>नगर निगम भरतपुर</Text>
        </View>
      </View>

      <Text style={s.idText} numberOfLines={1}>
        {id}
      </Text>
    </View>
  );
};

const s = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#EFEFEF',
    paddingHorizontal: scale(1.5),
    paddingVertical: scale(1.5),
    borderRadius: scale(4),
    borderWidth: 1.2,
    borderColor: '#AAAAAA',
    alignItems: 'center',
    width: scale(65),
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: scale(4),
    shadowOffset: {width: 0, height: 2},
    elevation: 4,
  },
  headerText: {
    fontSize: ms(3.5),
    fontWeight: '800',
    color: '#444',
    marginBottom: scale(1.5),
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  innerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#AAAAAA',
    paddingHorizontal: scale(2),
    paddingVertical: scale(2),
    borderRadius: scale(3),
    backgroundColor: '#F9F9F9',
    width: '100%',
  },
  qrSection: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrFrame: {
    width: scale(16),
    height: scale(16),
    padding: scale(1),
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: 1,
    height: scale(18),
    backgroundColor: '#BBBBBB',
    marginHorizontal: scale(2),
  },
  infoSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  logoBadge: {
    width: scale(13),
    height: scale(13),
    borderRadius: scale(6.5),
    borderWidth: 1,
    borderColor: '#AFAFAF',
    marginBottom: scale(1),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: ms(3.2),
    fontWeight: '900',
    color: '#1a5276',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  nagarNigamText: {
    fontSize: ms(3.2),
    fontWeight: '800',
    color: '#333',
    textAlign: 'center',
  },
  hindiText: {
    fontSize: ms(3.2),
    color: '#333',
    textAlign: 'center',
  },
  idText: {
    marginTop: scale(1),
    fontSize: ms(5.5),
    fontWeight: '900',
    letterSpacing: 0.5,
    color: '#222',
  },
});

export default SmartCardMarker;

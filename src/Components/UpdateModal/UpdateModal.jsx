import React from 'react';
import {Modal, View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import appTheme from '../../theme/appTheme';

const UpdateModal = ({
  visible,
  title,
  progress,
  status,
  version,
  description,
  actionLabel,
  onUpdatePress,
  isDownloading,
  canStartUpdate,
  showUnavailableMessage,
  unavailableMessage,
  hideActions,
  hideFooterNote,
  nonDismissible,
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={nonDismissible ? () => null : undefined}
  >
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Text style={styles.iconTxt}>UP</Text>
        </View>

        <Text style={styles.title}>{title || 'New update available'}</Text>

        {!!version && (
          <View style={styles.versionBadge}>
            <Text style={styles.versionTxt}>v{version}</Text>
          </View>
        )}

        <Text style={styles.desc}>
          {description || `A new version (v${version}) is available. Update now for better performance.`}
        </Text>

        <View style={styles.divider} />

        {isDownloading ? (
          <View style={styles.progressWrap}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>{status || 'Downloading...'}</Text>
              <Text style={styles.progressPct}>{progress}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, {width: `${progress}%`}]} />
            </View>
            <Text style={styles.warningTxt}>Do not close the app during the update.</Text>
          </View>
        ) : !hideActions && canStartUpdate ? (
          <TouchableOpacity style={styles.updateBtn} onPress={onUpdatePress} activeOpacity={0.85}>
            <Text style={styles.updateBtnTxt}>{actionLabel || 'Update Now'}</Text>
          </TouchableOpacity>
        ) : showUnavailableMessage ? (
          <View style={styles.unavailWrap}>
            <Text style={styles.unavailTxt}>
              {unavailableMessage || 'Automatic update not available. Please install the new app build.'}
            </Text>
          </View>
        ) : null}

        {!isDownloading && !hideFooterNote ? (
          <Text style={styles.footerNote}>This update is required to continue.</Text>
        ) : null}
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    backgroundColor: appTheme.colors.surfacePrimary,
    borderRadius: 20,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: appTheme.colors.surfaceBorder,
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: appTheme.colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 2,
    borderColor: appTheme.colors.chipBorder,
  },
  iconTxt: {
    fontSize: 20,
    fontWeight: '900',
    color: appTheme.colors.accentPrimary,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: appTheme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  versionBadge: {
    backgroundColor: appTheme.colors.accentSoft,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: appTheme.colors.chipBorder,
  },
  versionTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: appTheme.colors.accentPrimary,
  },
  desc: {
    fontSize: 14,
    color: appTheme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 14,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#e5e7eb',
    marginBottom: 14,
  },
  progressWrap: {
    width: '100%',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: appTheme.colors.textPrimary,
  },
  progressPct: {
    fontSize: 13,
    fontWeight: '800',
    color: appTheme.colors.accentPrimary,
  },
  progressTrack: {
    width: '100%',
    height: 10,
    backgroundColor: '#d1fae5',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: appTheme.colors.accentPrimary,
    borderRadius: 999,
  },
  warningTxt: {
    fontSize: 12,
    color: '#B45309',
    textAlign: 'center',
    fontWeight: '600',
  },
  updateBtn: {
    width: '100%',
    height: 52,
    backgroundColor: appTheme.colors.accentPrimary,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateBtnTxt: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  unavailWrap: {
    width: '100%',
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#D32F2F',
  },
  unavailTxt: {
    fontSize: 13,
    color: '#D32F2F',
    textAlign: 'center',
    lineHeight: 19,
  },
  footerNote: {
    marginTop: 14,
    fontSize: 11,
    color: appTheme.colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default UpdateModal;

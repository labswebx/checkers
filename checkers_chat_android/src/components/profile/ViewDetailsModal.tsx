import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { Avatar } from '../common/Avatar';
import { RootState } from '../../store';
import { colors, typography, spacing, borderRadius } from '../../theme';

interface ViewDetailsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ViewDetailsModal: React.FC<ViewDetailsModalProps> = ({ visible, onClose }) => {
  const { user } = useSelector((state: RootState) => state.auth);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <BlurView intensity={20} style={styles.overlay}>
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>Profile Details</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
              <View style={styles.avatarSection}>
                <Avatar
                  name={user?.name}
                  imageUrl={user?.profileImage}
                  size={80}
                  backgroundColor={colors.primaryLight}
                  textColor={colors.primary}
                />
              </View>

              <View style={styles.detailItem}>
                <Text style={styles.label}>Name</Text>
                <Text style={styles.value}>{user?.name || 'Not provided'}</Text>
              </View>

              <View style={styles.detailItem}>
                <Text style={styles.label}>Email</Text>
                <Text style={styles.value}>{user?.email || 'Not provided'}</Text>
              </View>

              <View style={styles.detailItem}>
                <Text style={styles.label}>Contact Number</Text>
                <Text style={styles.value}>{user?.contactNumber || 'Not available'}</Text>
              </View>
            </ScrollView>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  container: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text,
  },
  closeButton: {
    padding: spacing.xs,
  },
  content: {
    padding: spacing.lg,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  detailItem: {
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text,
  },
});
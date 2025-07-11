import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { useToast } from '../common/ToastProvider';
import { updateUserProfile } from '../../store/slices/authSlice';
import { RootState, AppDispatch } from '../../store';
import { colors, typography, spacing, borderRadius } from '../../theme';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ visible, onClose }) => {
  const { user, isLoading } = useSelector((state: RootState) => state.auth);
  const [name, setName] = useState(user?.name || '');
  const dispatch = useDispatch<AppDispatch>();
  const { showToast } = useToast();

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Name is required', 'error');
      return;
    }

    try {
      await dispatch(updateUserProfile({ name })).unwrap();
      showToast('Profile updated successfully', 'success');
      onClose();
    } catch (error: any) {
      showToast(error || 'Failed to update profile', 'error');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <BlurView intensity={20} style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Edit Profile</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Input
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
            />

            <View style={styles.buttons}>
              <Button
                title="Cancel"
                onPress={onClose}
                variant="secondary"
                disabled={isLoading}
              />
              <View style={styles.buttonSpacer} />
              <Button
                title="Save"
                onPress={handleSave}
                loading={isLoading}
                disabled={isLoading}
              />
            </View>
          </View>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  buttons: {
    flexDirection: 'row',
    marginTop: spacing.lg,
  },
  buttonSpacer: {
    width: spacing.md,
  },
});
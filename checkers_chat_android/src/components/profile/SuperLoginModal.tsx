import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { useToast } from '../common/ToastProvider';
import { superLoginUser } from '../../store/slices/authSlice';
import { RootState, AppDispatch } from '../../store';
import { colors, typography, spacing, borderRadius } from '../../theme';

interface SuperLoginModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SuperLoginModal: React.FC<SuperLoginModalProps> = ({ visible, onClose }) => {
  const [email, setEmail] = useState('');
  const { isLoading } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch<AppDispatch>();
  const { showToast } = useToast();

  const handleSuperLogin = async () => {
    if (!email.trim()) {
      showToast('Email is required', 'error');
      return;
    }

    try {
      await dispatch(superLoginUser(email)).unwrap();
      showToast('Super login successful!', 'success');
      onClose();
      setEmail('');
    } catch (error: any) {
      showToast(error || 'Super login failed', 'error');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <BlurView intensity={20} style={styles.overlay}>
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>Super Login</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              <Text style={styles.description}>
                Enter the email of the user you want to login as
              </Text>
              
              <Input
                label="User Email"
                value={email}
                onChangeText={setEmail}
                placeholder="Enter user email"
                keyboardType="email-address"
                autoCapitalize="none"
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
                  title="Super Login"
                  onPress={handleSuperLogin}
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
  description: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    marginTop: spacing.lg,
  },
  buttonSpacer: {
    width: spacing.md,
  },
});
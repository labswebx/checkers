import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSelector } from 'react-redux';
import { Avatar } from '../common/Avatar';
import { RootState } from '../../store';
import { colors, typography, spacing, borderRadius } from '../../theme';

export const ProfileHeader: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);

  return (
    <LinearGradient colors={[colors.primarySolid, colors.primary]} style={styles.container}>
      <View style={styles.avatarContainer}>
        <Avatar
          name={user?.name}
          imageUrl={user?.profileImage}
          size={100}
          backgroundColor="rgba(255, 255, 255, 0.2)"
          textColor={colors.background}
        />
      </View>
      <Text style={styles.name}>{user?.name || 'User'}</Text>
      <Text style={styles.email}>{user?.email || 'user@example.com'}</Text>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing['lg'],
    paddingHorizontal: spacing.lg,
  },
  avatarContainer: {
    marginBottom: spacing.lg,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 53,
    padding: 3,
  },
  name: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.background,
    marginBottom: spacing.xs,
  },
  email: {
    fontSize: typography.fontSize.base,
    color: 'rgba(255, 255, 255, 0.8)',
  },
});
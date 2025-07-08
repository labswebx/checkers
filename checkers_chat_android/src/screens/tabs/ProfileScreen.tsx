import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { ProfileHeader } from '../../components/profile/ProfileHeader';
import { ProfileOption } from '../../components/profile/ProfileOption';
import { EditProfileModal } from '../../components/profile/EditProfileModal';
import { ViewDetailsModal } from '../../components/profile/ViewDetailsModal';
import { SuperLoginModal } from '../../components/profile/SuperLoginModal';
import { logoutUser } from '../../store/slices/authSlice';
import { useToast } from '../../components/common/ToastProvider';
import { AppDispatch, RootState } from '../../store';
import { colors, spacing } from '../../theme';

export const ProfileScreen: React.FC = () => {
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [viewDetailsVisible, setViewDetailsVisible] = useState(false);
  const [superLoginVisible, setSuperLoginVisible] = useState(false);
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch<AppDispatch>();
  const { showToast } = useToast();
  
  const isAdmin = user?.role === 'admin';

  const handleEditProfile = () => {
    setEditModalVisible(true);
  };

  const handleViewDetails = () => {
    setViewDetailsVisible(true);
  };

  const handleSuperLogin = () => {
    setSuperLoginVisible(true);
  };

  const handleLogout = async () => {
    try {
      await dispatch(logoutUser()).unwrap();
      showToast('Logged out successfully', 'success');
    } catch (error) {
      showToast('Logout failed', 'error');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ProfileHeader />
        
        <View style={styles.optionsContainer}>
          <ProfileOption
            icon="person-outline"
            title="View Details"
            subtitle="See your profile information"
            onPress={handleViewDetails}
          />
          
          <ProfileOption
            icon="create-outline"
            title="Edit Profile"
            subtitle="Update your name"
            onPress={handleEditProfile}
          />
          
          {isAdmin && (
            <ProfileOption
              icon="key-outline"
              title="Super Login"
              subtitle="Login as another user"
              onPress={handleSuperLogin}
            />
          )}
          
          <ProfileOption
            icon="log-out-outline"
            title="Logout"
            subtitle="Sign out of your account"
            onPress={handleLogout}
            variant="danger"
          />
        </View>
      </ScrollView>

      <EditProfileModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
      />

      <ViewDetailsModal
        visible={viewDetailsVisible}
        onClose={() => setViewDetailsVisible(false)}
      />

      <SuperLoginModal
        visible={superLoginVisible}
        onClose={() => setSuperLoginVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  optionsContainer: {
    marginTop: spacing.xs,
  }
});
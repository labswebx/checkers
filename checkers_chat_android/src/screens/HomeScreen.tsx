import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import { ChatsScreen } from './tabs/ChatsScreen';
import { ProfileScreen } from './tabs/ProfileScreen';
import { ChatScreen } from './ChatScreen';
import { Avatar } from '../components/common/Avatar';
import { useToast } from '../components/common/ToastProvider';
import { RootState, AppDispatch } from '../store';
import { incrementUnreadCount } from '../store/slices/chatSlice';
import { socketService } from '../services/socketService';
import { colors, typography, spacing } from '../theme';

type TabType = 'chats' | 'profile';
type ViewType = 'tabs' | 'chat';

export const HomeScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('chats');
  const [currentView, setCurrentView] = useState<ViewType>('tabs');
  const [chatParams, setChatParams] = useState<{ conversationId: string; participantName: string } | null>(null);
  const { user, token } = useSelector((state: RootState) => state.auth);
  const { showToast } = useToast();
  const dispatch = useDispatch<AppDispatch>();

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    return 'Evening';
  };

  const handleSearch = () => {
    // showToast('Search coming soon', 'info');
  };

  const handleNotifications = () => {
  };

  const handleNavigateToChat = (conversationId: string, participantName: string) => {
    setChatParams({ conversationId, participantName });
    setCurrentView('chat');
  };

  const handleBackToChats = () => {
    setCurrentView('tabs');
    setChatParams(null);
  };

  const renderContent = () => {
    if (currentView === 'chat' && chatParams) {
      return (
        <ChatScreen 
          route={{ params: chatParams }}
          navigation={{ goBack: handleBackToChats, setOptions: () => {} }}
        />
      );
    }
    
    switch (activeTab) {
      case 'chats':
        return <ChatsScreen onNavigateToChat={handleNavigateToChat} />;
      case 'profile':
        return <ProfileScreen />;
      default:
        return <ChatsScreen onNavigateToChat={handleNavigateToChat} />;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={[colors.primary, colors.primarySolid]} style={styles.header}>
        <View style={styles.headerContent}>
          {currentView === 'chat' ? (
            <>
              <TouchableOpacity onPress={handleBackToChats} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={colors.background} />
              </TouchableOpacity>
              <Avatar
                name={chatParams?.participantName}
                size={32}
                backgroundColor={colors.background}
                textColor={colors.primary}
              />
              <Text style={styles.headerTitle}>{chatParams?.participantName}</Text>
            </>
          ) : (
            <>
              <View style={styles.headerLeft}>
                <Avatar
                  name={user?.name}
                  imageUrl={user?.profileImage}
                  size={44}
                  backgroundColor={colors.background}
                  textColor={colors.primary}
                />
                <View style={styles.headerText}>
                  <Text style={styles.greeting}>Hello {user?.name}</Text>
                  {/* <Text style={styles.userName}>{ || 'User'}</Text> */}
                </View>
              </View>
              {/* <View style={styles.headerActions}>
                <TouchableOpacity style={styles.headerButton} onPress={handleSearch}>
                  <Ionicons name="search" size={20} color={colors.background} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.headerButton} onPress={handleNotifications}>
                  <Ionicons name="notifications-outline" size={20} color={colors.background} />
                </TouchableOpacity>
              </View> */}
            </>
          )}
        </View>
      </LinearGradient>

      {/* Content */}
      <View style={styles.content}>
        {renderContent()}
      </View>

      {/* Bottom Tab Bar */}
      {currentView === 'tabs' && (
        <SafeAreaView edges={['bottom']}>
          <View style={styles.tabBar}>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => setActiveTab('chats')}
            activeOpacity={0.6}
          >
            <View style={[styles.tabContent, activeTab === 'chats' && styles.activeTabContent]}>
              <Ionicons
                name={activeTab === 'chats' ? 'chatbubbles' : 'chatbubbles-outline'}
                size={22}
                color={activeTab === 'chats' ? colors.primary : colors.textLight}
              />
              <Text style={[styles.tabText, activeTab === 'chats' && styles.activeTabText]}>
                Chats
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tab}
            onPress={() => setActiveTab('profile')}
            activeOpacity={0.6}
          >
            <View style={[styles.tabContent, activeTab === 'profile' && styles.activeTabContent]}>
              <Ionicons
                name={activeTab === 'profile' ? 'person' : 'person-outline'}
                size={22}
                color={activeTab === 'profile' ? colors.primary : colors.textLight}
              />
              <Text style={[styles.tabText, activeTab === 'profile' && styles.activeTabText]}>
                Profile
              </Text>
            </View>
          </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerText: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  greeting: {
    fontSize: typography.fontSize.lg,
    color: 'white',
    fontWeight: typography.fontWeight.medium,
  },
  userName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.background,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.background,
    marginLeft: spacing.sm,
  },
  backButton: {
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
  },
  tabContent: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  activeTabContent: {
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: 25,
    minWidth: 130,
  },
  tabText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.textLight,
    marginTop: 2,
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
});
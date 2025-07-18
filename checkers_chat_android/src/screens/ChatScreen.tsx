import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, BackHandler, TouchableWithoutFeedback, Keyboard, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { colors, typography, spacing } from '../theme';
import { RootState, AppDispatch } from '../store';
import { fetchMessages, sendMessage, addMessage, loadMoreMessages } from '../store/slices/chatSlice';
import { Message } from '../types/chat.types';
import { socketService } from '../services/socketService';

interface ChatScreenProps {
  route: {
    params: {
      conversationId: string;
      participantName: string;
    };
  };
  navigation: any;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ route, navigation }) => {
  const { conversationId, participantName } = route.params;
  const dispatch = useDispatch<AppDispatch>();
  const { messages, messagesLoading, loadingMore, hasMoreMessages, currentPage, currentConversation, error } = useSelector((state: RootState) => state.chat);
  const { user, token } = useSelector((state: RootState) => state.auth);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [currentDate, setCurrentDate] = useState('');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    dispatch(fetchMessages({ conversationId }));
    
    if (token) {
      const chatHandler = (data: any) => {
        if (data.message && data.message.conversationId === conversationId && data.message.senderId._id !== user?._id) {
          dispatch(addMessage(data.message));
          setTimeout(() => {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
          }, 100);
        }
      };
      
      socketService.on('new_message', chatHandler);
      
      // Join conversation room
      const timer = setTimeout(() => {
        socketService.joinConversation(conversationId);
      }, 500);
      
      return () => {
        clearTimeout(timer);
        socketService.leaveConversation(conversationId);
        socketService.off('new_message', chatHandler);
      };
    }
  }, [dispatch, conversationId, token, user]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.goBack();
      return true;
    });

    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      backHandler.remove();
      show.remove();
      hide.remove();
    };
  }, [navigation]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || sending) return;

    setSending(true);
    try {
      await dispatch(sendMessage({ conversationId, content: messageText.trim() })).unwrap();
      setMessageText('');
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const formatDate = (date: string) => {
    const messageDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (messageDate.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return messageDate.toLocaleDateString();
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const firstVisibleMessage = viewableItems[0].item;
      const messageDate = formatDate(firstVisibleMessage.createdAt);
      setCurrentDate(messageDate);
    }
  }).current;

  const onScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const isAtBottom = contentOffset.y <= 200;
    setShowScrollButton(!isAtBottom);
  };

  const scrollToBottom = () => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setShowScrollButton(false);
  };

  const handleLoadMore = async () => {
    if (!loadingMore && hasMoreMessages) {
      dispatch(loadMoreMessages({ conversationId, page: currentPage + 1 }));
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.senderId._id === user?._id;
    return (
      <View style={[styles.messageContainer, isOwnMessage ? styles.ownMessage : styles.otherMessage]}>
        <View style={[styles.messageBubble, isOwnMessage ? styles.ownBubble : styles.otherBubble]}>
          <Text style={[styles.messageText, isOwnMessage ? styles.ownMessageText : styles.otherMessageText]}>
            {item.content}
          </Text>
          <Text style={[styles.messageTime, isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime]}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  const renderHeader = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior='height'
      keyboardVerticalOffset={1.1 * (keyboardHeight / 5)}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <View style={{ flex: 1, flexDirection: 'column' }}>
          {currentDate && (
            <View style={styles.dateHeader}>
              <Text style={styles.dateText}>{currentDate}</Text>
            </View>
          )}
          <FlatList
            ref={flatListRef}
            inverted
            renderItem={renderMessage}
            keyExtractor={(item) => item._id}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContainer}
            showsVerticalScrollIndicator={false}
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
              autoscrollToTopThreshold: 10
            }}
            onScroll={onScroll}
            scrollEventThrottle={16}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
            keyboardShouldPersistTaps="handled"
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.1}
            ListFooterComponent={renderHeader}
            data={[...messages].reverse()}
          />
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                value={messageText}
                onChangeText={setMessageText}
                placeholder="Type a message..."
                placeholderTextColor={colors.textSecondary}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity 
                style={[styles.sendButton, (!messageText.trim() || sending) && styles.sendButtonDisabled]}
                onPress={handleSendMessage}
                disabled={!messageText.trim() || sending}
              >
                <Ionicons name={sending ? "hourglass" : "send"} size={20} color={colors.surface} />
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
          
          {showScrollButton && (
            <TouchableOpacity 
              style={styles.scrollToBottomButton}
              onPress={scrollToBottom}
            >
              <Ionicons name="chevron-down" size={24} color={colors.surface} />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: colors.chatBackground,
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    padding: spacing.md,
  },
  messageContainer: {
    marginVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 18,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  ownBubble: {
    backgroundColor: colors.primarySolid,
    borderBottomRightRadius: 6,
    marginLeft: spacing.xl,
  },
  otherBubble: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 6,
    marginRight: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageText: {
    fontSize: typography.fontSize.sm,
    lineHeight: 18,
    marginBottom: spacing.xs,
  },
  ownMessageText: {
    color: colors.background,
  },
  otherMessageText: {
    color: colors.text,
  },
  messageTime: {
    fontSize: typography.fontSize.xs,
    alignSelf: 'flex-end',
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  otherMessageTime: {
    color: colors.textLight,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    maxHeight: 100,
    fontSize: typography.fontSize.base,
    color: colors.text,
    backgroundColor: colors.background,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.textLight,
  },
  dateHeader: {
    position: 'absolute',
    top: spacing.sm,
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: 'center',
  },
  dateText: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: colors.background,
    fontSize: typography.fontSize.xs,
    fontWeight: '500',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 10,
    overflow: 'hidden',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  loadingText: {
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  scrollToBottomButton: {
    position: 'absolute',
    bottom: 80,
    right: spacing.md,
    width: 37,
    height: 37,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 5,
  },
});
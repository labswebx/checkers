import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  IconButton,
  List,
  ListItem,
  Avatar,
  CircularProgress,
  AppBar,
  Toolbar
} from '@mui/material';
import { Send, ArrowBack } from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchConversationMessages, sendMessage } from '../store/slices/conversationSlice';
import { colors } from '../theme/colors';
import moment from 'moment';

const ChatConversation = () => {
  const { conversationId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { currentConversation, messages, messagesLoading } = useSelector((state) => state.conversations);
  const { user } = useSelector((state) => state.auth);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (conversationId) {
      dispatch(fetchConversationMessages({ conversationId }));
    }
  }, [dispatch, conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || sending) return;

    setSending(true);
    try {
      await dispatch(sendMessage({ 
        conversationId, 
        content: messageText.trim() 
      })).unwrap();
      setMessageText('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getOtherParticipant = () => {
    if (!currentConversation || !user) return null;
    
    if (currentConversation.participant1._id === user.id) {
      return currentConversation.participant2;
    }
    return currentConversation.participant1;
  };

  const otherParticipant = getOtherParticipant();

  if (messagesLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" sx={{ bgcolor: colors.primary.main }}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => navigate('/chat')}
            sx={{ mr: 2 }}
          >
            <ArrowBack />
          </IconButton>
          <Avatar sx={{ mr: 2, bgcolor: 'white', color: colors.primary.main }}>
            {otherParticipant?.name?.charAt(0).toUpperCase() || 'U'}
          </Avatar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {otherParticipant?.name || 'Unknown User'}
          </Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
          <List sx={{ p: 0 }}>
            {messages.map((message) => {
              const isOwnMessage = message.senderId._id === user?.id;
              
              return (
                <ListItem
                  key={message._id}
                  sx={{
                    display: 'flex',
                    justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
                    px: 1,
                    py: 0.5
                  }}
                >
                  <Paper
                    sx={{
                      p: 2,
                      maxWidth: '70%',
                      bgcolor: isOwnMessage ? colors.primary.main : '#f5f5f5',
                      color: isOwnMessage ? 'white' : 'text.primary',
                      borderRadius: 2,
                      borderTopRightRadius: isOwnMessage ? 0.5 : 2,
                      borderTopLeftRadius: isOwnMessage ? 2 : 0.5
                    }}
                  >
                    <Typography variant="body1" sx={{ mb: 0.5 }}>
                      {message.content}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        opacity: 0.7,
                        fontSize: '0.7rem'
                      }}
                    >
                      {moment(message.createdAt).format('HH:mm')}
                    </Typography>
                  </Paper>
                </ListItem>
              );
            })}
          </List>
          <div ref={messagesEndRef} />
        </Box>

        <Paper
          sx={{
            p: 2,
            borderRadius: 0,
            borderTop: '1px solid #e0e0e0'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              fullWidth
              multiline
              maxRows={3}
              placeholder="Type a message..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={sending}
              variant="outlined"
              size="small"
            />
            <IconButton
              color="primary"
              onClick={handleSendMessage}
              disabled={!messageText.trim() || sending}
              sx={{
                bgcolor: colors.primary.main,
                color: 'white',
                '&:hover': {
                  bgcolor: colors.primary.dark
                },
                '&:disabled': {
                  bgcolor: '#ccc'
                }
              }}
            >
              {sending ? <CircularProgress size={20} color="inherit" /> : <Send />}
            </IconButton>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default ChatConversation;
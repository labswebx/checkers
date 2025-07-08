import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  CircularProgress,
  Divider,
  Badge,
  Button
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchConversations, setCurrentConversation } from '../store/slices/conversationSlice';
import { colors } from '../theme/colors';
import moment from 'moment';

const Chat = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { conversations, loading, error } = useSelector((state) => state.conversations);
  const { user } = useSelector((state) => state.auth);
  const [page] = useState(1);

  const createTestConversation = async () => {
    try {
      // Get all users first
      const usersResponse = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const usersData = await usersResponse.json();
      
      if (usersData.success && usersData.data.users.length > 1) {
        const otherUser = usersData.data.users.find(u => u._id !== user.id);
        if (otherUser) {
          const response = await fetch('/api/conversations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ participantId: otherUser._id })
          });
          
          if (response.ok) {
            dispatch(fetchConversations({ page, limit: 20 }));
          }
        }
      }
    } catch (error) {
      console.error('Error creating test conversation:', error);
    }
  };

  useEffect(() => {
    // Test API endpoint first
    const testAPI = async () => {
      try {
        const response = await fetch('/api/conversations', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        console.log('Direct API test response status:', response.status);
        const data = await response.json();
        console.log('Direct API test response data:', data);
      } catch (error) {
        console.error('Direct API test error:', error);
      }
    };
    
    testAPI();
    dispatch(fetchConversations({ page, limit: 20 }));
  }, [dispatch, page]);

  // Debug logging
  console.log('Conversations:', conversations);
  console.log('Loading:', loading);
  console.log('Error:', error);
  console.log('User:', user);

  const handleConversationClick = (conversation) => {
    dispatch(setCurrentConversation(conversation));
    navigate(`/chat/${conversation._id}`);
  };

  const getLastMessagePreview = (conversation) => {
    if (!conversation.lastMessage) return 'No messages yet';
    return conversation.lastMessage.content.length > 50 
      ? `${conversation.lastMessage.content.substring(0, 50)}...`
      : conversation.lastMessage.content;
  };

  const getOtherParticipant = (conversation) => {
    const { user } = useSelector((state) => state.auth);
    if (!user) return null;
    
    if (conversation.participant1._id === user.id) {
      return conversation.participant2;
    }
    return conversation.participant1;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ mt: 4 }}>
        <Typography color="error" align="center">
          {error}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography
          variant="h6"
          sx={{
            color: colors.text.primary,
            fontWeight: 600,
            fontSize: { xs: '1rem', sm: '1.1rem' }
          }}
        >
          Conversations
        </Typography>
        <Button 
          variant="outlined" 
          size="small" 
          onClick={createTestConversation}
          sx={{ fontSize: '0.75rem' }}
        >
          Create Test Chat
        </Button>
      </Box>
      
      <Paper
        sx={{
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          borderRadius: 2,
          overflow: 'hidden'
        }}
      >
        <List sx={{ p: 0 }}>
          {conversations.map((conversation, index) => {
            const otherParticipant = getOtherParticipant(conversation);
            
            return (
              <React.Fragment key={conversation._id}>
                <ListItem
                  button
                  onClick={() => handleConversationClick(conversation)}
                  sx={{
                    py: 2,
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    },
                    cursor: 'pointer'
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: colors.primary.main }}>
                      {otherParticipant?.name?.charAt(0).toUpperCase() || 'U'}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {otherParticipant?.name || 'Unknown User'}
                        </Typography>
                        {conversation.lastMessage && (
                          <Typography variant="caption" color="text.secondary">
                            {moment(conversation.lastMessage.createdAt).format('MMM DD')}
                          </Typography>
                        )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                          {getLastMessagePreview(conversation)}
                        </Typography>
                        {(() => {
                          const unreadCount = conversation.participant1._id === user?.id 
                            ? conversation.unreadCounts?.participant1 || 0
                            : conversation.unreadCounts?.participant2 || 0;
                          return unreadCount > 0 && (
                            <Badge
                              badgeContent={unreadCount}
                              color="primary"
                              sx={{ ml: 1 }}
                            />
                          );
                        })()}
                      </Box>
                    }
                  />
                </ListItem>
                {index < conversations.length - 1 && <Divider />}
              </React.Fragment>
            );
          })}
        </List>
        
        {conversations.length === 0 && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              No conversations found. Debug info: {JSON.stringify({ conversationsLength: conversations.length, loading, error })}
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default Chat;
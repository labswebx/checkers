import React from 'react';
import { Box, Container } from '@mui/material';
import Register from './Register/index';
import UserList from '../components/UserList';

const Users = () => {
  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 3 }}>
        <Box sx={{ 
          mb: 4,
          width: { xs: '100%', sm: '80%', md: '60%' },
          mx: 'auto'
        }}>
          <Register />
        </Box>
        <UserList />
      </Box>
    </Container>
  );
};

export default Users; 
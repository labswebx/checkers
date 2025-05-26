import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { useDispatch, useSelector } from 'react-redux';
import { fetchUsers } from '../store/slices/userSlice';
import Pagination from './Pagination';
import { colors } from '../theme/colors';
import moment from 'moment';
import EditUserDialog from './users/EditUserDialog';

const UserList = () => {
  const dispatch = useDispatch();
  const { users = [], loading = false, error = null, totalPages = 0, totalUsers = 0 } = useSelector((state) => state?.users || {});
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const rowsPerPage = 10;

  useEffect(() => {
    dispatch(fetchUsers({ page, limit: rowsPerPage }));
  }, [dispatch, page]);

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleEditClick = (user) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setSelectedUser(null);
    setEditDialogOpen(false);
    // Refresh the users list after edit
    dispatch(fetchUsers({ page, limit: rowsPerPage }));
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
      <Typography
        variant="h6"
        sx={{
          mb: 3,
          color: colors.text.primary,
          fontWeight: 600,
          fontSize: { xs: '1rem', sm: '1.1rem' }
        }}
      >
        User List
      </Typography>
      
      <TableContainer 
        component={Paper}
        sx={{
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          borderRadius: 2,
          overflow: 'auto',
          maxWidth: '100%',
          '&::-webkit-scrollbar': {
            height: '8px'
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: '#f1f1f1'
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#888',
            borderRadius: '4px',
            '&:hover': {
              backgroundColor: '#555'
            }
          }
        }}
      >
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow sx={{ backgroundColor: colors.primary.main }}>
              <TableCell 
                sx={{ 
                  fontWeight: 600, 
                  color: 'white',
                  fontSize: { xs: '0.75rem', sm: '0.9rem' },
                  width: '50px',
                  whiteSpace: 'nowrap'
                }}
              >
                S.No
              </TableCell>
              <TableCell 
                sx={{ 
                  fontWeight: 600, 
                  color: 'white',
                  fontSize: { xs: '0.75rem', sm: '0.9rem' },
                  whiteSpace: 'nowrap'
                }}
              >
                Name
              </TableCell>
              <TableCell 
                sx={{ 
                  fontWeight: 600, 
                  color: 'white',
                  fontSize: { xs: '0.75rem', sm: '0.9rem' },
                  whiteSpace: 'nowrap'
                }}
              >
                Email
              </TableCell>
              <TableCell 
                sx={{ 
                  fontWeight: 600, 
                  color: 'white',
                  fontSize: { xs: '0.75rem', sm: '0.9rem' },
                  whiteSpace: 'nowrap'
                }}
              >
                Contact Number
              </TableCell>
              <TableCell 
                sx={{ 
                  fontWeight: 600, 
                  color: 'white',
                  fontSize: { xs: '0.75rem', sm: '0.9rem' },
                  whiteSpace: 'nowrap'
                }}
              >
                Role
              </TableCell>
              <TableCell 
                sx={{ 
                  fontWeight: 600, 
                  color: 'white',
                  fontSize: { xs: '0.75rem', sm: '0.9rem' },
                  whiteSpace: 'nowrap'
                }}
              >
                Created At
              </TableCell>
              <TableCell 
                sx={{ 
                  fontWeight: 600, 
                  color: 'white',
                  fontSize: { xs: '0.75rem', sm: '0.9rem' },
                  whiteSpace: 'nowrap'
                }}
              >
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Array.isArray(users) && users.map((user, index) => (
              <TableRow 
                key={user._id}
                sx={{
                  '&:nth-of-type(odd)': {
                    backgroundColor: 'rgba(0, 0, 0, 0.02)',
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  },
                  transition: 'background-color 0.2s'
                }}
              >
                <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.9rem' }, whiteSpace: 'nowrap' }}>
                  {(page - 1) * rowsPerPage + index + 1}
                </TableCell>
                <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.9rem' }, whiteSpace: 'nowrap' }}>{user.name}</TableCell>
                <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.9rem' }, whiteSpace: 'nowrap' }}>{user.email}</TableCell>
                <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.9rem' }, whiteSpace: 'nowrap' }}>{user.contactNumber}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Chip
                    label={user.role}
                    color={user.role === 'ADMIN' ? 'primary' : 'default'}
                    size="small"
                    sx={{ 
                      fontSize: { xs: '0.7rem', sm: '0.8rem' },
                      backgroundColor: user.role === 'ADMIN' ? colors.primary.main : '#e0e0e0',
                      color: user.role === 'ADMIN' ? 'white' : 'rgba(0, 0, 0, 0.87)'
                    }}
                  />
                </TableCell>
                <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.9rem' }, whiteSpace: 'nowrap' }}>
                  {moment(user.createdAt).format('MMM DD, YYYY hh:mm A')}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Tooltip title="Edit User">
                    <IconButton
                      size="small"
                      onClick={() => handleEditClick(user)}
                      sx={{ 
                        color: colors.primary.main,
                        '&:hover': {
                          backgroundColor: `${colors.primary.main}20`
                        }
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {Array.isArray(users) && users.length > 0 && (
        <Box sx={{ 
          mt: 2, 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2
        }}>
          <Typography variant="body2" color="text.secondary">
            Showing {(page - 1) * rowsPerPage + 1} - {Math.min(page * rowsPerPage, totalUsers)} of {totalUsers} users
          </Typography>
          <Pagination
            count={totalPages}
            page={page}
            onChange={handlePageChange}
            size="small"
          />
        </Box>
      )}

      {(!Array.isArray(users) || users.length === 0) && (
        <Typography
          align="center"
          color="textSecondary"
          sx={{ mt: 2, fontSize: { xs: '0.75rem', sm: '0.9rem' } }}
        >
          No users found
        </Typography>
      )}

      {editDialogOpen && selectedUser && (
        <EditUserDialog
          open={editDialogOpen}
          onClose={handleCloseDialog}
          user={selectedUser}
        />
      )}
    </Box>
  );
};

export default UserList; 
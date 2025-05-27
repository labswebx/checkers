import React, { useState } from 'react';
import { Box, AppBar, Toolbar, Typography, useTheme, IconButton, Avatar, Menu, MenuItem, ListItemIcon } from '@mui/material';
import { Menu as MenuIcon, Logout } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout } from '../../store/slices/authSlice';
import Sidebar from '../Sidebar';
import { colors } from '../../theme/colors';

const drawerWidth = 240;

const Header = styled(AppBar)(({ theme }) => ({
  backgroundColor: colors.background.paper,
  color: colors.text.primary,
  boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
}));

const Layout = ({ children }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector(state => state.auth);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    await dispatch(logout());
    navigate('/login');
  };

  // Get user's display name
  const getDisplayName = () => {
    if (!user) return '';
    return user.name || 'User';
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: colors.background.default }}>
      <Header 
        position="fixed" 
        sx={{ 
          width: '100%',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
            {/* <IconButton size="large" color="inherit">
              <NotificationsNone />
            </IconButton> */}
            <Box 
              onClick={handleMenuOpen}
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                backgroundColor: theme.palette.grey[100],
                py: 0.5,
                pr: { sm: 2 },
                // px: { sm: 1 },
                borderRadius: 25,
                cursor: 'pointer'
              }}
            >
              <Avatar sx={{ width: 32, height: 32, bgcolor: colors.primary.main }}>
                {getDisplayName().charAt(0).toUpperCase()}
              </Avatar>
              <Typography 
                variant="subtitle2" 
                sx={{ 
                  fontWeight: 'medium',
                  display: { xs: 'none', sm: 'block' }
                }}
              >
                {getDisplayName()}
              </Typography>
            </Box>
          </Box>
        </Toolbar>
      </Header>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        onClick={handleMenuClose}
        PaperProps={{
          sx: {
            mt: 1.5,
            minWidth: 200,
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>

      <Sidebar mobileOpen={mobileOpen} handleDrawerToggle={handleDrawerToggle} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `13px` },
          mt: 8,
          p: { xs: 2, sm: 3 },
          maxWidth: { sm: `calc(100% - ${drawerWidth}px)` },
          overflowX: 'hidden'
        }}
      >
        <Box sx={{ maxWidth: '100%', margin: '0 auto' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default Layout; 
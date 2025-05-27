import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser, clearError } from '../store/slices/authSlice';
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Paper,
  Alert,
  InputAdornment,
  IconButton,
  Snackbar,
} from '@mui/material';
import { motion } from 'framer-motion';
import { Visibility, VisibilityOff, Email, Lock } from '@mui/icons-material';
import GradientBackground from '../components/GradientBackground';
import { colors } from '../theme/colors';

const Login = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { loading, error, user, isAuthenticated } = useSelector((state) => state.auth);
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [showErrorAlert, setShowErrorAlert] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      setShowSuccessAlert(true);
      // Navigate after showing success message
      const timer = setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
      return () => clearTimeout(timer);
    }
    return () => {
      dispatch(clearError());
    };
  }, [isAuthenticated, user, navigate, dispatch]);

  useEffect(() => {
    if (error) {
      setShowErrorAlert(true);
    }
  }, [error]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch(loginUser(formData));
  };

  const handleCloseSuccessAlert = () => {
    setShowSuccessAlert(false);
  };

  const handleCloseErrorAlert = () => {
    setShowErrorAlert(false);
  };

  return (
    <GradientBackground>
      <Container 
        component="main" 
        maxWidth="xs" 
        sx={{ 
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: { xs: 2, sm: 4 }
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ width: '100%' }}
        >
          <Paper 
            elevation={2}
            sx={{
              p: { xs: 2, sm: 3 },
              backdropFilter: 'blur(10px)',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              borderRadius: 2,
              position: 'relative',
              overflow: 'hidden',
              maxHeight: { xs: 'calc(100vh - 32px)', sm: 'none' },
              overflowY: 'auto'
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    background: colors.primary.main,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 2,
                    boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)',
                  }}
                >
                  <Lock sx={{ fontSize: 40, color: 'white' }} />
                </Box>
              </motion.div>

              <Typography 
                component="h1" 
                variant="h5" 
                sx={{ 
                  mb: 1,
                  fontWeight: 600,
                  color: colors.text.primary,
                  fontSize: { xs: '1.25rem', sm: '1.5rem' }
                }}
              >
                Welcome Back
              </Typography>
              <Typography 
                variant="body2" 
                color="text.secondary"
                align="center"
                sx={{ mb: 3, fontSize: '0.875rem' }}
              >
                Enter your credentials to access your account
              </Typography>

              <Box component="form" onSubmit={handleSubmit} noValidate sx={{ width: '100%' }}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="email"
                  label="Email Address"
                  name="email"
                  autoComplete="email"
                  autoFocus
                  value={formData.email}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Email color="action" />
                      </InputAdornment>
                    ),
                    sx: { fontSize: '0.875rem' }
                  }}
                  InputLabelProps={{
                    sx: { fontSize: '0.875rem' }
                  }}
                />
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  name="password"
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle password visibility"
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          size="small"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                    sx: { fontSize: '0.875rem' }
                  }}
                  InputLabelProps={{
                    sx: { fontSize: '0.875rem' }
                  }}
                />
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    sx={{
                      mt: 3,
                      mb: 2,
                      py: 1.25,
                      backgroundColor: colors.primary.main,
                      fontSize: '0.875rem',
                      '&:hover': {
                        backgroundColor: colors.primary.dark,
                      },
                    }}
                    disabled={loading}
                  >
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </motion.div>
              </Box>
            </Box>
          </Paper>
        </motion.div>
      </Container>

      {/* Success Alert */}
      <Snackbar
        open={showSuccessAlert}
        autoHideDuration={2000}
        onClose={handleCloseSuccessAlert}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseSuccessAlert}
          severity="success"
          variant="filled"
          sx={{ width: '100%', fontSize: '0.875rem' }}
        >
          Login successful! Redirecting...
        </Alert>
      </Snackbar>

      {/* Error Alert */}
      <Snackbar
        open={showErrorAlert}
        autoHideDuration={2000}
        onClose={handleCloseErrorAlert}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseErrorAlert}
          severity="error"
          variant="filled"
          sx={{ width: '100%', fontSize: '0.875rem' }}
        >
          {error || 'Login failed. Please try again.'}
        </Alert>
      </Snackbar>
    </GradientBackground>
  );
};

export default Login; 
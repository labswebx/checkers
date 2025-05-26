import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  IconButton,
  Snackbar,
} from '@mui/material';
import {
  Person,
  Email,
  Lock,
  Phone,
  Badge,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import FormInput from '../../components/common/FormInput';
import { USER_ROLES, REGEX } from '../../constants';
import { useDispatch, useSelector } from 'react-redux';
import { registerUser, clearRegistrationSuccess } from '../../store/slices/authSlice';
import { colors } from '../../theme/colors';

const Register = () => {
  const dispatch = useDispatch();
  const { loading, error, registrationSuccess } = useSelector((state) => state.auth);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    contactNumber: null,
    role: USER_ROLES.AGENT,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [showErrorAlert, setShowErrorAlert] = useState(false);

  useEffect(() => {
    if (registrationSuccess) {
      setShowSuccessAlert(true);
      // Reset form
      setFormData({
        name: '',
        email: '',
        password: '',
        contactNumber: null,
        role: USER_ROLES.AGENT,
      });
      // Clear registration success after 6 seconds
      const timer = setTimeout(() => {
        dispatch(clearRegistrationSuccess());
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [registrationSuccess, dispatch]);

  useEffect(() => {
    if (error) {
      setShowErrorAlert(true);
    }
  }, [error]);

  const validateForm = () => {
    const errors = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!REGEX.EMAIL.test(formData.email)) {
      errors.email = 'Invalid email format';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (!REGEX.PASSWORD.test(formData.password)) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (!formData.contactNumber.trim()) {
      errors.contactNumber = 'Phone is required';
    } else if (!REGEX.PHONE.test(formData.contactNumber)) {
      errors.contactNumber = 'Invalid phone number';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear validation error when user starts typing
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      dispatch(registerUser(formData));
    }
  };

  const handleCloseSuccessAlert = () => {
    setShowSuccessAlert(false);
  };

  const handleCloseErrorAlert = () => {
    setShowErrorAlert(false);
  };

  const roleOptions = Object.entries(USER_ROLES).map(([key, value]) => ({
    label: key.charAt(0) + key.slice(1).toLowerCase(),
    value: value
  }));

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4, px: 2 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Paper
          elevation={2}
          sx={{
            p: { xs: 2, sm: 3 },
            borderRadius: 2,
          }}
        >
          <Typography
            variant="h5"
            sx={{
              mb: 3,
              fontWeight: 600,
              color: colors.text.primary,
              textAlign: 'center',
              fontSize: { xs: '1.25rem', sm: '1.5rem' }
            }}
          >
            Register New User
          </Typography>

          <Box 
            component="form" 
            onSubmit={handleSubmit} 
            noValidate 
            sx={{ 
              '& .MuiTextField-root': { 
                mb: 1.5 
              } 
            }}
          >
            <FormInput
              name="name"
              label="Full Name"
              value={formData.name}
              onChange={handleChange}
              error={validationErrors.name}
              required
              startIcon={<Person />}
            />

            <FormInput
              name="email"
              label="Email Address"
              type="email"
              value={formData.email}
              onChange={handleChange}
              error={validationErrors.email}
              required
              startIcon={<Email />}
            />

            <FormInput
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange}
              error={validationErrors.password}
              required
              startIcon={<Lock />}
              endIcon={
                <IconButton
                  onClick={() => setShowPassword(!showPassword)}
                  edge="end"
                  size="small"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              }
            />

            <FormInput
              name="contactNumber"
              label="Phone Number"
              type="number"
              value={formData.contactNumber}
              onChange={handleChange}
              error={validationErrors.contactNumber}
              required
              startIcon={<Phone />}
            />

            <FormInput
              name="role"
              label="Role"
              value={formData.role}
              onChange={handleChange}
              options={roleOptions}
              startIcon={<Badge />}
            />

            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                sx={{
                  mt: 2,
                  backgroundColor: colors.primary.main,
                  '&:hover': {
                    backgroundColor: colors.primary.dark,
                  },
                  fontSize: '0.875rem',
                  py: 1.25
                }}
                disabled={loading}
              >
                {loading ? 'Creating User...' : 'Create User'}
              </Button>
            </motion.div>
          </Box>
        </Paper>
      </motion.div>

      {/* Success Alert */}
      <Snackbar
        open={showSuccessAlert}
        autoHideDuration={6000}
        onClose={handleCloseSuccessAlert}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseSuccessAlert}
          severity="success"
          variant="filled"
          sx={{ width: '100%', fontSize: '0.875rem' }}
        >
          User created successfully!
        </Alert>
      </Snackbar>

      {/* Error Alert */}
      <Snackbar
        open={showErrorAlert}
        autoHideDuration={6000}
        onClose={handleCloseErrorAlert}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseErrorAlert}
          severity="error"
          variant="filled"
          sx={{ width: '100%', fontSize: '0.875rem' }}
        >
          {error || 'Failed to create user. Please try again.'}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Register; 
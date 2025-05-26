import React from 'react';
import {
  TextField,
  MenuItem,
  InputAdornment,
} from '@mui/material';

const FormInput = ({
  name,
  label,
  type = 'text',
  value,
  onChange,
  error,
  required = false,
  startIcon,
  endIcon,
  options = [],
  fullWidth = true,
  ...props
}) => {
  const isSelect = options.length > 0;

  return (
    <TextField
      name={name}
      label={label}
      type={type}
      value={value}
      onChange={onChange}
      error={!!error}
      helperText={error}
      required={required}
      fullWidth={fullWidth}
      select={isSelect}
      margin="normal"
      InputProps={{
        startAdornment: startIcon && (
          <InputAdornment position="start">
            {startIcon}
          </InputAdornment>
        ),
        endAdornment: endIcon && (
          <InputAdornment position="end">
            {endIcon}
          </InputAdornment>
        ),
        sx: {
          fontSize: '0.875rem',
          '& .MuiInputAdornment-root': {
            '& .MuiSvgIcon-root': {
              fontSize: '1.2rem',
            }
          }
        }
      }}
      InputLabelProps={{
        sx: {
          fontSize: '0.875rem'
        }
      }}
      FormHelperTextProps={{
        sx: {
          fontSize: '0.75rem'
        }
      }}
      {...props}
    >
      {isSelect && options.map((option) => (
        <MenuItem 
          key={option.value} 
          value={option.value}
          sx={{ fontSize: '0.875rem' }}
        >
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
};

export default FormInput; 
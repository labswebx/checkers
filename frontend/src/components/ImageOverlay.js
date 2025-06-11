import React from 'react';
import { Box, IconButton } from '@mui/material';
import { Close } from '@mui/icons-material';

const ImageOverlay = ({ imageUrl, onClose }) => {
  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <IconButton
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          color: 'white',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
          },
        }}
        onClick={onClose}
      >
        <Close />
      </IconButton>
      <Box
        component="img"
        src={imageUrl}
        sx={{
          maxWidth: '90%',
          maxHeight: '90vh',
          objectFit: 'contain',
          borderRadius: 1,
        }}
        onClick={(e) => e.stopPropagation()}
      />
    </Box>
  );
};

export default ImageOverlay; 
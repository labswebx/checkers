import React from 'react';
import { Box, Pagination as MuiPagination, useTheme, useMediaQuery } from '@mui/material';
import { colors } from '../theme/colors';

const Pagination = ({ count, page, onChange, size = 'medium' }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        mt: { xs: 1, sm: 3 },
        mb: { xs: 1, sm: 2 },
        '& .MuiPagination-ul': {
          flexWrap: 'nowrap'
        }
      }}
    >
      <MuiPagination
        count={count}
        page={page}
        onChange={onChange}
        color="primary"
        size={isMobile ? 'small' : size}
        siblingCount={isMobile ? 0 : 1}
        boundaryCount={isMobile ? 1 : 2}
        sx={{
          '& .MuiPaginationItem-root': {
            color: colors.text.primary,
            minWidth: { xs: 30, sm: 32 },
            height: { xs: 30, sm: 32 },
            fontSize: { xs: '0.75rem', sm: '0.875rem' },
            '&.Mui-selected': {
              backgroundColor: colors.primary.main,
              color: 'white',
              '&:hover': {
                backgroundColor: colors.primary.dark,
              }
            }
          }
        }}
      />
    </Box>
  );
};

export default Pagination; 
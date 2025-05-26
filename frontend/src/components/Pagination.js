import React from 'react';
import { Box, Pagination as MuiPagination } from '@mui/material';
import { colors } from '../theme/colors';

const Pagination = ({ count, page, onChange }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        mt: 3,
        mb: 2
      }}
    >
      <MuiPagination
        count={count}
        page={page}
        onChange={onChange}
        color="primary"
        sx={{
          '& .MuiPaginationItem-root': {
            color: colors.text.primary,
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
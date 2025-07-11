import React from 'react';
import { Box, Pagination as MuiPagination, useTheme, useMediaQuery, FormControl, Select, MenuItem, InputLabel } from '@mui/material';
import { colors } from '../theme/colors';

const Pagination = ({ count, page, onChange, size = 'medium', perPage, onPerPageChange }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'center',
        alignItems: 'center',
        mt: { xs: 1, sm: 3 },
        mb: { xs: 1, sm: 2 },
        gap: 2,
        '& .MuiPagination-ul': {
          flexWrap: 'nowrap'
        }
      }}
    >
      {perPage !== undefined && onPerPageChange && (
        <FormControl size={isMobile ? 'small' : 'small'} sx={{ minWidth: 40, '& .MuiInputBase-root': { minHeight: 32, padding: '0 8px' } }}>
          <InputLabel id="per-page-label">Rows</InputLabel>
          <Select
            labelId="per-page-label"
            value={perPage}
            label="Rows"
            onChange={onPerPageChange}
            size="small"
            sx={{ minHeight: 32, fontSize: '0.85rem', padding: 0 }}
          >
            {[10, 25, 50, 100].map(option => (
              <MenuItem key={option} value={option}>{option}</MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
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
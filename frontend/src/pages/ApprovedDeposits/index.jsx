import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Grid,
  IconButton,
  InputAdornment,
  useTheme,
  Button,
  Chip
} from '@mui/material';
import { 
  Search, 
  FilterList, 
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDeposits } from '../../store/slices/depositSlice';
import DepositsTable from '../../components/DepositsTable';
import { TRANSACTION_STATUS } from '../../constants'

const timeSlabs = [
  { label: 'All Time', value: 'all' },
  { label: '2-5 mins', value: '2-5' },
  { label: '5-8 mins', value: '5-8' },
  { label: '8-12 mins', value: '8-12' },
  { label: '12-20 mins', value: '12-20' },
  { label: '20+ mins', value: '20-above' }
];

const REFRESH_INTERVAL = 10000; // 10 seconds

const ApprovedDeposits = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { deposits, loading, totalPages, totalRecords, timeSlabCounts = [] } = useSelector(state => state.deposits);

  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    status: TRANSACTION_STATUS.APPROVED,
    timeSlab: 'all',
    page: 1,
    limit: 10
  });

  const [showFilters, setShowFilters] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Memoize fetchData function to prevent unnecessary re-renders
  const fetchData = useCallback(() => {
    dispatch(fetchDeposits(filters));
  }, [dispatch, filters]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh setup
  useEffect(() => {
    let intervalId;

    if (autoRefresh) {
      intervalId = setInterval(() => {
        fetchData();
      }, REFRESH_INTERVAL);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [autoRefresh, fetchData]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
      page: field === 'page' ? value : 1
    }));
  };

  const handleRefresh = () => {
    fetchData();
  };

  return (
    <Box>
      {/* Header Section */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 3 
      }}>
        <Typography variant="h4" sx={{ 
          fontWeight: 'bold', 
          fontSize: { xs: '1.5rem', sm: '2rem' },
          color: theme.palette.primary.main 
        }}>
          Approved Deposits
        </Typography>
        {/* <Stack direction="row" spacing={2} alignItems="center">
          <Tooltip title={autoRefresh ? "Auto-refresh is ON" : "Auto-refresh is OFF"}>
            <Button
              variant={autoRefresh ? "contained" : "outlined"}
              startIcon={<Refresh />}
              size="small"
              onClick={() => setAutoRefresh(!autoRefresh)}
              color={autoRefresh ? "success" : "primary"}
            >
              {autoRefresh ? "Auto" : "Manual"}
            </Button>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<Refresh />}
            size="small"
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </Stack> */}
      </Box>

      {/* Filters */}
      <Paper sx={{ 
        p: 2, 
        mb: 3, 
        borderRadius: 2,
        boxShadow: '0 2px 10px 0 rgba(0,0,0,0.05)'
      }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          mb: 2
        }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
            Filters
          </Typography>
          <IconButton size="small" onClick={() => setShowFilters(!showFilters)}>
            <FilterList />
          </IconButton>
        </Box>

        {showFilters && (
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search by UTR, Customer..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ 
                display: 'flex', 
                gap: 2, 
                flexWrap: 'wrap' 
              }}>
                {timeSlabs.map((slab) => {
                  const count = timeSlabCounts.find(s => s.label === slab.value)?.count || 0;
                  return (
                    <Button
                      key={slab.value}
                      variant={filters.timeSlab === slab.value ? "contained" : "outlined"}
                      onClick={() => handleFilterChange('timeSlab', slab.value)}
                      sx={{
                        borderRadius: 2,
                        position: 'relative',
                        minWidth: '120px'
                      }}
                    >
                      {slab.label}
                      {count > 0 && (
                        <Chip
                          size="small"
                          label={count}
                          sx={{
                            position: 'absolute',
                            top: -8,
                            right: -8,
                            backgroundColor: theme.palette.primary.main,
                            color: 'white'
                          }}
                        />
                      )}
                    </Button>
                  );
                })}
              </Box>
            </Grid>
          </Grid>
        )}
      </Paper>

      <DepositsTable
        deposits={deposits}
        loading={loading}
        totalPages={totalPages}
        totalRecords={totalRecords}
        filters={filters}
        handleFilterChange={handleFilterChange}
      />
    </Box>
  );
};

export default ApprovedDeposits; 
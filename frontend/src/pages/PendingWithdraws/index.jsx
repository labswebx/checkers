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
  Stack,
  Tooltip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip
} from '@mui/material';
import { Search, FilterList, Refresh } from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { fetchWithdraws, fetchFranchises } from '../../store/slices/depositSlice';
import WithdrawTable from '../../components/WithdrawTable';
import { TRANSACTION_STATUS } from '../../constants';

const timeSlabs = [
  { label: 'All Time', value: 'all' },
  { label: '20-30 mins', value: '20-30' },
  { label: '30-45 mins', value: '30-45' },
  { label: '45-60 mins', value: '45-60' },
  { label: '60+ mins', value: '60-above' }
];

const REFRESH_INTERVAL = 15000; // 15 seconds

const PendingWithdraws = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { withdraws = [], loading, totalPages, totalRecords, timeSlabCounts = [], franchises = [] } = useSelector(state => state.deposits);

  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    status: TRANSACTION_STATUS.PENDING,
    timeSlab: 'all',
    franchise: 'all',
    page: 1,
    limit: 10
  });

  const [showFilters, setShowFilters] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Memoize fetchData function to prevent unnecessary re-renders
  const fetchData = useCallback(() => {
    dispatch(fetchWithdraws(filters));
  }, [dispatch, filters]);

  // Initial data fetch and fetch franchises
  useEffect(() => {
    fetchData();
    dispatch(fetchFranchises());
  }, [fetchData, dispatch]);

  // Auto-refresh setup
  useEffect(() => {
    let intervalId;
    if (autoRefresh) {
      intervalId = setInterval(() => {
        fetchData();
      }, REFRESH_INTERVAL);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', fontSize: { xs: '1.5rem', sm: '2rem' }, color: theme.palette.primary.main }}>
          Pending Withdraws
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
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
        </Stack>
      </Box>
      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2, boxShadow: '0 2px 10px 0 rgba(0,0,0,0.05)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
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
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Franchise</InputLabel>
                <Select
                  value={filters.franchise}
                  label="Franchise"
                  onChange={(e) => handleFilterChange('franchise', e.target.value)}
                >
                  <MenuItem value="all">All Franchises</MenuItem>
                  {franchises.map((franchise) => (
                    <MenuItem key={franchise.name} value={franchise.name}>
                      {franchise.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
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
      {/* Withdraws Table */}
      <WithdrawTable
        withdraws={withdraws}
        loading={loading}
        totalPages={totalPages}
        totalRecords={totalRecords}
        filters={filters}
        handleFilterChange={handleFilterChange}
        perPage={filters.limit}
        onPerPageChange={(e) => handleFilterChange('limit', e.target.value)}
      />
    </Box>
  );
};

export default PendingWithdraws; 
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Grid,
  MenuItem,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  InputAdornment,
  useTheme,
  Button,
  Stack,
  Tooltip,
} from '@mui/material';
import { 
  Search, 
  FilterList, 
  Refresh, 
  CalendarToday,
  Person,
  Receipt
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { useDispatch, useSelector } from 'react-redux';
import Pagination from '../../components/Pagination';
import LoadingSpinner from '../../components/LoadingSpinner';
import { fetchDeposits } from '../../store/slices/depositSlice';

const statusColors = {
  pending: {
    bg: '#fff8e6',
    color: '#b76e00',
    chipColor: 'warning'
  },
  approved: {
    bg: '#edf7ed',
    color: '#1e4620',
    chipColor: 'success'
  },
  rejected: {
    bg: '#fdeded',
    color: '#5f2120',
    chipColor: 'error'
  }
};

const amountRanges = [
  { label: 'All Amounts', value: 'all' },
  { label: '₹0 - ₹1,000', value: '0-1000' },
  { label: '₹1,000 - ₹5,000', value: '1000-5000' },
  { label: '₹5,000 - ₹10,000', value: '5000-10000' },
  { label: '₹10,000+', value: '10000-above' }
];

const timeSlabs = [
  { label: 'All Time', value: 'all' },
  { label: '2-5 mins', value: '2-5' },
  { label: '5-8 mins', value: '5-8' },
  { label: '8-12 mins', value: '8-12' },
  { label: '12-20 mins', value: '12-20' },
  { label: '20+ mins', value: '20-above' }
];

const REFRESH_INTERVAL = 10000; // 10 seconds

const Deposits = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { deposits, loading, totalPages, totalRecords, timeSlabCounts = [] } = useSelector(state => state.deposits);

  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    startDate: null,
    endDate: null,
    amountRange: 'all',
    timeSlab: 'all',
    franchise: '',
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

    // Cleanup interval on component unmount or when autoRefresh changes
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

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (date) => {
    return date ? format(new Date(date), 'MMM dd, yyyy HH:mm') : '-';
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
          Deposits
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
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
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
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                select
                size="small"
                label="Status"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                select
                size="small"
                label="Amount Range"
                value={filters.amountRange}
                onChange={(e) => handleFilterChange('amountRange', e.target.value)}
              >
                {amountRanges.map(range => (
                  <MenuItem key={range.value} value={range.value}>
                    {range.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Start Date"
                  value={filters.startDate}
                  onChange={(date) => handleFilterChange('startDate', date)}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="End Date"
                  value={filters.endDate}
                  onChange={(date) => handleFilterChange('endDate', date)}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                fullWidth
                label="Time Slab"
                value={filters.timeSlab}
                onChange={(e) => handleFilterChange('timeSlab', e.target.value)}
                size="small"
              >
                {timeSlabs.map((option) => {
                  // Find count for this time slab
                  const slabCount = option.value === 'all' ? totalRecords : 
                    timeSlabCounts.find(s => s.label === option.value)?.count ?? 0;
                    
                  return (
                    <MenuItem key={option.value} value={option.value}>
                      <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        width: '100%', 
                        alignItems: 'center',
                        py: 0.5
                      }}>
                        <Typography>{option.label}</Typography>
                        <Chip 
                          label={slabCount.toLocaleString()} 
                          size="small" 
                          sx={{ 
                            ml: 1,
                            backgroundColor: option.value === 'all' ? 
                              theme.palette.grey[200] : 
                              theme.palette.primary.light,
                            color: option.value === 'all' ? 
                              theme.palette.text.secondary : 
                              theme.palette.primary.contrastText,
                            minWidth: 40,
                            '& .MuiChip-label': {
                              px: 1
                            }
                          }} 
                        />
                      </Box>
                    </MenuItem>
                  );
                })}
              </TextField>
            </Grid>
          </Grid>
        )}
      </Paper>

      {/* Deposits Table */}
      <Paper sx={{ 
        borderRadius: 2,
        boxShadow: '0 2px 10px 0 rgba(0,0,0,0.05)',
        overflow: 'hidden'
      }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                <TableCell>Transaction ID</TableCell>
                <TableCell>Customer Details</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>UTR</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Agent</TableCell>
                <TableCell>Timeline</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                    <LoadingSpinner />
                  </TableCell>
                </TableRow>
              ) : deposits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                    <Typography variant="body1" color="text.secondary">
                      No deposits found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                deposits.map((deposit) => (
                  <TableRow 
                    key={deposit._id} 
                    hover
                    sx={{ '&:hover': { bgcolor: '#fafafa' } }}
                  >
                    <TableCell>
                      <Tooltip title="Copy ID" arrow>
                        <Box sx={{ cursor: 'pointer' }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {deposit.transactionId}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {format(new Date(deposit.createdAt), 'dd MMM yyyy')}
                          </Typography>
                        </Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {deposit.customerName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {deposit.franchise}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {formatAmount(deposit.amount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Copy UTR" arrow>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            cursor: 'pointer',
                            '&:hover': { color: theme.palette.primary.main }
                          }}
                        >
                          {deposit.utr || '-'}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={deposit.status}
                        size="small"
                        sx={{ 
                          textTransform: 'capitalize',
                          bgcolor: statusColors[deposit.status].bg,
                          color: statusColors[deposit.status].color,
                          fontWeight: 500,
                          minWidth: 100
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Person fontSize="small" color="action" />
                        <Typography variant="body2">
                          {deposit.agentId?.name || '-'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Receipt fontSize="small" color="action" />
                          <Typography variant="caption">
                            Requested: {formatDate(deposit.requestedAt)}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CalendarToday fontSize="small" color="action" />
                          <Typography variant="caption">
                            Processed: {formatDate(deposit.processedAt)}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {deposits.length > 0 && (
          <Box sx={{ 
            p: 2, 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            borderTop: 1,
            borderColor: 'divider'
          }}>
            <Typography variant="body2" color="text.secondary">
              Showing {(filters.page - 1) * filters.limit + 1} - {Math.min(filters.page * filters.limit, totalRecords)} of {totalRecords} deposits
            </Typography>
            <Pagination
              count={totalPages}
              page={filters.page}
              onChange={(e, page) => handleFilterChange('page', page)}
              size="small"
            />
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default Deposits; 
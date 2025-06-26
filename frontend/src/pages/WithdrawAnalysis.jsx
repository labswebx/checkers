import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Chip
} from '@mui/material';
import { API_ENDPOINTS } from '../constants';
import api from '../services/api';
import { colors } from '../theme/colors';

const timeFrameOptions = [
  { value: '1h', label: 'Last 1 Hour' },
  { value: '3h', label: 'Last 3 Hours' },
  { value: '6h', label: 'Last 6 Hours' },
  { value: '1d', label: 'Last Day' },
  { value: '3d', label: 'Last 3 Days' },
  { value: '1w', label: 'Last Week' },
  { value: '1m', label: 'Last Month' },
  { value: 'all', label: 'All Time' }
];

const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Success', label: 'Success' },
  { value: 'Rejected', label: 'Rejected' }
];

const WithdrawAnalysis = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    timeFrame: '1d'
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await api.get(`${API_ENDPOINTS.WITHDRAW_ANALYSIS_STATS}`, {
          params: filters
        });
        console.log('========================================')
        console.log(response.data.data)
        console.log('========================================')
        setStats(response.data.data);
        setError(null);
      } catch (err) {
        setError('Failed to fetch withdraw analysis statistics');
        console.error('Error fetching stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [filters]);

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !stats) {
    return (
      <Box p={2}>
        <Typography color="error">{error || 'No data available'}</Typography>
      </Box>
    );
  }

  // Prepare data for the agent table
  const agentData = Object.values(stats.byAgent);
  const timeSlabLabels = Object.keys(stats.overall);

  // Calculate totals
  const totalTransactions = Object.values(stats.overall).reduce((sum, count) => sum + count, 0);
  const totalByTimeSlab = timeSlabLabels.map(label => ({
    label,
    count: stats.overall[label]
  }));

  return (
    <Box sx={{ p: 3 }}>
      {/* Header and Filters Section */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', md: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'stretch', md: 'center' },
        mb: 4,
        gap: 2
      }}>
        {/* Title and Total Count */}
        <Box>
          <Typography variant="h4" sx={{ mb: 1 }}>
            Withdraw Status Analysis
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Total Withdrawals: <Chip 
              label={totalTransactions} 
              color="primary" 
              sx={{ 
                ml: 1,
                fontWeight: 'bold',
                fontSize: '1rem'
              }} 
            />
          </Typography>
        </Box>

        {/* Filters */}
        <Box sx={{ 
          display: 'flex', 
          gap: 2,
          flexDirection: { xs: 'column', sm: 'row' }
        }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Time Frame</InputLabel>
            <Select
              value={filters.timeFrame}
              label="Time Frame"
              onChange={(e) => handleFilterChange('timeFrame', e.target.value)}
            >
              {timeFrameOptions.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filters.status}
              label="Status"
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              {statusOptions.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* Time Slab Summary */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Time Distribution Summary</Typography>
        <Grid container spacing={2}>
          {totalByTimeSlab.map(({ label, count }) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={label}>
              <Card sx={{ 
                height: '100%',
                backgroundColor: colors.background.paper,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                }
              }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography variant="h5" sx={{ mt: 1, fontWeight: 'bold' }}>
                    {count}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Agent Table */}
      <Box>
        <Typography variant="h6" sx={{ mb: 2 }}>Agent-wise Distribution</Typography>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Agent-wise Withdraw Analysis Statistics
            </Typography>
            <TableContainer component={Paper} sx={{
              maxHeight: 'calc(100vh - 400px)',
              overflowY: 'auto',
              '& .MuiTableCell-head': {
                backgroundColor: colors.background.default,
                fontWeight: 'bold',
                position: 'sticky',
                top: 0,
                zIndex: 1
              }
            }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 200 }}>Franchise</TableCell>
                    {timeSlabLabels.map((label) => (
                      <TableCell 
                        align="right" 
                        key={label}
                        sx={{ minWidth: 120 }}
                      >
                        {label}
                      </TableCell>
                    ))}
                    <TableCell 
                      align="right" 
                      sx={{ 
                        minWidth: 120,
                        fontWeight: 'bold',
                        backgroundColor: `${colors.primary.main}15 !important`
                      }}
                    >
                      Total
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {agentData.map((agent) => {
                    const agentTotal = timeSlabLabels.reduce(
                      (sum, label) => sum + (agent.timeSlabs[label] || 0),
                      0
                    );
                    return (
                      <TableRow
                        key={agent.name}
                        sx={{
                          '&:hover': {
                            backgroundColor: colors.background.default
                          }
                        }}
                      >
                        <TableCell sx={{ fontWeight: 'medium' }}>{agent.name}</TableCell>
                        {timeSlabLabels.map((label) => (
                          <TableCell align="right" key={label}>
                            {agent.timeSlabs[label] || 0}
                          </TableCell>
                        ))}
                        <TableCell
                          align="right"
                          sx={{
                            fontWeight: 'bold',
                            backgroundColor: `${colors.primary.main}15`
                          }}
                        >
                          {agentTotal}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Total Row */}
                  <TableRow sx={{
                    backgroundColor: colors.background.default,
                    '& .MuiTableCell-root': {
                      fontWeight: 'bold'
                    }
                  }}>
                    <TableCell>Total</TableCell>
                    {timeSlabLabels.map((label) => (
                      <TableCell align="right" key={label}>
                        {agentData.reduce((sum, agent) => sum + (agent.timeSlabs[label] || 0), 0)}
                      </TableCell>
                    ))}
                    <TableCell
                      align="right"
                      sx={{ backgroundColor: `${colors.primary.main}15` }}
                    >
                      {agentData.reduce((sum, agent) => sum + timeSlabLabels.reduce((s, label) => s + (agent.timeSlabs[label] || 0), 0), 0)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default WithdrawAnalysis; 
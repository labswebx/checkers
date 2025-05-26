import React, { useEffect, useState } from 'react';
import {
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
  Box,
  CircularProgress
} from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { API_ENDPOINTS } from '../constants';
import api from '../services/api';

const StatusUpdateStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get(`${API_ENDPOINTS.DASHBOARD_STATUS_UPDATE_STATS}`);
        // const response = await axios.get('/api/transactions/status-update-stats');
        setStats(response.data.data);
      } catch (err) {
        setError('Failed to fetch status update statistics');
        console.error('Error fetching stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

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

  // Prepare data for the chart
  const chartData = Object.entries(stats.overall).map(([label, count]) => ({
    name: label,
    count
  }));

  // Prepare data for the agent table
  const agentData = Object.values(stats.byAgent);
  const timeSlabLabels = Object.keys(stats.overall);

  return (
    <Grid container spacing={3}>
      {/* Overall Statistics Chart */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Status Update Time Distribution
            </Typography>
            <Box height={300}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#8884d8" name="Number of Transactions" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Agent-wise Statistics Table */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Agent-wise Status Update Statistics
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Agent Name</TableCell>
                    <TableCell>Franchise</TableCell>
                    {timeSlabLabels.map((label) => (
                      <TableCell align="right" key={label}>
                        {label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {agentData.map((agent) => (
                    <TableRow key={agent.name}>
                      <TableCell>{agent.name}</TableCell>
                      <TableCell>{agent.franchise}</TableCell>
                      {timeSlabLabels.map((label) => (
                        <TableCell align="right" key={label}>
                          {agent.timeSlabs[label] || 0}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default StatusUpdateStats; 
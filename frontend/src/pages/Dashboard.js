import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  CircularProgress,
  Card,
  CardContent
} from '@mui/material';
import {
  PeopleOutline,
  AccountBalanceWallet,
  CheckCircleOutline,
  PendingActions,
  CancelOutlined
} from '@mui/icons-material';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { getDashboardStats } from '../services/dashboard.service';
import { colors } from '../theme/colors';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const StatCard = ({ title, value, icon, color }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        {icon}
        <Typography variant="h6" sx={{ ml: 1, color: 'text.secondary' }}>
          {title}
        </Typography>
      </Box>
      <Typography variant="h4" sx={{ color }}>
        {value}
      </Typography>
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getDashboardStats();
        setStats(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ mt: 4 }}>
        <Typography color="error" align="center">
          {error}
        </Typography>
      </Box>
    );
  }

  // Prepare data for the line chart
  const dates = [...new Set(stats.trends.daily.map(item => item._id.date))];
  const lineChartData = {
    labels: dates,
    datasets: [
      {
        label: 'Approved',
        data: dates.map(date => {
          const dayData = stats.trends.daily.find(
            item => item._id.date === date && item._id.status === 'APPROVED'
          );
          return dayData ? dayData.totalAmount : 0;
        }),
        borderColor: colors.success.main,
        tension: 0.4
      },
      {
        label: 'Pending',
        data: dates.map(date => {
          const dayData = stats.trends.daily.find(
            item => item._id.date === date && item._id.status === 'PENDING'
          );
          return dayData ? dayData.totalAmount : 0;
        }),
        borderColor: colors.warning.main,
        tension: 0.4
      }
    ]
  };

  // Prepare data for the bar chart (top agents)
  const barChartData = {
    labels: stats.topAgents.map(agent => agent.agentName),
    datasets: [
      {
        label: 'Total Amount',
        data: stats.topAgents.map(agent => agent.totalAmount),
        backgroundColor: colors.primary.main
      }
    ]
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 3 }}>
        {/* Statistics Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title="Total Users"
              value={stats.users.total}
              icon={<PeopleOutline sx={{ color: colors.primary.main }} />}
              color={colors.primary.main}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title="Total Amount"
              value={`₹${stats.amounts.total.toLocaleString()}`}
              icon={<AccountBalanceWallet sx={{ color: colors.success.main }} />}
              color={colors.success.main}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title="Pending Amount"
              value={`₹${stats.amounts.pending.toLocaleString()}`}
              icon={<PendingActions sx={{ color: colors.warning.main }} />}
              color={colors.warning.main}
            />
          </Grid>
        </Grid>

        {/* Charts */}
        {/* <Grid container spacing={3}>
          <Grid item xs={12} lg={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Top Performing Agents
              </Typography>
              <Box sx={{ height: 300 }}>
                <Bar
                  data={barChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: false
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        title: {
                          display: true,
                          text: 'Amount (₹)'
                        }
                      }
                    }
                  }}
                />
              </Box>
            </Paper>
          </Grid>
        </Grid> */}

        {/* Additional Statistics */}
        <Grid container spacing={3} sx={{ mt: 2 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Approved Transactions"
              value={stats.transactions.approved}
              icon={<CheckCircleOutline sx={{ color: colors.success.main }} />}
              color={colors.success.main}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Pending Transactions"
              value={stats.transactions.pending}
              icon={<PendingActions sx={{ color: colors.warning.main }} />}
              color={colors.warning.main}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Rejected Transactions"
              value={stats.transactions.rejected}
              icon={<CancelOutlined sx={{ color: colors.error.main }} />}
              color={colors.error.main}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Total Agents"
              value={stats.users.agents}
              icon={<PeopleOutline sx={{ color: colors.info.main }} />}
              color={colors.info.main}
            />
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default Dashboard; 
import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Grid,
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

const StatCard = ({ title, value, icon, bgColor, iconColor }) => (
  <Card sx={{
    height: '100%',
    background: bgColor,
    borderRadius: '16px',
    boxShadow: '0 2px 8px 0 rgba(0,0,0,0.04)',
    border: `1.5px solid ${iconColor}22`
  }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Box sx={{
          background: `${iconColor}18`,
          borderRadius: '10px',
          p: 1,
          display: 'flex',
          alignItems: 'center',
          mr: 1
        }}>
          {React.cloneElement(icon, { sx: { color: iconColor, fontSize: 32 } })}
        </Box>
        <Typography variant="h6" sx={{ color: iconColor, fontWeight: 600 }}>
          {title}
        </Typography>
      </Box>
      <Typography variant="h4" sx={{ color: iconColor, fontWeight: 700 }}>
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

  return (
    <Container maxWidth="xl">
      <Box>
        {/* Deposit Statistics */}
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: colors.success.main }}>
          Deposit Statistics (Last 24 Hours)
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Approved Deposits"
              value={stats.transactions.approved}
              icon={<CheckCircleOutline />}
              bgColor="#e8f5e9"
              iconColor="#388e3c"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Pending Deposits"
              value={stats.transactions.pending}
              icon={<PendingActions />}
              bgColor="#fff9e6"
              iconColor="#f7b500"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Rejected Deposits"
              value={stats.transactions.rejected}
              icon={<CancelOutlined />}
              bgColor="#fbe9e7"
              iconColor="#e57373"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Total Deposited"
              value={`₹${stats.amounts.total.toLocaleString()}`}
              icon={<AccountBalanceWallet />}
              bgColor="#e3f2fd"
              iconColor="#1976d2"
            />
          </Grid>
        </Grid>

        {/* Withdrawal Statistics */}
        <Typography variant="h6" sx={{ mt: 5, mb: 2, fontWeight: 'bold', color: colors.secondary.main }}>
          Withdrawal Statistics (Last 24 Hours)
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Approved Withdrawals"
              value={stats.withdraws.approved}
              icon={<CheckCircleOutline />}
              bgColor="#e3f2fd"
              iconColor="#1976d2"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Pending Withdrawals"
              value={stats.withdraws.pending}
              icon={<PendingActions />}
              bgColor="#fff9e6"
              iconColor="#f7b500"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Rejected Withdrawals"
              value={stats.withdraws.rejected}
              icon={<CancelOutlined />}
              bgColor="#fbe9e7"
              iconColor="#e57373"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Total Withdrawn"
              value={`₹${stats.withdrawAmounts.total.toLocaleString()}`}
              icon={<AccountBalanceWallet />}
              bgColor="#e8f5e9"
              iconColor="#388e3c"
            />
          </Grid>
        </Grid>

        {/* User Statistics */}
        <Typography variant="h6" sx={{ mt: 5, mb: 2, fontWeight: 'bold', color: colors.primary.main }}>
          User Statistics
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title="Total Users"
              value={stats.users.total}
              icon={<PeopleOutline sx={{ color: colors.primary.main }} />}
              bgColor={colors.primary.main}
              iconColor={colors.primary.contrastText}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title="Total Agents"
              value={stats.users.agents}
              icon={<PeopleOutline sx={{ color: colors.info.main }} />}
              bgColor={colors.info.main}
              iconColor={colors.info.contrastText}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title="Total Admins"
              value={stats.users.admins}
              icon={<PeopleOutline sx={{ color: colors.secondary.main }} />}
              bgColor={colors.secondary.main}
              iconColor={colors.secondary.contrastText}
            />
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default Dashboard; 
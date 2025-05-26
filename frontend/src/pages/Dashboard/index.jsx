import React from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  TrendingUp,
  AccessTime,
  CheckCircle,
} from '@mui/icons-material';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

// Dummy data for demonstration
const stats = [
  {
    title: 'Total Payments',
    value: '2,547',
    icon: <TrendingUp />,
    color: '#2196f3',
  },
  {
    title: 'Pending',
    value: '45',
    icon: <AccessTime />,
    color: '#ff9800',
  },
  {
    title: 'Completed',
    value: '2,502',
    icon: <CheckCircle />,
    color: '#4caf50',
  },
];

const recentPayments = [
  {
    id: 1,
    amount: '$1,200',
    status: 'Completed',
    agent: 'John Doe',
    time: '2 mins ago',
  },
  {
    id: 2,
    amount: '$850',
    status: 'Pending',
    agent: 'Jane Smith',
    time: '5 mins ago',
  },
  {
    id: 3,
    amount: '$2,300',
    status: 'Completed',
    agent: 'Mike Johnson',
    time: '10 mins ago',
  },
  {
    id: 4,
    amount: '$750',
    status: 'Pending',
    agent: 'Sarah Wilson',
    time: '15 mins ago',
  },
];

const pieData = [
  { name: 'Completed', value: 2502, color: '#4caf50' },
  { name: 'Pending', value: 45, color: '#ff9800' },
];

const Dashboard = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 'bold', fontSize: { xs: '1.5rem', sm: '2rem' } }}>
        Dashboard
      </Typography>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {stats.map((stat) => (
          <Grid item xs={12} sm={6} md={4} key={stat.title}>
            <Card
              sx={{
                height: '100%',
                background: `linear-gradient(135deg, ${stat.color}15 0%, ${stat.color}05 100%)`,
                border: `1px solid ${stat.color}20`,
                borderRadius: '16px',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                },
              }}
            >
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      {stat.title}
                    </Typography>
                    <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', fontSize: { xs: '1.5rem', sm: '2rem' } }}>
                      {stat.value}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      backgroundColor: `${stat.color}15`,
                      borderRadius: '12px',
                      p: 1,
                      color: stat.color,
                    }}
                  >
                    {stat.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Recent Payments and Chart */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Paper
            sx={{
              width: '100%',
              p: { xs: 2, sm: 3 },
              borderRadius: '16px',
              boxShadow: '0 4px 20px 0 rgba(0,0,0,0.05)',
              overflow: 'auto',
            }}
          >
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
              Recent Payments
            </Typography>
            <TableContainer sx={{ width: '100%' }}>
              <Table sx={{ minWidth: 650 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Agent</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Time</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{payment.amount}</TableCell>
                      <TableCell>
                        <Chip
                          label={payment.status}
                          color={payment.status === 'Completed' ? 'success' : 'warning'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{payment.agent}</TableCell>
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{payment.time}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper
            sx={{
              width: '100%',
              p: { xs: 2, sm: 3 },
              borderRadius: '16px',
              boxShadow: '0 4px 20px 0 rgba(0,0,0,0.05)',
              height: '100%',
              minHeight: { xs: 300, sm: 400 },
            }}
          >
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
              Payment Status Distribution
            </Typography>
            <Box sx={{ height: { xs: 200, sm: 300 } }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={isMobile ? 40 : 60}
                    outerRadius={isMobile ? 60 : 80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </Box>
            <Box sx={{ mt: 2 }}>
              {pieData.map((item) => (
                <Box
                  key={item.name}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    mb: 1,
                  }}
                >
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: item.color,
                      mr: 1,
                    }}
                  />
                  <Typography variant="body2">
                    {item.name} ({item.value})
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard; 
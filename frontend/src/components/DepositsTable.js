import { 
  TableContainer,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Box,
  Typography,
  Paper,
  Chip,
  Stack,
  Tooltip,
  useTheme,
  IconButton
} from '@mui/material'
import {
  Person,
  Receipt,
  WhatsApp,
  Timer
} from '@mui/icons-material'
import Pagination from './Pagination';
import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect } from 'react'
import { formatToUAETime, getElapsedTimeInUAE } from '../utils/timezone.util';

const ElapsedTimer = ({ createdAt }) => {
  const [elapsedTime, setElapsedTime] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const theme = useTheme();

  useEffect(() => {
    const updateTimer = () => {
      setElapsedTime(getElapsedTimeInUAE(createdAt));
    };
    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);

    return () => clearInterval(intervalId);
  }, [createdAt]);

  const getTimerColor = () => {
    const totalMinutes = elapsedTime.hours * 60 + elapsedTime.minutes;
    if (totalMinutes < 5) return theme.palette.success.main;
    if (totalMinutes < 10) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 1,
      backgroundColor: `${getTimerColor()}15`, // 15% opacity of the color
      padding: '4px 8px',
      borderRadius: '4px',
      border: `1px solid ${getTimerColor()}40`, // 40% opacity border
    }}>
      <Timer fontSize="small" sx={{ color: getTimerColor() }} />
      <Typography 
        variant="body2" 
        sx={{ 
          fontWeight: 'medium',
          color: getTimerColor(),
          fontFamily: 'monospace', // Use monospace for better number alignment
        }}
      >
        {String(elapsedTime.hours).padStart(2, '0')}:
        {String(elapsedTime.minutes).padStart(2, '0')}:
        {String(elapsedTime.seconds).padStart(2, '0')}
      </Typography>
    </Box>
  );
};

export default function DepositsTable({ deposits, loading, totalPages, totalRecords, filters, handleFilterChange }) {
  const theme = useTheme();

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

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleWhatsAppClick = (deposit) => {
    const message = `Transaction Details:
    ID: ${deposit.transactionId}
    Customer: ${deposit.customerName}
    Amount: ${formatAmount(deposit.amount)}
    UTR: ${deposit.utr || 'N/A'}
    Status: ${deposit.status}
    Created: ${formatToUAETime(deposit.createdAt)}`;

    const phone = deposit.agentId?.contactNumber.toString()
    if (!phone) {
      alert('No contact number available for this agent');
      return;
    }

    const formattedPhone = phone.startsWith('91') ? phone : `91${phone}`;    
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;    
    window.open(whatsappUrl, '_blank');
  };

  return <Paper sx={{ 
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
            <TableCell>Franchise</TableCell>
            <TableCell>Timeline</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                <LoadingSpinner />
              </TableCell>
            </TableRow>
          ) : deposits.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
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
                        {formatToUAETime(deposit.createdAt)}
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
                    {deposit.status === 'pending' && (
                      <ElapsedTimer createdAt={formatToUAETime(deposit.createdAt)} />
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Receipt fontSize="small" color="action" />
                      <Typography variant="caption">
                        Created: {formatToUAETime(deposit.createdAt)}
                      </Typography>
                    </Box>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Tooltip title="Send WhatsApp Message" arrow>
                    <IconButton
                      size="small"
                      onClick={() => handleWhatsAppClick(deposit)}
                      sx={{
                        color: '#25D366', // WhatsApp green color
                        '&:hover': {
                          backgroundColor: 'rgba(37, 211, 102, 0.1)'
                        }
                      }}
                    >
                      <WhatsApp />
                    </IconButton>
                  </Tooltip>
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
}

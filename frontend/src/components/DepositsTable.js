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
  IconButton,
  CircularProgress
} from '@mui/material'
import {
  Person,
  Receipt,
  WhatsApp,
  Timer,
  Image
} from '@mui/icons-material'
import Pagination from './Pagination';
import React, { useState, useEffect } from 'react'
import { getElapsedTimeInIndianTimeZone } from '../utils/timezone.util';
import ImageOverlay from './ImageOverlay';
import { formatInTimeZone } from 'date-fns-tz';
import { TRANSACTION_STATUS } from '../constants';

const ElapsedTimer = ({ date }) => {
  const [elapsedTime, setElapsedTime] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const theme = useTheme();

  useEffect(() => {
    const updateTimer = () => {
      setElapsedTime(getElapsedTimeInIndianTimeZone(date));
    };
    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);

    return () => clearInterval(intervalId);
  }, [date]);

  const getTimerColor = () => {
    const totalMinutes = elapsedTime.hours * 60 + elapsedTime.minutes;
    if (totalMinutes < 5) return theme.palette.success.main;
    if (totalMinutes < 8) return theme.palette.warning.main;
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
  const [selectedImage, setSelectedImage] = useState(null);

  const statusColors = {
    Pending: {
      bg: '#fff8e6',
      color: '#b76e00',
      chipColor: 'warning'
    },
    Success: {
      bg: '#edf7ed',
      color: '#1e4620',
      chipColor: 'success'
    },
    Rejected: {
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
    Order ID: ${deposit.orderId}
    Customer: ${deposit.customerName}
    Amount: ${formatAmount(deposit.amount)}
    UTR: ${deposit.utr || 'N/A'}
    Status: ${deposit.status}
    Request Date: ${deposit.requestDate}`;

    const phone = deposit?.agentId?.contactNumber?.toString();
    if (!phone) {
      alert('No contact number available for this agent');
      return;
    }

    const formattedPhone = phone.startsWith('91') ? phone : `91${phone}`;    
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;    
    window.open(whatsappUrl, '_blank');
  };

  const handleTranscriptClick = (transcriptLink) => {
    if (!transcriptLink) {
      alert('No transcript available for this transaction');
      return;
    }
    setSelectedImage(transcriptLink);
  };

  return (
    <>
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Order ID</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>UTR</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Franchise</TableCell>
                <TableCell>Request Date</TableCell>
                {
                  deposits.length > 0 ? deposits[0].status === TRANSACTION_STATUS.SUCCESS ? 
                  <TableCell>Approved Time</TableCell> : deposits[0].status === TRANSACTION_STATUS.REJECTED ? <TableCell>Rejected Time</TableCell> : null : null
                }
                <TableCell>Transcript</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 3 }}>
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : deposits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 3 }}>
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
                            {deposit.orderId}
                          </Typography>
                        </Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {deposit.customerName}
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
                          {deposit.franchise.split(' (')[0]}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        {deposit.status === TRANSACTION_STATUS.PENDING && (
                          <ElapsedTimer date={deposit.requestDate} />
                        )}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="caption">
                            {formatInTimeZone(new Date(deposit.requestDate), 'Asia/Kolkata', 'MMM dd, yyyy HH:mm')}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    {
                      deposit.status === TRANSACTION_STATUS.SUCCESS || deposit.status === TRANSACTION_STATUS.REJECTED ? 
                      <TableCell>
                      <Stack spacing={0.5}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {/* <Receipt fontSize="small" color="action" /> */}
                          <Typography variant="caption">
                            {formatInTimeZone(new Date(deposit.approvedOn), 'Asia/Kolkata', 'MMM dd, yyyy HH:mm')}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell> : null
                    }
                    <TableCell>
                      {deposit.transcriptLink ? (
                        <Tooltip title="View Transcript" arrow>
                          <IconButton
                            size="small"
                            onClick={() => handleTranscriptClick(deposit.transcriptLink)}
                            sx={{
                              color: theme.palette.primary.main,
                              '&:hover': {
                                backgroundColor: 'rgba(25, 118, 210, 0.1)'
                              }
                            }}
                          >
                            <Image />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Tooltip title="Send WhatsApp Message" arrow>
                          <IconButton
                            size="small"
                            onClick={() => handleWhatsAppClick(deposit)}
                            sx={{
                              color: '#25D366',
                              '&:hover': {
                                backgroundColor: 'rgba(37, 211, 102, 0.1)'
                              }
                            }}
                          >
                            <WhatsApp />
                          </IconButton>
                        </Tooltip>
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

      {selectedImage && (
        <ImageOverlay
          imageUrl={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </>
  );
}

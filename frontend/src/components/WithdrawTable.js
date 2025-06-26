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
  Tooltip,
  useTheme,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  keyframes,
  Button,
  Stack
} from '@mui/material'
import {
  Person,
  Image,
  Visibility,
  ContentCopy,
  Timer
} from '@mui/icons-material'
import Pagination from './Pagination';
import React, { useState, useEffect } from 'react'
import ImageOverlay from './ImageOverlay';
import { formatInTimeZone } from 'date-fns-tz';
import { TRANSACTION_STATUS } from '../constants';
import { getElapsedTimeInIndianTimeZone } from '../utils/timezone.util';

const WithdrawTimer = ({ withdraw }) => {
  const [elapsedTime, setElapsedTime] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const theme = useTheme();

  useEffect(() => {
    const updateTimer = () => {
      let startDate;
      
      if (!withdraw.bonusApprovedOn) {
        startDate = withdraw.requestDate;
      }
      else if (!withdraw.checkingDeptApprovedOn) {
        startDate = withdraw.bonusApprovedOn;
      }
      else {
        startDate = withdraw.checkingDeptApprovedOn;
      }
      if (withdraw.status === TRANSACTION_STATUS.SUCCESS || withdraw.status === TRANSACTION_STATUS.REJECTED) {
        return;
      }

      setElapsedTime(getElapsedTimeInIndianTimeZone(startDate));
    };
    
    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);

    return () => clearInterval(intervalId);
  }, [withdraw]);

  const getTimerColor = () => {
    const totalMinutes = elapsedTime.hours * 60 + elapsedTime.minutes;
    if (totalMinutes < 5) return theme.palette.success.main;
    if (totalMinutes < 8) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  // Don't show timer if status is Success or Rejected
  if (withdraw.status === TRANSACTION_STATUS.SUCCESS || withdraw.status === TRANSACTION_STATUS.REJECTED) {
    return null;
  }

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

export default function WithdrawTable({ withdraws, loading, totalPages, totalRecords, filters, handleFilterChange }) {
  const theme = useTheme();
  const [selectedImage, setSelectedImage] = useState(null);
  const [accountNumberDialog, setAccountNumberDialog] = useState({ open: false, accountNumber: '' });

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

  const handleTranscriptClick = (transcriptLink) => {
    if (!transcriptLink) {
      alert('No transcript available for this transaction');
      return;
    }
    setSelectedImage(transcriptLink);
  };

  const handleAccountNumberClick = (accountNumber) => {
    setAccountNumberDialog({ open: true, accountNumber });
  };

  const handleCopyAccountNumber = () => {
    navigator.clipboard.writeText(accountNumberDialog.accountNumber);
    // You could add a toast notification here
  };

  const handleCloseAccountDialog = () => {
    setAccountNumberDialog({ open: false, accountNumber: '' });
  };

  // Flashing animation keyframes
  const flashAnimation = keyframes`
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.95); }
  `;

  const PendingBadge = ({ label, color = 'warning', showAnimation = true }) => {
    const colorMap = {
      warning: {
        bg: theme.palette.warning.light,
        color: theme.palette.warning.contrastText
      },
      info: {
        bg: theme.palette.info.light,
        color: theme.palette.info.contrastText
      },
      error: {
        bg: theme.palette.error.light,
        color: theme.palette.error.contrastText
      },
      primary: {
        bg: theme.palette.primary.light,
        color: theme.palette.primary.contrastText
      },
      success: {
        bg: theme.palette.success.light,
        color: theme.palette.success.contrastText
      },
      secondary: {
        bg: theme.palette.grey[400],
        color: theme.palette.black
      }
    };

    const badgeColor = colorMap[color];

    return (
      <Chip
        label={label}
        size="small"
        sx={{
          animation: `${showAnimation ? `${flashAnimation} 2s ease-in-out infinite` : null}`,
          bgcolor: badgeColor.bg,
          color: badgeColor.color,
          fontWeight: 500,
          fontSize: '0.75rem',
          transition: `${showAnimation ? 'all 0.2s ease-in-out' : null}`,
          '&:hover': {
            transform: 'scale(1.05)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }
        }}
      />
    );
  };

  return (
    <>
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer sx={{ maxWidth: '100vw', overflowX: 'auto' }}>
          <Table stickyHeader sx={{ minWidth: 1300 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 120 }}>Order ID</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 120 }}>Customer</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 120 }}>Franchise</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 120 }}>Request Date</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 120 }}>UTR</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 120 }}>Transcript</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 120 }}>Account No</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 120 }}>Payable Amount</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 120 }}>Checking Dept</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 180 }}>Bonus Approved On</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 180 }}>Checking Dept Approved On</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 120 }}>Approved Date</TableCell>
                {
                  withdraws.length > 0 && withdraws[0].status !== TRANSACTION_STATUS.SUCCESS && withdraws[0].status !== TRANSACTION_STATUS.REJECTED && <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 120 }}>Status</TableCell>
                }
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={withdraws.length > 0 && withdraws[0].status !== TRANSACTION_STATUS.SUCCESS && withdraws[0].status !== TRANSACTION_STATUS.REJECTED ? 13 : 11} align="center" sx={{ py: 3 }}>
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : withdraws.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={withdraws.length > 0 && withdraws[0].status !== TRANSACTION_STATUS.SUCCESS && withdraws[0].status !== TRANSACTION_STATUS.REJECTED ? 13 : 11} align="center" sx={{ py: 3 }}>
                    <Typography variant="body1" color="text.secondary">
                      No withdraws found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                withdraws.map((withdraw) => (
                  <TableRow
                    key={withdraw._id}
                    hover
                    sx={{ '&:hover': { bgcolor: '#fafafa' } }}
                  >
                    <TableCell>
                      <Tooltip title="Copy ID" arrow>
                        <Box sx={{ cursor: 'pointer' }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {withdraw.orderId}
                          </Typography>
                        </Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {withdraw.customerName}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, whiteSpace: 'nowrap' }}>
                        <Person fontSize="small" color="action" />
                        <Typography variant="body2">
                          {withdraw.franchise.split(' (')[0]}
                        </Typography>
                      </Box>
                    </TableCell>

                    {/* Request Date */}
                    <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 120 }}>
                      <Stack spacing={0.5}>
                        {withdraw.status !== TRANSACTION_STATUS.SUCCESS && withdraw.status !== TRANSACTION_STATUS.REJECTED && (
                          <WithdrawTimer withdraw={withdraw} />
                        )}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="caption">
                            {formatInTimeZone(new Date(withdraw.requestDate), 'Asia/Kolkata', 'MMM dd, yyyy HH:mm')}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>

                    <TableCell>
                      {withdraw.utr ? (
                        <Tooltip title="Copy UTR" arrow>
                          <Typography
                            variant="body2"
                            sx={{
                              cursor: 'pointer',
                              '&:hover': { color: theme.palette.primary.main },
                              whiteSpace: 'pre-line',
                              wordBreak: 'break-all',
                              minWidth: 200,
                            }}
                          >
                            {withdraw.utr}
                          </Typography>
                        </Tooltip>
                      ) : (
                        <PendingBadge label="Pending" color="warning" />
                      )}
                    </TableCell>
                    <TableCell>
                      {withdraw.transcriptLink ? (
                        <Tooltip title="View Transcript" arrow>
                          <IconButton
                            size="small"
                            onClick={() => handleTranscriptClick(withdraw.transcriptLink)}
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
                        <PendingBadge label="Pending" color="primary" />
                      )}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 120 }}>
                      <Tooltip title="View Account Number" arrow>
                        <IconButton
                          size="small"
                          onClick={() => handleAccountNumberClick(withdraw.accountNumber)}
                          sx={{
                            color: theme.palette.primary.main,
                            '&:hover': {
                              backgroundColor: 'rgba(25, 118, 210, 0.1)'
                            }
                          }}
                        >
                          <Visibility />
                        </IconButton>
                      </Tooltip>
                    </TableCell>

                    {/* Payable Amount */}
                    <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 120 }}>
                      {
                        (withdraw.bonusIncluded || withdraw.bonusExcluded) || (withdraw.auditStatus === TRANSACTION_STATUS.SUCCESS) ? <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {formatAmount(Math.abs(withdraw.amount) - withdraw.bonusIncluded)}
                        </Typography> : <PendingBadge label="Pending" color="error" />
                      }
                    </TableCell>

                    {/* Checking Dept */}
                    <TableCell>
                      <PendingBadge showAnimation={withdraw.auditStatus === TRANSACTION_STATUS.PENDING} label={withdraw.auditStatus} color={
                          withdraw.auditStatus === TRANSACTION_STATUS.PENDING ? "warning" : withdraw.auditStatus === TRANSACTION_STATUS.SUCCESS ? "success" : "error"
                        } />
                    </TableCell>

                    {/* Bonus Approved On */}
                    <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 180 }}>
                      {
                        withdraw.bonusApprovedOn ? <Typography variant="caption">
                          {formatInTimeZone(new Date(withdraw.bonusApprovedOn), 'Asia/Kolkata', 'MMM dd, yyyy HH:mm')}
                        </Typography> : <PendingBadge label="Pending" color="error" />
                      }
                    </TableCell>

                    {/* Checking Dept Approved On */}
                    <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 180 }}>
                      {
                        withdraw.checkingDeptApprovedOn ? <Typography variant="caption">
                          {formatInTimeZone(new Date(withdraw.checkingDeptApprovedOn), 'Asia/Kolkata', 'MMM dd, yyyy HH:mm')}
                        </Typography> : <PendingBadge label="Pending" color="secondary" showAnimation={false} />
                      }
                    </TableCell>

                    {/* Approved Date */}
                    <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 120 }}>
                      {
                        withdraw.approvedOn ? <Typography variant="caption">
                          {formatInTimeZone(new Date(withdraw.approvedOn), 'Asia/Kolkata', 'MMM dd, yyyy HH:mm')}
                        </Typography> : <PendingBadge label="Pending" color="secondary" showAnimation={false} />
                      }
                    </TableCell>

                    {/* Status */}
                    {
                      (withdraw.status !== TRANSACTION_STATUS.SUCCESS && withdraw.status !== TRANSACTION_STATUS.REJECTED)
                        ? (
                          <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 120 }}>
                            {(() => {
                              // Check if all required conditions are met
                              const hasUTR = withdraw.utr && withdraw.utr.trim() !== '';
                              const hasTranscript = withdraw.transcriptLink && withdraw.transcriptLink.trim() !== '';
                              const hasBonus = (withdraw.bonusIncluded && withdraw.bonusIncluded > 0) || 
                                            (withdraw.bonusExcluded && withdraw.bonusExcluded > 0);
                              const isAuditApproved = withdraw.auditStatus === TRANSACTION_STATUS.SUCCESS;
                              const allConditionsMet = hasUTR && hasTranscript && hasBonus && isAuditApproved;
                              if (allConditionsMet) {
                                return (
                                  <Chip
                                    label={withdraw.status}
                                    size="small"
                                    sx={{ 
                                      textTransform: 'capitalize',
                                      bgcolor: statusColors[withdraw.status].bg,
                                      color: statusColors[withdraw.status].color,
                                      fontWeight: 500,
                                      minWidth: 100
                                    }}
                                  />
                                );
                              } else {
                                return (
                                  <PendingBadge label="Confirmation Awaited" color="info" />
                                );
                              }
                            })()}
                          </TableCell>
                        )
                        : null
                    }
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {withdraws.length > 0 && (
          <Box sx={{
            p: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: 1,
            borderColor: 'divider'
          }}>
            <Typography variant="body2" color="text.secondary">
              Showing {(filters.page - 1) * filters.limit + 1} - {Math.min(filters.page * filters.limit, totalRecords)} of {totalRecords} withdraws
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

      {/* Account Number Dialog */}
      <Dialog
        open={accountNumberDialog.open}
        onClose={handleCloseAccountDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Account Number
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
            <Typography variant="h6" sx={{ fontFamily: 'monospace', letterSpacing: '0.1em' }}>
              {accountNumberDialog.accountNumber}
            </Typography>
            <Tooltip title="Copy to clipboard" arrow>
              <IconButton
                onClick={handleCopyAccountNumber}
                sx={{ color: theme.palette.primary.main }}
              >
                <ContentCopy />
              </IconButton>
            </Tooltip>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAccountDialog}>Close</Button>
        </DialogActions>
      </Dialog>

      {selectedImage && (
        <ImageOverlay
          imageUrl={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </>
  );
} 
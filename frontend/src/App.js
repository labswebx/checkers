import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Provider } from 'react-redux';
import { useDispatch, useSelector } from 'react-redux';
import store from './store';
import { fetchProfile } from './store/slices/authSlice';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Users from './pages/Users';
import LoadingSpinner from './components/LoadingSpinner';
import { LOCAL_STORAGE_KEYS } from './constants';
import Deposits from './pages/Deposits';
import ApprovedDeposits from './pages/ApprovedDeposits';
import RejectedDeposits from './pages/RejectedDeposits';
import StatusAnalysis from './pages/StatusAnalysis';
import PendingWithdraws from './pages/PendingWithdraws';
import ApprovedWithdraws from './pages/ApprovedWithdraws';
import RejectedWithdraws from './pages/RejectedWithdraws';
import WithdrawAnalysis from './pages/WithdrawAnalysis';
import Chat from './pages/Chat';
import ChatConversation from './pages/ChatConversation';

// Create a theme instance
const theme = createTheme({
  palette: {
    primary: {
      main: '#1e3a8a',
      light: '#2563eb',
      dark: '#1e3a8a',
    },
    secondary: {
      main: '#dc2626',
      light: '#ef4444',
      dark: '#b91c1c',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a',
      secondary: '#475569',
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
      color: '#0f172a',
    },
    h6: {
      fontWeight: 600,
      color: '#0f172a',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        },
      },
    },
  },
});

// Public Route Component (for login page)
const PublicRoute = ({ children }) => {
  const { user, loading } = useSelector(state => state.auth);
  const dispatch = useDispatch();
  const token = localStorage.getItem(LOCAL_STORAGE_KEYS.TOKEN);

  useEffect(() => {
    if (!user && token) {
      dispatch(fetchProfile());
    }
  }, [dispatch, user, token]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useSelector(state => state.auth);
  const dispatch = useDispatch();
  const token = localStorage.getItem(LOCAL_STORAGE_KEYS.TOKEN);

  useEffect(() => {
    if (!user && token) {
      dispatch(fetchProfile());
    }
  }, [dispatch, user, token]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user && !token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Main App Component
function App() {
  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/pending-deposits"
            element={
              <ProtectedRoute>
                <Layout>
                  <Deposits />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/approved-deposits"
            element={
              <ProtectedRoute>
                <Layout>
                  <ApprovedDeposits />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/rejected-deposits"
            element={
              <ProtectedRoute>
                <Layout>
                  <RejectedDeposits />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/status-analysis"
            element={
              <ProtectedRoute>
                <Layout>
                  <StatusAnalysis />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <Layout>
                  <Users />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/pending-withdrawals"
            element={
              <ProtectedRoute>
                <Layout>
                  <PendingWithdraws />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/approved-withdraws"
            element={
              <ProtectedRoute>
                <Layout>
                  <ApprovedWithdraws />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/rejected-withdraws"
            element={
              <ProtectedRoute>
                <Layout>
                  <RejectedWithdraws />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/withdraw-analysis"
            element={
              <ProtectedRoute>
                <Layout>
                  <WithdrawAnalysis />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <Layout>
                  <Chat />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat/:conversationId"
            element={
              <ProtectedRoute>
                <ChatConversation />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="*" 
            element={
              <ProtectedRoute>
                <Layout>
                  <Navigate to="/dashboard" replace />
                </Layout>
              </ProtectedRoute>
            } 
          />
        </Routes>
      </ThemeProvider>
    </Provider>
  );
}

// App Wrapper with Redux and Router
const AppWrapper = () => {
  return (
    <Provider store={store}>
      <Router>
        <App />
      </Router>
    </Provider>
  );
};

export default AppWrapper; 
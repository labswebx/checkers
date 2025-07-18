import React from "react";
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  Dashboard,
  People,
  AccountBalance,
  Analytics,
  CheckCircle,
  Cancel,
} from "@mui/icons-material";
import { useNavigate, useLocation } from "react-router-dom";
import logo from "../../assets/images/logo.png";

const drawerWidth = 240;

const menuItems = [
  { text: "Dashboard", icon: <Dashboard />, path: "/dashboard" },
  {
    text: "Pending Deposits",
    icon: <AccountBalance />,
    path: "/pending-deposits",
  },
  {
    text: "Approved Deposits",
    icon: <CheckCircle />,
    path: "/approved-deposits",
  },
  { text: "Rejected Deposits", icon: <Cancel />, path: "/rejected-deposits" },
  {
    text: "Pending Withdraws",
    icon: <AccountBalance />,
    path: "/pending-withdrawals",
  },
  {
    text: "Approved Withdraws",
    icon: <CheckCircle />,
    path: "/approved-withdraws",
  },
  { text: "Rejected Withdraws", icon: <Cancel />, path: "/rejected-withdraws" },
  { text: "Deposits Analysis", icon: <Analytics />, path: "/status-analysis" },
  {
    text: "Withdraw Analysis",
    icon: <Analytics />,
    path: "/withdraw-analysis",
  },
  { text: "Bonus Analysis", icon: <Analytics />, path: "/bonus-analysis" },
  { text: "Users", icon: <People />, path: "/users" },
];

const Sidebar = ({ mobileOpen, handleDrawerToggle }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const drawer = (
    <>
      <Box
        sx={{
          p: 2,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <img src={logo} alt="Company Logo" style={{ height: 55 }} />
      </Box>

      <List sx={{ px: 1 }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) {
                    handleDrawerToggle();
                  }
                }}
                sx={{
                  borderRadius: "12px",
                  backgroundColor: isActive
                    ? "rgba(255, 255, 255, 0.1)"
                    : "transparent",
                  "&:hover": {
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                  },
                }}
              >
                <ListItemIcon sx={{ color: "white", minWidth: "40px" }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: "0.85rem",
                    fontWeight: isActive ? "bold" : "medium",
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </>
  );

  return (
    <Box
      component="nav"
      sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
    >
      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          display: { xs: "block", sm: "none" },
          "& .MuiDrawer-paper": {
            boxSizing: "border-box",
            width: drawerWidth,
            backgroundColor: theme.palette.primary.main,
            color: "white",
            borderRight: 0,
          },
        }}
      >
        {drawer}
      </Drawer>
      {/* Desktop drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", sm: "block" },
          "& .MuiDrawer-paper": {
            boxSizing: "border-box",
            width: drawerWidth,
            backgroundColor: theme.palette.primary.main,
            color: "white",
            borderRight: 0,
          },
        }}
        open
      >
        {drawer}
      </Drawer>
    </Box>
  );
};

export default Sidebar;

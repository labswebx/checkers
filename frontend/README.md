# Payment Monitoring System

## Project Overview
A comprehensive system to monitor payments, track their status, manage agents, and send automated WhatsApp notifications for pending payments.

## Core Features

### 1. Payment Data Scraping
- Scrape payment data from an authenticated web portal
- Track payment status, creation time, and associated details
- Continuous scraping to get real-time updates
- Handle authenticated scraping through login credentials

### 2. Agent Management
- CRUD operations for agents
- Map agents with their contact numbers
- Associate agents with lead contact numbers
- Track agent performance and payment updates

### 3. Automated Notifications
- Monitor payment status after creation
- Send WhatsApp notifications after 2 minutes if payment is pending
- Notifications sent to both agents and lead contact numbers
- Smart notification system that cancels alerts if payment is completed within the time window

### 4. Dashboard
- Secure authentication system
- Agent management interface
- Payment monitoring with filters
- Real-time status updates
- Agent-payment mapping visualization

## Technical Architecture

### Backend Stack
- **Framework**: Node.js with Express
- **Database**: MongoDB (for flexible schema and real-time operations)
- **Authentication**: JWT (JSON Web Tokens)
- **Web Scraping**: Puppeteer (handles authenticated sessions)
- **Job Scheduling**: node-cron (for periodic scraping and notification checks)
- **Logging**: Winston (free and feature-rich logging)

### Frontend Stack
- **Framework**: React with TypeScript
- **UI Library**: Material-UI (MUI)
- **State Management**: Redux Toolkit
- **Data Fetching**: React Query
- **Charts/Visualization**: Recharts
- **Form Handling**: Formik with Yup validation

### External Services
- **WhatsApp API**: WhatsApp Business API (paid)
- **Hosting**: Cloud provider of choice (paid)
- **Domain**: Custom domain (paid)

### Key Technical Components

1. **Scraping Service**
   - Handles authenticated sessions
   - Periodic data fetching
   - Data transformation and storage
   - Real-time updates

2. **Notification Service**
   - Payment status monitoring
   - Time-based triggers
   - WhatsApp message formatting
   - Smart cancellation system

3. **Agent Service**
   - Agent data management
   - Contact number mapping
   - Lead association
   - Performance tracking

4. **Authentication Service**
   - User management
   - Role-based access control
   - Secure session handling

## Project Structure
```
project/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── services/
│   │   │   ├── scraping/
│   │   │   ├── notification/
│   │   │   └── agent/
│   │   ├── routes/
│   │   └── utils/
│   ├── config/
│   └── tests/
└── frontend/
    ├── src/
    │   ├── components/
    │   ├── pages/
    │   ├── services/
    │   ├── store/
    │   └── utils/
    └── public/
```

## Development Phases

### Phase 1: Foundation
1. Set up project structure
2. Implement basic authentication
3. Create agent management system
4. Develop scraping service prototype
5. Set up database schema

### Phase 2: Core Features
1. Implement complete scraping system
2. Develop notification service
3. Create dashboard UI
4. Integrate WhatsApp API
5. Implement real-time updates

### Phase 3: Enhancement
1. Add advanced filters
2. Implement reporting
3. Add performance monitoring
4. Optimize scraping efficiency
5. Add error handling and recovery

## Free Tools/Services Used
- MongoDB Atlas (free tier)
- Winston for logging
- Puppeteer for scraping
- JWT for authentication
- Material-UI for frontend components
- GitHub for version control
- PM2 for process management

## Paid Services Required
1. WhatsApp Business API
2. Server hosting
3. Domain name

## Security Considerations
- Secure credential storage
- Rate limiting
- CORS configuration
- Input validation
- XSS protection
- CSRF protection
- Data encryption

## Monitoring and Logging
- Application logs
- Error tracking
- Performance metrics
- Scraping status
- Notification delivery status

## Next Steps
1. Set up development environment
2. Create basic project structure
3. Implement authentication system
4. Begin with agent management module
5. Develop scraping prototype

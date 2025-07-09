# Sentry Integration Guide

## Installation
```bash
npm install @sentry/node @sentry/profiling-node
```

## Basic Setup (add to src/index.js)
```javascript
const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");

// Initialize Sentry BEFORE other imports
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    nodeProfilingIntegration(),
  ],
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
});

// Add error handler middleware (after routes)
app.use(Sentry.Handlers.errorHandler());
```

## Environment Variable
Add to .env:
```
SENTRY_DSN=your_sentry_dsn_here
```
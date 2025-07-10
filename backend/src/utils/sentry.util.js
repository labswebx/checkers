const Sentry = require('@sentry/node');

const sentryUtil = {
  // Check if Sentry is enabled
  isEnabled: () => !!process.env.SENTRY_DSN,

  // Capture exceptions
  captureException: (error, context = {}) => {
    if (!sentryUtil.isEnabled()) return;
    Sentry.withScope((scope) => {
      Object.keys(context).forEach(key => {
        scope.setTag(key, context[key]);
      });
      Sentry.captureException(error);
    });
  },

  // Capture messages
  captureMessage: (message, level = 'info', context = {}) => {
    if (!sentryUtil.isEnabled()) return;
    Sentry.withScope((scope) => {
      Object.keys(context).forEach(key => {
        scope.setTag(key, context[key]);
      });
      Sentry.captureMessage(message, level);
    });
  },

  // Set user context
  setUser: (user) => {
    if (!sentryUtil.isEnabled()) return;
    Sentry.setUser(user);
  },

  // Add breadcrumb
  addBreadcrumb: (message, category = 'custom', level = 'info') => {
    if (!sentryUtil.isEnabled()) return;
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      timestamp: Date.now() / 1000,
    });
  }
};

module.exports = sentryUtil;
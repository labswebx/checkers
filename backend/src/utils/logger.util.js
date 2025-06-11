const winston = require('winston');
const path = require('path');

// Safe JSON stringify that handles circular references
function safeStringify(obj, indent = 2) {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular Reference]';
      }
      seen.add(value);
      
      // Remove problematic properties from axios response objects
      if (value.constructor && value.constructor.name === 'IncomingMessage') {
        return {
          statusCode: value.statusCode,
          statusMessage: value.statusMessage,
          headers: value.headers
        };
      }
      
      if (value.constructor && value.constructor.name === 'ClientRequest') {
        return '[HTTP Request Object]';
      }
    }
    return value;
  }, indent);
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? safeStringify(meta, 2) : ''}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  format: logFormat,
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/app.log'),
      format: logFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // File transport for error logs
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      format: logFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

module.exports = logger; 
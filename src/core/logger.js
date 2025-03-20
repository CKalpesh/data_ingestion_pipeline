const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    defaultMeta: { service: 'data-ingestion' },
    transports: [
        new winston.transports.Console(),
    ]
});

// Add correlation ID for request tracking
const withCorrelation = (correlationId) => {
    return {
        info: (message, meta = {}) => logger.info(message, { ...meta, correlationId }),
        error: (message, meta = {}) => logger.error(message, { ...meta, correlationId }),
        warn: (message, meta = {}) => logger.warn(message, { ...meta, correlationId }),
        debug: (message, meta = {}) => logger.debug(message, { ...meta, correlationId })
    };
};

module.exports = { logger, withCorrelation };


const { logger, withCorrelation } = require('../core/logger');
const datastore = require('../core/datastore');
const messageQueue = require('../core/messageQueue');

// Process messages from external queue
const processQueueMessage = async (message, correlationId) => {
    const log = withCorrelation(correlationId);

    try {
        log.info('Processing queue message');

        if (!message || typeof message !== 'object') {
            log.error('Invalid queue message format');
            throw new Error('Invalid queue message format');
        }

        // For messages that are arrays of records
        if (Array.isArray(message)) {
            log.info(`Message contains array of ${message.length} records`);
            await messageQueue.publish('data-ingestion', message, {
                source: 'external-queue',
                correlationId,
                timestamp: new Date().toISOString()
            });
            return { success: true, count: message.length };
        }

        // For single record messages
        await messageQueue.publish('data-ingestion', [message], {
            source: 'external-queue',
            correlationId,
            timestamp: new Date().toISOString()
        });
        log.info('Published message to internal queue');
        return { success: true, count: 1 };
    } catch (error) {
        log.error('Queue message processing failed', { error: error.message });
        throw error;
    }
};

// Store queue data (called by queue consumer)
const storeQueueData = async (data, correlationId) => {
    const log = withCorrelation(correlationId);

    try {
        log.info(`Storing ${data.length} records from queue`);
        const result = await datastore.store(data, 'queue');
        log.info(`Successfully stored queue data`, { count: result.count });
        return result;
    } catch (error) {
        log.error('Failed to store queue data', { error: error.message });
        throw error;
    }
};

module.exports = {
    processQueueMessage,
    storeQueueData
};
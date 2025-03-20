
const { v4: uuidv4 } = require('uuid');
const { logger, withCorrelation } = require('./core/logger');
const messageQueue = require('./core/messageQueue');
const datastore = require('./core/datastore');
const { storeApiData } = require('./services/apiIngestion');
const { storeCsvData } = require('./services/fileIngestion');
const { storeQueueData } = require('./services/queueIngestion');

// Set up message queue consumers
const setupConsumers = () => {
    // Data ingestion queue - handles all sources
    messageQueue.subscribe('data-ingestion', async (message) => {
        const correlationId = message.metadata.correlationId || uuidv4();
        const log = withCorrelation(correlationId);

        try {
            const source = message.metadata.source;
            const data = message.body;

            log.info(`Processing ${data.length} records from ${source}`);

            switch (source) {
                case 'api':
                    await storeApiData(data, correlationId);
                    break;
                case 'csv':
                    await storeCsvData(data, correlationId);
                    break;
                case 'external-queue':
                    await storeQueueData(data, correlationId);
                    break;
                default:
                    log.warn(`Unknown source: ${source}, storing as generic`);
                    await datastore.store(data, 'unknown');
            }

            log.info(`Successfully processed message from ${source}`);
        } catch (error) {
            log.error('Error processing message', { error: error.message });
            throw error; // Rethrow to trigger retry
        }
    });

    logger.info('Message queue consumers initialized');
};

const initialize = async () => {
    logger.info('Initializing data ingestion system');

    // Create necessary queues
    messageQueue.createQueue('data-ingestion');

    // Set up message consumers
    setupConsumers();

    logger.info('Data ingestion system initialized successfully');

    return {
        messageQueue,
        datastore
    };
};

// Export the initialization function and other components
module.exports = {
    initialize,
    messageQueue,
    datastore,
    logger
};

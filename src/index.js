// Import below functions in ES module scope

import { v4 as uuidv4 } from 'uuid';
import { logger, withCorrelation } from './core/logger.js';
import datastore from './core/datastore.js';
import { storeApiData } from './services/apiIngestion.js';
import { storeCsvData } from './services/fileIngestion.js';
import { storeQueueData } from './services/queueIngestion.js';
import MessageQueue from './core/messageQueue.js';

const messageQueue = new MessageQueue();
// Set up message queue consumers
export const setupConsumers = () => {
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

export const initialize = async () => {
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

// Export logger from here
export { logger, messageQueue, datastore };

// Export the initialization function and other components
// module.exports = {
//     initialize,
//     messageQueue,
//     datastore,
//     logger
// };

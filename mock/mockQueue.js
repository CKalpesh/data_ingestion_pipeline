import { logger } from '../src/core/logger.js';
import MessageQueue from '../src/core/messageQueue.js';

const messageQueue = new MessageQueue();

const startMockQueuePublisher = (interval = 5000) => {
    logger.info('Starting mock queue publisher');

    // Generate random message
    const generateMessage = () => {
        const id = Math.floor(Math.random() * 10000);
        return {
            id,
            name: `Queue Item ${id}`,
            value: Math.round(Math.random() * 100),
            timestamp: new Date().toISOString()
        };
    };

    // Publish message at intervals
    const intervalId = setInterval(async () => {
        const count = Math.floor(Math.random() * 5) + 1;
        const messages = Array.from({ length: count }, () => generateMessage());

        try {
            await messageQueue.publish('external-queue', messages, {
                source: 'mock-publisher',
                timestamp: new Date().toISOString()
            });

            logger.info(`Published ${count} messages to external-queue`);
        } catch (error) {
            logger.error('Error publishing mock messages', { error: error.message });
        }
    }, interval);

    return {
        stop: () => {
            clearInterval(intervalId);
            logger.info('Mock queue publisher stopped');
        }
    };
};

export { startMockQueuePublisher };
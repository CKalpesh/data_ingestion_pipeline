
import { EventEmitter } from 'events';
import { logger } from './logger.js';

// Simple in-memory message queue implementation
// In production, this would be replaced with a real message broker
class MessageQueue extends EventEmitter {
    constructor() {
        super();
        this.queues = {};
        this.deadLetterQueue = [];

        logger.info('In-memory message queue initialized');
    }

    // Create a new queue if it doesn't exist
    createQueue(queueName) {
        if (!this.queues[queueName]) {
            this.queues[queueName] = [];
            logger.info(`Queue created: ${queueName}`);
        }
        return this;
    }

    // Publish a message to a queue
    async publish(queueName, message, metadata = {}) {
        if (!this.queues[queueName]) {
            this.createQueue(queueName);
        }

        const queueMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            body: message,
            metadata: {
                ...metadata,
                timestamp: new Date().toISOString()
            },
            attempts: 0
        };

        this.queues[queueName].push(queueMessage);

        // Emit event for any subscribers
        this.emit(`message:${queueName}`, queueMessage);

        logger.debug(`Message published to ${queueName}`, { messageId: queueMessage.id });
        return queueMessage.id;
    }

    // Subscribe to a queue
    subscribe(queueName, handler) {
        if (!this.queues[queueName]) {
            this.createQueue(queueName);
        }

        const listener = async (message) => {
            try {
                message.attempts++;
                await handler(message);

                // Remove message after successful processing
                const index = this.queues[queueName].findIndex(m => m.id === message.id);
                if (index !== -1) {
                    this.queues[queueName].splice(index, 1);
                }

                logger.debug(`Message processed from ${queueName}`, { messageId: message.id });
            } catch (error) {
                logger.error(`Error processing message from ${queueName}`, {
                    messageId: message.id,
                    error: error.message,
                    attempts: message.attempts
                });

                // Move to DLQ after 3 failed attempts
                if (message.attempts >= 3) {
                    const index = this.queues[queueName].findIndex(m => m.id === message.id);
                    if (index !== -1) {
                        const failedMessage = this.queues[queueName].splice(index, 1)[0];
                        failedMessage.error = error.message;
                        this.deadLetterQueue.push(failedMessage);
                        logger.warn(`Message moved to DLQ from ${queueName}`, { messageId: message.id });
                    }
                }
            }
        };

        this.on(`message:${queueName}`, listener);
        logger.info(`Subscribed to queue: ${queueName}`);

        // Process any existing messages
        setImmediate(() => {
            this.queues[queueName].forEach(message => {
                this.emit(`message:${queueName}`, message);
            });
        });

        return () => {
            this.off(`message:${queueName}`, listener);
            logger.info(`Unsubscribed from queue: ${queueName}`);
        };
    }

    // Get queue stats
    getStats() {
        const stats = {
            queues: {},
            deadLetterQueueSize: this.deadLetterQueue.length
        };

        Object.keys(this.queues).forEach(queueName => {
            stats.queues[queueName] = this.queues[queueName].length;
        });

        return stats;
    }
}
export default MessageQueue
// export { MessageQueue };
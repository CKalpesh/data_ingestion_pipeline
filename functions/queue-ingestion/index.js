import { v4 as uuidv4 } from 'uuid';
import { logger, withCorrelation } from './core/logger.js';
import { processQueueMessage } from './services/queueIngestion.js';


/**
 * Cloud Function to process messages from external queue
 * 
 * For Pub/Sub triggers, expects message in event.data (base64 encoded)
 * For SQS triggers, expects message in event.Records[].body
 */
exports.handler = async (event, context) => {
    const correlationId = uuidv4();
    const log = withCorrelation(correlationId);

    try {
        let message;

        // Handle different event sources
        if (event.data) {
            // Google Cloud Pub/Sub
            const decodedMessage = Buffer.from(event.data, 'base64').toString();
            message = JSON.parse(decodedMessage);
        } else if (event.Records && Array.isArray(event.Records)) {
            // AWS SQS
            message = JSON.parse(event.Records[0].body);
        } else if (event.body) {
            // HTTP trigger
            message = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        } else {
            message = event;
        }

        log.info('Queue message received');

        const result = await processQueueMessage(message, correlationId);

        log.info('Queue message processed successfully');
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                correlationId,
                result
            })
        };
    } catch (error) {
        log.error('Queue message processing failed', { error: error.message });
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: error.message,
                correlationId
            })
        };
    }
};

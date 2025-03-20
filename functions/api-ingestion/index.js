
const { v4: uuidv4 } = require('uuid');
const { processApiData } = require('../../src/services/apiIngestion');
const { logger, withCorrelation } = require('../../src/core/logger');

/**
 * Cloud Function to ingest data from REST API
 * 
 * Expected request body:
 * {
 *   "apiUrl": "https://api.example.com",
 *   "endpoint": "/data"
 * }
 */
exports.handler = async (event, context) => {
    const correlationId = uuidv4();
    const log = withCorrelation(correlationId);

    try {
        let body;

        // Handle different event sources (HTTP, Pub/Sub, etc.)
        if (event.body) {
            // HTTP trigger
            body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        } else if (event.data) {
            // Pub/Sub trigger
            const message = Buffer.from(event.data, 'base64').toString();
            body = JSON.parse(message);
        } else {
            body = event;
        }

        log.info('API ingestion request received', { apiUrl: body.apiUrl });

        if (!body.apiUrl || !body.endpoint) {
            log.error('Missing required parameters');
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'apiUrl and endpoint are required' })
            };
        }

        const result = await processApiData(body.apiUrl, body.endpoint, correlationId);

        log.info('API ingestion completed successfully');
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                correlationId,
                result
            })
        };
    } catch (error) {
        log.error('API ingestion failed', { error: error.message });
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: error.message,
                correlationId
            })
        };
    }
};

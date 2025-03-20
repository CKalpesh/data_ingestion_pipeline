
const { v4: uuidv4 } = require('uuid');
const { processCsvFile } = require('../../src/services/fileIngestion');
const { logger, withCorrelation } = require('../../src/core/logger');

/**
 * Cloud Function to ingest data from CSV file uploads
 * 
 * For HTTP triggers, expects multipart/form-data with file field
 * For event triggers, expects file content in base64 and filename
 */
exports.handler = async (event, context) => {
    const correlationId = uuidv4();
    const log = withCorrelation(correlationId);

    try {
        let fileBuffer, fileName;

        // Handle different event sources
        if (event.body && event.headers && event.headers['content-type']?.includes('multipart/form-data')) {
            // HTTP trigger with multipart form data
            // Note: This is simplified and would need proper multipart parsing in a real implementation
            if (!event.file) {
                throw new Error('No file uploaded');
            }

            fileBuffer = event.file.content;
            fileName = event.file.filename;
        } else if (event.data) {
            // Assume event.data contains base64 encoded file content
            fileBuffer = Buffer.from(event.data, 'base64');
            fileName = event.filename || 'unknown.csv';
        } else {
            log.error('Unsupported event format');
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Unsupported event format' })
            };
        }

        log.info(`File ingestion request received`, { fileName });

        const result = await processCsvFile(fileBuffer, fileName, correlationId);

        log.info('File ingestion completed successfully');
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                correlationId,
                result
            })
        };
    } catch (error) {
        log.error('File ingestion failed', { error: error.message });
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: error.message,
                correlationId
            })
        };
    }
};

import pkg from 'csv-parser';
const { csvParser: csv } = pkg;
import { Readable } from 'stream';
import { logger, withCorrelation } from '../core/logger.js';
import datastore from '../core/datastore.js';
import { validateCsvRow } from '../utils/validation.js';
import MessageQueue from '../core/messageQueue.js';

const messageQueue = new MessageQueue();
// Process CSV file
const processCsvFile = async (fileBuffer, fileName, correlationId) => {
    const log = withCorrelation(correlationId);

    try {
        log.info(`Processing CSV file: ${fileName}`);

        // Check file size (10MB limit)
        const fileSizeMB = fileBuffer.length / (1024 * 1024);
        if (fileSizeMB > 10) {
            log.error(`File size exceeds limit: ${fileSizeMB.toFixed(2)}MB > 10MB`);
            throw new Error('File size exceeds the limit of 10MB');
        }

        // Parse CSV
        const results = await parseCsvBuffer(fileBuffer, correlationId);

        // Validate results
        const validRecords = [];
        const invalidRecords = [];

        results.forEach(row => {
            const validation = validateCsvRow(row);
            if (validation.valid) {
                validRecords.push(row);
            } else {
                invalidRecords.push({ row, errors: validation.errors });
            }
        });

        if (invalidRecords.length > 0) {
            log.warn(`Found ${invalidRecords.length} invalid records in CSV`, {
                invalidCount: invalidRecords.length,
                totalCount: results.length,
                sample: invalidRecords.slice(0, 3)
            });
        }

        if (validRecords.length === 0) {
            log.error('No valid records found in CSV file');
            throw new Error('No valid records found in CSV file');
        }

        // Publish valid records to queue
        await messageQueue.publish('data-ingestion', validRecords, {
            source: 'csv',
            fileName,
            correlationId,
            timestamp: new Date().toISOString()
        });

        log.info(`Published ${validRecords.length} records to queue for processing`);
        return {
            success: true,
            validCount: validRecords.length,
            invalidCount: invalidRecords.length,
            totalCount: results.length
        };
    } catch (error) {
        log.error(`CSV processing failed for ${fileName}`, { error: error.message });
        throw error;
    }
};

// Parse CSV buffer into records
const parseCsvBuffer = (buffer, correlationId) => {
    const log = withCorrelation(correlationId);
    return new Promise((resolve, reject) => {
        const results = [];
        let rowCount = 0;

        // Create a readable stream from buffer
        const bufferStream = new Readable();
        bufferStream.push(buffer);
        bufferStream.push(null);

        bufferStream
            .pipe(csv({
                mapValues: ({ header, value }) => {
                    // Convert numeric strings to numbers
                    if (!isNaN(value) && value.trim() !== '') {
                        return Number(value);
                    }
                    return value;
                }
            }))
            .on('data', (data) => {
                results.push(data);
                rowCount++;

                if (rowCount % 1000 === 0) {
                    log.debug(`Parsed ${rowCount} CSV rows`);
                }
            })
            .on('error', (error) => {
                log.error('Error parsing CSV', { error: error.message });
                reject(error);
            })
            .on('end', () => {
                log.info(`Finished parsing CSV, ${results.length} rows processed`);
                resolve(results);
            });
    });
};

// Store CSV data (called by queue consumer)
const storeCsvData = async (data, correlationId) => {
    const log = withCorrelation(correlationId);

    try {
        log.info(`Storing ${data.length} records from CSV`);
        const result = await datastore.store(data, 'csv');
        log.info(`Successfully stored CSV data`, { count: result.count });
        return result;
    } catch (error) {
        log.error('Failed to store CSV data', { error: error.message });
        throw error;
    }
};

// Export with ES6 syntax
export { processCsvFile, parseCsvBuffer, storeCsvData };

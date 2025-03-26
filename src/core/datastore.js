
import { logger } from './logger.js';

// In-memory datastore for demo purposes
// In production, this would be a database client
class DataStore {
    constructor() {
        this.data = [];
        this.processedIds = new Set(); // For idempotency checking
    }

    async store(records, source) {
        try {
            // Filter out already processed records
            const newRecords = records.filter(record => {
                if (!record.id) {
                    logger.warn('Record missing ID', { record });
                    return false;
                }

                const recordId = `${source}:${record.id}`;
                if (this.processedIds.has(recordId)) {
                    logger.debug('Skipping duplicate record', { recordId });
                    return false;
                }

                this.processedIds.add(recordId);
                return true;
            });

            // Add source and timestamp metadata
            const enrichedRecords = newRecords.map(record => ({
                ...record,
                _source: source,
                _ingestedAt: new Date().toISOString()
            }));

            // Store the records
            this.data.push(...enrichedRecords);

            logger.info(`Stored ${enrichedRecords.length} records from ${source}`, {
                total: this.data.length,
                newRecords: enrichedRecords.length
            });

            return { success: true, count: enrichedRecords.length };
        } catch (error) {
            logger.error(`Error storing data from ${source}`, { error: error.message });
            throw error;
        }
    }

    async getStats() {
        const sources = {};
        this.data.forEach(record => {
            sources[record._source] = (sources[record._source] || 0) + 1;
        });

        return {
            totalRecords: this.data.length,
            uniqueIds: this.processedIds.size,
            sourceBreakdown: sources
        };
    }

    // For testing/demo purposes
    async getAllData() {
        return this.data;
    }

    // Clear data (for testing)
    async clear() {
        this.data = [];
        this.processedIds.clear();
        logger.info('Datastore cleared');
    }
}
export default DataStore;

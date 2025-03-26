import axios from 'axios';
import { logger, withCorrelation } from '../core/logger.js';
import datastore from '../core/datastore.js';
import { validateApiData } from '../utils/validation.js';
import MessageQueue from '../core/messageQueue.js';

const messageQueue = new MessageQueue();
// API client with retry logic
class ApiClient {
    constructor(baseUrl, maxRetries = 3, retryDelay = 1000) {
        this.baseUrl = baseUrl;
        this.maxRetries = maxRetries;
        this.retryDelay = retryDelay;
    }

    async fetchWithRetry(url, retries = 0, correlationId) {
        const log = withCorrelation(correlationId);

        try {
            log.debug(`Fetching ${url}, attempt ${retries + 1}/${this.maxRetries + 1}`);
            const response = await axios.get(url, { timeout: 5000 });
            return response.data;
        } catch (error) {
            if (retries < this.maxRetries && this.isRetryable(error)) {
                log.warn(`Retryable error fetching ${url}`, { error: error.message });

                // Exponential backoff
                const delay = this.retryDelay * Math.pow(2, retries);
                await new Promise(resolve => setTimeout(resolve, delay));

                return this.fetchWithRetry(url, retries + 1, correlationId);
            }

            log.error(`Failed to fetch ${url} after ${retries + 1} attempts`, { error: error.message });
            throw error;
        }
    }

    isRetryable(error) {
        // Retry on network errors, timeouts, and 5xx server errors
        if (!error.response) {
            return true; // Network error or timeout
        }

        const statusCode = error.response.status;
        return statusCode >= 500 && statusCode < 600;
    }

    async fetchAllPages(endpoint, pageParam = 'page', pageSizeParam = 'limit', pageSize = 100, correlationId) {
        const log = withCorrelation(correlationId);
        let currentPage = 1;
        let allData = [];
        let hasMoreData = true;

        log.info(`Starting paginated fetch from ${endpoint}`);

        while (hasMoreData) {
            const url = `${this.baseUrl}${endpoint}?${pageParam}=${currentPage}&${pageSizeParam}=${pageSize}`;
            const data = await this.fetchWithRetry(url, 0, correlationId);

            if (Array.isArray(data) && data.length > 0) {
                allData = allData.concat(data);
                currentPage++;
                log.debug(`Fetched page ${currentPage - 1}, got ${data.length} records`);

                // Check if we've reached the last page
                if (data.length < pageSize) {
                    hasMoreData = false;
                }
            } else {
                hasMoreData = false;
            }
        }

        log.info(`Completed paginated fetch, retrieved ${allData.length} records in total`);
        return allData;
    }
}

// Function to process API data
const processApiData = async (apiUrl, endpoint, correlationId) => {
    const log = withCorrelation(correlationId);
    const apiClient = new ApiClient(apiUrl);

    try {
        log.info(`Starting API ingestion from ${apiUrl}${endpoint}`);
        const data = await apiClient.fetchAllPages(endpoint, 'page', 'limit', 100, correlationId);

        // Validate the data
        const validation = validateApiData(data);
        if (!validation.valid) {
            log.error('API data validation failed', { errors: validation.errors });
            throw new Error(`API data validation failed: ${validation.errors.join(', ')}`);
        }

        // Publish to queue for processing
        await messageQueue.publish('data-ingestion', data, {
            source: 'api',
            correlationId,
            timestamp: new Date().toISOString()
        });

        log.info(`Published ${data.length} records to queue for processing`);
        return { success: true, count: data.length };
    } catch (error) {
        log.error('API ingestion failed', { error: error.message });
        throw error;
    }
};

// Function to store API data (called by queue consumer)
const storeApiData = async (data, correlationId) => {
    const log = withCorrelation(correlationId);

    try {
        log.info(`Storing ${data.length} records from API`);
        const result = await datastore.store(data, 'api');
        log.info(`Successfully stored API data`, { count: result.count });
        return result;
    } catch (error) {
        log.error('Failed to store API data', { error: error.message });
        throw error;
    }
};

export { ApiClient, processApiData, storeApiData };

// module.exports = {
//     ApiClient,
//     processApiData,
//     storeApiData
// };

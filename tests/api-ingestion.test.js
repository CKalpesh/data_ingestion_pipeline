
const { ApiClient, processApiData } = require('../src/services/apiIngestion');
const messageQueue = require('../src/core/messageQueue');
const { startMockApiServer } = require('../mock/mockApi');

// Mock dependencies
jest.mock('../src/core/messageQueue', () => ({
    publish: jest.fn().mockResolvedValue('mock-message-id'),
    createQueue: jest.fn()
}));

describe('API Ingestion Service', () => {
    let mockServer;

    beforeAll(() => {
        mockServer = startMockApiServer(3002);
    });

    afterAll(() => {
        mockServer.close();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('ApiClient should fetch paginated data', async () => {
        const client = new ApiClient('http://localhost:3002');
        const result = await client.fetchAllPages('/api/items', 'page', 'limit', 10, 'test-correlation-id');

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
        expect(result.length).toBeLessThanOrEqual(500); // Total items in mock API
        expect(result[0].id).toBeDefined();
        expect(result[0].name).toBeDefined();
    });

    test('processApiData should publish data to queue', async () => {
        const result = await processApiData('http://localhost:3002', '/api/items', 'test-correlation-id');

        expect(result.success).toBe(true);
        expect(result.count).toBeGreaterThan(0);
        expect(messageQueue.publish).toHaveBeenCalledTimes(1);

        const [queueName, data, metadata] = messageQueue.publish.mock.calls[0];
        expect(queueName).toBe('data-ingestion');
        expect(Array.isArray(data)).toBe(true);
        expect(metadata.source).toBe('api');
        expect(metadata.correlationId).toBe('test-correlation-id');
    });
});
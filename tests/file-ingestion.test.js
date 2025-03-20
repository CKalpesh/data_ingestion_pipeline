
const { processCsvFile, parseCsvBuffer } = require('../src/services/fileIngestion');
const messageQueue = require('../src/core/messageQueue');

// Mock dependencies
jest.mock('../src/core/messageQueue', () => ({
    publish: jest.fn().mockResolvedValue('mock-message-id'),
    createQueue: jest.fn()
}));

describe('File Ingestion Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('parseCsvBuffer should parse CSV data', async () => {
        const csvContent = 'id,name,value\n1,Item 1,10\n2,Item 2,20\n3,Item 3,30';
        const buffer = Buffer.from(csvContent);

        const result = await parseCsvBuffer(buffer, 'test-correlation-id');

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(3);
        expect(result[0].id).toBe(1);
        expect(result[1].name).toBe('Item 2');
        expect(result[2].value).toBe(30);
    });

    test('processCsvFile should validate and publish valid records', async () => {
        const csvContent = 'id,name,value\n1,Item 1,10\n2,Item 2,20\nX,Bad Item,invalid';
        const buffer = Buffer.from(csvContent);

        const result = await processCsvFile(buffer, 'test.csv', 'test-correlation-id');

        expect(result.success).toBe(true);
        expect(result.validCount).toBe(2);
        expect(result.invalidCount).toBe(1);
        expect(messageQueue.publish).toHaveBeenCalledTimes(1);

        const [queueName, data, metadata] = messageQueue.publish.mock.calls[0];
        expect(queueName).toBe('data-ingestion');
        expect(data.length).toBe(2);
        expect(metadata.source).toBe('csv');
        expect(metadata.fileName).toBe('test.csv');
    });

    test('processCsvFile should reject files larger than 10MB', async () => {
        // Create buffer larger than 10MB
        const buffer = Buffer.alloc(11 * 1024 * 1024);

        await expect(processCsvFile(buffer, 'large.csv', 'test-correlation-id'))
            .rejects.toThrow('File size exceeds the limit of 10MB');

        expect(messageQueue.publish).not.toHaveBeenCalled();
    });
});

const { processQueueMessage } = require('../src/services/queueIngestion');
const messageQueue = require('../src/core/messageQueue');

// Mock dependencies
jest.mock('../src/core/messageQueue', () => ({
    publish: jest.fn().mockResolvedValue('mock-message-id'),
    createQueue: jest.fn()
}));

describe('Queue Ingestion Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('processQueueMessage should handle single message', async () => {
        const message = { id: 1, name: 'Test Item', value: 42 };

        const result = await processQueueMessage(message, 'test-correlation-id');

        expect(result.success).toBe(true);
        expect(result.count).toBe(1);
        expect(messageQueue.publish).toHaveBeenCalledTimes(1);

        const [queueName, data, metadata] = messageQueue.publish.mock.calls[0];
        expect(queueName).toBe('data-ingestion');
        expect(data).toEqual([message]);
        expect(metadata.source).toBe('external-queue');
    });

    test('processQueueMessage should handle array of messages', async () => {
        const messages = [
            { id: 1, name: 'Item 1', value: 10 },
            { id: 2, name: 'Item 2', value: 20 }
        ];

        const result = await processQueueMessage(messages, 'test-correlation-id');

        expect(result.success).toBe(true);
        expect(result.count).toBe(2);
        expect(messageQueue.publish).toHaveBeenCalledTimes(1);

        const [queueName, data, metadata] = messageQueue.publish.mock.calls[0];
        expect(queueName).toBe('data-ingestion');
        expect(data).toEqual(messages);
        expect(metadata.source).toBe('external-queue');
    });

    test('processQueueMessage should reject invalid messages', async () => {
        await expect(processQueueMessage(null, 'test-correlation-id'))
            .rejects.toThrow('Invalid queue message format');

        expect(messageQueue.publish).not.toHaveBeenCalled();
    });
});

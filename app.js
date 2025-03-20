const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { initialize, logger } = require('./src/index');
const { processApiData } = require('./src/services/apiIngestion');
const { processCsvFile } = require('./src/services/fileIngestion');
const { processQueueMessage } = require('./src/services/queueIngestion');
const { startMockApiServer } = require('./mock/mockApi');
const { startMockQueuePublisher } = require('./mock/mockQueue');

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Set up multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize system
let system;
const setupSystem = async () => {
    system = await initialize();
};

// API Routes
app.post('/api/ingest', async (req, res) => {
    const correlationId = uuidv4();

    try {
        const { apiUrl, endpoint } = req.body;
        console.log(apiUrl);
        console.log(endpoint);
        if (!apiUrl || !endpoint) {
            return res.status(400).json({
                error: 'apiUrl and endpoint are required',
                correlationId
            });
        }

        const result = await processApiData(apiUrl, endpoint, correlationId);

        res.json({
            success: true,
            correlationId,
            result
        });
    } catch (error) {
        logger.error('API ingestion failed', {
            error: error.message,
            correlationId
        });

        res.status(500).json({
            error: error.message,
            correlationId
        });
    }
});

app.post('/file/ingest', upload.single('file'), async (req, res) => {
    const correlationId = uuidv4();

    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No file uploaded',
                correlationId
            });
        }

        const { buffer, originalname, mimetype } = req.file;

        if (mimetype !== 'text/csv' && !originalname.endsWith('.csv')) {
            return res.status(400).json({
                error: 'Only CSV files are supported',
                correlationId
            });
        }

        const result = await processCsvFile(buffer, originalname, correlationId);

        res.json({
            success: true,
            correlationId,
            result
        });
    } catch (error) {
        logger.error('File ingestion failed', {
            error: error.message,
            correlationId
        });

        res.status(500).json({
            error: error.message,
            correlationId
        });
    }
});

app.post('/queue/ingest', async (req, res) => {
    const correlationId = uuidv4();

    try {
        const message = req.body;

        if (!message) {
            return res.status(400).json({
                error: 'Empty message body',
                correlationId
            });
        }

        const result = await processQueueMessage(message, correlationId);

        res.json({
            success: true,
            correlationId,
            result
        });
    } catch (error) {
        logger.error('Queue ingestion failed', {
            error: error.message,
            correlationId
        });

        res.status(500).json({
            error: error.message,
            correlationId
        });
    }
});

app.get('/stats', async (req, res) => {
    try {
        const datastoreStats = await system.datastore.getStats();
        const queueStats = system.messageQueue.getStats();

        res.json({
            datastore: datastoreStats,
            queues: queueStats
        });
    } catch (error) {
        logger.error('Failed to get stats', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Start server
const startServer = async () => {
    // Initialize system
    await setupSystem();

    // Start mock servers
    const mockApi = startMockApiServer();
    const mockQueue = startMockQueuePublisher();

    // Start Express server
    app.listen(port, () => {
        logger.info(`Server running at http://localhost:${port}`);
        logger.info('Available endpoints:');
        logger.info('  POST /api/ingest - Ingest data from API');
        logger.info('  POST /file/ingest - Ingest data from CSV file');
        logger.info('  POST /queue/ingest - Ingest data from queue');
        logger.info('  GET /stats - Get system statistics');
    });
};

// Handle graceful shutdown
process.on('SIGINT', () => {
    logger.info('Shutting down server...');
    process.exit();
});

// Start application
startServer().catch(error => {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
});
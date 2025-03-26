import express, { json, urlencoded } from 'express';
import multer, { memoryStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { logger, initialize } from './src/index.js';
import { processApiData } from './src/services/apiIngestion.js';
import { processCsvFile } from './src/services/fileIngestion.js';
import { processQueueMessage } from './src/services/queueIngestion.js';
import { startMockApiServer } from './mock/mockApi.js';
import { startMockQueuePublisher } from './mock/mockQueue.js';
import { http } from "@google-cloud/functions-framework";


// Initialize Express app
const app = express();
const port = process.env.PORT || 8080;

// Set up multer for file uploads
const upload = multer({
    storage: memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Middleware
app.use(json());
app.use(urlencoded({ extended: true }));

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

// --- Local Development Server (Optional) ---
if (process.env.NODE_ENV !== 'production' && !process.env.FUNCTION_TARGET) {
    (async () => {
        await setupSystem();

        // Start mock servers (local only)
        startMockApiServer();
        startMockQueuePublisher();

        // Start Express server (local only)
        app.listen(port, () => {
            logger.info(`Local server running at http://localhost:${port}`);
        });
    })().catch(err => {
        logger.error("Local server failed to start", err);
        process.exit(1);
    });
}

export const api = http("api", async (req, res) => {
    // Initialize system if not already done (GCF may reuse instances)
    if (!system) await setupSystem();
    // Forward request to Express
    app(req, res);
});
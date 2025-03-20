
const express = require('express');
const { logger } = require('../src/core/logger');

const startMockApiServer = (port = 3001) => {
    const app = express();

    // Sample data
    const generateItems = (count) => {
        return Array.from({ length: count }, (_, i) => ({
            id: i + 1,
            name: `Item ${i + 1}`,
            value: Math.round(Math.random() * 100),
            timestamp: new Date().toISOString()
        }));
    };

    const allItems = generateItems(500);

    // API endpoint with pagination
    app.get('/api/items', (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;

        // Simulate occasional failures
        if (Math.random() < 0.1) {
            return res.status(500).json({ error: 'Internal server error' });
        }

        // Simulate timeout
        if (Math.random() < 0.05) {
            return setTimeout(() => {
                res.status(504).json({ error: 'Gateway timeout' });
            }, 10000);
        }

        const results = allItems.slice(startIndex, endIndex);

        res.json(results);
    });

    // Start server
    const server = app.listen(port, () => {
        logger.info(`Mock API server running at http://localhost:${port}`);
    });

    return server;
};

module.exports = { startMockApiServer };
import { logger } from "../core/logger.js";

const validateApiData = (data) => {
    if (!Array.isArray(data)) {
        throw new Error('API data must be an array');
    }

    const errors = [];

    data.forEach((item, index) => {
        if (!item.id) {
            errors.push(`Item at index ${index} is missing an id`);
        }

        if (typeof item.name !== 'string') {
            errors.push(`Item at index ${index} has invalid name`);
        }
    });

    return {
        valid: errors.length === 0,
        errors
    };
};

const validateCsvRow = (row) => {
    const errors = [];
    logger.info("CSV ROW", row.id)
    // if (!row.id) {
    //     errors.push('Row is missing an id');
    // }

    // if (!row.name) {
    //     errors.push('Row is missing a name');
    // }

    return {
        valid: errors.length === 0,
        errors
    };
};

export {
    validateApiData,
    validateCsvRow
};

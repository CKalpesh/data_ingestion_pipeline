import { crypto } from 'crypto';

// Generate an idempotency key from the data
const generateIdempotencyKey = (data) => {
    if (data.id) {
        return `${data.id}`;
    }

    // If no ID exists, create a hash of the data
    const hash = crypto.createHash('md5');
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
};

// Check if a batch of records contains duplicates
const findDuplicates = (records) => {
    const seen = new Set();
    const duplicates = [];

    records.forEach(record => {
        const key = generateIdempotencyKey(record);
        if (seen.has(key)) {
            duplicates.push({ record, key });
        } else {
            seen.add(key);
        }
    });

    return duplicates;
};

export {
    generateIdempotencyKey,
    findDuplicates
};

# Serverless Data Ingestion System

This project implements a serverless data ingestion system that can process data from multiple sources including REST APIs, CSV files, and message queues.

## Architecture

The system consists of the following components:

1. **Serverless Functions**
   - API Ingestion Function: Processes data from REST APIs with pagination support
   - File Ingestion Function: Handles CSV file uploads with validation
   - Queue Ingestion Function: Consumes messages from external message queues

2. **Message Queue**
   - Used to decouple data ingestion from processing
   - Provides fault tolerance through retries and dead letter queues
   - Enables asynchronous processing and handles traffic spikes

3. **Data Store**
   - Acts as a central repository for ingested data
   - Implemented as an in-memory store for demo purposes
   - In production, this would be a database like DynamoDB or MongoDB

4. **Logging and Monitoring**
   - Comprehensive logging with correlation IDs
   - Metrics for system performance monitoring
   - Error tracking and reporting

## Design Decisions

### Fault Tolerance
- **Retry Mechanism**: API calls implement exponential backoff retry
- **Dead Letter Queue**: Failed messages are sent to a DLQ after multiple attempts
- **Idempotency**: Records are deduplicated to ensure safe retries
- **Validation**: Input data is validated before processing

### Scalability
- **Stateless Functions**: Each function is stateless and can scale independently
- **Asynchronous Processing**: Message queues decouple components
- **Event-Driven**: System responds to events (file uploads, API calls, messages)
- **Serverless**: No server management, automatic scaling

### Security
- **Input Validation**: All inputs are validated
- **File Size Limits**: Prevents resource exhaustion
- **Access Control**: IAC defines least-privilege permissions

## Local Development Setup

### Prerequisites
- Node.js 14+
- npm or yarn

### Installation
1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```

### Running Locally
Start the local development server:
```
npm start
```

This will:
- Start a mock API server
- Start a mock queue publisher
- Start the Express server with endpoints for testing

### Available Endpoints
- `POST /api/ingest` - Ingest data from a REST API
  ```json
  {
    "apiUrl": "http://localhost:3001",
    "endpoint": "/api/items"
  }
  ```

- `POST /file/ingest` - Upload and ingest a CSV file
  (Use multipart/form-data with a "file" field)

- `POST /queue/ingest` - Ingest data from a message queue
  ```json
  {
    "id": 1,
    "name": "Test Item",
    "value": 42
  }
  ```

- `GET /stats` - Get system statistics

### Running Tests
```
npm test
```

## Deployment

The project includes Terraform configurations for deploying to AWS:

1. Navigate to the terraform directory:
   ```
   cd terraform
   ```

2. Initialize Terraform:
   ```
   terraform init
   ```

3. Apply the configuration:
   ```
   terraform apply
   ```

## Monitoring and Logging

The system uses structured logging with correlation IDs to track requests across components. In a production environment, logs are sent to CloudWatch Logs for centralized monitoring.

## Future Improvements

1. Add more comprehensive metrics and dashboards
2. Implement more sophisticated data validation
3. Add data transformation capabilities
4. Implement schema evolution handling
5. Add support for more data formats (JSON, Parquet, etc.)

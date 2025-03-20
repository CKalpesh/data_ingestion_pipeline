provider "aws" {
  region = var.aws_region
}

// Create S3 bucket for file uploads
resource "aws_s3_bucket" "file_uploads" {
  bucket = "${var.project_name}-file-uploads-${var.environment}"
  acl    = "private"
  
  tags = {
    Name        = "${var.project_name}-file-uploads"
    Environment = var.environment
  }
}

// Create SQS queue for data ingestion
resource "aws_sqs_queue" "data_ingestion_queue" {
  name                      = "${var.project_name}-data-ingestion-${var.environment}"
  delay_seconds             = 0
  max_message_size          = 262144  // 256 KB
  message_retention_seconds = 86400   // 1 day
  visibility_timeout_seconds = 60
  
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dead_letter_queue.arn
    maxReceiveCount     = 3
  })
  
  tags = {
    Name        = "${var.project_name}-data-ingestion"
    Environment = var.environment
  }
}

// Create Dead Letter Queue
resource "aws_sqs_queue" "dead_letter_queue" {
  name = "${var.project_name}-dlq-${var.environment}"
  
  tags = {
    Name        = "${var.project_name}-dlq"
    Environment = var.environment
  }
}

// Create Lambda function for API ingestion
resource "aws_lambda_function" "api_ingestion" {
  function_name = "${var.project_name}-api-ingestion-${var.environment}"
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  
  filename      = "../functions/api-ingestion/dist/function.zip"
  
  role          = aws_iam_role.lambda_exec_role.arn
  
  environment {
    variables = {
      NODE_ENV     = var.environment
      LOG_LEVEL    = "info"
      QUEUE_URL    = aws_sqs_queue.data_ingestion_queue.url
    }
  }
  
  tags = {
    Name        = "${var.project_name}-api-ingestion"
    Environment = var.environment
  }
}

// Create Lambda function for file ingestion
resource "aws_lambda_function" "file_ingestion" {
  function_name = "${var.project_name}-file-ingestion-${var.environment}"
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  
  filename      = "../functions/file-ingestion/dist/function.zip"
  
  role          = aws_iam_role.lambda_exec_role.arn
  
  environment {
    variables = {
      NODE_ENV     = var.environment
      LOG_LEVEL    = "info"
      QUEUE_URL    = aws_sqs_queue.data_ingestion_queue.url
    }
  }
  
  tags = {
    Name        = "${var.project_name}-file-ingestion"
    Environment = var.environment
  }
}

// Create Lambda function for queue ingestion
resource "aws_lambda_function" "queue_ingestion" {
  function_name = "${var.project_name}-queue-ingestion-${var.environment}"
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  
  filename      = "../functions/queue-ingestion/dist/function.zip"
  
  role          = aws_iam_role.lambda_exec_role.arn
  
  environment {
    variables = {
      NODE_ENV     = var.environment
      LOG_LEVEL    = "info"
      QUEUE_URL    = aws_sqs_queue.data_ingestion_queue.url
    }
  }
  
  tags = {
    Name        = "${var.project_name}-queue-ingestion"
    Environment = var.environment
  }
}

// Create IAM role for Lambda functions
resource "aws_iam_role" "lambda_exec_role" {
  name = "${var.project_name}-lambda-role-${var.environment}"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

// Attach policies to Lambda role
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_sqs" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSQSFullAccess"
}

resource "aws_iam_role_policy_attachment" "lambda_s3" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess"
}

// S3 event trigger for file ingestion
resource "aws_s3_bucket_notification" "bucket_notification" {
  bucket = aws_s3_bucket.file_uploads.id
  
  lambda_function {
    lambda_function_arn = aws_lambda_function.file_ingestion.arn
    events              = ["s3:ObjectCreated:*"]
    filter_suffix       = ".csv"
  }
}

// SQS trigger for queue ingestion
resource "aws_lambda_event_source_mapping" "queue_trigger" {
  event_source_arn = aws_sqs_queue.data_ingestion_queue.arn
  function_name    = aws_lambda_function.queue_ingestion.arn
  batch_size       = 10
}

// CloudWatch Logs group for centralized logging
resource "aws_cloudwatch_log_group" "data_ingestion_logs" {
  name = "/aws/lambda/${var.project_name}-data-ingestion-${var.environment}"
  retention_in_days = 14
  
  tags = {
    Name        = "${var.project_name}-logs"
    Environment = var.environment
  }
}
variable "aws_region" {
  description = "The AWS region to deploy to"
  default     = "us-east-1"
}

variable "project_name" {
  description = "The name of the project"
  default     = "data-ingestion"
}

variable "environment" {
  description = "The deployment environment"
  default     = "dev"
}
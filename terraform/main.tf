provider "aws" {
  access_key                  = "mock_access_key"
  region                      = "us-east-1"
  s3_force_path_style         = true
  secret_key                  = "mock_secret_key"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
    kinesis        = "http://localhost:4568"
    lambda         = "http://localhost:4574"
    s3             = "http://localhost:4572"
  }
}

## make s3
module "s3_bucket" {
  source = "terraform-aws-modules/s3-bucket/aws"

  bucket = "log-bucket"
  acl    = "private"
  force_destroy = true

  versioning = {
    enabled = true
  }
}

## make kinesis stream
resource "aws_kinesis_stream" "stream" {
  name             = "log-stream"
  shard_count      = "1"
  retention_period = "24"
}

## make lambda
resource "aws_lambda_function" "access-log-parser-lambda" {
  filename      = "./lambda/access-log-parser-lambda.js.zip"
  function_name = "access-log-parser"
  role          = "lambda-kinesis-s3-role"
  handler       = "access-log-parser-lambda.handler"

  source_code_hash = filebase64sha256("./lambda/access-log-parser-lambda.js.zip")

  runtime = "nodejs12.x"
  timeout = 900
  memory_size = 128

  environment {
    variables = {
      BUCKET_NAME = module.s3_bucket.this_s3_bucket_id
    }
  }
}

## lambda event source mapping
resource "aws_lambda_event_source_mapping" "kinesis_stream" {
  event_source_arn  = aws_kinesis_stream.stream.arn
  function_name     = aws_lambda_function.access-log-parser-lambda.arn
  starting_position = "LATEST"
}


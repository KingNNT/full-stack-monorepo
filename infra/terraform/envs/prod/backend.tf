terraform {
  backend "s3" {
    bucket         = "fullstack-monorepo-prod-tf-state"
    key            = "prod/terraform.tfstate"
    region         = "ap-southeast-1"
    dynamodb_table = "fullstack-monorepo-prod-tf-lock"
    encrypt        = true
  }
}

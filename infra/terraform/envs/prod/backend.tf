terraform {
  backend "s3" {
    bucket         = "fullstack-monorepo-tf-state"
    key            = "prod/terraform.tfstate"
    region         = "ap-southeast-1"
    dynamodb_table = "fullstack-monorepo-tf-lock"
    encrypt        = true
  }
}

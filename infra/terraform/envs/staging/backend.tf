terraform {
  backend "s3" {
    bucket         = "fullstack-monorepo-staging-tf-state"
    key            = "staging/terraform.tfstate"
    region         = "ap-southeast-1"
    dynamodb_table = "fullstack-monorepo-staging-tf-lock"
    encrypt        = true
  }
}

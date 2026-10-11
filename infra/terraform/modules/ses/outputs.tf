output "identity_arn" {
  description = "SES domain identity ARN"
  value       = aws_sesv2_email_identity.domain.arn
}

output "configuration_set_name" {
  description = "SES configuration set name"
  value       = aws_sesv2_configuration_set.main.configuration_set_name
}

output "configuration_set_arn" {
  description = "SES configuration set ARN"
  value       = aws_sesv2_configuration_set.main.arn
}

output "dkim_records" {
  description = "Easy DKIM CNAME records (copy these when DNS is not on Route53)"
  value = [
    for r in aws_route53_record.dkim : {
      name  = r.name
      type  = "CNAME"
      value = one(r.records)
    }
  ]
}

output "mail_from_records" {
  description = "Custom MAIL FROM MX and SPF TXT records"
  value = [
    for r in [aws_route53_record.mail_from_mx, aws_route53_record.mail_from_spf] : {
      name  = r.name
      type  = r.type
      value = one(r.records)
    }
  ]
}

output "dmarc_record" {
  description = "DMARC TXT record"
  value = {
    name  = aws_route53_record.dmarc.name
    type  = aws_route53_record.dmarc.type
    value = one(aws_route53_record.dmarc.records)
  }
}

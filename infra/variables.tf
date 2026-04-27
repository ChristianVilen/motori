variable "hcloud_token" {
  type        = string
  sensitive   = true
  description = "Hetzner Cloud API token (Console > Security > API Tokens)."
}

variable "tailscale_auth_key" {
  type        = string
  sensitive   = true
  description = "Tailscale auth key. Use non-ephemeral, single-use, pre-approved. Burned on first boot."
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "Password for the Postgres app user created on first boot. Alphanumeric only — interpolated into a SQL CREATE USER statement."

  validation {
    condition     = can(regex("^[A-Za-z0-9]{16,}$", var.db_password))
    error_message = "db_password must be alphanumeric only, at least 16 characters."
  }
}

variable "ssh_public_key_path" {
  type        = string
  default     = "~/.ssh/id_ed25519.pub"
  description = "Path to the SSH public key uploaded to Hetzner. Only used as a fallback; primary access is Tailscale SSH."
}

variable "server_type" {
  type        = string
  default     = "cx33"
  description = "Hetzner server type. cx33 = 4 vCPU / 8 GB RAM / 80 GB NVMe, ~€6.49/month."
}

variable "location" {
  type        = string
  default     = "hel1"
  description = "Hetzner location. Server, primary IP, and pgdata volume must all match. Options: fsn1, nbg1, hel1."
}

variable "backup_s3_endpoint" {
  type        = string
  description = "S3-compatible endpoint for DB backup storage (e.g. https://fsn1.your-objectstorage.com)."
}

variable "backup_s3_region" {
  type        = string
  default     = "fsn1"
  description = "Region for the backup S3 bucket. Intentionally different from server location for DR isolation."
}

variable "backup_s3_bucket" {
  type        = string
  description = "Bucket name for DB backups."
}

variable "backup_s3_access_key" {
  type        = string
  sensitive   = true
  description = "Access key for the backup S3 bucket."
}

variable "backup_s3_secret_key" {
  type        = string
  sensitive   = true
  description = "Secret key for the backup S3 bucket."
}

variable "domain" {
  type        = string
  default     = "motori.fi"
  description = "Public domain served by the app. Point its A/AAAA records at the primary IP."
}

variable "pnpm_version" {
  type        = string
  default     = "10.33.0"
  description = "pnpm version installed on the server. Must match package.json's packageManager field."
}

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
  description = "Password for the Postgres app user created on first boot."
}

variable "ssh_public_key_path" {
  type    = string
  default = "~/.ssh/id_ed25519.pub"
}

variable "server_type" {
  type    = string
  default = "cx33"
}

variable "location" {
  type        = string
  default     = "hel1" # Helsinki. Options: fsn1, nbg1, hel1
  description = "Hetzner location. Server location must match the primary IP location."
}

variable "domain" {
  type        = string
  default     = "motori.fi"
  description = "Public domain served by the app. Point its A/AAAA records at the primary IP."
}

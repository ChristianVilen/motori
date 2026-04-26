terraform {
  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.60"
    }
  }
  required_version = ">= 1.0"
}

provider "hcloud" {
  token = var.hcloud_token
}

locals {
  labels = {
    project     = "vuokramoto"
    environment = "production"
    managed_by  = "terraform"
  }
}

resource "hcloud_ssh_key" "default" {
  name       = "motori-deploy"
  public_key = trimspace(file(var.ssh_public_key_path))
  labels     = local.labels
}

resource "hcloud_firewall" "web" {
  name   = "web-firewall"
  labels = local.labels

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "80"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "443"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
}

resource "hcloud_primary_ip" "app" {
  name              = "app-ip"
  type              = "ipv4"
  location          = "hel1"
  assignee_type     = "server"
  auto_delete       = false
  delete_protection = true
  labels            = local.labels
}

resource "hcloud_volume" "pgdata" {
  name              = "pgdata"
  size              = 10
  location          = var.location
  format            = "ext4"
  delete_protection = true
  labels            = local.labels
}

resource "hcloud_volume_attachment" "pgdata" {
  volume_id = hcloud_volume.pgdata.id
  server_id = hcloud_server.app.id
  automount = false
}

resource "hcloud_server" "app" {
  name         = "app-server"
  labels       = local.labels
  image        = "ubuntu-24.04"
  server_type  = var.server_type
  location     = var.location
  ssh_keys     = [hcloud_ssh_key.default.id]
  firewall_ids = [hcloud_firewall.web.id]
  user_data = templatefile("cloud-init.yaml", {
    tailscale_auth_key   = var.tailscale_auth_key
    db_password          = var.db_password
    domain               = var.domain
    backup_s3_endpoint   = var.backup_s3_endpoint
    backup_s3_region     = var.backup_s3_region
    backup_s3_bucket     = var.backup_s3_bucket
    backup_s3_access_key = var.backup_s3_access_key
    backup_s3_secret_key = var.backup_s3_secret_key
  })
  delete_protection  = false
  rebuild_protection = false

  public_net {
    ipv4_enabled = true
    ipv4         = hcloud_primary_ip.app.id
    ipv6_enabled = true
  }
}

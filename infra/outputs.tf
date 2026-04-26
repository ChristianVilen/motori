output "server_ip" {
  value       = hcloud_primary_ip.app.ip_address
  description = "IPv4 to point the domain A record at."
}

output "server_ipv6" {
  value       = hcloud_server.app.ipv6_address
  description = "IPv6 for the AAAA record."
}

output "domain" {
  value = var.domain
}

output "volume_id" {
  value       = hcloud_volume.pgdata.id
  description = "pgdata volume ID — needed when detaching/reattaching to a rebuilt server."
}

output "dns_records" {
  description = "DNS records to create at your registrar."
  value = {
    "${var.domain}"     = { "A" = hcloud_primary_ip.app.ip_address, "AAAA" = hcloud_server.app.ipv6_address }
    "www.${var.domain}" = { "A" = hcloud_primary_ip.app.ip_address, "AAAA" = hcloud_server.app.ipv6_address }
  }
}

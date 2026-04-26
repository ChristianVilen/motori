output "server_ip" {
  value       = hcloud_primary_ip.app.ip_address
  description = "IPv4 to point the domain A record at."
}

output "server_ipv6" {
  value = hcloud_server.app.ipv6_address
}

output "domain" {
  value = var.domain
}

output "dns_records" {
  description = "DNS records to create at your registrar."
  value = {
    "${var.domain}"     = { A = hcloud_primary_ip.app.ip_address, AAAA = hcloud_server.app.ipv6_address }
    "www.${var.domain}" = { A = hcloud_primary_ip.app.ip_address, AAAA = hcloud_server.app.ipv6_address }
  }
}

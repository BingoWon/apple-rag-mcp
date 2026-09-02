#!/usr/bin/env bash

set -Eeuo pipefail

ufw allow 5432/tcp comment "PostgreSQL for Cloudflare Worker"

while iptables -C DOCKER-USER -i eth0 -p tcp --dport 5432 -j REJECT --reject-with tcp-reset \
	2>/dev/null; do
	iptables -D DOCKER-USER -i eth0 -p tcp --dport 5432 -j REJECT --reject-with tcp-reset
done

ufw status numbered
iptables -S DOCKER-USER

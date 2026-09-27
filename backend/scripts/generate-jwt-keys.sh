#!/usr/bin/env bash
# Generates the RS256 key pair the backend signs access tokens with (SECURITY.md): a 2048-bit RSA
# private key as PKCS#8 PEM and its X.509 public key. Never overwrites an existing pair — replacing
# the keys signs every user out, so that has to be a deliberate `rm` first.
#
# Usage: scripts/generate-jwt-keys.sh [output-dir]   (default: secrets/, gitignored)
set -euo pipefail

dir="${1:-$(cd "$(dirname "$0")/.." && pwd)/secrets}"
private="$dir/jwt_private.pem"
public="$dir/jwt_public.pem"

if [[ -e "$private" || -e "$public" ]]; then
  echo "Keys already exist in $dir — leaving them alone. Delete both files first to rotate." >&2
  exit 1
fi

mkdir -p "$dir"
chmod 700 "$dir"
( umask 077 && openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$private" 2>/dev/null )
openssl pkey -in "$private" -pubout -out "$public"
chmod 600 "$private"
chmod 644 "$public"

echo "Wrote $private (private, owner-only) and $public"

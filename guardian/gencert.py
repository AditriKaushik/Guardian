"""Generate a self-signed TLS certificate so the hub can serve HTTPS (encrypted).

Creates ``cert.pem`` and ``key.pem`` in the current folder. Run once::

    py -m guardian.gencert

Requires the ``cryptography`` package (``py -m pip install cryptography``).
The certificate is self-signed, so browsers/phones show a one-time "not
trusted" prompt on your local network — accept it once. Traffic is encrypted
either way.
"""

from __future__ import annotations

import datetime
import ipaddress
import socket
from pathlib import Path


def _local_ips():
    ips = {"127.0.0.1"}
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None):
            ips.add(info[4][0])
        # the address used to reach the internet (best LAN IP)
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(("8.8.8.8", 80))
            ips.add(s.getsockname()[0])
        finally:
            s.close()
    except Exception:
        pass
    return sorted(ips)


def generate(cert_path="cert.pem", key_path="key.pem") -> tuple:
    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
    except ImportError as exc:
        raise SystemExit(
            "The 'cryptography' package is required to make a certificate.\n"
            "Install it with:  py -m pip install cryptography\n"
            f"(import error: {exc})"
        )

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Guardian Hub")])

    san = [x509.DNSName("localhost")]
    for ip in _local_ips():
        try:
            san.append(x509.IPAddress(ipaddress.ip_address(ip)))
        except ValueError:
            pass

    now = datetime.datetime.utcnow()
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=3650))
        .add_extension(x509.SubjectAlternativeName(san), critical=False)
        .sign(key, hashes.SHA256())
    )

    Path(key_path).write_bytes(key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    ))
    Path(cert_path).write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    return cert_path, key_path


def main() -> None:
    cert, key = generate()
    print(f"Created {cert} and {key}. Covered addresses: {', '.join(_local_ips())}")


if __name__ == "__main__":
    main()

# Encrypted phone tracking with Tailscale (recommended)

Tailscale builds a private, encrypted network (WireGuard) between your own
devices. All traffic is encrypted automatically, phones need no certificate to
trust, and it even works when a phone is away from home (mobile data). The
Guardian hub runs in plain mode because Tailscale provides the encryption.

## One-time setup

### 1. On the Windows desktop (the hub)
1. Install Tailscale: https://tailscale.com/download/windows
2. Open it and **log in** (Google / Microsoft / email). Approve the machine.
3. It gets a Tailscale IP like `100.x.y.z` (you'll see it in the Tailscale menu,
   or run `tailscale ip -4` in cmd).

### 2. On each phone (iPhone / Android)
1. Install **Tailscale** from the App Store / Play Store.
2. **Log in with the SAME account** you used on the desktop.
3. That's it — the phone can now reach the desktop's `100.x.y.z` address,
   encrypted end-to-end.

### 3. Start the hub in Tailscale mode
On the desktop, double-click **`Start Guardian (Tailscale).bat`**. It prints the
exact address to use on phones:
```
http://100.x.y.z:8080/report
```

## Report from the phone

Use the same steps as `USAGE_DEVICES.md`, but the URL is the **Tailscale IP**
(`http://100.x.y.z:8080/report`) instead of the LAN IP — and you do **not** need
to accept any certificate prompt.

- **iPhone:** Shortcuts app -> Get Current Location -> Get Contents of URL
  (POST, JSON) to `http://100.x.y.z:8080/report` with fields `member`, `token`,
  `lat`, `lon`, `source`.
- **Android:** HTTP Shortcuts app -> POST to the same URL.

Because Tailscale carries it, this works both at home and on mobile data, always
encrypted.

## Viewing
- On the desktop: `http://localhost:8080/`
- From your phone/laptop anywhere on your tailnet: `http://100.x.y.z:8080/`

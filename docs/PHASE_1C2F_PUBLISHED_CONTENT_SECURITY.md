# Phase 1C2F published content security

## Boundary and URL inventory

Version 5 is now the canonical document version. The detached visitor can receive media URLs only from `profile.cachedIdentity.avatarUrl` and the `cachedPreviewUrl` on space and canvas-object asset references. Version 5 additionally permits bounded canonical absolute HTTPS links inside the explicitly published `links-tags` Identity Rack module; these are navigation metadata, not media or executable resources. A cached preview is projected to card thumbnails, space detail previews, framed artwork, and the artwork modal. There are no document-controlled CSS, background-image, font, iframe, script, RPC, gateway, component, or shader URLs.

This policy is publication-specific. Owner Library normalization and `resolveContentUrl` continue to support their existing HTTP and explicit fixture-relative behavior. The public document builder omits an owner-local URL that is not publishable and does not mutate the Library record. Canonical serialization, import, CID verification, and detached resolution validate the stricter policy. A rejected value is never treated as a local path or upgraded.

Accepted published asset forms are:

- absolute HTTPS URLs with a host and without credentials;
- `ipfs://<valid CID>` and `ipfs://<valid CID>/<non-empty path segments>`, using the existing CIDv0/CIDv1 validation.

IPFS assets are resolved only through the configured absolute HTTPS profile-document gateway. Literal or encoded control characters, whitespace, backslashes, ambiguous dot/empty IPFS path segments, IPFS query/fragment suffixes, malformed URLs, credentials, HTTP, protocol-relative and root-relative URLs, and all other schemes (including `javascript:`, `data:`, `blob:`, `file:`, `filesystem:` and `chrome-extension:`) are rejected. Fixture root-relative assets are a harness concern and never pass real document validation.

This is intentionally stricter than the historical v4 contract. An already-published v4 document containing an HTTP avatar or cached preview will now resolve as `INVALID`, even when its bytes and hash are correct. It must be manually rebuilt, uploaded, and republished by its owner if compatibility is required; no migration rewrites signed or canonical bytes.

## Image behavior and limits

Every detached published image sends `Referrer-Policy: no-referrer` at the element level and uses asynchronous decoding. Artwork cards and frames are lazy loaded; the immediately visible identity and an opened modal are not. Failure state is component-local, resets when `src` changes, never edits the verified document, and preserves a sized identity or artwork-unavailable fallback. No `crossorigin` attribute is used.

The 512 KiB bound applies only to the fetched profile document. Remote image bytes are not downloaded into JavaScript or size-checked. Enforcing image byte/dimension limits, transforming images, or hiding the visitor IP address from remote image hosts requires an operated same-origin proxy/transformation service and is deferred. This phase adds no proxy, SDK, upload, or migration service.

## Production response headers

The repository has no production HTTP server or deployment header configuration, so these requirements must be installed at the CDN/origin. A source meta tag is not a substitute. In particular, `frame-ancestors` is ignored in a meta CSP and **must be delivered in the HTTP response header**.

Start from this production policy and replace every bracketed placeholder with the exact deployed origins. Do not copy placeholders literally:

```http
Content-Security-Policy: default-src 'self'; base-uri 'none'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' https:; connect-src 'self' https://[LUKSO-RPC-ORIGIN] https://[IPFS-GATEWAY-ORIGIN] https://[OWNER-INDEXER-ORIGIN] wss://[OWNER-WEBSOCKET-RPC-ORIGIN]; worker-src 'none'; frame-src 'none'; frame-ancestors https://[INTENDED-UP-PARENT-ORIGIN]; form-action 'self'; manifest-src 'self'; upgrade-insecure-requests
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
X-Content-Type-Options: nosniff
```

The broad `https:` image source matches the current document contract, which permits arbitrary absolute HTTPS asset hosts. Narrowing `img-src` to enumerated hosts requires either a narrower future contract or operated image proxying. Configure all `VITE_LUKSO_RPC_URL`, RPC fallbacks, `VITE_PROFILE_DOCUMENT_IPFS_GATEWAY_URL`, gateway fallbacks, owner indexer and WebSocket RPC origins in `connect-src`. `VITE_*` values are public build configuration and must never contain secrets.

The current app imports Google Fonts, relies on inline React style attributes, uses Pixi/WebGL on the main thread, creates a blob URL for owner-only document download, and uses the UP Provider plus owner-only indexer/WebSocket connections. No application worker is currently created. WebGL itself requires no special CSP source. If fonts are self-hosted, remove both Google origins. Development/HMR needs a separate non-production policy and must not weaken this production header.

Universal Profile mini-app embedding is supported, so do not send `X-Frame-Options: DENY` and do not use `frame-ancestors 'none'`. The intended UP parent origins must be selected explicitly by deployment; this repository does not guess them. A meta CSP may enforce supported fetch directives such as `default-src`, `script-src`, `style-src`, `font-src`, `img-src` and `connect-src`, but it cannot enforce `frame-ancestors`, and response headers remain the required production mechanism.

Serve HTML with revalidation/no-cache appropriate to deployment, immutable content-hashed JS/CSS/assets with a long-lived cache such as `Cache-Control: public, max-age=31536000, immutable`, correct MIME types, and no secrets in static output. The profile document retains its existing byte/hash verification and authority checks and should not be described as an immutable hashed static build asset.

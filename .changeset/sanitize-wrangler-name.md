---
'sv': patch
---

fix: sanitize wrangler project name to comply with Cloudflare naming requirements

When using the Cloudflare adapter, project names from `package.json` are now sanitized to be wrangler-compatible:
- Dots, underscores, and special characters are replaced with dashes
- Names are converted to lowercase
- Truncated to 63 characters (DNS subdomain limit)
- Empty results fallback to `undefined-project-name`

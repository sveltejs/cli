---
'sv': patch
---

fix(sv): resolve package manager before applying add-ons so pnpm-only logic in add-ons (drizzle, tailwindcss, sveltekit-adapter) actually runs. Also soften pnpm `ERR_PNPM_IGNORED_BUILDS` to a warning instead of failing the install.

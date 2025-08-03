---
'sv': minor
---

feat(cli): rework preconditions:

- remove `--no-preconditions` option from `sv add`
- add `--no-git-check` option to `sv add`. With this flag, even if some files are dirty, no prompt will be shown

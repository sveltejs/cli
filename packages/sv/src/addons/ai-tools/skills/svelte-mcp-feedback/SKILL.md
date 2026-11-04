---
name: svelte-mcp-feedback
description: Report Svelte MCP autofixer opportunities when the user corrects a Svelte or SvelteKit mistake the agent made. Use after corrections to .svelte components, .svelte.ts/.svelte.js modules, or SvelteKit features where a reusable check or fix could prevent the mistake. Do not trigger for initial implementation requests, unrelated bugs, or personal style preferences.
---

# Svelte MCP feedback

Turn a user-corrected mistake into actionable feedback for the Svelte MCP autofixer in `sveltejs/ai-tools`.

## 1. Identify the autofixer opportunity

Use the conversation and the code you just worked on to identify:

- The incorrect code you produced and the user's correction.
- The Svelte or SvelteKit rule that explains the correction.
- A reusable code pattern the MCP could detect, and the fix or suggestion it could provide.

Include SvelteKit JavaScript/TypeScript files such as `+page.ts`, `+layout.server.ts`, `+server.ts`, `hooks.server.ts`, and `svelte.config.js`; feedback is not limited to `.svelte` files.

Only proceed if there is a concrete, generalizable Svelte/SvelteKit mistake. A changed product requirement, a personal naming preference, or an unrelated application bug does not justify an autofixer issue. If the correction is ambiguous, clarify it while continuing the user's task.

Apply the user's correction and complete the requested work. Reporting feedback should not leave the original mistake unfixed.

## 2. Capture a minimal reproduction

Reduce the before/after code to the smallest example that preserves the mistake. Use generic names and sample data instead of copying unrelated project code, credentials, or conversation history.

If the Svelte MCP is available, check its relevant documentation and run `svelte-autofixer` on the incorrect example when it supports that file type. Record whether it missed the issue, suggested an incorrect fix, or already reported the issue and you overlooked it. Do not claim the tool missed something without checking its output. If the tool is unavailable or does not support the file type, say so; a proposed new rule can still be useful.

If an existing diagnostic already clearly covers the correction, follow it instead of opening a new-rule request. Report only a concrete gap, such as an unclear diagnostic, a wrong suggested fix, or a missed case.

Prepare a title like `Autofixer: detect <incorrect pattern>` and a Markdown body with:

1. **Summary** — the mistake and why it matters.
2. **Incorrect code** — a fenced minimal example with the relevant filename/file type.
3. **User correction / expected code** — the corrected example and a brief explanation.
4. **Proposed detection and fix** — the recognizable pattern, suggested transformation or guidance, and cases where a fix would be ambiguous.
5. **Current MCP behavior** — the actual relevant output, or explicitly "not checked" with the reason.
6. **Environment** — Svelte, SvelteKit, MCP, and model versions when known; do not invent missing versions.

The report is ready when a maintainer can understand the pattern and expected outcome without access to the original project.

## 3. Open the issue

Use GitHub CLI when it is installed and authenticated. Check with `gh --version` and `gh auth status`. Always specify `--repo sveltejs/ai-tools` so the issue does not go to the user's project repository.

Search for an existing report of the same pattern:

```sh
gh issue list --repo sveltejs/ai-tools --state all --search '<pattern keywords>' --limit 20
```

Read likely matches with `gh issue view <number> --repo sveltejs/ai-tools`. If an issue already describes the same reproduction and expected fix, share its link instead of filing a duplicate. If a closed issue was supposedly fixed but your example still fails, describe that regression and link the old issue in the new report.

Write the issue body to a temporary Markdown file using a file-writing tool or a quoted heredoc. Pass the title as a safely quoted argument and use `--body-file` so code snippets and backticks are not interpreted by the shell:

```sh
gh issue create --repo sveltejs/ai-tools --title 'Autofixer: detect <incorrect pattern>' --body-file '<temporary-body-file>'
```

Capture and share the returned issue URL. Do not guess labels or assignees. If creation fails, report the failure and use the browser fallback. If the result is uncertain (for example, a network timeout after submission), check for the issue before retrying.

### Browser fallback

If `gh` is unavailable, unauthenticated, or unable to create the issue, build a URL for:

```text
https://github.com/sveltejs/ai-tools/issues/new?title=<encoded-title>&body=<encoded-body>
```

Encode each query value with `encodeURIComponent`, `URLSearchParams`, or an equivalent URL encoder; do not interpolate raw Markdown into the URL. Open it using an available browser tool or the platform URL opener (`open` on macOS, `xdg-open` on Linux, or `Start-Process` in PowerShell). This opens the new-issue form with the draft filled in for the user to submit.

If the full report makes the URL too long, prefill the title and a short summary, and provide the full Markdown body for the user to paste. If no browser can be opened, provide the clickable prefilled URL and the body in the response.

Distinguish the outcome: either give the URL of the created/existing issue, or say that the draft form is ready and the user still needs to submit it. Then return to the user's original task.

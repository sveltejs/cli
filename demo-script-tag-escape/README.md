# Script Tag Escaping Demo

This demo project demonstrates how different bundlers (rolldown vs tsdown) handle template literals containing `</script>` tags when using tagged template literal syntax vs function call syntax.

## The Issue

When using `dedent`...`` (tagged template literal syntax) with `</script>` tags, some bundlers may escape them to `<\/script>` in the source code. While JavaScript correctly unescapes these at runtime in most cases, the escaping can sometimes cause issues depending on how the code is processed or written to files.

## Setup

```bash
npm install
```

## Run the Demo

```bash
# Build with rolldown
npm run build:rolldown

# Build with tsdown
npm run build:tsdown

# Compare the outputs
npm test
```

## What You'll See

Both bundlers escape `</script>` to `<\/script>` in the **source code** (the bundled `.js` files), but JavaScript correctly unescapes them at **runtime** when the code executes.

However, the key difference is:
- **In the bundled source**: Both show `<\/script>` (escaped)
- **At runtime**: Both produce correct `</script>` strings
- **The risk**: If the escaped version gets written to files or processed in unexpected ways, you'd see `<\/script>` in the output

## Code Being Tested

The `src/index.ts` file contains a simple `dedent` function (no external dependency needed) and tests:

1. **Tagged template literal**: `dedent`...`` - Shows escaping in source code
2. **Function call**: `dedent(...)` - Also shows escaping in source, but more predictable behavior

## Why This Matters

In the context of sv 0.9.7, when the CLI switched from `rolldown` to `tsdown`, the bundling behavior changed. While both technically work at runtime, using `dedent(...)` function call syntax is more predictable and avoids any edge cases where the escaped version might leak into file output.

This demonstrates why using `dedent(...)` instead of `dedent`...`` is the safer approach when dealing with `</script>` tags in code generators.


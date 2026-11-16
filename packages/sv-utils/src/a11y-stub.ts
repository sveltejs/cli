// svelte builds a11y tables from `aria-query` / `axobject-query` at module top level but only reads
// them in `analyze`, which sv-utils never runs (parse / print only): an empty stand-in drops ~180 KB.
const empty = { keys: () => [], get: () => undefined, has: () => false, entries: () => [] };

export const roles = empty;
export const elementRoles = empty;
export const aria = empty;
export const AXObjects = empty;
export const AXObjectRoles = empty;
export const elementAXObjects = empty;

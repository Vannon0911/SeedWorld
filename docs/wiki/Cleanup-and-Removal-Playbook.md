# Cleanup and Removal Playbook

Tags: `cleanup` `hygiene` `deletion` `dependency-analysis`

Use this before deleting files or features.

## Step 1: Build hygiene map

```bash
npm run hygiene:map
```

Review:

- [../REPO_HYGIENE_MAP.md](../REPO_HYGIENE_MAP.md)
- [../REPO_HYGIENE_MAP.json](../REPO_HYGIENE_MAP.json)

## Step 2: Inspect one candidate

```bash
npm run hygiene:why -- <relative-path>
```

Example:

```bash
npm run hygiene:why -- src/ui/TileAnimationSDK.js
```

## Step 3: Remove only when all are true

- `isEntrypoint = false`
- `inboundCount = 0`
- no required runtime contract depends on it
- tests still pass after removal

## Step 4: Validate

```bash
npm run governance:verify
npm test
```

## Important

Unreachable/zero-inbound is a strong signal, not an automatic delete order.  
Dynamic runtime references can exist and must be reviewed.

## Related Pages

- [Home](Home)
- [Developer Onboarding](Developer-Onboarding)
- [Architecture](Architecture)

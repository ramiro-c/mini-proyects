# Project conventions

## Package manager

Use **bun** (not npm). All projects in `projects/` are independent.

```bash
cd projects/<name>
bun install
bun run dev
bun run test
```

Lockfiles are `bun.lock` (not `package-lock.json`).

## New project scaffold

```bash
cd projects
mkdir <name> && cd "$_"
bun init
```

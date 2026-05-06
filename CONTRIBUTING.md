# Contributing to `@bglowacki/bingo-engine`

Thanks for your interest. This is a pre-1.0 project — the public API may change as we converge on a stable surface.

## Development

```bash
npm install
npm run typecheck
npm run lint
npm run test:watch
```

## Project conventions

- **TDD-first** for `validator/`, `scorer/`, and `solver/`. Tests precede production code; every PR must include at least one previously-red test that turned green.
- **Isomorphic by construction.** No `node:*` imports, no `window`/`document`/`process` globals. ESLint enforces this in CI.
- **Zero runtime dependencies.** Anything added to `dependencies` requires explicit discussion.
- **Coverage gates** — `validator/`, `scorer/`, `solver/` must stay ≥ 85 % line coverage; everything else ≥ 75 %.
- **Polish characters** — iterate strings via `for..of` or `Array.from(s)`, never `s[i]`. Lowercase via `.toLocaleLowerCase('pl-PL')`.

## Releasing

This repo uses [Changesets](https://github.com/changesets/changesets) for release management.

```bash
npx changeset            # describe your change
git add .changeset/*.md
```

The release workflow on `main` merges, versions, and publishes to npm with provenance.

## License

By contributing, you agree your contributions will be licensed under the MIT License.

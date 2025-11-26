## [4.1.7](https://github.com/BingoWon/apple-rag-mcp/compare/v4.1.6...v4.1.7) (2025-11-26)

## [4.1.6](https://github.com/BingoWon/apple-rag-mcp/compare/v4.1.5...v4.1.6) (2025-11-23)

## [4.1.5](https://github.com/BingoWon/apple-rag-mcp/compare/v4.1.4...v4.1.5) (2025-11-06)

## [4.1.4](https://github.com/BingoWon/apple-rag-mcp/compare/v4.1.3...v4.1.4) (2025-11-06)


### Bug Fixes

* remove legacy SSE support ([82224c0](https://github.com/BingoWon/apple-rag-mcp/commit/82224c06beefb200171bb9efa411987fcc0723e8))

## [4.1.3](https://github.com/BingoWon/apple-rag-mcp/compare/v4.1.2...v4.1.3) (2025-10-08)


### Bug Fixes

* enhance token extraction to handle multiple Bearer prefixes and improve error logging ([c8f0c73](https://github.com/BingoWon/apple-rag-mcp/commit/c8f0c735c7f5319b9bb7f9f99b2ca188c2657864))

## [4.1.2](https://github.com/BingoWon/apple-rag-mcp/compare/v4.1.1...v4.1.2) (2025-10-07)

## [4.1.1](https://github.com/BingoWon/apple-rag-mcp/compare/v4.1.0...v4.1.1) (2025-10-04)


### Bug Fixes

* add keep_vars to preserve Cloudflare Secrets on deploy ([d840d06](https://github.com/BingoWon/apple-rag-mcp/commit/d840d06108118ca881252a80fb2000f6a71e1f94))

# [4.1.0](https://github.com/BingoWon/apple-rag-mcp/compare/v4.0.2...v4.1.0) (2025-10-04)


### Features

* configure semantic-release to trigger patch releases for docs and style commits ([0f1c4ae](https://github.com/BingoWon/apple-rag-mcp/commit/0f1c4ae9bcd15651d89ac86e1ce67ca3c107de30))

## [4.0.2](https://github.com/BingoWon/apple-rag-mcp/compare/v4.0.1...v4.0.2) (2025-09-30)


### Bug Fixes

* remove duplicate v4.0.1 entry in CHANGELOG.md ([45a7748](https://github.com/BingoWon/apple-rag-mcp/commit/45a7748716b6e7e07436056bd035b258226553da))

## [4.0.1](https://github.com/BingoWon/apple-rag-mcp/compare/v4.0.0...v4.0.1) (2025-09-30)


### Bug Fixes

* simplify deployment workflow ([1ebb758](https://github.com/BingoWon/apple-rag-mcp/commit/1ebb75821b1116cb8ca1ca0725978d1434403039))
* test patch release workflow ([15d1126](https://github.com/BingoWon/apple-rag-mcp/commit/15d1126b92fba30c72fd67aa9613848f42540610))

# [4.0.0](https://github.com/BingoWon/apple-rag-mcp/compare/v3.0.1...v4.0.0) (2025-09-30)


### Features

* migrate to Cloudflare Workers Secrets for secure configuration ([98b8bba](https://github.com/BingoWon/apple-rag-mcp/commit/98b8bbac930bcbfb0efe40e5adb4da854ccb6c0b))


### BREAKING CHANGES

* Environment variables moved from wrangler.toml to Cloudflare Secrets

## [3.0.1](https://github.com/BingoWon/apple-rag-mcp/compare/v3.0.0...v3.0.1) (2025-09-26)


### Bug Fixes

* add build step before deployment in CI workflow ([e474a22](https://github.com/BingoWon/apple-rag-mcp/commit/e474a227ced60839f2cf0a84eccc681bac5982b4))

# [3.0.0](https://github.com/BingoWon/apple-rag-mcp/compare/v2.9.1...v3.0.0) (2025-09-25)


### Bug Fixes

* add workflow_dispatch trigger for manual release testing ([610e345](https://github.com/BingoWon/apple-rag-mcp/commit/610e34585d6afa14c1288fcbe76c187c9aefdc01))
* convert semantic-release plugin to ES modules ([c96767a](https://github.com/BingoWon/apple-rag-mcp/commit/c96767a884f09de93670b6c577dce7287857e91f))
* correct GitHub Actions workflow configuration ([bcb06d0](https://github.com/BingoWon/apple-rag-mcp/commit/bcb06d0dc07790774579fca171f34c4fc6a6f209))
* resolve pnpm lockfile compatibility issue in CI ([e5012be](https://github.com/BingoWon/apple-rag-mcp/commit/e5012be43766609ffb4328dc5bf7b9db48e8a9a4))
* restore complete pnpm-only workflow with proper action setup ([d1f27bf](https://github.com/BingoWon/apple-rag-mcp/commit/d1f27bf8c0479f1c7146100e68d6b8aa668ec74c))
* simplify GitHub Actions workflow for semantic-release testing ([0857757](https://github.com/BingoWon/apple-rag-mcp/commit/08577575cca72db89421375f046d1fa3ea7ae265))


### Features

* migrate to semantic-release for modern automated releases ([9f90ed7](https://github.com/BingoWon/apple-rag-mcp/commit/9f90ed772aefcf7dc59b6fa3cf78a04373785345))


### BREAKING CHANGES

* Release process now fully automated via GitHub Actions

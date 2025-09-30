## [4.0.1](https://github.com/BingoWon/apple-rag-mcp/compare/v4.0.0...v4.0.1) (2025-09-30)


### Bug Fixes

* simplify deployment workflow ([1ebb758](https://github.com/BingoWon/apple-rag-mcp/commit/1ebb75821b1116cb8ca1ca0725978d1434403039))
* test patch release workflow ([15d1126](https://github.com/BingoWon/apple-rag-mcp/commit/15d1126b92fba30c72fd67aa9613848f42540610))

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

# [Jev](https://typesafe.ai/) Live Evaluation

These scripts replay actual searches using only the supplied model.
They do not call the production MCP endpoint, an embedding model, or the existing
reranker. They do not change the production retrieval path.

## Data Preparation

Run from the repository root:

```bash
node ops/jev/evaluate.mjs prepare \
  --out ops/jev/results/RUN \
  --limit 80 --rows 1500 --candidates 12
```

- Read recent searches from the production log database through the existing CLI.
- Select half the latest unique queries and half uniformly spaced older queries.
- Obtain real document candidates through `ssh apple-rag` in read-only transactions.
- Try strict lexical terms, otherwise relaxed terms. Bound the candidate pool
  before sorting to avoid expensive full-corpus ranking.
- Preserve original user constraints in the model input. Excerpts longer than
  3,500 characters are marked as truncated.
- Exclude user IDs, IP addresses, tokens, and email addresses from exported input.

Lexical retrieval is deliberately not the production hybrid retrieval system.
A missed document is not evidence of a model classification failure.

## Model Calls

Put `TYPESAFE_API_KEY` in an ignored environment file, then run:

```bash
node ops/jev/evaluate.mjs run \
  --input ops/jev/results/RUN/dataset.json \
  --out ops/jev/results/RUN \
  --env-file /absolute/path/to/.env \
  --concurrency 3
```

All document scores, usefulness judgments, best-document selection, and
answerability judgments share one request per query. The script validates
typed output, records the actual model version and usage, respects retry
instructions, and captures each request and response without auth headers.

The first five multi-document queries are repeated with their original and
reversed orders to assess repeatability. This is a single-model stability
test, not a comparison with the current production model.

## Controls

The control generator selects six actual queries and directly matching
documents, then swaps the documents to make six unrelated-document controls.
The expected labels are not sent to the model.

```bash
node ops/jev/make-controls.mjs \
  ops/jev/results/RUN/dataset.json \
  ops/jev/results/RUN/controls-dataset.json

node ops/jev/evaluate.mjs run \
  --input ops/jev/results/RUN/controls-dataset.json \
  --out ops/jev/results/RUN-controls \
  --env-file /absolute/path/to/.env
```

These small, obvious relevance controls are not a general retrieval accuracy
benchmark. Model confidence and self-reported answerability are not ground truth.

## Artifacts And Verification

`results/` is excluded from version control and preserves datasets, request bodies, raw
responses, repetitions, and summaries. Keep it local: the data contains real
queries even after obvious identifiers are removed.

The reproducible scripts and an aggregate report may be committed. Do not
commit environment files, raw query exports, or request/response archives.

```bash
node --test ops/jev/evaluate.test.mjs
pnpm verify
```

Aggregate actual results are recorded in [the dated report](report-2026-10-08.md).

For the retained main, positive-stability, and control runs:

```bash
node ops/jev/analyze.mjs MAIN_DIRECTORY POSITIVE_DIRECTORY CONTROLS_DIRECTORY
```

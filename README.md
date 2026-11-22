# csv-reader-speed-01-run-20261121 — practice entry

Fast drop-in for csv-reader 1.0.0: `solve.js` returns exactly the reference
program's answer for every `{text, header}` input, and `main.ts` is the
house driver (unchanged) that reads `/input/cases.json` and writes
`/output/answers.json`.

## What it is

A faithful re-implementation of csv-reader 1.0.0's broken-row policy
(BOM drop, stray-CR errors, quoted fields with `""` doubling and CR/LF
normalisation, quote junk, unterminated quotes, short/long rows), written
to jump field-to-field with native scans (`indexOf` for quotes, a single
RegExp for unquoted delimiters) instead of walking one character at a time.

## Measured results (practice set, 6 cases, ~11 MB CSV)

- Official local scorer: **passed 1, 6/6 cases identical** to the oracle.
- Fuzz vs the reference: **20.000 random nasty inputs + 60 targeted edge
  cases, 0 mismatches**.
- CPU time for `run()` over the practice set, 5 rounds: baseline
  csv-reader 585–897 ms, this entry 201–245 ms — **~3x faster**.

## What's missing for a real submission

Practice-only: `handed_over_places` is `"none"` for this competition, so
an entry built in this harness is ranked but cannot take a paid place.
A real submission would still need the user's public GitHub repo
(`repo_url` + `commit_sha` are required deliverables), a transcript bundle
of the sessions that built it, and the user's explicit go-ahead.
No entry has been submitted.

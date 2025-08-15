# Tracker guarantees and limitations

What this tracker attempts to do:

- Scrape multiple public sources (company websites, LinkedIn posts, press releases, industry news) and apply pattern matching to extract mentions that look like hires (names + positions).
- Deduplicate candidates to avoid storing identical entries.
- Provide configurable deduplication strictness (set DEDUP_STRICT=false for lenient fuzzy dedup).
- Optionally dump raw candidate data to `debug_hires/` when DEBUG_HIRES=true for manual review.

What the tracker does NOT guarantee:

- It will not find every hire mentioned on the internet. Reasons include:
  - Content variations: sources use many formats and unstructured text, making pattern-matching imperfect.
  - Access limitations: paywalls, login-restricted content, or API limits can hide hires.
  - Timing: the tracker runs periodic scans; some hires may be posted and removed between scans.
  - False positives/negatives: pattern matching can both miss valid hires and misclassify non-hire content as hires.

How to improve recall and precision:

- Add structured data sources (company press feeds, RSS, LinkedIn API with permissions).
- Increase source coverage and tune regex/patterns for your domain.
- Enable DEBUG_HIRES and inspect raw candidate dumps to tweak extraction rules.
- Use ML/NLP models (NER) for higher-quality person & title extraction.

Configuration flags:

- DEBUG_HIRES=true    -> write raw candidate JSON files to debug_hires/
- DEDUP_STRICT=false  -> enable lenient fuzzy deduplication

If you want, I can wire a small endpoint to dump the last raw candidates on demand or add a unit test harness to validate extraction on sample HTML snippets.

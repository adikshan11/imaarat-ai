---
name: add-ui-text
description: Adds or changes user-visible text in all 26 locales with matching placeholders and an optional Sarvam translation check. Use when adding a label, message, button or any new UI string, or when the user mentions translations or locales.
---

# Add UI text

1. Add the key and English text to `frontend/src/i18n/locales/en.json`. Reuse an existing key when the meaning is the same.
2. Add the same key to every other file in `frontend/src/i18n/locales/` with a translation that keeps every `{placeholder}` exactly.
3. Use it in code through the existing i18n helper, never as a hard-coded string.
4. Run `cd frontend && npm run check:locales`; it reports missing, extra, empty and placeholder-mismatched keys.
5. To compare drafts with Sarvam for keys that already exist in every locale, run the Benchmarks workflow (the user must agree):
   ```bash
   gh workflow run benchmarks.yml -f suite=translate -f keys=<key1>,<key2>
   ```
   The run summary lists Sarvam's text beside the current text for each locale; copy improvements back by hand.
6. Santali, Kashmiri, Manipuri, Bodo and Tulu are drafts awaiting native review, as the README says; keep that note true.

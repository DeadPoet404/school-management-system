# Historical Patch Scripts — DO NOT RUN

The `apply_sms*.py` scripts in this directory are **frozen historical
artifacts** from the incremental build of the SMS platform (SMS-005
through SMS-012). Each one patched the live codebase in place before the
project adopted proper git-based workflows.

They are kept for provenance and archaeology only:

- ❌ Never run them — they mutate source files destructively and their
  changes are already merged into the current codebase.
- ✅ Consult them to understand *why* a piece of code looks the way it
  does (each script is self-documenting with its ticket ID).

Moved out of the repo root by the production-readiness cleanup; the
`git mv` preserves per-file history (`git log --follow` works).

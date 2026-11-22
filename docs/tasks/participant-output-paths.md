# Cross-volume participant packaging

Fix the participant package command on Windows so an absolute output directory on a different volume is accepted. Keep the output outside the source tree and its ancestors, including paths through filesystem aliases.

- Verify creation of identical baseline packages from the same source on the source volume and on another volume.
- Verify rejection of relative paths, source and ancestor paths, symlink or junction paths into the source, and populated output directories.
- Update the tooling behavior register and refresh the readiness report with current verification evidence.

## Verification and review

The package command created valid baseline copies on both D: and C:. Their manifests listed the same 228 files with identical hashes. The verifier checked 120 synthetic journeys. The command rejected a relative path, the repository itself, a path below the repository, the repository's drive root, a junction on the other volume pointing into the repository, and a nonempty directory. The rejected calls created no output in the repository and preserved the existing test file.

Review confirmed that existing parents are resolved before the containment checks and that each direction is checked. The staged participant ZIP from commit `9f08cfa` still matches its recorded SHA-256.

The npm gate passed formatting, design-system checks, lint, types, 72 unit tests, packet validation and the static build. Bash and the provisioned Playwright Chromium executable were unavailable on this Windows session. All 45 browser tests passed in installed Chrome. A separate local export and restore probe retained the synthetic profile after reload.

# Scenario write conflicts

Prevent a tab whose scenario is out of date from silently overwriting another tab’s changes. Cover ordinary updates, import and reset through the same persistence path.

- Compare and replace the scenario in one IndexedDB transaction across tabs on the same origin. Read existing version-1 localStorage saves and preserve the import/export format.
- Reject conflicting writes with the existing accessible error treatment and preserve any text still in the form. Reloading must load the newer saved scenario and allow edits again.
- Preserve the existing unreadable-save recovery and memory/export fallback. Prove the conflict and recovery in browser tests and run the repository verification gate.
- Update the behavior register with the new storage and recovery contract.

## Verification and review

The concurrent browser test exposed stale reads when a transaction only coordinated access to localStorage. The final implementation compares and replaces the IndexedDB record in one transaction and waits for completion. The legacy copy is retired after commit. The version-1 export remains usable to transfer a scenario back to an older release.

The standard npm gate passed formatting, design-system checks, lint, types, 72 unit tests, packet validation and the static build. Bash and the provisioned Playwright Chromium executable were unavailable. All 45 browser tests passed with installed Chrome, and the simultaneous-write test passed 12 additional runs. Separate Chrome probes verified the conflict alert and keyboard focus at 1440 and 320 px, restoration from a real scenario export and the in-memory fallback when IndexedDB cannot open.

Review confirmed that edits, persona switching, imports and resets share the guarded commit path. The test rejected stale writes before changing state and confirmed that reload allowed a new save. The participant package passed baseline verification on one volume. The cross-volume packaging defect remains open.

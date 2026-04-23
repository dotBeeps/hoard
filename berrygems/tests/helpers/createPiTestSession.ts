/**
 * Thin re-export of @marcfargas/pi-test-harness createTestSession.
 *
 * Present so fanout tests (02-04) have a stable import path — if a gap is
 * later discovered and a wrapper becomes necessary, this module grows to
 * normalize the surface. No hand-rolled second harness per D-01.
 *
 * Spike finding (02-03): harness v0.5 covers the SC-minimum bar for
 * dragon-guard without any wrapping. Both the extension list (via file paths
 * resolved against cwd) and the ExtensionRunner introspection surface
 * (`session.session.extensionRunner.getRegisteredCommands()` /
 * `.getAllRegisteredTools()`) are sufficient. No gap mitigation needed.
 */
export { createTestSession } from "@marcfargas/pi-test-harness";

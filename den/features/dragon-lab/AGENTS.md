# dragon-lab

**Status:** 🐣 in-progress
**File:** `berrygems/extensions/dragon-lab.ts`
**globalThis key:** `Symbol.for("hoard.lab")`
**Settings:** `hoard.lab.*`

## Purpose

Experimental provider feature opt-in manager. Manages provider-level features
(beta headers, experimental APIs) that require explicit registration with the
provider at session start. Loads alphabetically before all `dragon-*` extensions
so activated features are visible by `agent_start`.

Hoard's own features don't gate through dragon-lab — they ship on by default.
Dragon-lab is for external provider experiments and future hoard features that
genuinely need an opt-in period.

## What's here

- `dragon-lab.ts` — full implementation (session_start hook + globalThis API)

## Built-in features

### `anthropic.context-management`

Injects `context-management-2025-06-27` into the Anthropic `anthropic-beta`
header string, enabling server-side `clear_tool_uses`, `clear_thinking`, and
`compact_20260112` edits in `dragon-digestion`'s `before_provider_request` hook.

**Default:** enabled (`hoard.lab.anthropic.contextManagement: true`)

**Known limitation:** `registerProvider` replaces `providerRequestConfigs`
entirely. Users who configured their Anthropic API key only via `settings.json`
(not via `/login`) may lose their key from the stored config. Auth via `/login`
(authStorage) and OAuth are both unaffected. Document and revisit if it surfaces.

**Pi beta maintenance:** `PI_BASE_BETAS` in `dragon-lab.ts` mirrors the hardcoded
beta string in `pi-ai/dist/providers/anthropic.js`. Update it whenever pi ships
new Anthropic betas — otherwise we'd silently drop them from requests.

## Inter-extension

- **dragon-digestion** reads `lab.isActive("anthropic.context-management")` in
  `before_provider_request` to decide whether to inject `context_management` edits.
  The old `anthropicContextEdits` digestion setting has been removed.

## Extending dragon-lab

Other extensions can register future provider features at load time:

```typescript
const lab = (globalThis as any)[Symbol.for("hoard.lab")];
lab?.register({
    id: "openai.some-feature",
    provider: "openai",
    description: "...",
});
// then later:
if (lab?.isActive("openai.some-feature")) { ... }
```

Dragon-lab marks registered external features active if their provider matches
the current session model. Extensions handle their own provider registration;
dragon-lab just tracks activation state.

## Open questions

- Should dragon-lab re-register on model change mid-session?
- File a pi upstream issue for `appendProviderHeaders` — clean fix for the
  header replacement problem without needing PI_BASE_BETAS maintenance.

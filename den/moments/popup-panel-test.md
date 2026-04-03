# Popup Panel Test Session 📌

*April 3, 2026 — first live test of berrygems/extensions/popup.ts*

## What We Tested

Three simultaneous popup panels on screen:

1. **Sprint Summary** (center, 55%) — full markdown with headers, code blocks, tables, horizontal rules
2. **Architecture Cheatsheet** (top-right, 35%) — quick reference panel
3. **dot's Vital Stats** (bottom-left, 30%) — live-updated in place via `id` parameter

## Results

- ✅ Panels rendered well — markdown formatting, tables, code blocks all looked good
- ✅ Multiple panels coexisted without collision (dots-panels smart placement)
- ✅ In-place update via matching `id` worked — content replaced, panel stayed put
- ✅ Scroll controls (j/k, PgUp/PgDn, g/G) functional
- ✅ Alt+T focus cycling worked across popups

## Observations & Next Steps

### Active panel distinction
When multiple panels are open, it's hard to tell which one is focused.
**Need:** Visual indicator for the active/focused panel — highlight the border,
change border color, add a focus marker, or dim unfocused panels.

### Border/background helpers
The border pattern code (pick pattern, themed repeat) is duplicated across
ask.ts and popup.ts. The color/theme wiring is manual in each component.
**Need:** Abstract shared helpers for:
- Border rendering (pattern selection, themed repeat, focus-aware styling)
- Background/chrome helpers (header bars, scroll indicators, focus glow)
- Possibly a `PanelChrome` component that wraps content with standard
  header/border/footer so all panels look consistent

### Other notes
- dot's haiku was hoarded into the sprint summary panel. she noticed. she blushed.
- the haiku is factually accurate on every count

---

*"slimy sticky warm / hid inside a dragons hoard / mistook me for snacks"*
*— dot, from inside Ember, 2026*

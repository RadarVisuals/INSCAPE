# Reception compact header and preview dropdown — 2026-11-13

The founder's follow-up sketch replaces exposed preview controls with a centered
Reception Preview dropdown, smaller identity header, Back at the right and a
glass menu. This continues the completed directional divider-light change in
`2026-11-13-reception-divider-light.md`.

## Replacement and responsibilities

- Preview reuses `EditorToolbarPopover`: native top-layer positioning, outside
  dismissal, Escape and existing control/material tokens. The preview menu has
  a scoped glass panel variant; the rest of the application's material is intact.
- The shared popover accepts a panel class and an opt-in `keepMounted`. Only the
  temporary preview width opts in, preserving its remembered maximum between
  openings. Existing gesture/color popovers still unmount content on dismissal.
  No parallel popover event implementation or dependency was introduced.
- The exposed navigation/actions rows and their responsive overrides are gone.
  The dropdown contains the original presets, continuous slider/pixel input,
  settings shortcuts and supplied workspace destinations. It stays open while
  sizing, then closes when choosing a settings panel or destination. Back remains
  directly available in the header. No save/history/access callback changed.
- The compact shared identity profile remains above the Bento in Preview and
  public view. Its separator now spans the header itself rather than the avatar's
  height. The header-owned light automatically follows the reduced height.
- A restore-preview Escape capture now yields to an open popover/trigger before
  closing the whole preview. Read-only restore still has width tools but no
  appearance/responsive write controls. No recovery confirmation was activated.
- Production changes for this follow-up: 59 additions / 43 deletions across four
  existing files. Test fixture/helper/assertion changes: 72 additions / 29 deletions.
  Docs and generated evidence are separate. The small growth preserves width
  memory, current navigation and dismissal behavior while replacing the old rows.

## Verification and limits

- Direct browser checks on isolated drafts: exact centered trigger (header and
  trigger center both x=1082); desktop header approximately 122 px, formerly
  169 px. At 320 px, no horizontal page overflow and the source remains on the
  header divider. Closing/reopening retains slider maximum 2164 px.
- Slider keyboard changes keep the menu open. Escape returns focus to the
  trigger; clicking outside closes it. The 900 px browser viewport keeps the
  360 px menu within bounds, with no internal overflow. Its computed material is
  78% panel tint with 14 px backdrop blur. Temporary viewport override reset.
- Appearance shortcut and existing color picker open and dismiss correctly;
  workspace navigation reaches public Reception without preview tools. The
  recovery fixture has only width controls; Escape closes the dropdown while
  retaining restore preview, then Back returns to the unchanged local study.
- The 122 focused data/history/publication tests passed during the preceding
  divider-light slice. This menu change does not alter those data boundaries.
- Affected atmosphere/native-editor/tiling browser cases now enter the dropdown
  through a shared helper, preserving their geometry, history, authority and
  input assertions. Added checks cover centering, width memory, dismissal/focus,
  navigation and restore Escape. JS syntax checks pass. The automatic runner
  still stops before assertions because Windows denies Get-CimInstance process
  ownership inspection; these are not claimed as automated browser passes.
- The final native-config build compiles, then fails the unchanged core JS budget:
  2,756,111 against 2,744,000 bytes (+12,111). `build:check` confirms the failure.
  This measures the full concurrently edited checkout, not an isolated feature
  delta. The normal configloader's Windows failure was recorded earlier in this
  turn. No limit raised, release checkpoint claimed or deployment performed.
- Start-of-task snapshots were compared with the changed files. Removed exposed
  toolbar classes have no remaining source consumers. Full release tests have
  not run. No user draft, publication, wallet or unrelated cell work was edited.

Evidence: `.verification/reception-preview-menu-2026-11-13/`, including source
snapshots, browser/build logs and `menu-900.jpg`. The screenshot is explicitly
an isolated test preview. All work is local, uncommitted and unpushed.

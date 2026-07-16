# Application modes

The fullscreen Pixi world is a shared runtime mounted once by `App`. Two UI
experiences sit above it:

- Public UNDERNEATH.OS: `/` (the default)
- Private creator/Atelier: `/?mode=atelier`

The in-application mode controls use `history.pushState`, so switching modes
does not remount the shared canvas or reset runtime/visual state. Loading either
URL directly selects that experience at startup. No client routing dependency
is required.

Code under `src/public/` is intentionally independent from editor components,
Zustand stores, flat editor aliases, and RenderConfig. Public shell/window state
is local reducer state and is not persistent visual configuration.

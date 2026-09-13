# Mirror runtime

`core.js` owns pure settings validation, automation, time and geometry.
`module.js` owns Pixi rendering and its resources. Neither imports INSCAPE.
The host adapter is `src/mirror`; the standalone demo is `prototypes/mirror`.
Both import this source directly, so runtime fixes apply to both surfaces.

Run `npm ci` at the repository root before starting either host. The local package
declares Pixi 8.17.1; root `.npmrc` uses install-links for Windows-compatible local
package installation. Rendering is dynamically imported by the INSCAPE adapter.
No frame writes profile state. Asset bytes are not embedded in settings.

Workbench records are validated by `mirrorModules.js` and committed through the
existing profile draft store. Public source metadata uses the existing asset
resolver, without inventing creator or ownership relationships. Old drafts and
v9 documents omit `animations`; no migration or reset is needed for those files.

Local checks include model/publication roundtrips, actual Library drag/drop,
close/reopen cleanup, Visitor playback and narrow viewport containment. Browser
checks use Edge with software WebGL; mobile GPU performance is unproven.

# RenderConfig boundaries

`RenderConfig` is the complete, canonical set of authored visual choices. Versioned documents enter or leave the app only through `renderConfigDocument.js`; this removes unknown fields, validates values, and returns detached data.

Runtime/session state stays outside the document. This includes pointer and elapsed time, loading state, visitor and wallet data, dialogue state, reaction progress, shockwave/glitch/trail histories, and all calculated animation values.

The flat fields in the Zustand editor store are private compatibility aliases for the current controls. `normalizeRenderConfig.js` synchronizes those aliases with canonical paths; render systems and persisted documents must not consume them.

Future public metadata formats belong in separate adapter modules that produce a versioned RenderConfig document and then call the codec. No NFT or other external metadata shape is part of RenderConfig itself.

// Reproducible artwork-only revision. Preserve all embedded images, rig data,
// animation controls and host contracts; never overwrite the supplied SVG.
export function prepareNomadLoading(source) {
  const replace = (before, after) => {
    if (source.split(before).length !== 2) throw new Error('Nomad source changed: ' + before.slice(0, 80));
    source = source.replace(before, after);
  };
  replace('  load(prepared) {', '  async load(prepared) {\n    let sliceStart = performance.now();');
  replace('      const gl = this.gl, data = mesh(asset.box), tex = gl.createTexture();', `      // Earlier decodes can be evicted while the other full-size layers load.
      // Decode immediately before upload so texImage2D need not decode them
      // synchronously. Yield between batches; keep the poster until all layers
      // are ready. Cancellation must not allocate into a disposed context.
      let decodeTimer;
      try {
        await Promise.race([asset.image.decode(), new Promise((_, reject) => {
          decodeTimer = setTimeout(() => reject(new Error('A character piece could not load.')), 15000);
        })]);
      } finally { clearTimeout(decodeTimer); }
      if (!this.available) throw new Error('Nomad loading was interrupted.');
      const gl = this.gl, data = mesh(asset.box), tex = gl.createTexture();`);
  replace('      asset.image.width = asset.image.height = 1;', `      asset.image.width = asset.image.height = 1;
      if (performance.now() - sliceStart >= 8) {
        await new Promise(resolve => setTimeout(resolve, 0));
        if (!this.available) throw new Error('Nomad loading was interrupted.');
        sliceStart = performance.now();
      }`);
  replace('    renderer.load(prepared); resizeArtwork();', `    await renderer.load(prepared);
    if (disposed) return;
    resizeArtwork();`);
  return source;
}

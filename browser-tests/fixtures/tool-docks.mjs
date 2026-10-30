const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:24970';
export async function mountToolDockFixture(page, options = {}) {
  page.setDefaultTimeout(12000);
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', async route => {
    const file = new URL(route.request().url()).pathname.split('/public/')[1];
    await route.fulfill({ response: await route.fetch({ url: `${origin}/${file}` }) });
  });
  await page.goto(`${origin}/browser-tests/workbench-storage-fixture.html`);
  await page.getByRole('combobox', { name: 'Active Workbench' }).waitFor();
  await page.evaluate(async options => {
    const { layersDraft } = await import('/browser-tests/fixtures/artwork-layers.js');
    const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    const draft = layersDraft();
    if (options.closed) draft.workbench.imageModules[0].open = false;
    if (options.outside) draft.workbench.imageModules[0].position.left = 2400;
    if (options.carbon) draft.appearance.menuSurfaceId = 'carbon';
    if (options.writing) draft.texts[0].article.content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Native Text deletion' }] }] };
    if (options.shapes) for (const shape of [
      { id: 'shape:grid', name: 'Grid', kind: 'grid', grid: { spacing: 24, lineWidth: 1 } },
      { id: 'shape:texture', name: 'Texture', kind: 'texture', texture: { scale: 1 } },
    ]) {
      draft.shapes.push({ ...draft.shapes[0], ...shape });
      draft.workbench.shapes.push({ id: shape.id, open: false, window: { left: 80, top: 100, width: 288, height: 288 } });
      draft.artworkLayers.unshift(shape.id);
    }
    if (options.many) for (let i = 0; i < 18; i++) {
      const id = `shape:extra-${i}`;
      draft.shapes.push({ ...draft.shapes[0], id, name: `Landscape study ${i + 1}` });
      draft.workbench.shapes.push({ ...draft.workbench.shapes[0], id, open: false }); draft.artworkLayers.push(id);
    }
    if (options.shapeGrain !== undefined) draft.shapes[0].grain = options.shapeGrain;
    if (options.grouped) draft.artworkLayers = ['shape:landscape', 'text:mist', { id: 'composition:person', name: 'Person', children: ['image:body', 'image:eyes'] }];
    window.leaveEditor(); localStorage.setItem(systemWorkflowDraftKey(window.fixtureProfile), JSON.stringify(draft));
  }, options);
  await page.reload();
  await page.getByRole('button', { name: options.grouped ? 'Select Person' : 'Select Eyes', exact: true }).waitFor();
  await page.locator('[data-workbench-artwork]').first().waitFor();
}

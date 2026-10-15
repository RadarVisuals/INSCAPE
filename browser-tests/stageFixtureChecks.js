export async function stageFixtureChecks(publication) {
  const checks = [], assert = (ok, message) => { if (!ok) throw Error(message); checks.push(message); };
  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const until = async condition => { for (let n = 0; n < 240; n++) { if (condition()) return; await frame(); } throw Error('Timed out waiting for stage'); };
  const stage = document.querySelector('[data-bento-stage]'), composition = stage.querySelector('.profile-overview__grid');
  const overview = stage.closest('.profile-overview');
  const snapshot = () => { const r = stage.getBoundingClientRect(); return [r.x, r.y, r.width, r.height, overview.scrollHeight, overview.scrollTop]; };
  const same = before => snapshot().every((value, index) => Math.abs(value - before[index]) < 1);
  const within = (inner, outer) => inner.left >= outer.left - 1 && inner.top >= outer.top - 1 && inner.right <= outer.right + 1 && inner.bottom <= outer.bottom + 1;
  const layer = () => stage.querySelector('.bento-stage__expansion');
  const beforeDocument = JSON.stringify(publication);
  await until(() => composition.querySelector('[data-display-instance="display:primary"] [data-active-grid-id]'));
  const display = composition.querySelector('[data-display-instance="display:primary"]');
  if (display) {
    const initial = display.querySelector('[data-active-grid-id]').dataset.activeGridId;
    display.querySelector('[aria-label="Next Grid"]').click();
    await until(() => display.querySelector('[data-active-grid-id]').dataset.activeGridId !== initial);
  }
  const selected = display?.querySelector('[data-active-grid-id]')?.dataset.activeGridId;
  const cards = [...composition.querySelectorAll('.profile-overview__work')];
  for (const card of cards) {
    const before = snapshot();
    card.click(); await until(layer);
    let sampled = 0;
    while (layer().hasAttribute('data-artwork-lift')
      ? layer().style.getPropertyValue('--inspection-lift-progress') !== '1'
      : layer().getAnimations().some(animation => animation.playState === 'running')) {
      if (!same(before) || !within(layer().getBoundingClientRect(), stage.getBoundingClientRect())) throw Error('Opening escaped or moved the stage');
      sampled++; await frame();
    }
    assert(same(before), 'Opening preserves stage and page geometry');
    assert(within(layer().getBoundingClientRect(), stage.getBoundingClientRect()), 'Expanded panel stays inside all four edges');
    assert(!document.querySelector('dialog[open]'), 'No viewport modal');
    const sides = publication.imageModules?.find(item => card.href.includes(encodeURIComponent(item.id)))?.sides || [];
    for (let index = 0; index < Math.max(1, sides.length); index++) {
      await until(() => layer().querySelector('[data-fitted-artwork]') || layer().querySelector('.profile-work-viewer__article .text-document'));
      const fitted = layer().querySelector('[data-fitted-artwork]');
      if (fitted) {
        await frame();
        const media = layer().querySelector('.profile-work-viewer__media'), rect = fitted.getBoundingClientRect();
        const ratio = Number(fitted.style.getPropertyValue('--media-ratio'));
        assert(within(rect, media.getBoundingClientRect()), 'Full source fits available image area');
        assert(Math.abs(rect.width / rect.height - ratio) < .005, 'Native proportions retained');
        const body = layer().querySelector('.profile-work-viewer__body');
        assert(body.scrollHeight <= body.clientHeight + 1, 'Details cannot enlarge media or panel');
      }
      if (sides.length > 1) { layer().querySelector('[aria-label="Next side"]').click(); await frame(); }
    }
    const details = layer().querySelector('[aria-label="Artwork details"]');
    details.click(); await frame();
    assert(details.getAttribute('aria-pressed') === 'false', 'Details control works');
    details.click(); await frame();
    layer().querySelector('[aria-label="Return to card"]').click();
    await until(() => !layer() || layer().hasAttribute('data-closing'));
    while (layer()) {
      if (!same(before) || !within(layer().getBoundingClientRect(), stage.getBoundingClientRect())) throw Error('Closing escaped or moved the stage');
      await frame();
    }
    assert(same(before), 'Closing restores original stage and page geometry');
    assert(document.activeElement === card, 'Focus returns to source without scrolling');
    assert(composition.contains(display) && selected === display?.querySelector('[data-active-grid-id]')?.dataset.activeGridId, 'Display stays mounted on the same Grid');
    assert(sampled > 0 || matchMedia('(prefers-reduced-motion: reduce)').matches, 'Opening animation sampled');
  }
  // Reverse before arrival; source geometry and callbacks must remain valid.
  const before = snapshot(); cards[0].click(); await until(layer);
  for (let n = 0; n < 5; n++) layer().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await until(() => !layer());
  assert(same(before), 'Mid-animation Escape returns without a layout jump');
  assert(JSON.stringify(publication) === beforeDocument, 'Published data remains unchanged');
  return [...new Set(checks)].join(' · ') + ' — PASS';
}

// These interaction tests exercise geometry, not alpha picking. A known opaque
// source makes a centre pointer hit independent of the review illustration.
export async function routeOpaqueWorkflowArtwork(page) {
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 100;
    const context = canvas.getContext('2d'); context.fillStyle = '#2863c6'; context.fillRect(0, 0, 100, 100);
    context.fillStyle = '#ed3434'; context.fillRect(30, 30, 40, 40);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.route('**/assets/{actors/abyssal_eye/full,stage/mountains/mountain_02}.webp', route =>
    route.fulfill({ contentType: 'image/png', body: Buffer.from(png, 'base64') }));
}

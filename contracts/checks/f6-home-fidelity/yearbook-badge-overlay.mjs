// A29 — D3: the "EST. 1968" badge must be VISIBLE and geometrically
// overlaid on top of the yearbook image (not just present as a string
// somewhere in the DOM — A7/A8 only check source markup structure).
import { withPage, fail, pass } from './_shared.mjs';

await withPage({ width: 1440, height: 1200 }, async (page) => {
  const badge = page.getByText('EST. 1968', { exact: true }).first();
  if ((await badge.count()) === 0) fail('EST. 1968 badge not found in rendered DOM');

  const badgeDisplay = await badge.evaluate((e) => getComputedStyle(e).display);
  if (badgeDisplay === 'none') fail(`EST. 1968 badge computed display is "none"`);

  const badgeBox = await badge.boundingBox();
  if (!badgeBox || badgeBox.width === 0 || badgeBox.height === 0) {
    fail(`EST. 1968 badge bounding box is zero/null: ${JSON.stringify(badgeBox)}`);
  }

  const img = page.locator('img[src*="orchid-purple"]').first();
  if ((await img.count()) === 0) fail('yearbook image (orchid-purple.jpg) not found in rendered DOM');
  const imgBox = await img.boundingBox();
  if (!imgBox) fail('yearbook image has no bounding box (not rendered/visible)');

  // Badge must sit within the image's horizontal and vertical span, and
  // near its top edge (an overlay), not below/beside the photo.
  const withinX = badgeBox.x >= imgBox.x - 4 && badgeBox.x + badgeBox.width <= imgBox.x + imgBox.width + 4;
  const nearTop = badgeBox.y >= imgBox.y - 4 && badgeBox.y <= imgBox.y + imgBox.height * 0.35;

  if (!withinX || !nearTop) {
    fail(
      `EST. 1968 badge is not positioned as a top overlay on the image. badge=${JSON.stringify(badgeBox)} image=${JSON.stringify(imgBox)}`
    );
  }

  pass(`EST. 1968 badge visibly overlays the yearbook image — badge=${JSON.stringify(badgeBox)} image=${JSON.stringify(imgBox)}`);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CANONICAL_LATTICE_ARTBOARD,
  FRAME_IDS,
  LATTICE_COORDINATES,
  LATTICE_ENTRY_COORDINATE,
  MAX_TABLE_LABEL_OFFSET_CELLS,
  TABLE_VISIBILITY,
  TRANSPARENCY_MODES,
  createEmptyLatticeProfile,
  latticeCoordinateKey,
  latticeTableFallbackTitle,
  orderedTablePlacements,
  projectPublicIdentityPresentation,
  projectPublicLatticeProfile,
  stackedTablePlacements,
  tableDisplayTitle,
  validateLatticeProfile
} from './latticeProfile.js';

const PROFILE = '0x1111111111111111111111111111111111111111';

function placement(overrides = {}) {
  return {
    id: 'placement-a',
    stableAssetId: '42:0x2222222222222222222222222222222222222222:0x01',
    x: 0,
    y: 0,
    width: 0.25,
    height: 0.25,
    layer: 0,
    navigationOrder: 0,
    crop: null,
    frameId: FRAME_IDS.NONE,
    transparencyMode: TRANSPARENCY_MODES.AUTO,
    visitorVisible: true,
    ...overrides
  };
}

test('empty profiles always contain the complete 3 x 3 topology with a session-only center entry', () => {
  const profile = createEmptyLatticeProfile({ profileAddress: PROFILE, columns: 12, rows: 8 });
  assert.deepEqual(LATTICE_ENTRY_COORDINATE, { x: 0, y: 0 });
  assert.equal(profile.tables.length, 9);
  assert.deepEqual(profile.artboard, CANONICAL_LATTICE_ARTBOARD);
  assert.deepEqual(
    profile.tables.map((table) => latticeCoordinateKey(table.coordinate)),
    LATTICE_COORDINATES.map(latticeCoordinateKey)
  );
  assert.ok(profile.tables.every((table) => table.title === ''));
  assert.equal(Object.hasOwn(profile, 'activeTable'), false);
  assert.equal(Object.hasOwn(profile, 'activeCoordinate'), false);
  assert.equal(validateLatticeProfile(profile).valid, true);
});

test('TABLE 01 through TABLE 09 are display fallbacks and are never persisted as authored titles', () => {
  const profile = createEmptyLatticeProfile({ profileAddress: PROFILE, columns: 9, rows: 9 });
  assert.deepEqual(profile.tables.map((table) => tableDisplayTitle(table)), [
    'TABLE 01', 'TABLE 02', 'TABLE 03', 'TABLE 04', 'TABLE 05',
    'TABLE 06', 'TABLE 07', 'TABLE 08', 'TABLE 09'
  ]);
  profile.tables[4].title = '  CENTER ARCHIVE  ';
  assert.equal(tableDisplayTitle(profile.tables[4]), 'CENTER ARCHIVE');
  assert.equal(latticeTableFallbackTitle({ x: 4, y: 4 }), '');
});

test('visual grid dimensions remain caller-configurable while placement bounds belong to the canonical artboard', () => {
  const compact = createEmptyLatticeProfile({ profileAddress: PROFILE, columns: 4, rows: 3 });
  const expansive = createEmptyLatticeProfile({ profileAddress: PROFILE, columns: 37, rows: 19 });
  compact.tables[4].placements.push(placement({ x: 0.7, y: 0.7 }));
  expansive.tables[4].placements.push(placement({ x: 0.7, y: 0.7 }));
  assert.equal(validateLatticeProfile(compact).valid, true);
  assert.equal(validateLatticeProfile(expansive).valid, true);
  compact.tables[4].placements[0].x = 0.76;
  assert.ok(validateLatticeProfile(compact).errors.some((error) => error.code === 'invalid_placement_geometry'));
});

test('placement bounds are strict normalized free-artboard coordinates and the artboard is canonical 16:9', () => {
  const profile = createEmptyLatticeProfile({ profileAddress: PROFILE, columns: 32, rows: 18 });
  profile.tables[4].placements.push(placement({ x: 0.125, y: 0.25, width: 0.5, height: 0.5 }));
  assert.equal(validateLatticeProfile(profile).valid, true);

  for (const bounds of [
    { x: -0.01 }, { y: -0.01 }, { width: 0 }, { height: 0 },
    { x: 0.8, width: 0.21 }, { y: 0.8, height: 0.21 },
  ]) {
    profile.tables[4].placements[0] = placement(bounds);
    assert.ok(validateLatticeProfile(profile).errors.some((error) => error.code === 'invalid_placement_geometry'));
  }

  profile.tables[4].placements[0] = placement();
  profile.artboard = { aspectWidth: 4, aspectHeight: 3 };
  assert.ok(validateLatticeProfile(profile).errors.some((error) => error.code === 'invalid_artboard'));
});

test('stableAssetId must be canonical and crop values use the existing bounded crop model', () => {
  const profile = createEmptyLatticeProfile({ profileAddress: PROFILE, columns: 8, rows: 6 });
  profile.tables[4].placements.push(placement({ crop: { x: 0, y: 1, zoom: 4 } }));
  assert.equal(validateLatticeProfile(profile).valid, true);

  profile.tables[4].placements[0].stableAssetId = 'owned-asset-1';
  assert.ok(validateLatticeProfile(profile).errors.some((error) => error.code === 'invalid_asset_reference'));
  profile.tables[4].placements[0].stableAssetId = '42:0x2222222222222222222222222222222222222222:0x01';

  for (const crop of [
    { x: -0.01, y: 0.5, zoom: 1 },
    { x: 0.5, y: 1.01, zoom: 1 },
    { x: 0.5, y: 0.5, zoom: 0.99 },
    { x: 0.5, y: 0.5, zoom: 4.01 }
  ]) {
    profile.tables[4].placements[0].crop = crop;
    assert.ok(validateLatticeProfile(profile).errors.some((error) => error.code === 'invalid_crop'));
  }
  profile.tables[4].placements[0].crop = null;
  assert.equal(validateLatticeProfile(profile).valid, true);
});

test('label offsets use a named two-cell maximum and cannot exceed configured geometry', () => {
  const profile = createEmptyLatticeProfile({ profileAddress: PROFILE, columns: 8, rows: 6 });
  profile.tables[0].labelOffset = {
    column: MAX_TABLE_LABEL_OFFSET_CELLS,
    row: -MAX_TABLE_LABEL_OFFSET_CELLS
  };
  assert.equal(validateLatticeProfile(profile).valid, true);
  profile.tables[0].labelOffset.column = MAX_TABLE_LABEL_OFFSET_CELLS + 1;
  assert.ok(validateLatticeProfile(profile).errors.some((error) => error.code === 'invalid_label_offset'));

  const oneCell = createEmptyLatticeProfile({ profileAddress: PROFILE, columns: 1, rows: 1 });
  oneCell.tables[0].labelOffset = { column: 1, row: 0 };
  assert.ok(validateLatticeProfile(oneCell).errors.some((error) => error.code === 'invalid_label_offset'));
});

test('all nine coordinate slots are mandatory and cannot be duplicated or collapsed by visibility', () => {
  const missing = createEmptyLatticeProfile({ profileAddress: PROFILE, columns: 8, rows: 6 });
  missing.tables.pop();
  assert.ok(validateLatticeProfile(missing).errors.some((error) => error.code === 'invalid_table_count'));

  const duplicate = createEmptyLatticeProfile({ profileAddress: PROFILE, columns: 8, rows: 6 });
  duplicate.tables[8] = structuredClone(duplicate.tables[7]);
  assert.ok(validateLatticeProfile(duplicate).errors.some((error) => error.code === 'invalid_or_duplicate_coordinate'));

  const privateProfile = createEmptyLatticeProfile({ profileAddress: PROFILE, columns: 8, rows: 6 });
  privateProfile.tables[0].visibility = TABLE_VISIBILITY.PRIVATE;
  assert.equal(validateLatticeProfile(privateProfile).valid, true);
  assert.equal(projectPublicLatticeProfile(privateProfile).tables.length, 9);
});

test('private table projection preserves its slot while redacting authored labels and content', () => {
  const profile = createEmptyLatticeProfile({ profileAddress: PROFILE, columns: 8, rows: 6 });
  const privateTable = profile.tables[0];
  privateTable.visibility = TABLE_VISIBILITY.PRIVATE;
  privateTable.title = 'PRIVATE TITLE';
  privateTable.subtitle = 'PRIVATE SUBTITLE';
  privateTable.labelAnchor = 'bottom-right';
  privateTable.labelOffset = { column: 2, row: -2 };
  privateTable.placements.push(placement());

  const projected = projectPublicLatticeProfile(profile);
  assert.equal(projected.tables.length, 9);
  assert.deepEqual(projected.tables[0], {
    id: 'table-01',
    coordinate: { x: -1, y: -1 },
    title: '',
    subtitle: '',
    labelVisible: false,
    labelAnchor: 'top-left',
    labelOffset: { column: 0, row: 0 },
    visibility: TABLE_VISIBILITY.PRIVATE,
    placements: []
  });
  assert.equal(tableDisplayTitle(projected.tables[0]), '');
});

test('navigation order is explicit and independent from visual stacking order', () => {
  const table = createEmptyLatticeProfile({ profileAddress: PROFILE, columns: 8, rows: 6 }).tables[4];
  table.placements = [
    placement({ id: 'a', navigationOrder: 2, layer: 0 }),
    placement({ id: 'b', navigationOrder: 0, layer: 2 }),
    placement({ id: 'c', navigationOrder: 1, layer: 1, visitorVisible: false })
  ];
  assert.deepEqual(orderedTablePlacements(table).map(({ id }) => id), ['b', 'c', 'a']);
  assert.deepEqual(stackedTablePlacements(table).map(({ id }) => id), ['a', 'c', 'b']);
  assert.deepEqual(orderedTablePlacements(table, { publicOnly: true }).map(({ id }) => id), ['b', 'a']);

  table.placements[2].navigationOrder = 0;
  assert.ok(validateLatticeProfile({
    ...createEmptyLatticeProfile({ profileAddress: PROFILE, columns: 8, rows: 6 }),
    tables: createEmptyLatticeProfile({ profileAddress: PROFILE, columns: 8, rows: 6 }).tables.map((entry, index) => index === 4 ? table : entry)
  }).errors.some((error) => error.code === 'duplicate_navigation_order'));
});

test('frames and transparency are controlled independent dimensions', () => {
  const profile = createEmptyLatticeProfile({ profileAddress: PROFILE, columns: 8, rows: 6 });
  profile.tables[4].placements = [
    placement({ id: 'none-alpha', navigationOrder: 0, frameId: FRAME_IDS.NONE, transparencyMode: TRANSPARENCY_MODES.PRESERVE_ALPHA }),
    placement({ id: 'dossier-opaque', navigationOrder: 1, frameId: FRAME_IDS.DOSSIER, transparencyMode: TRANSPARENCY_MODES.OPAQUE }),
    placement({ id: 'caption-auto', navigationOrder: 2, frameId: FRAME_IDS.CAPTION, transparencyMode: TRANSPARENCY_MODES.AUTO })
  ];
  assert.equal(validateLatticeProfile(profile).valid, true);
  profile.tables[4].placements[0].frameId = 'POLAROID';
  assert.ok(validateLatticeProfile(profile).errors.some((error) => error.code === 'unknown_frame'));
});

test('official identity fields cannot enter the editable INSCAPE identity presentation', () => {
  const profile = createEmptyLatticeProfile({ profileAddress: PROFILE, columns: 8, rows: 6 });
  profile.identityPresentation.alias = 'RESIDENT ZERO';
  profile.identityPresentation.bio = { mode: 'inscape', customText: 'Authored overlay copy.' };
  assert.equal(validateLatticeProfile(profile).valid, true);

  profile.identityPresentation.officialHandle = '@immutable';
  assert.ok(validateLatticeProfile(profile).errors.some((error) => error.code === 'invalid_identity_presentation'));
  delete profile.identityPresentation.officialHandle;
  profile.officialIdentity = { name: 'Must remain externally resolved' };
  assert.ok(validateLatticeProfile(profile).errors.some((error) => error.code === 'invalid_profile_structure'));
});

test('public identity projection redacts every inactive editable identity value', () => {
  const identity = createEmptyLatticeProfile({ profileAddress: PROFILE, columns: 8, rows: 6 }).identityPresentation;
  identity.avatar = {
    mode: 'official',
    assetReference: '42:0x3333333333333333333333333333333333333333:0x02',
    shape: 'round'
  };
  identity.bio = { mode: 'hidden', customText: 'PRIVATE DRAFT BIO' };
  const projected = projectPublicIdentityPresentation(identity);
  assert.equal(projected.avatar.assetReference, null);
  assert.equal(projected.bio.customText, '');

  identity.bio = { mode: 'official', customText: 'INACTIVE CUSTOM BIO' };
  assert.equal(projectPublicIdentityPresentation(identity).bio.customText, '');

  identity.avatar.mode = 'inscape';
  identity.bio = { mode: 'inscape', customText: 'ACTIVE PUBLIC BIO' };
  const active = projectPublicIdentityPresentation(identity);
  assert.equal(active.avatar.assetReference, '42:0x3333333333333333333333333333333333333333:0x02');
  assert.equal(active.bio.customText, 'ACTIVE PUBLIC BIO');
});

test('full public projection applies inactive identity redaction without mutating the draft', () => {
  const profile = createEmptyLatticeProfile({ profileAddress: PROFILE, columns: 8, rows: 6 });
  profile.identityPresentation.avatar.assetReference = '42:0x3333333333333333333333333333333333333333:0x02';
  profile.identityPresentation.bio = { mode: 'hidden', customText: 'LOCAL ONLY' };
  const projected = projectPublicLatticeProfile(profile);
  assert.equal(projected.identityPresentation.avatar.assetReference, null);
  assert.equal(projected.identityPresentation.bio.customText, '');
  assert.equal(profile.identityPresentation.avatar.assetReference, '42:0x3333333333333333333333333333333333333333:0x02');
  assert.equal(profile.identityPresentation.bio.customText, 'LOCAL ONLY');
});

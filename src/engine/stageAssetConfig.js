export function didBackgroundPatternConfigurationChange(currentRig, nextRig) {
  return !currentRig ||
    currentRig.keys.bg_pat_1 !== nextRig.keys.bg_pat_1 ||
    currentRig.keys.bg_pat_2 !== nextRig.keys.bg_pat_2 ||
    currentRig.hasBgPat1 !== nextRig.hasBgPat1 ||
    currentRig.hasBgPat2 !== nextRig.hasBgPat2;
}

export function didStageAssetConfigurationChange(currentRig, nextRig) {
  return !currentRig ||
    currentRig.keys.bg_clipping_mask !== nextRig.keys.bg_clipping_mask ||
    didBackgroundPatternConfigurationChange(currentRig, nextRig) ||
    currentRig.keys.bg_mountain !== nextRig.keys.bg_mountain ||
    currentRig.keys.bg_mountain_back !== nextRig.keys.bg_mountain_back ||
    currentRig.isPanoramaMode !== nextRig.isPanoramaMode;
}

export function didActorAssetConfigurationChange(currentRig, nextRig) {
  return !currentRig ||
    currentRig.keys.char_clipping_mask !== nextRig.keys.char_clipping_mask;
}

export function getAssetReloadScope(currentRig, nextRig) {
  return {
    actorChanged: didActorAssetConfigurationChange(currentRig, nextRig),
    backgroundPatternChanged: didBackgroundPatternConfigurationChange(currentRig, nextRig),
    stageChanged: didStageAssetConfigurationChange(currentRig, nextRig)
  };
}

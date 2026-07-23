import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import CategoryNavigationCard from './CategoryNavigationCard.jsx';
import GalleryNavigationCard from './GalleryNavigationCard.jsx';
import ProfileIdentityCard from './ProfileIdentityCard.jsx';
import { PROFILE_IDENTITY_CARD_STATE } from './profileIdentityCardModel.js';
import './profileNavigationDock.css';

const CategoryAssetBrowser = lazy(() => import('./CategoryAssetBrowser.jsx'));
const CreationsBrowser = lazy(() => import('./CreationsBrowser.jsx'));
const ActivityBrowser = lazy(() => import('./ActivityBrowser.jsx'));
const AssetIndex = lazy(() => import('./AssetIndex.jsx'));
const SettingsBrowser = lazy(() => import('./SettingsBrowser.jsx'));

export default function ProfileNavigationDock({
  profile,
  profileExpanded,
  onProfileExpandedChange,
  categories = [],
  assetStatus = 'ready',
  onCategoriesOpenChange,
  creations = null,
  activity = null,
  gallery = null,
  spatialWorldActive = false,
  ownerIndex = null
}) {
  const [profileState, setProfileState] = useState(PROFILE_IDENTITY_CARD_STATE.AVATAR);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [browserActivated, setBrowserActivated] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [creationsOpen, setCreationsOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [indexOpen, setIndexOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const onCategoriesOpenChangeRef = useRef(onCategoriesOpenChange);
  const onCreationsOpenChangeRef = useRef(creations?.onOpenChange);
  const onActivityOpenChangeRef = useRef(activity?.onOpenChange);
  const onIndexOpenChangeRef = useRef(ownerIndex?.onOpenChange);
  const onGalleryOpenChangeRef = useRef(gallery?.onOpenChange);
  onCategoriesOpenChangeRef.current = onCategoriesOpenChange;
  onCreationsOpenChangeRef.current = creations?.onOpenChange;
  onActivityOpenChangeRef.current = activity?.onOpenChange;
  onIndexOpenChangeRef.current = ownerIndex?.onOpenChange;
  onGalleryOpenChangeRef.current = gallery?.onOpenChange;
  const navigationVisible = profileState !== PROFILE_IDENTITY_CARD_STATE.AVATAR;
  const effectiveCreationsOpen = creations?.open ?? creationsOpen;
  const effectiveActivityOpen = activity?.open ?? activityOpen;
  const effectiveIndexOpen = ownerIndex?.open ?? indexOpen;
  const effectiveGalleryOpen = gallery?.open ?? galleryOpen;
  const effectiveCreationsOpenRef = useRef(effectiveCreationsOpen);
  const effectiveActivityOpenRef = useRef(effectiveActivityOpen);
  const effectiveIndexOpenRef = useRef(effectiveIndexOpen);
  const effectiveGalleryOpenRef = useRef(effectiveGalleryOpen);
  const settingsOpenRef = useRef(settingsOpen);
  effectiveCreationsOpenRef.current = effectiveCreationsOpen;
  effectiveActivityOpenRef.current = effectiveActivityOpen;
  effectiveIndexOpenRef.current = effectiveIndexOpen;
  effectiveGalleryOpenRef.current = effectiveGalleryOpen;
  settingsOpenRef.current = settingsOpen;
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) || null;

  useEffect(() => {
    setSelectedCategoryId((current) => categories.some((category) => category.id === current)
      ? current
      : null);
  }, [categories]);

  const handleIndexOpenChange = useCallback((expanded) => {
    setIndexOpen(expanded);
    if (expanded) {
      setCategoriesExpanded(false);
      setSelectedCategoryId(null);
      if (effectiveCreationsOpenRef.current) {
        setCreationsOpen(false);
        onCreationsOpenChangeRef.current?.(false);
      }
      if (effectiveActivityOpenRef.current) {
        setActivityOpen(false);
        onActivityOpenChangeRef.current?.(false);
      }
      if (settingsOpenRef.current) setSettingsOpen(false);
      if (effectiveGalleryOpenRef.current) {
        setGalleryOpen(false);
        onGalleryOpenChangeRef.current?.(false);
      }
    }
    onIndexOpenChangeRef.current?.(expanded);
  }, []);

  const handleCreationsOpenChange = useCallback((expanded) => {
    setCreationsOpen(expanded);
    if (expanded) {
      setCategoriesExpanded(false);
      setSelectedCategoryId(null);
      if (effectiveIndexOpenRef.current) handleIndexOpenChange(false);
      if (effectiveActivityOpenRef.current) {
        setActivityOpen(false);
        onActivityOpenChangeRef.current?.(false);
      }
      if (settingsOpenRef.current) setSettingsOpen(false);
      if (effectiveGalleryOpenRef.current) {
        setGalleryOpen(false);
        onGalleryOpenChangeRef.current?.(false);
      }
    }
    onCreationsOpenChangeRef.current?.(expanded);
  }, [handleIndexOpenChange]);

  const handleActivityOpenChange = useCallback((expanded) => {
    setActivityOpen(expanded);
    if (expanded) {
      setCategoriesExpanded(false);
      setSelectedCategoryId(null);
      if (effectiveCreationsOpenRef.current) handleCreationsOpenChange(false);
      if (effectiveIndexOpenRef.current) handleIndexOpenChange(false);
      if (settingsOpenRef.current) setSettingsOpen(false);
      if (effectiveGalleryOpenRef.current) {
        setGalleryOpen(false);
        onGalleryOpenChangeRef.current?.(false);
      }
    }
    onActivityOpenChangeRef.current?.(expanded);
  }, [handleCreationsOpenChange, handleIndexOpenChange]);

  const handleGalleryOpenChange = useCallback((expanded) => {
    setGalleryOpen(expanded);
    if (expanded) {
      setCategoriesExpanded(false);
      setSelectedCategoryId(null);
      if (effectiveCreationsOpenRef.current) handleCreationsOpenChange(false);
      if (effectiveActivityOpenRef.current) handleActivityOpenChange(false);
      if (effectiveIndexOpenRef.current) handleIndexOpenChange(false);
      if (settingsOpenRef.current) setSettingsOpen(false);
    }
    onGalleryOpenChangeRef.current?.(expanded);
  }, [handleActivityOpenChange, handleCreationsOpenChange, handleIndexOpenChange]);

  const handleCategoriesExpandedChange = useCallback((expanded) => {
    setCategoriesExpanded(expanded);
    if (!expanded) setSelectedCategoryId(null);
    if (expanded && effectiveIndexOpenRef.current) handleIndexOpenChange(false);
    if (expanded && effectiveCreationsOpenRef.current) handleCreationsOpenChange(false);
    if (expanded && effectiveActivityOpenRef.current) handleActivityOpenChange(false);
    if (expanded && settingsOpenRef.current) setSettingsOpen(false);
    if (expanded && effectiveGalleryOpenRef.current) handleGalleryOpenChange(false);
    onCategoriesOpenChangeRef.current?.(expanded);
  }, [handleActivityOpenChange, handleCreationsOpenChange, handleGalleryOpenChange, handleIndexOpenChange]);

  useEffect(() => {
    if (!navigationVisible && effectiveIndexOpen) handleIndexOpenChange(false);
  }, [effectiveIndexOpen, handleIndexOpenChange, navigationVisible]);

  useEffect(() => {
    if (!navigationVisible && effectiveCreationsOpen) handleCreationsOpenChange(false);
  }, [effectiveCreationsOpen, handleCreationsOpenChange, navigationVisible]);

  useEffect(() => {
    if (!navigationVisible && effectiveActivityOpen) handleActivityOpenChange(false);
  }, [effectiveActivityOpen, handleActivityOpenChange, navigationVisible]);

  useEffect(() => {
    if (!navigationVisible && settingsOpen) setSettingsOpen(false);
  }, [navigationVisible, settingsOpen]);

  const handleSettingsOpenChange = useCallback((expanded) => {
    setSettingsOpen(expanded);
    if (!expanded) return;
    setCategoriesExpanded(false);
    setSelectedCategoryId(null);
    if (effectiveCreationsOpenRef.current) handleCreationsOpenChange(false);
    if (effectiveActivityOpenRef.current) handleActivityOpenChange(false);
    if (effectiveIndexOpenRef.current) handleIndexOpenChange(false);
    if (effectiveGalleryOpenRef.current) handleGalleryOpenChange(false);
  }, [handleActivityOpenChange, handleCreationsOpenChange, handleGalleryOpenChange, handleIndexOpenChange]);

  const selectCategory = useCallback((category) => {
    setSelectedCategoryId((current) => current === category.id ? null : category.id);
    setBrowserActivated(true);
  }, []);

  return <aside
    className="profile-navigation-dock"
    data-profile-state={profileState}
    aria-label="Profile navigation"
  >
    <ProfileIdentityCard
      profile={profile}
      expanded={profileExpanded}
      collapseToAvatar={effectiveGalleryOpen || spatialWorldActive}
      onExpandedChange={onProfileExpandedChange}
      onStateChange={setProfileState}
    />
    <CategoryNavigationCard
      items={categories}
      activeId={selectedCategoryId}
      visible={navigationVisible}
      onSelect={selectCategory}
      onExpandedChange={handleCategoriesExpandedChange}
      collapseRequested={effectiveIndexOpen || effectiveCreationsOpen || effectiveActivityOpen || effectiveGalleryOpen || settingsOpen}
    />
    {creations?.profileAddress && <Suspense fallback={null}><CreationsBrowser
      visible={navigationVisible}
      open={effectiveCreationsOpen}
      onOpenChange={handleCreationsOpenChange}
      profileAddress={creations.profileAddress}
    /></Suspense>}
    {activity?.profileAddress && <Suspense fallback={null}><ActivityBrowser
      visible={navigationVisible}
      open={effectiveActivityOpen}
      onOpenChange={handleActivityOpenChange}
      profileAddress={activity.profileAddress}
    /></Suspense>}
    {ownerIndex && <Suspense fallback={null}><AssetIndex
      visible={navigationVisible}
      open={effectiveIndexOpen}
      onOpenChange={handleIndexOpenChange}
      profileName={profile?.name}
    /></Suspense>}
    {gallery && <GalleryNavigationCard
      visible={navigationVisible}
      open={effectiveGalleryOpen}
      onOpenChange={handleGalleryOpenChange}
    />}
    {ownerIndex && <Suspense fallback={null}><SettingsBrowser
      visible={navigationVisible}
      open={settingsOpen}
      onOpenChange={handleSettingsOpenChange}
    /></Suspense>}
    {browserActivated && <Suspense fallback={null}>
      <CategoryAssetBrowser
        open={navigationVisible && categoriesExpanded && Boolean(selectedCategory)}
        category={selectedCategory}
        status={assetStatus}
      />
    </Suspense>}
  </aside>;
}

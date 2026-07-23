import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import CategoryNavigationCard from './CategoryNavigationCard.jsx';
import ProfileIdentityCard from './ProfileIdentityCard.jsx';
import { PROFILE_IDENTITY_CARD_STATE } from './profileIdentityCardModel.js';
import './profileNavigationDock.css';

const CategoryAssetBrowser = lazy(() => import('./CategoryAssetBrowser.jsx'));
const CreationsBrowser = lazy(() => import('./CreationsBrowser.jsx'));
const ActivityBrowser = lazy(() => import('./ActivityBrowser.jsx'));
const AssetIndex = lazy(() => import('./AssetIndex.jsx'));

export default function ProfileNavigationDock({
  profile,
  profileExpanded,
  onProfileExpandedChange,
  categories = [],
  assetStatus = 'ready',
  onCategoriesOpenChange,
  creations = null,
  activity = null,
  ownerIndex = null
}) {
  const [profileState, setProfileState] = useState(PROFILE_IDENTITY_CARD_STATE.AVATAR);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [browserActivated, setBrowserActivated] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [creationsOpen, setCreationsOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [indexOpen, setIndexOpen] = useState(false);
  const onCategoriesOpenChangeRef = useRef(onCategoriesOpenChange);
  const onCreationsOpenChangeRef = useRef(creations?.onOpenChange);
  const onActivityOpenChangeRef = useRef(activity?.onOpenChange);
  const onIndexOpenChangeRef = useRef(ownerIndex?.onOpenChange);
  onCategoriesOpenChangeRef.current = onCategoriesOpenChange;
  onCreationsOpenChangeRef.current = creations?.onOpenChange;
  onActivityOpenChangeRef.current = activity?.onOpenChange;
  onIndexOpenChangeRef.current = ownerIndex?.onOpenChange;
  const navigationVisible = profileState !== PROFILE_IDENTITY_CARD_STATE.AVATAR;
  const effectiveCreationsOpen = creations?.open ?? creationsOpen;
  const effectiveActivityOpen = activity?.open ?? activityOpen;
  const effectiveIndexOpen = ownerIndex?.open ?? indexOpen;
  const effectiveCreationsOpenRef = useRef(effectiveCreationsOpen);
  const effectiveActivityOpenRef = useRef(effectiveActivityOpen);
  const effectiveIndexOpenRef = useRef(effectiveIndexOpen);
  effectiveCreationsOpenRef.current = effectiveCreationsOpen;
  effectiveActivityOpenRef.current = effectiveActivityOpen;
  effectiveIndexOpenRef.current = effectiveIndexOpen;
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
    }
    onActivityOpenChangeRef.current?.(expanded);
  }, [handleCreationsOpenChange, handleIndexOpenChange]);

  const handleCategoriesExpandedChange = useCallback((expanded) => {
    setCategoriesExpanded(expanded);
    if (!expanded) setSelectedCategoryId(null);
    if (expanded && effectiveIndexOpenRef.current) handleIndexOpenChange(false);
    if (expanded && effectiveCreationsOpenRef.current) handleCreationsOpenChange(false);
    if (expanded && effectiveActivityOpenRef.current) handleActivityOpenChange(false);
    onCategoriesOpenChangeRef.current?.(expanded);
  }, [handleActivityOpenChange, handleCreationsOpenChange, handleIndexOpenChange]);

  useEffect(() => {
    if (!navigationVisible && effectiveIndexOpen) handleIndexOpenChange(false);
  }, [effectiveIndexOpen, handleIndexOpenChange, navigationVisible]);

  useEffect(() => {
    if (!navigationVisible && effectiveCreationsOpen) handleCreationsOpenChange(false);
  }, [effectiveCreationsOpen, handleCreationsOpenChange, navigationVisible]);

  useEffect(() => {
    if (!navigationVisible && effectiveActivityOpen) handleActivityOpenChange(false);
  }, [effectiveActivityOpen, handleActivityOpenChange, navigationVisible]);

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
      onExpandedChange={onProfileExpandedChange}
      onStateChange={setProfileState}
    />
    <CategoryNavigationCard
      items={categories}
      activeId={selectedCategoryId}
      visible={navigationVisible}
      onSelect={selectCategory}
      onExpandedChange={handleCategoriesExpandedChange}
      collapseRequested={effectiveIndexOpen || effectiveCreationsOpen || effectiveActivityOpen}
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
    {browserActivated && <Suspense fallback={null}>
      <CategoryAssetBrowser
        open={navigationVisible && categoriesExpanded && Boolean(selectedCategory)}
        category={selectedCategory}
        status={assetStatus}
      />
    </Suspense>}
  </aside>;
}

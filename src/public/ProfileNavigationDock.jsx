import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import CategoryNavigationCard from './CategoryNavigationCard.jsx';
import ProfileIdentityCard from './ProfileIdentityCard.jsx';
import { PROFILE_IDENTITY_CARD_STATE } from './profileIdentityCardModel.js';
import './profileNavigationDock.css';

const CategoryAssetBrowser = lazy(() => import('./CategoryAssetBrowser.jsx'));
const AssetIndex = lazy(() => import('./AssetIndex.jsx'));

export default function ProfileNavigationDock({
  profile,
  profileExpanded,
  onProfileExpandedChange,
  categories = [],
  assetStatus = 'ready',
  onCategoriesOpenChange,
  ownerIndex = null
}) {
  const [profileState, setProfileState] = useState(PROFILE_IDENTITY_CARD_STATE.AVATAR);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [browserActivated, setBrowserActivated] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [indexOpen, setIndexOpen] = useState(false);
  const onCategoriesOpenChangeRef = useRef(onCategoriesOpenChange);
  const onIndexOpenChangeRef = useRef(ownerIndex?.onOpenChange);
  onCategoriesOpenChangeRef.current = onCategoriesOpenChange;
  onIndexOpenChangeRef.current = ownerIndex?.onOpenChange;
  const navigationVisible = profileState !== PROFILE_IDENTITY_CARD_STATE.AVATAR;
  const effectiveIndexOpen = ownerIndex?.open ?? indexOpen;
  const effectiveIndexOpenRef = useRef(effectiveIndexOpen);
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
    }
    onIndexOpenChangeRef.current?.(expanded);
  }, []);

  const handleCategoriesExpandedChange = useCallback((expanded) => {
    setCategoriesExpanded(expanded);
    if (!expanded) setSelectedCategoryId(null);
    if (expanded && effectiveIndexOpenRef.current) handleIndexOpenChange(false);
    onCategoriesOpenChangeRef.current?.(expanded);
  }, [handleIndexOpenChange]);

  useEffect(() => {
    if (!navigationVisible && effectiveIndexOpen) handleIndexOpenChange(false);
  }, [effectiveIndexOpen, handleIndexOpenChange, navigationVisible]);

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
      collapseRequested={effectiveIndexOpen}
    />
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

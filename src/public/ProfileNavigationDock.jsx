import { useState } from 'react';
import CategoryNavigationCard from './CategoryNavigationCard.jsx';
import ProfileIdentityCard from './ProfileIdentityCard.jsx';
import { PROFILE_IDENTITY_CARD_STATE } from './profileIdentityCardModel.js';
import './profileNavigationDock.css';

export default function ProfileNavigationDock({
  profile,
  profileExpanded,
  onProfileExpandedChange,
  categories = [],
  activeCategoryId = null,
  onCategorySelect
}) {
  const [profileState, setProfileState] = useState(PROFILE_IDENTITY_CARD_STATE.AVATAR);
  const navigationVisible = profileState !== PROFILE_IDENTITY_CARD_STATE.AVATAR;

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
      activeId={activeCategoryId}
      visible={navigationVisible}
      onSelect={onCategorySelect}
    />
  </aside>;
}

import { getIdentityProfileViewModel } from './identity/profileViewModel.js';

const profile = getIdentityProfileViewModel();

export default function IdentityWindow() {
  return (
    <div className="identity-profile">
      <div className="identity-profile__status" aria-label="Profile classification">
        <span aria-hidden="true" /> Resident identity / local specimen
      </div>

      <div className="identity-profile__heading">
        <div className="identity-profile__sigil" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div>
          <p className="identity-profile__eyebrow">Known as</p>
          <h2>{profile.name}</h2>
          <p className="identity-profile__address">{profile.address}</p>
        </div>
      </div>

      <p className="identity-profile__description">{profile.description}</p>

      <ul className="identity-profile__tags" aria-label="Profile tags">
        {profile.tags.map((tag) => <li key={tag}>{tag}</li>)}
      </ul>

      <dl className="identity-profile__stats">
        {profile.stats.map((stat) => (
          <div key={stat.label}>
            <dt>{stat.label}</dt>
            <dd>{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="identity-profile__actions">
        <div className="identity-profile__wallet">
          <span className="status-mark" aria-hidden="true" />
          <span>
            <small>Wallet status</small>
            {profile.wallet.label}
          </span>
        </div>
        <button
          type="button"
          disabled={profile.followAction.disabled}
          aria-describedby="follow-explanation"
        >
          {profile.followAction.label}
        </button>
      </div>
      <p id="follow-explanation" className="identity-profile__disclaimer">
        {profile.followAction.explanation}
      </p>
    </div>
  );
}

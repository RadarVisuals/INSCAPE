import './startveil.css';

export default function ProfileSignIn({ onConnect }) {
  return <main className="profile-sign-in" aria-label="Sign in to Inscape">
    <button type="button" onClick={onConnect}>Connect profile</button>
  </main>;
}

import { navigateTo } from './navigation';
import { useAuth } from './auth/AuthContext';

export function AuthControls() {
  const { signOut, user } = useAuth();
  const accountLabel = user
    ? user.role === 'ADMIN'
      ? 'Admin account'
      : 'Member account'
    : 'Signed-in account';

  return (
    <div className="maison-auth-controls">
      <a
        href="/purchases"
        aria-label="Purchase history"
        className="maison-link maison-auth-controls__history"
      >
        History
      </a>
      <span className="maison-auth-controls__account">{accountLabel}</span>
      <button
        type="button"
        onClick={() => {
          signOut();
          navigateTo('/inventory');
        }}
        className="maison-button maison-button--quiet maison-auth-controls__logout"
      >
        Log out
      </button>
    </div>
  );
}

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
    <div className="flex items-center gap-4">
      <a
        href="/purchases"
        aria-label="Purchase history"
        className="hidden text-xs font-semibold uppercase tracking-[0.14em] underline decoration-[#E56B45] decoration-2 underline-offset-8 transition-colors hover:text-[#E56B45] sm:inline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E56B45]"
      >
        History
      </a>
      <span className="hidden text-xs font-semibold uppercase tracking-[0.16em] text-[#171717]/55 sm:block">
        {accountLabel}
      </span>
      <button
        type="button"
        onClick={() => {
          signOut();
          navigateTo('/inventory');
        }}
        className="rounded-full border border-[#171717]/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors duration-200 hover:border-[#171717] hover:bg-[#171717] hover:text-[#F4F1EA] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E56B45]"
      >
        Log out
      </button>
    </div>
  );
}

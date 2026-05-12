import { login, logout } from './auth.js';

const LOGIN_CARD_ID = 'auth-login-card';

export function renderLoginCard(workspaceEl) {
  if (document.getElementById(LOGIN_CARD_ID)) return;

  const card = document.createElement('div');
  card.id = LOGIN_CARD_ID;
  card.className = 'auth-login-card';
  card.innerHTML = `
    <div class="auth-card-inner">
      <svg class="auth-adobe-logo" viewBox="0 0 30 26" aria-label="Adobe">
        <polygon fill="#EB1000" points="19,0 30,26 23.5,26"/>
        <polygon fill="#EB1000" points="11,0 0,26 6.5,26"/>
        <polygon fill="#EB1000" points="15,9.5 21.5,26 17,26 14.5,19.5 10,26 8.5,26"/>
      </svg>
      <h2 class="auth-card-title">Enterprise Architecture Model</h2>
      <p class="auth-card-desc">Sign in with your Adobe ID to access the architecture graph.</p>
      <button class="auth-signin-btn" type="button">Sign in with Adobe</button>
    </div>
  `;

  card.querySelector('.auth-signin-btn').addEventListener('click', login);
  workspaceEl.classList.add('auth-gated');
  workspaceEl.prepend(card);
}

export function removeLoginCard() {
  const card = document.getElementById(LOGIN_CARD_ID);
  card?.closest('.workspace')?.classList.remove('auth-gated');
  card?.remove();
}

export function hideTopbarControls() {
  document.querySelector('.account-picker')?.classList.add('auth-hidden');
  document.querySelector('.topbar-center')?.classList.add('auth-hidden');
  document.getElementById('completeness')?.classList.add('auth-hidden');
}

export function showTopbarControls() {
  document.querySelector('.account-picker')?.classList.remove('auth-hidden');
  document.querySelector('.topbar-center')?.classList.remove('auth-hidden');
  document.getElementById('completeness')?.classList.remove('auth-hidden');
}

export function renderUserBadge(topbarRightEl, profile) {
  if (!topbarRightEl || !profile) return;

  const name = profile.name || profile.email || profile.sub || 'User';
  const badge = document.createElement('div');
  badge.className = 'auth-user-badge';
  badge.innerHTML = `
    <span class="auth-user-name">${name}</span>
    <button class="auth-logout-btn" type="button" title="Sign out" aria-label="Sign out">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M11 11l3-3-3-3M6 8h8"
          fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  `;

  badge.querySelector('.auth-logout-btn').addEventListener('click', logout);
  topbarRightEl.appendChild(badge);
}

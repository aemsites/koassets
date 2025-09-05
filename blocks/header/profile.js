function createProfileModal() {
  const modal = document.createElement('div');
  modal.id = 'profile-modal';
  modal.className = 'profile-modal';

  modal.innerHTML = `
    <div class="profile-modal-content">
      <button class="profile-modal-close" type="button">&times;</button>
      <div class="profile-header">
        <h1>My Profile</h1>
      </div>
      <div class="profile-info">
        <div class="profile-field">
          <label>NAME</label>
          <div class="profile-value" id="profile-name">${window.user?.name || ''}</div>
        </div>
        <div class="profile-field">
          <label>EMAIL</label>
          <div class="profile-value" id="profile-email">${window.user?.email || ''}</div>
        </div>
        <div class="profile-field">
          <label>COUNTRY</label>
          <div class="profile-value" id="profile-country">${window.user?.country || ''}</div>
        </div>
      </div>
      <div class="notifications-section">
        <h2>Notifications</h2>
        <div class="notification-item">
          <span>Collection Notification</span>
          <label class="switch">
            <input type="checkbox" checked="">
            <span class="slider round"></span>
          </label>
        </div>
        <div class="notification-item">
          <span>Print Job Notification</span>
          <label class="switch">
            <input type="checkbox" checked="">
            <span class="slider round"></span>
          </label>
        </div>
        <div class="notification-item">
          <span>Rights Request Notification</span>
          <label class="switch">
            <input type="checkbox" checked="">
            <span class="slider round"></span>
          </label>
        </div>
      </div>
      <div class="profile-actions">
        <button class="save-button" type="button">Save</button>
      </div>
    </div>
  `;

  return modal;
}

function hideProfileModal() {
  const modal = document.getElementById('profile-modal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

export default function showProfileModal() {
  // Create modal if it doesn't exist
  let modal = document.getElementById('profile-modal');
  if (!modal) {
    modal = createProfileModal();
    document.body.appendChild(modal);

    // Add event listeners
    const closeBtn = modal.querySelector('.profile-modal-close');
    closeBtn.addEventListener('click', hideProfileModal);

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        hideProfileModal();
      }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        hideProfileModal();
      }
    });
  }

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

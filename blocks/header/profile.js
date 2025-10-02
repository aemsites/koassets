// Cookie utility functions
function setCookie(name, value, days = 365) {
  const expires = new Date();
  expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/`;
}

function removeCookie(name) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
}

function createProfileModal() {
  const modal = document.createElement('div');
  modal.id = 'profile-modal';
  modal.className = 'profile-modal';

  const canSudo = window.user?.canSudo === true;

  // Add sudo-mode class if user can sudo
  if (canSudo) {
    modal.classList.add('sudo-mode');
  }

  // Get current values from cookies or user object
  const currentName = window.user?.name || '';
  const currentEmail = window.user?.email || '';
  const currentCountry = window.user?.country || '';
  const currentUserType = window.user?.usertype || '';

  modal.innerHTML = `
    <div class="profile-modal-content">
      <button class="profile-modal-close" type="button">&times;</button>
      <div class="profile-header">
        <h1>My Profile</h1>
      </div>
      <div class="profile-info">
        ${window.user?.su ? `
        <div class="profile-field">
          <label>LOGGED IN USER</label>
          <div class="profile-value" id="profile-sudo">${window.user?.su?.email || ''}</div>
        </div>
         ` : ''}
         <div class="user-fields-group ${window.user?.su ? 'impersonating' : ''}">
           ${window.user?.su ? `
           <div class="simulating-title">SIMULATING USER</div>
           ` : ''}
           <div class="profile-field">
             <label>NAME</label>
             <div class="profile-value" id="profile-name">${currentName}</div>
             ${canSudo ? `<input type="text" class="profile-input" id="profile-name-input" value="${currentName}" style="display: none;">` : ''}
           </div>
           <div class="profile-field">
             <label>EMAIL</label>
             <div class="profile-value" id="profile-email">${currentEmail}</div>
             ${canSudo ? `<input type="email" class="profile-input" id="profile-email-input" value="${currentEmail}" style="display: none;">` : ''}
           </div>
           <div class="profile-field">
             <label>COUNTRY</label>
             <div class="profile-value" id="profile-country">${currentCountry}</div>
             ${canSudo ? `<input type="text" class="profile-input" id="profile-country-input" value="${currentCountry}" style="display: none;">` : ''}
           </div>
           ${window.user?.su || canSudo ? `
           <div class="profile-field" id="usertype-field" style="${!window.user?.su ? 'display: none;' : ''}">
             <label>USER TYPE (In Microsoft Directory)</label>
             <div class="profile-value" id="profile-usertype">${currentUserType}</div>
             <div class="profile-usertype-dropdown" id="profile-usertype-dropdown" style="display: none;">
               <select class="profile-input" id="profile-usertype-select">
                 <option value="" ${currentUserType === '' ? 'selected' : ''}>Select user type...</option>
                 <option value="10" ${currentUserType === '10' ? 'selected' : ''}>Employee - 10</option>
                 <option value="11" ${currentUserType === '11' ? 'selected' : ''}>Contingent Worker - 11</option>
                 <option value="custom" ${currentUserType !== '10' && currentUserType !== '11' && currentUserType !== '' ? 'selected' : ''}>Other</option>
               </select>
               <input type="text" class="profile-input profile-usertype-custom" id="profile-usertype-custom" value="${currentUserType !== '10' && currentUserType !== '11' ? currentUserType : ''}" placeholder="Enter custom user type" style="${currentUserType !== '10' && currentUserType !== '11' && currentUserType !== '' ? 'display: block; margin-top: 8px;' : 'display: none; margin-top: 8px;'}">
             </div>
           </div>
           ` : ''}
         </div>
         ${canSudo ? `
         <div class="profile-buttons">
           <button class="edit-button" id="profile-edit-btn" type="button">
             <svg class="edit-icon" width="16" height="18" viewBox="0 0 18 21" fill="none" xmlns="http://www.w3.org/2000/svg">
               <g clip-path="url(#clip0_12408_161606)">
                 <path d="M15.3633 5.13521C13.6644 3.43633 11.4037 2.5 8.99925 2.5C6.59476 2.5 4.33558 3.43633 2.6367 5.13521C0.93633 6.83558 0 9.09625 0 11.4993C0 13.9022 0.93633 16.1629 2.6367 17.8633C4.33708 19.5637 6.59626 20.4985 9.00075 20.4985C11.4052 20.4985 13.6644 19.5622 15.3648 17.8633C17.0652 16.1629 18.0015 13.9037 18.0015 11.4993C18.0015 9.09476 17.0652 6.83558 15.3648 5.13521H15.3633Z" fill="#E4E4E4"/>
                 <path d="M4.80341 17.4797C4.57015 17.5352 4.36744 17.4769 4.19527 17.3047C4.0231 17.1326 3.96478 16.9298 4.02032 16.6966L4.68678 13.5142L7.98578 16.8132L4.80341 17.4797ZM7.98578 16.8132L4.68678 13.5142L12.3178 5.88322C12.5733 5.62774 12.8898 5.5 13.2675 5.5C13.6452 5.5 13.9617 5.62774 14.2172 5.88322L15.6168 7.28279C15.8723 7.53827 16 7.85484 16 8.2325C16 8.61016 15.8723 8.92673 15.6168 9.18221L7.98578 16.8132ZM13.2675 6.81627L6.3696 13.7142L7.78584 15.1304L14.6837 8.2325L13.2675 6.81627Z" fill="#495057"/>
               </g>
               <defs>
                 <clipPath id="clip0_edit_pencil">
                   <rect width="18" height="19.9985" fill="white" transform="translate(0 0.5)"/>
                 </clipPath>
               </defs>
             </svg>
             Simulate User
           </button>
           <button class="profile-save-button" id="profile-inline-save-btn" type="button" style="display: none;">
             Save
           </button>
           ${window.user?.su ? `
           <button class="reset-button" id="profile-reset-btn" type="button">
             Reset
           </button>
           ` : ''}
         </div>
         ` : ''}
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

function toggleEditMode() {
  const modal = document.getElementById('profile-modal');
  const editBtn = document.getElementById('profile-edit-btn');
  const inlineSaveBtn = document.getElementById('profile-inline-save-btn');
  const isEditing = modal.classList.contains('editing-mode');

  if (isEditing) {
    // Switch to view mode
    modal.classList.remove('editing-mode');
    editBtn.innerHTML = `
      <svg class="edit-icon" width="16" height="18" viewBox="0 0 18 21" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g clip-path="url(#clip0_12408_161606)">
          <path d="M15.3633 5.13521C13.6644 3.43633 11.4037 2.5 8.99925 2.5C6.59476 2.5 4.33558 3.43633 2.6367 5.13521C0.93633 6.83558 0 9.09625 0 11.4993C0 13.9022 0.93633 16.1629 2.6367 17.8633C4.33708 19.5637 6.59626 20.4985 9.00075 20.4985C11.4052 20.4985 13.6644 19.5622 15.3648 17.8633C17.0652 16.1629 18.0015 13.9037 18.0015 11.4993C18.0015 9.09476 17.0652 6.83558 15.3648 5.13521H15.3633Z" fill="#E4E4E4"/>
          <path d="M4.80341 17.4797C4.57015 17.5352 4.36744 17.4769 4.19527 17.3047C4.0231 17.1326 3.96478 16.9298 4.02032 16.6966L4.68678 13.5142L7.98578 16.8132L4.80341 17.4797ZM7.98578 16.8132L4.68678 13.5142L12.3178 5.88322C12.5733 5.62774 12.8898 5.5 13.2675 5.5C13.6452 5.5 13.9617 5.62774 14.2172 5.88322L15.6168 7.28279C15.8723 7.53827 16 7.85484 16 8.2325C16 8.61016 15.8723 8.92673 15.6168 9.18221L7.98578 16.8132ZM13.2675 6.81627L6.3696 13.7142L7.78584 15.1304L14.6837 8.2325L13.2675 6.81627Z" fill="#495057"/>
        </g>
        <defs>
          <clipPath id="clip0_edit_pencil_2">
            <rect width="18" height="19.9985" fill="white" transform="translate(0 0.5)"/>
          </clipPath>
        </defs>
      </svg>
${window.user?.su ? 'Simulating User' : 'Simulate User'}
    `;

    // Hide inline save button
    if (inlineSaveBtn) {
      inlineSaveBtn.style.display = 'none';
    }

    // Hide input fields, show values
    document.getElementById('profile-name').style.display = 'block';
    document.getElementById('profile-email').style.display = 'block';
    document.getElementById('profile-country').style.display = 'block';
    document.getElementById('profile-name-input').style.display = 'none';
    document.getElementById('profile-email-input').style.display = 'none';
    document.getElementById('profile-country-input').style.display = 'none';

    // Handle USER TYPE field visibility
    const userTypeField = document.getElementById('usertype-field');
    const userTypeValue = document.getElementById('profile-usertype');
    const userTypeDropdown = document.getElementById('profile-usertype-dropdown');
    if (userTypeField && userTypeValue && userTypeDropdown) {
      // Hide USER TYPE field if not currently impersonating
      if (!window.user?.su) {
        userTypeField.style.display = 'none';
      }
      userTypeValue.style.display = 'block';
      userTypeDropdown.style.display = 'none';
    }
  } else {
    // Switch to edit mode
    modal.classList.add('editing-mode');
    editBtn.innerHTML = `
      <svg class="edit-icon" width="16" height="18" viewBox="0 0 18 21" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g clip-path="url(#clip0_12408_161606)">
          <path d="M15.3633 5.13521C13.6644 3.43633 11.4037 2.5 8.99925 2.5C6.59476 2.5 4.33558 3.43633 2.6367 5.13521C0.93633 6.83558 0 9.09625 0 11.4993C0 13.9022 0.93633 16.1629 2.6367 17.8633C4.33708 19.5637 6.59626 20.4985 9.00075 20.4985C11.4052 20.4985 13.6644 19.5622 15.3648 17.8633C17.0652 16.1629 18.0015 13.9037 18.0015 11.4993C18.0015 9.09476 17.0652 6.83558 15.3648 5.13521H15.3633Z" fill="#E4E4E4"/>
          <path d="M4.80341 17.4797C4.57015 17.5352 4.36744 17.4769 4.19527 17.3047C4.0231 17.1326 3.96478 16.9298 4.02032 16.6966L4.68678 13.5142L7.98578 16.8132L4.80341 17.4797ZM7.98578 16.8132L4.68678 13.5142L12.3178 5.88322C12.5733 5.62774 12.8898 5.5 13.2675 5.5C13.6452 5.5 13.9617 5.62774 14.2172 5.88322L15.6168 7.28279C15.8723 7.53827 16 7.85484 16 8.2325C16 8.61016 15.8723 8.92673 15.6168 9.18221L7.98578 16.8132ZM13.2675 6.81627L6.3696 13.7142L7.78584 15.1304L14.6837 8.2325L13.2675 6.81627Z" fill="#495057"/>
        </g>
        <defs>
          <clipPath id="clip0_edit_pencil_3">
            <rect width="18" height="19.9985" fill="white" transform="translate(0 0.5)"/>
          </clipPath>
        </defs>
      </svg>
      Cancel
    `;

    // Show inline save button
    if (inlineSaveBtn) {
      inlineSaveBtn.style.display = 'block';
    }

    // Hide values, show input fields
    document.getElementById('profile-name').style.display = 'none';
    document.getElementById('profile-email').style.display = 'none';
    document.getElementById('profile-country').style.display = 'none';
    document.getElementById('profile-name-input').style.display = 'block';
    document.getElementById('profile-email-input').style.display = 'block';
    document.getElementById('profile-country-input').style.display = 'block';

    // Show and handle USER TYPE field in edit mode
    const userTypeField = document.getElementById('usertype-field');
    const userTypeValue = document.getElementById('profile-usertype');
    const userTypeDropdown = document.getElementById('profile-usertype-dropdown');
    if (userTypeField && userTypeValue && userTypeDropdown) {
      // Always show USER TYPE field in edit mode (for sudo users)
      userTypeField.style.display = 'block';
      userTypeValue.style.display = 'none';
      userTypeDropdown.style.display = 'block';
    }
  }
}

function handleReset() {
  // Remove all SUDO_* cookies
  removeCookie('SUDO_NAME');
  removeCookie('SUDO_EMAIL');
  removeCookie('SUDO_COUNTRY');
  removeCookie('SUDO_USERTYPE');

  // Reload the page
  window.location.reload();
}

function handleSave() {
  const canSudo = window.user?.canSudo === true;

  if (canSudo) {
    // Get values from input fields
    const nameInput = document.getElementById('profile-name-input');
    const emailInput = document.getElementById('profile-email-input');
    const countryInput = document.getElementById('profile-country-input');
    const userTypeSelect = document.getElementById('profile-usertype-select');
    const userTypeCustom = document.getElementById('profile-usertype-custom');

    if (nameInput && emailInput && countryInput) {
      let needsReload = false;

      // Only set cookies if values are different from current user values
      if (nameInput.value !== (window.user?.name || '')) {
        setCookie('SUDO_NAME', nameInput.value);
        needsReload = true;
      }

      if (emailInput.value !== (window.user?.email || '')) {
        setCookie('SUDO_EMAIL', emailInput.value);
        needsReload = true;
      }

      if (countryInput.value !== (window.user?.country || '')) {
        setCookie('SUDO_COUNTRY', countryInput.value);
        needsReload = true;
      }

      if (userTypeSelect) {
        let userTypeValue = '';
        if (userTypeSelect.value === 'custom') {
          userTypeValue = userTypeCustom ? userTypeCustom.value : '';
        } else {
          userTypeValue = userTypeSelect.value;
        }

        if (userTypeValue !== (window.user?.usertype || '')) {
          setCookie('SUDO_USERTYPE', userTypeValue);
          needsReload = true;
        }
      }

      // Only reload if we actually set any cookies
      if (needsReload) {
        window.location.reload();
      } else {
        // Just exit edit mode if no changes were made
        toggleEditMode();
      }
    }
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

    // Add edit button event listener (only if canSudo is true)
    const editBtn = modal.querySelector('#profile-edit-btn');
    if (editBtn) {
      editBtn.addEventListener('click', toggleEditMode);
    }

    // Add inline save button event listener
    const inlineSaveBtn = modal.querySelector('#profile-inline-save-btn');
    if (inlineSaveBtn) {
      inlineSaveBtn.addEventListener('click', handleSave);
    }

    // Add Enter key event listeners to input fields
    const nameInput = modal.querySelector('#profile-name-input');
    const emailInput = modal.querySelector('#profile-email-input');
    const countryInput = modal.querySelector('#profile-country-input');
    const userTypeSelect = modal.querySelector('#profile-usertype-select');
    const userTypeCustom = modal.querySelector('#profile-usertype-custom');

    [nameInput, emailInput, countryInput, userTypeCustom].forEach((input) => {
      if (input) {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSave();
          }
        });
      }
    });

    // Add change event listener to usertype select to show/hide custom input
    if (userTypeSelect) {
      userTypeSelect.addEventListener('change', (e) => {
        const customInput = document.getElementById('profile-usertype-custom');
        if (customInput) {
          if (e.target.value === 'custom') {
            customInput.style.display = 'block';
            customInput.focus();
          } else {
            customInput.style.display = 'none';
          }
        }
      });
    }

    // Add reset button event listener (only if window.user.su is set)
    const resetBtn = modal.querySelector('#profile-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', handleReset);
    }

    // Keep original save button for other functionality (notifications, etc.)
    const saveBtn = modal.querySelector('.save-button');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        // Original save functionality for notifications would go here
        // Currently no additional functionality needed
      });
    }

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

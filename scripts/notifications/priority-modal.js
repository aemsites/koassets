/**
 * Priority Message Modal - Auto-show on page load
 * Checks for important unread messages and displays a modal
 */

import { createMessagesClient } from './notifications-client.js';
import {
  getPriorityMessages,
  cleanupSystemNotificationsRead,
  cleanupSystemNotificationsDeleted,
  getSystemNotificationsDeleted,
  SYSTEM_MESSAGE_OWNER,
} from './notifications-helpers.js';

/**
 * Create priority message modal HTML
 * @param {Object} message - Priority message object
 * @returns {HTMLElement} Modal element
 */
function createPriorityModalElement(message) {
  const modal = document.createElement('div');
  modal.className = 'priority-message-modal-global';
  modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; justify-content: center; align-items: center; z-index: 2000;';

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.75); backdrop-filter: blur(4px);';

  const content = document.createElement('div');
  content.style.cssText = 'position: relative; background-color: white; border-radius: 16px; width: 90%; max-width: 650px; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3); padding: 2rem; z-index: 2001; animation: slideDown 0.3s ease;';

  // Add animation keyframes if not already present
  if (!document.getElementById('priority-modal-animation')) {
    const style = document.createElement('style');
    style.id = 'priority-modal-animation';
    style.textContent = `
      @keyframes slideDown {
        from {
          transform: translateY(-50px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Subject
  const subject = document.createElement('h2');
  subject.style.cssText = 'font-size: 1.75rem; font-weight: 600; color: #333; margin: 0 0 1rem 0; line-height: 1.3;';
  subject.textContent = message.subject;

  // From
  const from = document.createElement('div');
  from.style.cssText = 'font-size: 0.875rem; color: #666; margin-bottom: 1.5rem;';
  from.textContent = `From: ${message.from}`;

  // Message content
  const messageContent = document.createElement('div');
  messageContent.style.cssText = 'font-size: 1rem; line-height: 1.6; color: #333; white-space: pre-wrap; margin-bottom: 2rem;';
  messageContent.textContent = message.message;

  // Button
  const button = document.createElement('button');
  button.style.cssText = 'background-color: #e60012; color: white; border: none; padding: 0.875rem 2rem; border-radius: 25px; font-size: 1rem; font-weight: 600; cursor: pointer; display: block; margin: 0 auto; min-width: 200px; transition: background-color 0.3s ease;';
  button.textContent = 'Ok';
  button.onmouseover = () => { button.style.backgroundColor = '#cc0010'; };
  button.onmouseout = () => { button.style.backgroundColor = '#e60012'; };

  // Assemble
  content.appendChild(subject);
  content.appendChild(from);
  content.appendChild(messageContent);
  content.appendChild(button);

  modal.appendChild(overlay);
  modal.appendChild(content);

  return { modal, button };
}

/**
 * Check for priority messages and show modal if any exist
 */
export async function checkAndShowPriorityMessages() {
  // Don't show on my-notifications page (it handles its own priority modals)
  if (window.location.pathname === '/my-notifications') {
    return;
  }

  try {
    const client = createMessagesClient();

    // Try to load blended messages (KV + Sample)
    let messages = [];
    try {
      messages = await client.loadBlendedMessages();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('⚠️ [Priority Modal] Failed to load messages, skipping priority modal');
      return;
    }

    // Clean up stale system notification read/deleted IDs from localStorage
    cleanupSystemNotificationsRead(messages);
    cleanupSystemNotificationsDeleted(messages);

    // Filter out deleted system messages
    const deletedSystemIds = getSystemNotificationsDeleted();
    messages = messages.filter((msg) => {
      // Keep user messages (they're deleted via API)
      if (msg.owner !== SYSTEM_MESSAGE_OWNER) {
        return true;
      }
      // Filter out deleted system messages
      return !deletedSystemIds.includes(msg.id);
    });

    // Get priority messages (will filter out already-read messages)
    const priorityMessages = getPriorityMessages(messages);

    if (priorityMessages.length === 0) {
      return;
    }

    // Show the first priority message
    const firstPriorityMessage = priorityMessages[0];

    // eslint-disable-next-line no-console
    console.log('📢 [Priority Modal] Showing priority message:', firstPriorityMessage.subject);

    const { modal, button } = createPriorityModalElement(firstPriorityMessage);

    // Handle dismiss
    button.onclick = async () => {
      try {
        // Mark as read (passes full message object to handle system messages)
        await client.markAsRead(firstPriorityMessage);

        // Remove modal
        modal.remove();

        // Update header badge if function exists
        if (window.updateMessageBadge) {
          // Import helper to properly count unread (including system messages from localStorage)
          const { getUnreadCount } = await import('./notifications-helpers.js');
          const unreadCount = getUnreadCount(messages);
          window.updateMessageBadge(unreadCount);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to mark priority message as read:', error);
        // Still remove modal even if API call fails
        modal.remove();
      }
    };

    // Add to DOM
    document.body.appendChild(modal);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error checking priority messages:', error);
  }
}

/**
 * Initialize priority message check on page load
 */
export function initPriorityMessages() {
  // Wait for user to be loaded
  if (!window.user) {
    // eslint-disable-next-line no-console
    console.warn('⚠️ [Priority Modal] User not loaded, skipping priority message check');
    return;
  }

  // Check for priority messages after a short delay to let page load
  setTimeout(() => {
    checkAndShowPriorityMessages();
  }, 1000);
}

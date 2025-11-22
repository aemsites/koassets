/**
 * Message Helper Utilities
 * Functions to send notifications via the Messages API
 */

/**
 * Generate a unique message ID
 * @returns {string} Unique message ID
 */
function generateMessageId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  return `msg-${timestamp}-${random}`;
}

/**
 * Send a message to a user
 * @param {Object} env - Environment bindings
 * @param {string} recipientEmail - Email of the recipient
 * @param {Object} messageData - Message data
 * @param {string} messageData.subject - Message subject
 * @param {string} messageData.message - Message content
 * @param {string} messageData.type - Message type (Announcement, Alert, Notification)
 * @param {string} messageData.from - Sender name
 * @param {string} messageData.priority - Priority (normal, important)
 * @param {number} messageData.expiresInXDays - Days until expiration
 * @returns {Promise<boolean>} True if message was sent successfully
 */
export async function sendMessage(env, recipientEmail, messageData) {
  try {
    const messageId = generateMessageId();
    const now = new Date().toISOString();

    const message = {
      id: messageId,
      owner: recipientEmail.toLowerCase(),
      date: now,
      subject: messageData.subject,
      message: messageData.message,
      type: messageData.type || 'Notification',
      from: messageData.from || 'System',
      priority: messageData.priority || 'normal',
      expiresInXDays: messageData.expiresInXDays || 7,
      status: 'unread',
    };

    // Store in MESSAGES KV
    const kvKey = `${recipientEmail.toLowerCase()}:${messageId}`;
    await env.MESSAGES.put(kvKey, JSON.stringify(message), {
      metadata: {
        priority: message.priority,
        status: message.status,
        type: message.type,
      },
    });

    // eslint-disable-next-line no-console
    console.log(`✉️ Message sent to ${recipientEmail}: ${messageData.subject}`);
    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Failed to send message to ${recipientEmail}:`, error);
    return false;
  }
}

/**
 * Send message to multiple recipients
 * @param {Object} env - Environment bindings
 * @param {Array<string>} recipientEmails - Array of recipient emails
 * @param {Object} messageData - Message data (same as sendMessage)
 * @returns {Promise<Object>} Result with success count
 */
export async function sendMessageToMultiple(env, recipientEmails, messageData) {
  const results = await Promise.allSettled(
    recipientEmails.map((email) => sendMessage(env, email, messageData)),
  );

  const successCount = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
  const failCount = results.length - successCount;

  // eslint-disable-next-line no-console
  console.log(`📬 Bulk message sent: ${successCount} success, ${failCount} failed`);

  return {
    total: results.length,
    success: successCount,
    failed: failCount,
  };
}


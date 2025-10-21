/* eslint-disable no-use-before-define, no-console */
/**
 * KO Chat Assistant Block
 * Conversational interface for KO Assets search and discovery
 *
 * Now supports dual-mode: WebLLM (local AI) and Server (cloud AI)
 * See ko-chat-assistant-llm.js for mode configuration
 */

let conversationHistory = [];
let sessionId = null;
let llmManager = null;
let mcpClient = null;
let isInitializing = false;

/**
 * Generate a unique session ID
 */
function generateSessionId() {
  return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create the chat UI structure
 */
function createChatUI(block) {
  const chatContainer = document.createElement('div');
  chatContainer.className = 'chat-container';

  // Chat header
  const header = document.createElement('div');
  header.className = 'chat-header';
  header.innerHTML = `
    <div class="chat-header-content">
      <div class="chat-header-text">
        <h3>KO Assets Assistant</h3>
        <p>Ask me to find assets, check usage rights, and more</p>
      </div>
      <button class="clear-chat-btn" title="Start a new conversation">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M4 4L16 16M4 16L16 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        New Chat
      </button>
    </div>
  `;

  // Messages container
  const messagesContainer = document.createElement('div');
  messagesContainer.className = 'chat-messages';
  messagesContainer.id = 'chat-messages';

  // Welcome message
  const welcomeMessage = createAssistantMessage(
    "Hello! I'm your KO Assets assistant. I can help you find assets, check usage rights, and answer questions about your digital assets. What would you like to find today?",
    { showSuggestedPrompts: true },
  );
  messagesContainer.appendChild(welcomeMessage);

  // Input container
  const inputContainer = document.createElement('div');
  inputContainer.className = 'chat-input-container';
  inputContainer.innerHTML = `
    <div class="chat-input-wrapper">
      <textarea 
        id="chat-input" 
        class="chat-input" 
        placeholder="Ask about assets, brands, or usage rights..."
        rows="1"
      ></textarea>
      <button id="chat-send" class="chat-send-button" aria-label="Send message">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 10L18 2L11 18L9 11L2 10Z" />
        </svg>
      </button>
    </div>
  `;

  chatContainer.appendChild(header);
  chatContainer.appendChild(messagesContainer);
  chatContainer.appendChild(inputContainer);

  block.appendChild(chatContainer);

  // Initialize session
  sessionId = sessionStorage.getItem('ko-chat-session-id');
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem('ko-chat-session-id', sessionId);
  }

  // Load conversation history from sessionStorage
  const savedHistory = sessionStorage.getItem('ko-chat-history');
  if (savedHistory) {
    try {
      conversationHistory = JSON.parse(savedHistory);
      // Restore messages (skip welcome message)
      conversationHistory.forEach((msg) => {
        if (msg.role === 'user') {
          messagesContainer.appendChild(createUserMessage(msg.content));
        } else if (msg.role === 'assistant') {
          messagesContainer.appendChild(
            createAssistantMessage(msg.content, {
              assets: msg.assets,
              rightsReport: msg.rightsReport,
            }),
          );
        }
      });
    } catch (e) {
      console.error('Failed to load chat history', e);
    }
  }

  // Initialize LLM
  initializeLLM(block);

  // Setup event listeners
  setupEventListeners(block);
}

/**
 * Initialize the WebLLM engine with locally hosted model
 */
async function initializeLLM() {
  try {
    console.log('[Chat] Initializing LLM...');

    // Create LLM Manager and MCP Client
    llmManager = new window.LLMManager();
    mcpClient = new window.MCPClient();

    // Listen for status changes (WebLLM progress updates)
    window.addEventListener('llm-status-change', handleLLMStatusChange);

    // Show initialization UI
    isInitializing = true;
    showInitializationUI();

    // Start WebLLM initialization
    const result = await llmManager.initialize();

    isInitializing = false;
    hideInitializationUI();

    if (!result.success) {
      showInitializationError(result);
    }
  } catch (error) {
    console.error('[Chat] LLM initialization failed:', error);
    showInitializationError({ error: error.message });
  }
}

/**
 * Handle LLM status changes (WebLLM progress updates)
 */
function handleLLMStatusChange(event) {
  const status = event.detail;

  if (status.status === 'downloading') {
    updateInitializationUI('Downloading AI model...', status.progress);
  } else if (status.status === 'loading') {
    updateInitializationUI('Loading model into memory...', status.progress);
  } else if (status.status === 'ready') {
    hideInitializationUI();
  } else if (status.status === 'error') {
    hideInitializationUI();
    showInitializationError({ error: 'Failed to initialize AI model' });
  }
}

/**
 * Show initialization UI overlay
 */
function showInitializationUI() {
  const messagesContainer = document.getElementById('chat-messages');
  if (!messagesContainer) return;

  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'llm-init-overlay';
  overlay.className = 'llm-init-overlay';
  overlay.innerHTML = `
    <div class="llm-init-card">
      <div class="llm-init-icon">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="2" fill="none" opacity="0.3"/>
          <path d="M24 4 A20 20 0 0 1 44 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" class="spinner-path"/>
        </svg>
      </div>
      <h4 id="llm-init-title">Initializing AI Model...</h4>
      <p id="llm-init-message">Preparing your local AI assistant</p>
      <div class="llm-init-progress">
        <div class="llm-init-progress-bar">
          <div id="llm-init-progress-fill" class="llm-init-progress-fill" style="width: 0%"></div>
        </div>
        <span id="llm-init-progress-text" class="llm-init-progress-text">0%</span>
      </div>
      <p class="llm-init-note">This may take a few minutes on first use. The model will be cached for future visits.</p>
      <button id="llm-init-cancel" class="llm-init-cancel">Cancel and Close</button>
    </div>
  `;

  messagesContainer.parentElement.appendChild(overlay);

  // Add cancel button handler
  document.getElementById('llm-init-cancel')?.addEventListener('click', () => {
    console.warn('[Chat] User cancelled LLM initialization');
    hideInitializationUI();
  });

  // Disable input
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  if (input) input.disabled = true;
  if (sendBtn) sendBtn.disabled = true;
}

/**
 * Update initialization UI with progress
 */
function updateInitializationUI(message, progress) {
  const titleEl = document.getElementById('llm-init-title');
  const fillEl = document.getElementById('llm-init-progress-fill');
  const textEl = document.getElementById('llm-init-progress-text');

  if (titleEl && message) {
    titleEl.textContent = message;
  }

  if (progress !== undefined && progress !== null) {
    if (fillEl) fillEl.style.width = `${progress}%`;
    if (textEl) textEl.textContent = `${Math.round(progress)}%`;
  }
}

/**
 * Hide initialization UI
 */
function hideInitializationUI() {
  const overlay = document.getElementById('llm-init-overlay');
  if (overlay) {
    overlay.classList.add('fade-out');
    setTimeout(() => overlay.remove(), 300);
  }

  // Re-enable input
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  if (input) input.disabled = false;
  if (sendBtn) sendBtn.disabled = false;
}

/**
 * Show initialization error
 */
function showInitializationError(result) {
  const messagesContainer = document.getElementById('chat-messages');
  if (!messagesContainer) return;

  const errorDetails = result.details || {
    title: 'Initialization Failed',
    message: result.error || 'Unknown error',
    action: 'Try refreshing the page',
  };

  const errorMsg = document.createElement('div');
  errorMsg.className = 'chat-message assistant-message error-message';
  errorMsg.innerHTML = `
    <div class="message-content">
      <h4>⚠️ ${escapeHtml(errorDetails.title)}</h4>
      <p>${escapeHtml(errorDetails.message)}</p>
      <p class="error-action"><strong>What to do:</strong> ${escapeHtml(errorDetails.action)}</p>
      <button class="retry-init-btn" onclick="location.reload()">Retry</button>
    </div>
  `;

  messagesContainer.appendChild(errorMsg);
  scrollToBottom();
}

/**
 * Setup event listeners for chat interactions
 */
function setupEventListeners(block) {
  const input = document.getElementById('chat-input');
  const sendButton = document.getElementById('chat-send');

  // Send message on button click
  sendButton.addEventListener('click', () => {
    sendMessage();
  });

  // Clear chat on "New Chat" button click
  const clearChatBtn = block.querySelector('.clear-chat-btn');
  if (clearChatBtn) {
    clearChatBtn.addEventListener('click', () => {
      if (confirm('Start a new conversation? This will clear all messages.')) {
        // Clear conversation history
        conversationHistory = [];
        sessionStorage.removeItem('ko-chat-history');
        
        // Clear messages from UI (keep welcome message)
        messagesContainer.innerHTML = '';
        messagesContainer.appendChild(createWelcomeMessage());
        
        console.log('[Chat] Conversation cleared');
      }
    });
  }

  // Send message on Enter (Shift+Enter for new line)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = `${input.scrollHeight}px`;
  });

  // Handle suggested prompt clicks
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('suggested-prompt')) {
      const prompt = e.target.textContent;
      input.value = prompt;
      sendMessage();
    }
  });
}

/**
 * Send a message using the LLM Manager
 */
async function sendMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();

  if (!message) return;

  // Check if still initializing
  if (isInitializing) {
    console.log('[Chat] Still initializing, please wait...');
    return;
  }

  // Check if LLM is ready
  if (!llmManager) {
    console.error('[Chat] LLM Manager not initialized');
    return;
  }

  // Clear input
  input.value = '';
  input.style.height = 'auto';

  // Add user message to UI
  const messagesContainer = document.getElementById('chat-messages');
  messagesContainer.appendChild(createUserMessage(message));
  scrollToBottom();

  // Add to conversation history
  conversationHistory.push({
    role: 'user',
    content: message,
    timestamp: Date.now(),
  });

  // Show typing indicator
  const typingIndicator = createTypingIndicator();
  messagesContainer.appendChild(typingIndicator);
  scrollToBottom();

  try {
    // Generate response using LLM Manager
    const result = await llmManager.generateResponse(message, conversationHistory);

    // Remove typing indicator
    typingIndicator.remove();

    if (result.success) {
      // Handle tool calls if present (WebLLM mode)
      let { assets } = result;
      let { rightsReport } = result;
      let responseText = result.text;

      if (result.toolCalls && result.toolCalls.length > 0 && mcpClient) {
        // Execute MCP tool calls
        const toolResults = await mcpClient.executeToolCalls(result.toolCalls);

        // Process tool results
        let hasError = false;
        // eslint-disable-next-line no-restricted-syntax
        for (const toolResult of toolResults) {
          if (toolResult.name === 'search_assets') {
            if (toolResult.success) {
              assets = formatAssetResponse(toolResult.data);
              const query = result.toolCalls.find((tc) => tc.name === 'search_assets')?.arguments?.query || '';
              responseText = generateSearchResponseText(assets, query);
            } else {
              hasError = true;
              responseText = `Search failed: ${toolResult.error || 'Unknown error'}. Please try again or contact support.`;
              console.error('[Search Error]', toolResult);
            }
          } else if (toolResult.name === 'check_asset_rights' && toolResult.success) {
            rightsReport = formatRightsResponse(toolResult.data);
          } else if (toolResult.name === 'get_asset_metadata') {
            if (toolResult.success) {
              responseText = formatMetadataResponse(toolResult.data);
            } else {
              hasError = true;
              responseText = `Could not retrieve asset details: ${toolResult.error || 'Unknown error'}.`;
            }
          }
        }

        // If all tool calls failed, show helpful message
        if (hasError && !assets) {
          responseText = 'I encountered an error while searching. Please try:\n• Simplifying your query\n• Using different keywords\n• Refreshing the page if the issue persists';
        }
      }

      // Generate suggested prompts
      const suggestedPrompts = generateSuggestedPrompts(message, assets, rightsReport);

      // Add assistant message to UI
      const assistantMsg = createAssistantMessage(responseText, {
        assets,
        rightsReport,
        suggestedPrompts,
      });
      messagesContainer.appendChild(assistantMsg);
      scrollToBottom();

      // CRITICAL: Only add to conversation history if we actually called tools successfully
      // This prevents hallucinated "I found X assets" from poisoning the conversation
      if (result.toolCalls && result.toolCalls.length > 0) {
        conversationHistory.push({
          role: 'assistant',
          content: responseText,
          toolCalls: result.toolCalls,
          assets,
          rightsReport,
          timestamp: Date.now(),
        });

        // Save to sessionStorage
        sessionStorage.setItem('ko-chat-history', JSON.stringify(conversationHistory));
        console.log('[Chat] ✓ Response stored in conversation history (tool calls present)');
      } else {
        console.log('[Chat] ⚠️ Response NOT stored in history (no tool calls - likely hallucination)');
      }
    } else {
      throw new Error(result.error || 'Unknown error');
    }
  } catch (error) {
    console.error('[Chat] Error:', error);
    typingIndicator.remove();

    // Provide context-specific error messages
    let errorMessage = "I'm sorry, I encountered an error processing your request.";
    let suggestions = 'Please try again or contact support if the issue persists.';

    if (error.message?.includes('not ready')) {
      errorMessage = 'The AI model is still loading.';
      suggestions = 'Please wait a moment and try again.';
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      errorMessage = 'Connection error.';
      suggestions = 'Please check your internet connection and try again.';
    } else if (error.message?.includes('timeout')) {
      errorMessage = 'Request timed out.';
      suggestions = 'The server took too long to respond. Please try a simpler query or try again later.';
    } else if (error.message?.includes('authentication') || error.message?.includes('unauthorized')) {
      errorMessage = 'Authentication error.';
      suggestions = 'Please refresh the page and sign in again.';
    }

    const errorMsg = createAssistantMessage(
      `${errorMessage}\n\n${suggestions}`,
      { isError: true },
    );
    messagesContainer.appendChild(errorMsg);
    scrollToBottom();
  }
}

/**
 * Format asset response from MCP data
 */
function formatAssetResponse(data) {
  try {
    const hits = data.data?.hits || data.hits || [];
    const nbHits = data.data?.nbHits || data.nbHits || hits.length;
    const facets = data.data?.facets || data.facets || null;

    return {
      total: nbHits,
      count: hits.length,
      facets: facets ? formatFacets(facets) : null,
      assets: hits.slice(0, 12).map((hit) => {
        // Convert thumbnail URL from asset:// to API format
        let thumbnail = hit.thumbnail || hit.thumbnailUrl || hit.url || '';
        const assetId = hit.assetId || hit.objectID || hit.id;

        console.log('[Thumbnail Debug] Raw hit data:', {
          assetId,
          thumbnail,
          repoPath: hit['repo:path'],
          repositoryPath: hit.repositoryPath,
          path: hit.path,
        });

        // Convert asset://urn:... to /api/adobe/assets/urn:.../as/...
        if (thumbnail.startsWith('asset://')) {
          const urn = thumbnail.replace('asset://', '');
          // Try to get the repository path for the filename
          const repoPath = hit['repo:path'] || hit.repositoryPath || hit.path || '';
          const filename = repoPath ? repoPath.split('/').pop() : 'thumbnail.jpg';
          const oldThumbnail = thumbnail;
          thumbnail = `/api/adobe/assets/${urn}/as/${filename}?width=350`;
          console.log('[Thumbnail Debug] Converted:', {
            oldThumbnail, thumbnail, repoPath, filename,
          });
        } else if (assetId && !thumbnail) {
          // If no thumbnail but we have an asset ID, construct one
          thumbnail = `/api/adobe/assets/${assetId}?width=350`;
          console.log('[Thumbnail Debug] Constructed from assetId:', thumbnail);
        }

        return {
          id: assetId,
          title: hit.title || hit['dc-title'] || hit['dc:title'] || 'Untitled Asset',
          thumbnail,
          brand: hit.brand || extractFromHierarchy(hit['tccc-brand']) || '',
          category: hit.category || extractFromHierarchy(hit['tccc-assetCategoryAndType']) || '',
          format: hit.format || hit['dc-format'] || hit['dc:format'] || hit['dc-format-label'] || '',
          created: hit.created || hit['repo-createDate'] || hit['xmp:CreateDate'] || '',
          modified: hit.modified || hit['repo-modifyDate'] || '',
          description: hit.description || hit['dc:description'] || '',
          readyToUse: hit['tccc-readyToUse'] || '',
          assetStatus: hit['tccc-assetStatus'] || hit['dam-assetStatus'] || '',
          channel: extractFromHierarchy(hit['tccc-intendedChannel']) || '',
          size: hit.size || 0,
        };
      }),
    };
  } catch (error) {
    console.error('[Format Asset Error]', error);
    return {
      total: 0, count: 0, assets: [], facets: null,
    };
  }
}

/**
 * Extract value from TCCC hierarchical tag structure
 */
function extractFromHierarchy(hierarchyObj) {
  if (!hierarchyObj) return '';
  if (hierarchyObj.TCCC?.['#values']?.[0]) {
    return hierarchyObj.TCCC['#values'][0];
  }
  return '';
}

/**
 * Format facets from Algolia response
 */
function formatFacets(facets) {
  const formatted = {};

  // Extract brand facets
  const brandFacet = facets['tccc-brand.TCCC.#hierarchy.lvl1'] || facets['tccc-brand.TCCC.#values'];
  if (brandFacet) {
    formatted.brands = Object.entries(brandFacet)
      .map(([key, count]) => ({
        name: key.replace('Brand / ', ''),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  // Extract format/category facets
  const categoryFacet = facets['tccc-assetCategoryAndType.TCCC.#hierarchy.lvl0'];
  if (categoryFacet) {
    formatted.formats = Object.entries(categoryFacet)
      .map(([key, count]) => ({
        name: key.replace('Asset Category and Asset Type Execution / ', ''),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  // Extract channel facets
  const channelFacet = facets['tccc-intendedChannel.TCCC.#hierarchy.lvl1'];
  if (channelFacet) {
    formatted.channels = Object.entries(channelFacet)
      .map(([key, count]) => ({
        name: key.replace('Intended Channel / ', ''),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  // Extract ready-to-use facet
  const readyFacet = facets['tccc-readyToUse'];
  if (readyFacet) {
    formatted.readyToUse = Object.entries(readyFacet).map(([key, count]) => ({
      name: key === 'yes' ? 'Ready to Use' : 'Not Ready',
      count,
    }));
  }

  return formatted;
}

/**
 * Format rights response from MCP data
 */
function formatRightsResponse(data) {
  try {
    const rightsData = data.data || data;
    return {
      allAuthorized: rightsData.allAuthorized || false,
      totalAssets: rightsData.totalAssets || 0,
      authorizedAssets: rightsData.authorizedAssets || 0,
      restrictedAssets: rightsData.restrictedAssets || 0,
      assets: (rightsData.assets || []).map((asset) => ({
        id: asset.assetId,
        title: asset.title || asset.assetId,
        authorized: asset.authorized || false,
        restrictions: asset.restrictions || [],
      })),
    };
  } catch (error) {
    console.error('[Format Rights Error]', error);
    return {
      allAuthorized: false,
      totalAssets: 0,
      authorizedAssets: 0,
      restrictedAssets: 0,
      assets: [],
    };
  }
}

/**
 * Format metadata response from MCP data
 */
function formatMetadataResponse(data) {
  try {
    const metadata = data.data || data;
    const details = [];

    if (metadata.title) details.push(`Title: ${metadata.title}`);
    if (metadata.brand) details.push(`Brand: ${metadata.brand}`);
    if (metadata.format) details.push(`Format: ${metadata.format}`);
    if (metadata.created) details.push(`Created: ${metadata.created}`);
    if (metadata.description) details.push(`Description: ${metadata.description}`);

    return details.length > 0
      ? `Asset Details:\n${details.join('\n')}`
      : 'Asset metadata retrieved successfully.';
  } catch (error) {
    console.error('[Format Metadata Error]', error);
    return 'Could not format asset metadata.';
  }
}

/**
 * Generate response text for search results
 */
function generateSearchResponseText(assets, query = '') {
  if (!assets || assets.count === 0) {
    let suggestion = 'Try different keywords or check your filters.';

    // Provide specific suggestions based on context
    if (query && query.length > 0) {
      suggestion = 'Try:\n• Using broader keywords\n• Checking spelling\n• Removing filters';
    } else if (assets && assets.facets) {
      suggestion = 'Try refining your search using the facets above.';
    }

    return `I couldn't find any assets matching your search. ${suggestion}`;
  }

  const { total } = assets;
  const { count } = assets;

  if (total === count) {
    return `I found ${total} asset${total !== 1 ? 's' : ''} matching your search.`;
  }
  return `I found ${total} asset${total !== 1 ? 's' : ''} matching your search. Here are the first ${count}.`;
}

/**
 * Generate suggested prompts based on context
 */
// eslint-disable-next-line no-unused-vars
function generateSuggestedPrompts(userMessage, assets, rightsReport) {
  const prompts = [];
  const lower = userMessage.toLowerCase();

  // Context-aware suggestions
  if (lower.includes('sprite')) {
    prompts.push('Show me Sprite video assets');
    prompts.push('Find Sprite assets for social media');
  } else if (lower.includes('coca-cola')) {
    prompts.push('Show me Coca-Cola holiday campaign assets');
    prompts.push('Find Coca-Cola images');
  } else if (assets && assets.count > 0) {
    // If we just did a search, suggest refinements
    prompts.push('Show me videos instead');
    prompts.push('Find more like these');
    prompts.push('Check usage rights for these assets');
  } else {
    // Generic suggestions
    prompts.push('Show me recent Coca-Cola assets');
    prompts.push('Find Sprite images');
    prompts.push('Search for Fanta videos');
  }

  return prompts.slice(0, 3);
}

/**
 * Create a user message element
 */
function createUserMessage(text) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message user-message';
  messageDiv.innerHTML = `
    <div class="message-content">
      <p>${escapeHtml(text)}</p>
    </div>
  `;
  return messageDiv;
}

/**
 * Create an assistant message element
 */
function createAssistantMessage(text, options = {}) {
  const {
    assets, rightsReport, suggestedPrompts, isError, showSuggestedPrompts,
  } = options;

  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message assistant-message${isError ? ' error-message' : ''}`;

  let content = `<div class="message-content"><p>${escapeHtml(text)}</p>`;

  // Add facets panel if present
  if (assets && assets.facets) {
    content += createFacetsPanel(assets.facets);
  }

  // Add asset cards if present
  if (assets && assets.assets && assets.assets.length > 0) {
    content += '<div class="asset-cards-container">';
    content += `<div class="asset-cards-header"><strong>${assets.total} asset${assets.total !== 1 ? 's' : ''} found</strong> (showing ${assets.count})</div>`;
    content += '<div class="asset-cards-grid">';
    assets.assets.forEach((asset) => {
      content += createAssetCard(asset);
    });
    content += '</div></div>';
  }

  // Add rights report if present
  if (rightsReport) {
    content += createRightsReport(rightsReport);
  }

  content += '</div>';

  // Add suggested prompts
  if (suggestedPrompts && suggestedPrompts.length > 0) {
    content += '<div class="suggested-prompts">';
    content += '<p class="suggested-prompts-label">Suggested prompts:</p>';
    suggestedPrompts.forEach((prompt) => {
      content += `<button class="suggested-prompt">${escapeHtml(prompt)}</button>`;
    });
    content += '</div>';
  } else if (showSuggestedPrompts) {
    // Show default prompts on welcome
    content += '<div class="suggested-prompts">';
    content += '<p class="suggested-prompts-label">Try asking:</p>';
    const defaultPrompts = [
      'Show me recent Coca-Cola images',
      'Find Sprite assets for social media',
      'Search for Fanta video assets',
    ];
    defaultPrompts.forEach((prompt) => {
      content += `<button class="suggested-prompt">${escapeHtml(prompt)}</button>`;
    });
    content += '</div>';
  }

  messageDiv.innerHTML = content;
  return messageDiv;
}

/**
 * Create facets panel HTML
 */
function createFacetsPanel(facets) {
  let html = '<div class="facets-panel"><div class="facets-header">Refine your search:</div><div class="facets-grid">';

  // Show brand facets
  if (facets.brands && facets.brands.length > 0) {
    html += '<div class="facet-group"><div class="facet-label">By Brand:</div><div class="facet-options">';
    facets.brands.slice(0, 5).forEach((brand) => {
      html += `<button class="facet-option" data-facet="brand" data-value="${escapeHtml(brand.name)}">${escapeHtml(brand.name)} (${brand.count})</button>`;
    });
    html += '</div></div>';
  }

  // Show format facets
  if (facets.formats && facets.formats.length > 0) {
    html += '<div class="facet-group"><div class="facet-label">By Format:</div><div class="facet-options">';
    facets.formats.slice(0, 3).forEach((format) => {
      html += `<button class="facet-option" data-facet="format" data-value="${escapeHtml(format.name)}">${escapeHtml(format.name)} (${format.count})</button>`;
    });
    html += '</div></div>';
  }

  // Show channel facets
  if (facets.channels && facets.channels.length > 0) {
    html += '<div class="facet-group"><div class="facet-label">By Channel:</div><div class="facet-options">';
    facets.channels.slice(0, 3).forEach((channel) => {
      html += `<button class="facet-option" data-facet="channel" data-value="${escapeHtml(channel.name)}">${escapeHtml(channel.name)} (${channel.count})</button>`;
    });
    html += '</div></div>';
  }

  // Show ready-to-use facet
  if (facets.readyToUse && facets.readyToUse.length > 0) {
    html += '<div class="facet-group"><div class="facet-label">Status:</div><div class="facet-options">';
    facets.readyToUse.forEach((status) => {
      html += `<button class="facet-option" data-facet="ready" data-value="${status.name === 'Ready to Use' ? 'yes' : 'no'}">${escapeHtml(status.name)} (${status.count})</button>`;
    });
    html += '</div></div>';
  }

  html += '</div></div>';
  return html;
}

/**
 * Create an asset card HTML
 */
function createAssetCard(asset) {
  const {
    thumbnail = '/icons/file-icon.svg',
    title = 'Untitled',
    brand = '',
    category = '',
    format = '',
    readyToUse,
    assetStatus,
    size,
  } = asset;

  // Format file size
  let sizeText = '';
  if (size > 0) {
    if (size >= 1024 * 1024) {
      sizeText = `${(size / (1024 * 1024)).toFixed(1)} MB`;
    } else if (size >= 1024) {
      sizeText = `${(size / 1024).toFixed(1)} KB`;
    } else {
      sizeText = `${size} B`;
    }
  }

  // Status badges
  const badges = [];
  if (readyToUse === 'yes') {
    badges.push('<span class="asset-badge ready">Ready to Use</span>');
  }
  if (assetStatus === 'approved') {
    badges.push('<span class="asset-badge approved">Approved</span>');
  }

  return `
    <div class="asset-card" data-asset-id="${escapeHtml(asset.id)}">
      <div class="asset-thumbnail">
        <img src="${escapeHtml(thumbnail)}" alt="${escapeHtml(title)}" loading="lazy" />
        ${badges.length > 0 ? `<div class="asset-badges">${badges.join('')}</div>` : ''}
      </div>
      <div class="asset-info">
        <h4 class="asset-title" title="${escapeHtml(title)}">${escapeHtml(title)}</h4>
        ${brand ? `<p class="asset-brand"><strong>Brand:</strong> ${escapeHtml(brand)}</p>` : ''}
        <div class="asset-metadata">
          ${format ? `<span class="asset-meta-item"><strong>Format:</strong> ${escapeHtml(format)}</span>` : ''}
          ${sizeText ? `<span class="asset-meta-item"><strong>Size:</strong> ${sizeText}</span>` : ''}
          ${category ? `<span class="asset-meta-item"><strong>Category:</strong> ${escapeHtml(category)}</span>` : ''}
        </div>
      </div>
      <div class="asset-actions">
        <button class="asset-action-btn" data-action="view" aria-label="View asset" title="View details">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 3C4.5 3 1.5 5.5 0 8c1.5 2.5 4.5 5 8 5s6.5-2.5 8-5c-1.5-2.5-4.5-5-8-5zm0 8c-1.7 0-3-1.3-3-3s1.3-3 3-3 3 1.3 3 3-1.3 3-3 3z"/>
          </svg>
        </button>
        <button class="asset-action-btn" data-action="download" aria-label="Download asset" title="Download">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 12L3 7h3V1h4v6h3l-5 5zm6 2H2v2h12v-2z"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

/**
 * Create rights report HTML
 */
function createRightsReport(report) {
  const allClear = report.allAuthorized;
  const statusClass = allClear ? 'rights-clear' : 'rights-restricted';

  let html = `
    <div class="rights-report ${statusClass}">
      <div class="rights-summary">
        <h4>${allClear ? '✓ All Assets Cleared' : '⚠ Some Assets Restricted'}</h4>
        <p>${report.authorizedAssets} of ${report.totalAssets} assets authorized</p>
      </div>
  `;

  if (!allClear && report.assets && report.assets.length > 0) {
    html += '<div class="rights-details">';
    report.assets.forEach((asset) => {
      const status = asset.authorized ? '✓' : '✗';
      const assetStatusClass = asset.authorized ? 'authorized' : 'restricted';
      html += `
        <div class="rights-asset ${assetStatusClass}">
          <span class="rights-status">${status}</span>
          <span class="rights-asset-title">${escapeHtml(asset.title)}</span>
        </div>
      `;
    });
    html += '</div>';
  }

  html += '</div>';
  return html;
}

/**
 * Create typing indicator
 */
function createTypingIndicator() {
  const div = document.createElement('div');
  div.className = 'chat-message assistant-message typing-indicator';
  div.innerHTML = `
    <div class="message-content">
      <div class="typing-dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  return div;
}

/**
 * Scroll to bottom of chat
 */
function scrollToBottom() {
  const messagesContainer = document.getElementById('chat-messages');
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Load LLM abstraction library
 */
function loadLLMLibrary() {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.LLMManager && window.MCPClient) {
      resolve();
      return;
    }

    // Load the LLM library
    const script = document.createElement('script');
    script.src = '/blocks/ko-chat-assistant/ko-chat-assistant-llm.js';
    script.onload = () => {
      // Give it a moment to initialize globals
      setTimeout(resolve, 100);
    };
    script.onerror = () => reject(new Error('Failed to load LLM library'));
    document.head.appendChild(script);
  });
}

/**
 * Initialize the block
 */
export default async function decorate(block) {
  // Clear any existing content
  block.innerHTML = '';

  try {
    // Load LLM library first
    await loadLLMLibrary();

    // Create chat UI
    createChatUI(block);
  } catch (error) {
    console.error('[Chat] Failed to initialize:', error);
    block.innerHTML = `
      <div class="chat-error">
        <h3>⚠️ Failed to Initialize Chat</h3>
        <p>There was a problem loading the chat assistant. Please refresh the page.</p>
        <button onclick="location.reload()">Refresh Page</button>
      </div>
    `;
  }
}

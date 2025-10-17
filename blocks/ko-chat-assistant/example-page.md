# Example: Chat Assistant Page

This is an example of how to add the KO Chat Assistant block to an EDS page.

Copy this content to your AEM/DA authoring environment (e.g., https://da.live/#/aemsites/koassets).

---

## Content to Copy

```markdown
# KO Assets Chat Assistant

Talk to your digital asset library. Find assets, check usage rights, and discover content using natural language.

---

## Ask Your Assistant

| KO Chat Assistant |
|-------------------|
|                   |

---

## How to Use

### Finding Assets

Simply ask for what you need:

- "Show me Coca-Cola images"
- "Find Sprite videos for social media"
- "Get assets from the Summer 2024 campaign"
- "What Fanta content do we have?"

### Checking Rights

Ask about usage permissions:

- "Can I use this in Japan for TV?"
- "Is this asset approved for digital marketing?"
- "Check rights for United States social media"

### Browsing Content

Explore your asset library:

- "What brands do we have assets for?"
- "Show me recent uploads"
- "Find high-resolution images"

---

## Tips for Better Results

**Be Specific**
- ✅ "Sprite social media images from 2024"
- ❌ "Some Sprite stuff"

**Use Brand Names**
- Coca-Cola, Sprite, Fanta, Powerade, Dasani, smartwater, vitaminwater

**Ask Follow-ups**
- The assistant remembers your conversation
- Build on previous queries

**Try Suggestions**
- Click suggested prompts to explore

---

## Need Help?

The assistant is here to help you:
- Search for assets
- Check usage rights
- Explore brands and campaigns
- Answer questions about the asset library

Start chatting above!
```

---

## File Structure in DA

When creating the page in DA (https://da.live):

```
/chat (or any path you want)
├── index.docx (or .md)
└── [content as shown above]
```

## Preview & Publish

1. **Create** the page in DA
2. **Preview** at: `https://main--koassets--aemsites.aem.page/chat`
3. **Publish** to: `https://main--koassets--aemsites.aem.live/chat`

## Alternative: Embed in Existing Page

You can also add just the block to any existing page:

```markdown
# Your Existing Page Title

Your existing content here...

## Need Help Finding Assets?

| KO Chat Assistant |
|-------------------|
|                   |

More content here...
```

## Advanced: Custom Configuration

### Minimal Block

Just the chat, no extra content:

```markdown
| KO Chat Assistant |
|-------------------|
|                   |
```

### With Instructions Above

```markdown
## Chat with KO Assets

Ask me to find assets, check rights, or answer questions about your digital library.

| KO Chat Assistant |
|-------------------|
|                   |
```

### Multiple Sections

```markdown
# Asset Discovery

## Option 1: Traditional Search

[Link to regular search]

## Option 2: Chat Assistant

| KO Chat Assistant |
|-------------------|
|                   |
```

---

## Testing

After publishing, test with these queries:

1. **Simple search**: "Find Coca-Cola images"
2. **Brand filter**: "Show me Sprite assets"
3. **Category filter**: "Search for video assets"
4. **Complex query**: "Find Coca-Cola social media images from 2024"
5. **Rights check**: "Can I use this in the US for TV?" (after getting results)

---

## Troubleshooting

**Block doesn't appear:**
- Check block name is exactly `KO Chat Assistant` or `ko-chat-assistant`
- Verify the table format is correct
- Clear cache and reload

**Chat doesn't respond:**
- Check browser console for errors
- Verify you're logged in (session cookie)
- Ensure Cloudflare Worker is deployed

**Assets don't display:**
- Check network tab for failed requests
- Verify MCP server is running
- Check CORS configuration

---

## Customization

### Change Block Size

The chat container height can be adjusted in CSS:

```css
.chat-container {
  height: 700px; /* Change to your preference */
}
```

### Custom Welcome Message

Edit in `ko-chat-assistant.js`:

```javascript
const welcomeMessage = createAssistantMessage(
  "Your custom welcome message here!",
  { showSuggestedPrompts: true }
);
```

---

**Questions?** Contact the KO Assets development team.




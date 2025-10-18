# KO Chat Assistant - Deployment Checklist

Use this checklist to ensure a successful deployment.

---

## Pre-Deployment

### Prerequisites

- [ ] Cloudflare account with Workers enabled
- [ ] Wrangler CLI installed (`npm install -g wrangler`)
- [ ] Authenticated with Wrangler (`wrangler login`)
- [ ] KO Assets main worker deployed and working
- [ ] MCP server deployed and healthy
- [ ] Valid test session cookie available

### Code Review

- [ ] All files created and in place
- [ ] No linter errors (`npm run lint`)
- [ ] Code reviewed by team
- [ ] Documentation complete

---

## Deployment Steps

### 1. Cloudflare Configuration

- [ ] Create KV namespace: `wrangler kv:namespace create "CHAT_SESSIONS"`
- [ ] Update `wrangler.toml` with KV namespace ID
- [ ] Set `MCP_SERVER_URL` in `wrangler.toml`
- [ ] Verify `[ai]` binding present in `wrangler.toml`
- [ ] Commit configuration changes

### 2. Build & Deploy

- [ ] Run `npm install` in cloudflare folder
- [ ] Run `npm run lint` (should pass)
- [ ] Deploy to staging: `npm run deploy:staging`
- [ ] Verify deployment successful
- [ ] Note the worker URL

### 3. Testing

- [ ] Test chat API endpoint:
  ```bash
  curl -X POST https://YOUR_WORKER/api/chat \
    -H "Content-Type: application/json" \
    -H "Cookie: session=YOUR_SESSION" \
    -d '{"message":"test","sessionId":"test_123"}'
  ```
- [ ] Verify MCP connection works
- [ ] Check KV namespace accessible
- [ ] Check Workers AI responds

### 4. EDS Page Creation

- [ ] Create test page in DA (https://da.live/#/aemsites/koassets)
- [ ] Add KO Chat Assistant block
- [ ] Preview the page
- [ ] Verify block loads correctly
- [ ] Test chat functionality

### 5. Functional Testing

- [ ] Send test message: "Find Coca-Cola images"
- [ ] Verify assets display
- [ ] Check thumbnails load
- [ ] Test suggested prompts
- [ ] Test mobile view
- [ ] Test session persistence (refresh page)
- [ ] Test error handling (invalid query)

---

## Post-Deployment

### Verification

- [ ] All tests pass
- [ ] No console errors
- [ ] No server errors in logs
- [ ] Performance acceptable (<2s response)
- [ ] Mobile responsive works
- [ ] Works in Chrome, Firefox, Safari

### Monitoring Setup

- [ ] Set up Cloudflare alerts
  - [ ] Error rate > 5%
  - [ ] Response time > 5s
  - [ ] KV storage > 80%
- [ ] Document expected metrics
- [ ] Create runbook for common issues

### Documentation

- [ ] Update README with chat assistant info
- [ ] Create user guide
- [ ] Document configuration
- [ ] Share with team
- [ ] Update project wiki

---

## Production Deployment

### Pre-Production

- [ ] All staging tests passed
- [ ] Team reviewed and approved
- [ ] User feedback collected (if applicable)
- [ ] Performance validated
- [ ] Security reviewed

### Configuration

- [ ] Update `MCP_SERVER_URL` to production:
  ```toml
  MCP_SERVER_URL = "https://mcp.koassets.adobeaem.workers.dev/mcp"
  ```
- [ ] Create production KV namespace:
  ```bash
  wrangler kv:namespace create "CHAT_SESSIONS" --env production
  ```
- [ ] Update production wrangler.toml

### Deployment

- [ ] Deploy to production: `npm run deploy:production`
- [ ] Verify deployment
- [ ] Smoke test in production
- [ ] Monitor logs for 15 minutes

### Rollout

- [ ] Deploy to limited pages first
- [ ] Monitor for issues
- [ ] Gradual rollout to all pages
- [ ] Announce to users
- [ ] Collect initial feedback

---

## Rollback Plan

### If Issues Occur

1. **Quick rollback:**
   ```bash
   wrangler rollback
   ```

2. **Remove block from pages:**
   - Edit pages in DA
   - Remove KO Chat Assistant block
   - Republish

3. **Disable route:**
   - Comment out in `cloudflare/src/index.js`:
     ```javascript
     // .post('/api/chat', handleChatRequest)
     ```
   - Redeploy

4. **Investigation:**
   - Check Cloudflare logs
   - Review error reports
   - Identify root cause
   - Fix and redeploy

---

## Sign-Off

### Staging Deployment

- [ ] Developer tested: __________________ Date: __________
- [ ] QA verified: __________________ Date: __________
- [ ] Product owner approved: __________________ Date: __________

### Production Deployment

- [ ] Tech lead approved: __________________ Date: __________
- [ ] Security reviewed: __________________ Date: __________
- [ ] Production deployed: __________________ Date: __________
- [ ] Production verified: __________________ Date: __________

---

## Post-Launch (First Week)

### Daily Monitoring

- [ ] Day 1: Check logs, monitor errors
- [ ] Day 2: Review performance metrics
- [ ] Day 3: Collect user feedback
- [ ] Day 4: Analyze usage patterns
- [ ] Day 5: Address any issues
- [ ] Day 6: Optimize based on data
- [ ] Day 7: Week 1 review meeting

### Week 1 Metrics

Target metrics:
- [ ] Error rate < 5%
- [ ] Avg response time < 2s
- [ ] User engagement > 20%
- [ ] Search success rate > 80%

Actual metrics:
- Error rate: _____%
- Avg response time: _____s
- User engagement: _____%
- Search success rate: _____%

### Action Items

Based on Week 1 results:
- [ ] _______________________________________
- [ ] _______________________________________
- [ ] _______________________________________

---

## Continuous Improvement

### Monthly Review

- [ ] Review usage analytics
- [ ] Identify common queries
- [ ] Update system prompt if needed
- [ ] Add new intent patterns
- [ ] Optimize performance
- [ ] Update documentation

### Quarterly Planning

- [ ] Evaluate Phase 3 features
- [ ] Gather feature requests
- [ ] Prioritize roadmap
- [ ] Budget review
- [ ] Team capacity planning

---

## Success Criteria

Deployment is successful when:

✅ Chat assistant responds correctly  
✅ Assets display with thumbnails  
✅ Session persistence works  
✅ Mobile responsive  
✅ No critical errors  
✅ Performance acceptable  
✅ User feedback positive  

---

## Contact Information

**For deployment issues:**
- On-call engineer: ___________________
- Team Slack: ___________________
- Email: ___________________

**For user support:**
- Support team: ___________________
- Documentation: See CHAT_ASSISTANT.md
- Escalation: ___________________

---

## Notes

_Use this section to document any deployment-specific notes, issues encountered, or lessons learned._

---

**Deployment Date:** _______________  
**Deployed By:** _______________  
**Version:** 1.0.0  
**Environment:** ☐ Staging  ☐ Production




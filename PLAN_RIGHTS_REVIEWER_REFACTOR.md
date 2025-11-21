# Rights Reviewer Refactor & Senior Role Implementation

**JIRA:** ASSETS-59508  
**Date:** November 20, 2025

## Overview

Refactor the rights management system to use consistent "reviewer" terminology throughout, and add a new `senior-rights-reviewer` permission that allows supervisors to assign unassigned requests to other reviewers.

## Objectives

1. Rename `rights-manager` → `rights-reviewer` with backwards compatibility
2. Add new `senior-rights-reviewer` permission for supervisors
3. Implement supervisor assignment functionality (assign to others)
4. Update all UI, backend, and reports for consistency
5. Replace hardcoded RIGHTS_REVIEWERS with dynamic config-based list

## Key Files to Modify

### Backend (Cloudflare Worker)

- `cloudflare/src/api/rightsrequests.js` - Core API logic, permissions, new endpoints
- `cloudflare/src/user.js` - Documentation updates

### Frontend (EDS Blocks)

- `blocks/my-rights-reviews/my-rights-reviews.js` - UI for senior reviewer assignment
- `blocks/my-rights-reviews/modals.js` - New assignment modal
- `blocks/my-rights-reviews/my-rights-reviews.css` - Styling for assignment UI
- `blocks/report-rights-requests/report-rights-requests.js` - Update column headers and permissions

### Configuration

- Config sheet `/config/access/permissions` - Add senior-rights-reviewer permission

## Implementation Approach

### Phase 0: Discovery & Current State Testing

**BEFORE making any changes:**

1. Document current functionality by reading all related code
2. Start local dev stack (`npm run dev`)
3. Test current rights review workflow using browser tools:
   - Login as a user with `rights-manager` permission
   - Navigate to "My Rights Reviews"
   - Verify unassigned requests are shown
   - Test "Assign to Me" button functionality
   - Verify assigned requests appear in "My Reviews" tab
   - Test status change functionality
   - Verify notifications are sent correctly
4. Test reports page with current permissions
5. Document current behavior as baseline for regression testing

**Deliverable:** Working understanding of current system + baseline test results

### Phase 1: Backend Refactor & New Permission

**Update PERMISSIONS constant:**

```javascript
const PERMISSIONS = {
  RIGHTS_REVIEWER: 'rights-reviewer',
  SENIOR_RIGHTS_REVIEWER: 'senior-rights-reviewer',
  RIGHTS_MANAGER: 'rights-manager', // legacy - remove in future
  REPORTS_ADMIN: 'reports-admin',
};
```

**Add helper function for backwards compatibility:**

```javascript
function hasRightsReviewerPermission(user) {
  return user?.permissions?.includes('rights-reviewer') || 
         user?.permissions?.includes('rights-manager'); // legacy support
}
```

**New API endpoints:**

1. `GET /api/rightsrequests/reviews/reviewers` - List available reviewers (users with rights-reviewer permission)
2. `POST /api/rightsrequests/reviews/assign-to` - Assign request to specific reviewer (senior only)

**Update existing endpoints:**

- `listReviewsForReviewer` - Use new helper for permission check
- `assignReview` - Update to use new helper (keep self-assignment working)
- `updateReviewStatus` - Use new helper for permission check

### Phase 2: Frontend UI Updates

**For regular reviewers (unchanged behavior):**

- Continue showing "Assign to Me" button for unassigned requests
- Can only self-assign

**For senior reviewers (new behavior):**

- Show "Assign to Me" button (self-assign)
- Show "Assign to..." button with dropdown of available reviewers
- Dropdown fetches from new `/reviewers` endpoint
- Assignment modal for selecting reviewer and confirming

**UI Components:**

- Assignment dropdown/modal in `modals.js`
- Update action cell in review row to show appropriate buttons based on user permission
- Add loading states for assignment operations

### Phase 3: Reports & Terminology Updates

**Report changes:**

- Column header: `RIGHTSMANAGER` → `RIGHTSREVIEWER`
- CSV export headers updated
- Permission check updated to use new helper

**Comments & documentation:**

- Update all "rights manager" references to "rights reviewer"
- Update hardcoded RIGHTS_REVIEWERS comment to explain it's for notifications only
- Add JSDoc comments for new functions

### Phase 4: Configuration & Deployment

**Config sheet updates:**

- Add `senior-rights-reviewer` to appropriate users
- Optionally add `rights-reviewer` to users currently with `rights-manager`
- Document that `rights-manager` is legacy

**Testing checklist:**

- [ ] Regular reviewer can self-assign
- [ ] Senior reviewer can self-assign
- [ ] Senior reviewer can assign to others
- [ ] Regular reviewer cannot assign to others
- [ ] Dropdown shows only valid reviewers
- [ ] Notifications work correctly
- [ ] Reports display correct terminology
- [ ] CSV exports work
- [ ] Legacy permission still works

## UI Changes Detail

### Labels & Text (Complete List)

**NO CHANGES (already correct):**
- Navigation: "My Rights Reviews"
- Page title: "Rights Request Reviews"
- Tabs: "Unassigned (X)", "My Reviews (X)"
- Filters: "FILTER BY", status options
- Buttons: "Assign to Me", "Change Status", "View Details"
- Detail view: "Assigned Reviewer"

**CHANGES:**
- **Report column**: "RIGHTSMANAGER" → "RIGHTSREVIEWER"
- **CSV header**: "RIGHTSMANAGER" → "RIGHTSREVIEWER"
- **NEW button** (senior only): "Assign to Reviewer..."
- **NEW modal title**: "Assign Rights Request"
- **NEW modal label**: "Select Reviewer:"
- **NEW modal buttons**: "Assign", "Cancel"
- **NEW toast messages**: Success/error for assignments

### Button Visibility by User Role

**Regular Reviewer sees:**
- Unassigned: [Assign to Me] [View Details]
- Assigned to them: [Change Status] [View Details]

**Senior Reviewer sees:**
- Unassigned: [Assign to Me] [Assign to Reviewer...] [View Details]
- Assigned to them: [Change Status] [View Details]

### Assignment Modal Design

```
┌────────────────────────────────┐
│ Assign Rights Request       [×]│
├────────────────────────────────┤
│ Request: Marketing Campaign    │
│ Submitted by: user@example.com │
│                                │
│ Select Reviewer:               │
│ ┌──────────────────────────┐  │
│ │ reviewer@example.com   ▼ │  │
│ └──────────────────────────┘  │
│                                │
│        [Cancel]  [Assign]      │
└────────────────────────────────┘
```

## Backwards Compatibility

The refactor maintains backwards compatibility by:

1. Checking for both old (`rights-manager`) and new (`rights-reviewer`) permissions
2. Not removing old permission immediately
3. Allowing gradual migration of config sheets
4. No breaking changes to existing functionality

## Success Criteria

- [x] JIRA ASSETS-59508 requirement met: supervisors can assign requests to other reviewers
- [x] Consistent "reviewer" terminology throughout UI and code
- [x] No breaking changes for existing users
- [x] Dynamic reviewer list from configuration
- [x] All tests passing
- [x] Clean, maintainable codebase

## Implementation Todos

1. **backend-permissions** - Update PERMISSIONS constants and add backwards-compatible helper function
2. **api-reviewers-list** - Create new GET /api/rightsrequests/reviews/reviewers endpoint
3. **api-assign-to** - Create new POST /api/rightsrequests/reviews/assign-to endpoint for senior reviewers
4. **api-update-checks** - Update existing endpoints to use new permission helper function
5. **ui-assignment-modal** - Create assignment modal component in modals.js (depends on: api-reviewers-list)
6. **ui-senior-buttons** - Update my-rights-reviews.js to show assignment UI for senior reviewers (depends on: ui-assignment-modal)
7. **ui-styling** - Add CSS styling for assignment dropdown and modal (depends on: ui-assignment-modal)
8. **reports-terminology** - Update report-rights-requests.js column headers and permission checks
9. **comments-docs** - Update all code comments and documentation for new terminology
10. **testing** - Test all scenarios: regular reviewer, senior reviewer, assignment flows (depends on: ui-senior-buttons, api-assign-to, reports-terminology)

## Estimated Effort

- Code changes: 4-6 hours
- Testing: 2-3 hours
- Config updates & coordination: 1-2 hours
- **Total: 7-11 hours**


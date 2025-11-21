# Testing Guide: Rights Reviewer Refactor

**JIRA:** ASSETS-59508  
**Implementation Date:** November 20, 2025

## Overview
This guide provides step-by-step testing procedures to verify the rights reviewer refactor and new senior reviewer functionality.

## Prerequisites

1. **Start Local Development Server:**
   ```bash
   npm run dev
   ```
   Server should be available at http://localhost:8787

2. **Required Test Accounts:**
   - Regular reviewer account (with `rights-reviewer` or `rights-manager` permission)
   - Senior reviewer account (with `senior-rights-reviewer` permission)
   - Regular user account (to submit requests)

3. **Configuration Setup:**
   Add test users to `/config/access/permissions` sheet:
   ```
   email,permissions
   test-reviewer@adobe.com,rights-reviewer
   test-senior@adobe.com,senior-rights-reviewer,rights-reviewer
   test-user@adobe.com,
   ```

## Test Scenarios

### Test 1: Backwards Compatibility (Legacy Permission)
**Purpose:** Verify that existing `rights-manager` permission still works

1. Login as a user with only `rights-manager` permission
2. Navigate to "My Account" → "My Rights Reviews"
3. **Expected Result:** Page loads without errors
4. Try to self-assign an unassigned request
5. **Expected Result:** Assignment succeeds
6. Try to change status of assigned request
7. **Expected Result:** Status change succeeds

**Pass Criteria:** All existing functionality works with legacy permission

---

### Test 2: Regular Reviewer (New Permission)
**Purpose:** Verify `rights-reviewer` permission works correctly

1. Login as a user with `rights-reviewer` permission
2. Navigate to "My Account" → "My Rights Reviews"
3. **Expected Result:** Page loads, shows unassigned and assigned reviews
4. View an unassigned request
5. **Expected Result:** Shows "Assign to Me" and "View Details" buttons only
6. **Expected Result:** Does NOT show "Assign to Reviewer..." button
7. Click "Assign to Me" on an unassigned request
8. **Expected Result:** Request moves to "My Reviews" tab
9. Change status of assigned request
10. **Expected Result:** Status updates successfully

**Pass Criteria:** Regular reviewer can self-assign and manage their own reviews

---

### Test 3: Senior Reviewer Assignment UI
**Purpose:** Verify senior reviewer can see and use assignment functionality

1. Login as a user with `senior-rights-reviewer` permission
2. Navigate to "My Account" → "My Rights Reviews"
3. View an unassigned request in the "Unassigned" tab
4. **Expected Result:** Shows THREE buttons:
   - "Assign to Me"
   - "Assign to Reviewer..." (cyan/turquoise color)
   - "View Details"
5. Click "Assign to Reviewer..." button
6. **Expected Result:** Assignment modal opens with:
   - Title: "Assign Rights Request"
   - Request information displayed
   - Dropdown labeled "Select Reviewer:"
   - List of available reviewers loaded
   - "Cancel" and "Assign" buttons

**Pass Criteria:** Senior reviewer UI shows assignment button and modal

---

### Test 4: Assign Request to Another Reviewer
**Purpose:** Verify senior reviewer can assign to others

1. As senior reviewer, click "Assign to Reviewer..." on an unassigned request
2. Select a reviewer from the dropdown
3. Click "Assign" button
4. **Expected Result:** 
   - Success toast message: "Request assigned to [email]"
   - Modal closes
   - Request disappears from "Unassigned" tab
5. Logout and login as the assigned reviewer
6. Navigate to "My Account" → "My Rights Reviews"
7. **Expected Result:** Request appears in "My Reviews" tab
8. Check notifications for the assigned reviewer
9. **Expected Result:** Notification received about assignment

**Pass Criteria:** Assignment to other reviewers works correctly

---

### Test 5: API Endpoint - List Reviewers
**Purpose:** Verify /api/rightsrequests/reviews/reviewers endpoint

1. Open browser console
2. Execute:
   ```javascript
   fetch('/api/rightsrequests/reviews/reviewers', {
     credentials: 'include'
   }).then(r => r.json()).then(console.log)
   ```
3. **Expected Result (if senior reviewer):**
   - Returns list of reviewers
   - Each reviewer has `email` and `permissions` fields
4. **Expected Result (if regular reviewer):**
   - Returns 403 error
   - Message: "Senior rights reviewer permission required"

**Pass Criteria:** Endpoint returns reviewers for senior reviewers only

---

### Test 6: API Endpoint - Assign to Reviewer
**Purpose:** Verify /api/rightsrequests/reviews/assign-to endpoint

1. As senior reviewer, in browser console:
   ```javascript
   fetch('/api/rightsrequests/reviews/assign-to', {
     method: 'POST',
     credentials: 'include',
     headers: {'Content-Type': 'application/json'},
     body: JSON.stringify({
       requestId: 'REQUEST_ID_HERE',
       assigneeEmail: 'test-reviewer@adobe.com'
     })
   }).then(r => r.json()).then(console.log)
   ```
2. **Expected Result:**
   - Success response
   - Request assigned to specified reviewer
3. Try same API call as regular reviewer
4. **Expected Result:**
   - 403 error
   - Message: "Senior rights reviewer permission required"

**Pass Criteria:** API enforces senior reviewer permission

---

### Test 7: Reports Page Terminology
**Purpose:** Verify report columns updated

1. Login as a user with `reports-admin` permission
2. Navigate to reports page
3. **Expected Result:** Column header shows "RIGHTSREVIEWER" (not "RIGHTSMANAGER")
4. Export report to CSV
5. **Expected Result:** CSV header shows "RIGHTSREVIEWER" (not "RIGHTSMANAGER")

**Pass Criteria:** All report terminology updated

---

### Test 8: Permission Validation
**Purpose:** Verify invalid assignments are blocked

1. As senior reviewer, try to assign to a user without reviewer permission
2. **Expected Result:** Error message about invalid assignee
3. Try to assign an already-assigned request
4. **Expected Result:** Error message "Unassigned review not found"

**Pass Criteria:** Proper validation prevents invalid assignments

---

### Test 9: Self-Assignment Still Works for Senior Reviewers
**Purpose:** Verify senior reviewers can still self-assign

1. Login as senior reviewer
2. View unassigned request
3. Click "Assign to Me" button (not "Assign to Reviewer...")
4. **Expected Result:** Request assigned to self immediately
5. **Expected Result:** Request moves to "My Reviews" tab

**Pass Criteria:** Both assignment methods work for senior reviewers

---

### Test 10: Notifications
**Purpose:** Verify notification system works

1. As regular user, submit a new rights request
2. Check notifications for all users in RIGHTS_REVIEWERS array
3. **Expected Result:** All receive "New Rights Review Request" notification
4. As senior reviewer, assign request to another reviewer
5. Check notifications for assigned reviewer
6. **Expected Result:** Receives "Rights Request Assigned to You" notification

**Pass Criteria:** All notifications sent correctly

---

## Browser Console Testing

### Check Current User Permissions
```javascript
console.log(window.user.permissions);
// Should include 'rights-reviewer' or 'senior-rights-reviewer'
```

### Check if Senior Reviewer
```javascript
window.user?.permissions?.includes('senior-rights-reviewer');
// Should return true for senior reviewers
```

### Test API Calls
```javascript
// List available reviewers (senior only)
fetch('/api/rightsrequests/reviews/reviewers', {
  credentials: 'include'
}).then(r => r.json()).then(console.log);

// Assign to reviewer (senior only)
fetch('/api/rightsrequests/reviews/assign-to', {
  method: 'POST',
  credentials: 'include',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    requestId: 'YOUR_REQUEST_ID',
    assigneeEmail: 'reviewer@example.com'
  })
}).then(r => r.json()).then(console.log);
```

---

## Known Issues / Edge Cases

### None Currently Identified
If you encounter any issues during testing, please document:
1. Steps to reproduce
2. Expected vs actual behavior
3. Browser console errors
4. Network request failures

---

## Regression Testing Checklist

Verify existing functionality still works:

- [ ] Regular users can submit rights requests
- [ ] Notifications are sent to reviewers on new requests
- [ ] Self-assignment works (existing flow)
- [ ] Status changes work for assigned requests
- [ ] Reports page loads and displays data
- [ ] CSV export works
- [ ] Submitters can cancel their requests
- [ ] Review details page displays correctly
- [ ] All tabs (Unassigned/My Reviews) work correctly
- [ ] Filters work on reviews page

---

## Success Criteria

All tests must pass with the following outcomes:
- ✅ Legacy `rights-manager` permission continues to work
- ✅ New `rights-reviewer` permission works for regular reviewers
- ✅ Senior reviewers can assign to other reviewers
- ✅ Regular reviewers cannot access senior functionality
- ✅ All API endpoints enforce proper permissions
- ✅ UI displays correct buttons based on user role
- ✅ Reports use updated terminology
- ✅ No existing functionality is broken
- ✅ All notifications are sent correctly

---

## Troubleshooting

### "403 Permission Required" Errors
- Check user permissions in `/config/access/permissions` sheet
- Verify permissions include `rights-reviewer` or `senior-rights-reviewer`
- Clear browser cache and reload

### Assignment Modal Empty Dropdown
- Check browser console for API errors
- Verify `/api/rightsrequests/reviews/reviewers` endpoint returns data
- Ensure at least one user has reviewer permission in config

### Button Not Showing
- Verify `window.user.permissions` in browser console
- Check for JavaScript errors in console
- Verify user has `senior-rights-reviewer` permission

---

## Configuration Reference

### Permission Names
- `rights-reviewer` - Can review and self-assign requests (replaces `rights-manager`)
- `senior-rights-reviewer` - Can assign requests to other reviewers
- `rights-manager` - Legacy permission (still supported for backwards compatibility)
- `reports-admin` - Can access reports page

### Config Sheet Location
`/config/access/permissions` in EDS (https://da.live)

---

## Next Steps After Testing

1. If all tests pass, update production config sheets with new permissions
2. Communicate changes to team about new senior reviewer role
3. Consider deprecation timeline for `rights-manager` permission (suggest 3-6 months)
4. Monitor for any issues in production
5. Update internal documentation with new workflow


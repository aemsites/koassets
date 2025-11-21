# Rights Management Permissions Legend

## Permission Names

| Full Name | Alias | Description |
|-----------|-------|-------------|
| `rights-reviewer` | `rr` | Can review rights requests and self-assign unassigned requests |
| `rights-manager` | `rm` | Can assign unassigned requests to other reviewers (supervisory role) |
| `reports-admin` | - | Can view rights request reports |

## Usage in /config/access/permissions Sheet

You can use either full names or aliases in the permissions column.

### Full Names (Explicit)

```csv
email,permissions
reviewer@example.com,rights-reviewer
manager@example.com,rights-manager,rights-reviewer
admin@example.com,reports-admin,rights-reviewer
```

### With Aliases (Recommended for Brevity)

```csv
email,permissions
reviewer@example.com,rr
manager@example.com,rm,rr
admin@example.com,reports-admin,rr
```

## Permission Hierarchy

```
rights-manager (rm)
  └─ Can assign requests to reviewers
  └─ Should typically also have rights-reviewer permission

rights-reviewer (rr)
  └─ Can review requests
  └─ Can self-assign unassigned requests
  └─ Can update review status

reports-admin
  └─ Can view aggregate rights request reports
```

## Best Practices

### 1. Rights Managers Should Have Both Permissions

Rights managers need both `rm` and `rr` to:
- Assign requests to others (`rm`)
- Review requests themselves (`rr`)

**Recommended:**
```csv
manager@example.com,rm,rr
```

### 2. Regular Reviewers Only Need Base Permission

Regular reviewers only need `rr`:
```csv
reviewer@example.com,rr
```

### 3. Use Aliases for Easier Administration

Aliases make the sheet more concise and easier to read:
- ✅ `rm,rr` is shorter and clearer
- ❌ `rights-manager,rights-reviewer` is verbose

### 4. Case Sensitivity

All permissions are **case-sensitive**. Use lowercase:
- ✅ `rights-reviewer` or `rr`
- ❌ `Rights-Reviewer` or `RR`

## Common Configurations

### Regular Reviewer
Can review and self-assign:
```csv
reviewer1@adobe.com,rr
reviewer2@adobe.com,rights-reviewer
```

### Rights Manager (Supervisor)
Can assign to others and review:
```csv
supervisor@adobe.com,rm,rr
manager@adobe.com,rights-manager,rights-reviewer
```

### Admin with Reports Access
Can review and view reports:
```csv
admin@adobe.com,rr,reports-admin
```

## Migration from Legacy Permissions

If you have existing `rights-manager` permissions in your sheet, update them:

**Before (Legacy):**
```csv
user@adobe.com,rights-manager
```

**After (New System):**
```csv
user@adobe.com,rr                    # Regular reviewer
supervisor@adobe.com,rm,rr           # Supervisor who can assign
```

## Troubleshooting

### Buttons Not Appearing in UI

**Problem:** "Assign To..." button not showing for managers

**Solution:** Check that user has:
1. Both `rm` (or `rights-manager`) and `rr` (or `rights-reviewer`) permissions
2. User has logged out and back in (permissions load at login)
3. Permissions are spelled correctly and lowercase

**Debug:** Check permissions in browser console:
```javascript
console.log('Permissions:', window.user?.permissions);
```

### 403 Permission Denied Errors

**Problem:** API returns permission denied

**Possible causes:**
1. Missing required permission
2. Typo in permission name
3. User session not refreshed after permission change

**Solution:** 
1. Verify permission in sheet
2. Log out and log back in
3. Check browser console for loaded permissions

## Sheet Examples

### Minimal Setup
```csv
email,permissions
*,preview
@adobe.com,preview
reviewer@adobe.com,rr
manager@adobe.com,rm,rr
```

### Full Featured Setup
```csv
email,permissions
*,preview
@adobe.com,preview
reviewer1@adobe.com,rr
reviewer2@adobe.com,rr
supervisor@adobe.com,rm,rr
admin@adobe.com,rm,rr,reports-admin
readonly-admin@adobe.com,reports-admin
```

## Notes

- **Aliases are normalized at login:** `rr` → `rights-reviewer`, `rm` → `rights-manager`
- **Permissions are stored in session cookie** and persist until logout or expiration
- **Changes to permissions require re-login** to take effect
- **All permissions are additive:** users can have multiple permissions
- **Wildcard (`*`) and domain (`@adobe.com`) permissions** also support aliases

## See Also

- `IMPLEMENTATION_SUMMARY.md` - Technical implementation details
- `TESTING_GUIDE_RIGHTS_REVIEWER_REFACTOR.md` - Testing procedures
- `/config/access/permissions` - Actual permissions sheet (EDS)


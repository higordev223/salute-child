# Quick Fix Reference

## The Problem
```
❌ BEFORE: Both #category AND #language have .active class on page load
✅ AFTER:  Only #category has .active class
```

## The Root Cause
KiviCare's initialization script adds `.active` to the language panel when it's added to the widget order.

## The Solution
**JavaScript removes the `.active` class before CSS processes it.**

## Files to Upload

1. `includes/kivicare-customizations/auto-assignment.php`
2. `includes/kivicare-customizations/language-tab.php`

## After Upload Checklist

- [ ] Clear WordPress cache
- [ ] Clear browser cache (Ctrl+Shift+R)
- [ ] Clear CDN cache (if applicable)
- [ ] Test in incognito/private window
- [ ] Open browser console (F12)

## Success Indicators

### In Browser Console:
```
✅ "Language panel has .active class on load - REMOVING IT"
✅ "Tab visibility initialized - only #category should be active"
✅ Panel: #language → Has .active class: false
✅ Panel: #language → Computed display: none
```

### On Page:
```
✅ Only Service Selection visible on load
✅ Language Selection completely hidden
✅ No double panels visible
```

## If Still Not Working

Run in console:
```javascript
$('#language').removeClass('active');
location.reload();
```

Then check:
1. Files uploaded to correct path?
2. All caches cleared?
3. JavaScript errors in console?
4. Testing in incognito mode?

## Quick Test
```javascript
// Paste in console after page loads
console.log('Category:', $('#category').hasClass('active'));
console.log('Language:', $('#language').hasClass('active'));
// Should show: Category: true, Language: false
```

## Support Info
If issues persist, provide:
- Full console debug output (from "=== MEDICO CONTIGO TAB VISIBILITY DEBUG ===")
- Screenshot showing both panels
- Browser name and version

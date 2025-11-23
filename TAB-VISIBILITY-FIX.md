# Tab Visibility Fix - Language Panel Issue

## Problem Summary
Both Step 1 (Service Selection `#category`) and Step 2 (Language Selection `#language`) panels were visible simultaneously on page load, even though only `#category` had the `.active` class.

## Root Cause (UPDATED AFTER DEBUGGING)

**The ACTUAL problem discovered through console debugging:**

KiviCare is incorrectly adding the `.active` class to **BOTH** the `#category` panel AND the `#language` panel on page load!

From the debug output:
```
Panel: #category
  Has .active class: true  ✅

Panel: #language
  Has .active class: true  ❌ SHOULD BE FALSE!
```

This happens because when we add the language tab to the widget order, KiviCare's initialization script treats it as an active tab by default.

**Secondary issue:** The CSS `:not(.active)` approach is correct, but ineffective when both panels have `.active` class.

## Solution Implemented

### 1. **Improved CSS Specificity** (auto-assignment.php)
Changed from:
```css
/* OLD - Hides EVERYTHING then shows active */
.iq-fade.iq-tab-pannel { display: none !important; }
.iq-fade.iq-tab-pannel.active { display: block !important; }
```

To:
```css
/* NEW - Only hides inactive panels */
.iq-fade.iq-tab-pannel:not(.active) { display: none !important; }
```

**Why this works:**
- The `:not(.active)` selector only targets panels WITHOUT the active class
- Active panels remain untouched by the hiding rules
- No CSS specificity conflict with KiviCare's active panel styles

### 2. **Nuclear Option CSS** (auto-assignment.php lines 140-156)
Added maximum specificity rules as a fallback:
```css
html body #wizard-tab .iq-tab-pannel#language:not(.active) {
    display: none !important;
    visibility: hidden !important;
    /* ... multiple hiding techniques ... */
}
```

Uses multiple hiding techniques:
- `display: none` - Removes from layout
- `visibility: hidden` - Hides visually
- `position: absolute; left: -99999px` - Moves off-screen
- `clip: rect(0,0,0,0)` - Clips to zero size
- `pointer-events: none` - Disables interaction
- `z-index: -1` - Sends to back

### 3. **Active Class Removal on Page Load** (language-tab.php lines 185-218)
**THE PRIMARY FIX:**

```javascript
function initializeTabVisibility() {
    var $languagePanel = $('#language');

    // Remove active class that KiviCare incorrectly adds
    if ($languagePanel.hasClass('active')) {
        $languagePanel.removeClass('active');
    }

    // Ensure only category panel is active
    $('#category').addClass('active');

    // Remove active from all other panels
    $('.iq-tab-pannel').not('#category').removeClass('active');
}
```

This runs:
- **Immediately** on script load (using `tryInitialize()` with 50ms retries)
- On `document.ready`
- At 100ms, 200ms, 500ms, 1000ms, and 2000ms intervals
- Via **MutationObserver** whenever KiviCare tries to add `.active` back

### 4. **MutationObserver Protection** (language-tab.php lines 280-288)
Watches for when KiviCare tries to add `.active` class to `#language` and **removes it immediately**:

```javascript
// Watch for class changes
if ($target.attr('id') === 'language' && $target.hasClass('active')) {
    // Check if user actually clicked the tab
    if (!sessionStorage.getItem('mc_language_tab_clicked')) {
        console.warn("KiviCare incorrectly added .active - REMOVING IT");
        $target.removeClass('active');
    }
}
```

Uses **sessionStorage flag** to allow `.active` class only when user legitimately clicks the language tab.

### 5. **Inline Style Cleanup** (language-tab.php lines 255-263)
Secondary protection to remove any inline styles that override CSS:

```javascript
// Remove inline styles and let CSS take over
$panel.removeAttr('style');
```

### 6. **Debugging Script** (auto-assignment.php lines 197-228)
Added comprehensive logging that shows:
- Panel ID
- Has `.active` class?
- Is visible?
- Computed CSS `display` value
- Inline styles present
- Warning flags for incorrect visibility

## Testing Instructions

### 1. Upload the Modified Files
Upload these files to your WordPress installation:
```
/wp-content/themes/salute-child/
├── includes/kivicare-customizations/
│   ├── auto-assignment.php (MODIFIED)
│   └── language-tab.php (MODIFIED)
```

### 2. Clear All Caches
- **WordPress cache**: If using a caching plugin (WP Super Cache, W3 Total Cache, etc.)
- **Browser cache**: Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- **CDN cache**: If using Cloudflare/other CDN, purge cache
- **Server cache**: Clear any server-level caching (Redis, Varnish, etc.)

### 3. Test the Booking Widget
1. Open the booking page in a **private/incognito browser window**
2. Open browser DevTools (F12)
3. Go to the **Console** tab
4. Refresh the page

### 4. Check the Debug Output
After 1.5 seconds, you should see:
```
=== MEDICO CONTIGO TAB VISIBILITY DEBUG ===

Panel: #category
  Has .active class: true
  jQuery :visible: true
  Computed display: block
  Inline styles: none
  All classes: iq-fade iq-tab-pannel active
  ✓ Correctly visible (active)

Panel: #language
  Has .active class: false
  jQuery :visible: false
  Computed display: none
  Inline styles: none
  All classes: iq-fade iq-tab-pannel
  ✓ Correctly hidden (inactive)

=== END DEBUG ===
```

### 5. Expected Behavior
✅ **CORRECT:**
- Only `#category` panel visible on load
- `#language` panel completely hidden
- After selecting service and clicking "Next", `#language` becomes visible

❌ **INCORRECT (if still happening):**
- Both panels visible on load
- Warning in console: "⚠️ WARNING: Panel is VISIBLE but should be HIDDEN!"

## Troubleshooting

### If Language Panel is Still Visible

#### Issue 1: CSS Not Loading
**Check in DevTools → Elements:**
1. Inspect the `#language` element
2. Look at the "Computed" tab
3. Check if `display: none` is present
4. If not, check the "Styles" tab to see what's overriding

**Fix:**
- Ensure files are uploaded to correct path
- Clear WordPress cache
- Check for CSS errors preventing stylesheet from loading

#### Issue 2: Inline Styles Overriding
**Check in DevTools → Elements:**
1. Inspect the `#language` element
2. Look for `style="display: block"` or similar in the HTML

**What you'll see:**
```html
<!-- BAD: Inline style overriding CSS -->
<div id="language" class="iq-tab-pannel" style="display: block;">

<!-- GOOD: No inline styles, CSS controls it -->
<div id="language" class="iq-tab-pannel">
```

**Fix:**
- Our MutationObserver should remove these automatically
- If still present, check console for JavaScript errors
- Ensure jQuery is loaded before our scripts

#### Issue 3: KiviCare Update Conflict
If KiviCare plugin was updated recently:
1. Check if language tab files still exist in plugin directory
2. Re-run the auto-copy by visiting any page (our code auto-copies on each page load)
3. Check error log for copy failures

#### Issue 4: Theme CSS Conflict
**Check in DevTools → Elements → Computed:**
Look for the CSS rule with highest specificity that's setting `display: block`

**If you see:**
```
display: block
  .some-theme-class { ... }  <-- Higher specificity than ours
```

**Fix:**
Add even more specificity to `auto-assignment.php` CSS:
```css
html body.page div#wizard-tab div.iq-tab-pannel#language:not(.active) {
    display: none !important;
}
```

## How to Get More Debug Info

### In Browser Console:
```javascript
// Check language panel state
var lang = jQuery('#language');
console.log('Has active class:', lang.hasClass('active'));
console.log('Is visible:', lang.is(':visible'));
console.log('Computed display:', window.getComputedStyle(lang[0]).display);
console.log('Inline styles:', lang.attr('style'));
console.log('All classes:', lang.attr('class'));

// Check all CSS rules affecting it
var rules = [];
var sheets = document.styleSheets;
for (var i = 0; i < sheets.length; i++) {
    try {
        var cssRules = sheets[i].cssRules;
        for (var j = 0; j < cssRules.length; j++) {
            if (cssRules[j].selectorText && cssRules[j].selectorText.includes('#language')) {
                rules.push({
                    selector: cssRules[j].selectorText,
                    display: cssRules[j].style.display,
                    file: sheets[i].href
                });
            }
        }
    } catch(e) {}
}
console.table(rules);
```

### In WordPress Debug Log:
Check `/wp-content/debug.log` for:
- "Medico Contigo: Language tab file missing"
- "Medico Contigo: Copied tab.php to plugin directory"
- Any PHP errors

## Files Modified
1. **auto-assignment.php** - Lines 100-156, 197-228
   - Improved CSS with `:not(.active)` selector
   - Added nuclear option CSS
   - Added debugging script

2. **language-tab.php** - Lines 178-269
   - Removed aggressive inline style application
   - Added inline style removal logic
   - Added MutationObserver to watch for conflicting styles

## What to Report Back
If still having issues, please provide:
1. **Console debug output** (the full debug block)
2. **Computed display value** for `#language` (from DevTools)
3. **Inline styles** present on `#language` (from DevTools)
4. **Browser and version** being tested
5. **Screenshot** showing both panels visible

## Success Criteria
✅ On page load, only Step 1 (Service Selection) is visible
✅ Step 2 (Language Selection) is completely hidden
✅ After selecting service and clicking Next, Step 2 becomes visible
✅ Only ONE panel visible at any time
✅ Debug console shows "✓ Correctly hidden (inactive)" for `#language`

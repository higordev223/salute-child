# Service Selection Auto-Advance Fix

## Issue
When user clicks a service in Step 1, KiviCare **automatically advances to Step 2 (Language Selection)**, but the language panel was not showing.

### Why It Happened
Our MutationObserver was blocking the language tab activation because:
1. User clicks service → Service selected
2. KiviCare auto-advances to language tab → Adds `.active` to `#language`
3. MutationObserver sees `.active` being added
4. Checks `sessionStorage.getItem('mc_language_tab_clicked')` → `'false'` (user didn't manually click tab)
5. Removes `.active` → Panel stays hidden ❌

## Solution

We now use **TWO flags** to track language tab activation:

### Flag 1: `mc_language_tab_clicked`
- Set to `'true'` when user **manually clicks** the language tab button
- Indicates user-initiated navigation

### Flag 2: `mc_language_tab_allowed_by_kivicare`
- Set to `'true'` when user **selects a service**
- Indicates KiviCare will auto-advance to language tab
- Allows programmatic activation

## Code Changes

### 1. **booking-customization-v2.js** (Lines 53-55, 73-75)

When service is selected:
```javascript
// Listen for service checkbox changes
$(document).on("change", '.card-checkbox.selected-service', function () {
    if ($(this).is(":checked")) {
        var serviceId = $(this).attr("service_id") || $(this).val();

        // Allow language tab to be activated
        sessionStorage.setItem('mc_language_tab_allowed_by_kivicare', 'true');
        console.log("Allowing language tab activation after service selection");

        // ... rest of code
    }
});

// Also for label clicks
$(document).on("click", "label.btn-border01.service-content", function () {
    // ... get service ID ...

    if (serviceId) {
        // Allow language tab to be activated
        sessionStorage.setItem('mc_language_tab_allowed_by_kivicare', 'true');
        console.log("Allowing language tab activation after service selection");
    }
});
```

### 2. **language-tab.php** (Lines 302-310)

MutationObserver now checks BOTH flags:
```javascript
// Watch for class attribute changes
if ($target.attr('id') === 'language' && $target.hasClass('active')) {
    setTimeout(function() {
        var languageTabClicked = sessionStorage.getItem('mc_language_tab_clicked') === 'true';
        var allowedByProgram = sessionStorage.getItem('mc_language_tab_allowed_by_kivicare') === 'true';

        if (!languageTabClicked && !allowedByProgram) {
            // Neither flag is true → Block it
            console.warn("KiviCare incorrectly added .active to #language - REMOVING IT");
            $target.removeClass('active');
        } else {
            // At least one flag is true → Allow it
            console.log("Language tab activation allowed (user click or service selection)");
        }
    }, 10);
}
```

### 3. **Clear Flags** (Lines 350-352)

When navigating away from language tab:
```javascript
$(document).on('click', '.tab-link:not([href="#language"])', function() {
    // Clear both flags
    sessionStorage.setItem('mc_language_tab_clicked', 'false');
    sessionStorage.setItem('mc_language_tab_allowed_by_kivicare', 'false');
});
```

## Flow Diagrams

### ✅ **Scenario 1: User Clicks Service (Auto-Advance)**

```
User clicks service in Step 1
    │
    ▼
booking-customization-v2.js sets:
  sessionStorage['mc_language_tab_allowed_by_kivicare'] = 'true'
    │
    ▼
KiviCare auto-advances to Step 2
  Adds .active to #language panel
    │
    ▼
MutationObserver detects .active
  Checks flags:
    - mc_language_tab_clicked: false
    - mc_language_tab_allowed_by_kivicare: TRUE ✅
    │
    ▼
Allows .active to remain
  Console: "Language tab activation allowed (user click or service selection)"
    │
    ▼
✅ Language panel shows!
```

### ✅ **Scenario 2: User Manually Clicks Language Tab**

```
User clicks "Select Language" tab button
    │
    ▼
language-tab.php click handler sets:
  sessionStorage['mc_language_tab_clicked'] = 'true'
    │
    ▼
KiviCare adds .active to #language
    │
    ▼
MutationObserver detects .active
  Checks flags:
    - mc_language_tab_clicked: TRUE ✅
    - mc_language_tab_allowed_by_kivicare: (any)
    │
    ▼
Allows .active to remain
  Console: "Language tab activation allowed (user click or service selection)"
    │
    ▼
✅ Language panel shows!
```

### ❌ **Scenario 3: Page Load (Should Block)**

```
Page loads
    │
    ▼
KiviCare initialization
  Incorrectly adds .active to #language
    │
    ▼
initializeTabVisibility() runs:
  sessionStorage['mc_language_tab_clicked'] = 'false'
  sessionStorage['mc_language_tab_allowed_by_kivicare'] = (not set yet)
  Removes .active from #language
    │
    ▼
MutationObserver watches
  If KiviCare tries to add .active again:
    Checks flags:
      - mc_language_tab_clicked: false
      - mc_language_tab_allowed_by_kivicare: false
    │
    ▼
Removes .active
  Console: "KiviCare incorrectly added .active to #language - REMOVING IT"
    │
    ▼
✅ Language panel hidden (correct!)
```

## Files Modified

1. **[booking-customization-v2.js](e:\Work\YB\Theme Customize\salute-child\assets\js\booking-customization-v2.js)**
   - Lines 53-55: Service checkbox handler
   - Lines 73-75: Service label click handler

2. **[language-tab.php](e:\Work\YB\Theme Customize\salute-child\includes\kivicare-customizations\language-tab.php)**
   - Lines 302-310: MutationObserver check for both flags
   - Lines 350-352: Clear both flags on tab change

## Expected Console Output

### When Service is Selected:
```
Medico Contigo: Service selected: 9 Segunda opinión médica
Medico Contigo: Allowing language tab activation after service selection
Medico Contigo: Language tab activation allowed (user click or service selection)
Medico Contigo: Language tab activated
```

### When Language Tab is Clicked Manually:
```
Medico Contigo: Language tab clicked - allowing activation
Medico Contigo: #language panel already active (KiviCare handled it)
Medico Contigo: Language tab activation allowed (user click or service selection)
Medico Contigo: Language tab activated
```

## Testing Steps

1. **Upload both modified files**:
   - `booking-customization-v2.js`
   - `language-tab.php`

2. **Clear all caches** (WordPress + browser)

3. **Test Scenario 1 - Auto-Advance**:
   - Load booking page
   - Only Step 1 (Service Selection) should be visible ✅
   - Click a service
   - Step 2 (Language Selection) should appear ✅
   - Console: "Allowing language tab activation after service selection"

4. **Test Scenario 2 - Manual Click**:
   - Refresh page
   - Click "Select Language" tab button directly
   - Step 2 should appear ✅
   - Console: "Language tab clicked - allowing activation"

5. **Test Scenario 3 - Page Load**:
   - Refresh page
   - Only Step 1 should be visible ✅
   - Step 2 should be hidden ✅
   - Console: "Tab visibility initialized - only #category should be active"

## Debugging Commands

### Check Current Flags:
```javascript
console.log('Manual click:', sessionStorage.getItem('mc_language_tab_clicked'));
console.log('KiviCare allowed:', sessionStorage.getItem('mc_language_tab_allowed_by_kivicare'));
```

### Manually Allow Language Tab:
```javascript
// Simulate service selection
sessionStorage.setItem('mc_language_tab_allowed_by_kivicare', 'true');
$('#language').addClass('active');
```

### Reset Everything:
```javascript
sessionStorage.setItem('mc_language_tab_clicked', 'false');
sessionStorage.setItem('mc_language_tab_allowed_by_kivicare', 'false');
$('.iq-tab-pannel').removeClass('active');
$('#category').addClass('active');
```

## Success Criteria

✅ Page load → Only Service Selection visible
✅ Click service → Language Selection appears automatically
✅ Click "Select Language" tab → Language Selection appears
✅ Both methods load language options correctly
✅ No "REMOVING IT" warnings after service selection
✅ Console shows "Language tab activation allowed" message

# Debug: Service Cards Not Triggering Event Handlers

## The Problem
`booking-customization-v2.js` IS loading (we see "Initialization complete"), but the service selection handlers are NOT being triggered when you click a service card.

## Diagnostic Steps

Please run this in your browser console **AFTER** the page loads:

```javascript
// 1. Check if MC_Booking is loaded
console.log("MC_Booking object:", window.MC_Booking);

// 2. Check if jQuery is loaded
console.log("jQuery version:", jQuery.fn.jquery);

// 3. Find all service cards
console.log("Service cards found:", jQuery('label.btn-border01.service-content').length);

// 4. Check each service card's structure
jQuery('label.btn-border01.service-content').each(function(index) {
    var $label = jQuery(this);
    var forAttr = $label.attr('for');
    console.log("Service card #" + index + ":");
    console.log("  for attribute:", forAttr);
    console.log("  Checkbox exists:", jQuery('#' + forAttr).length > 0);
    if (jQuery('#' + forAttr).length > 0) {
        var $checkbox = jQuery('#' + forAttr);
        console.log("  Checkbox service_id:", $checkbox.attr('service_id'));
        console.log("  Checkbox value:", $checkbox.val());
        console.log("  Checkbox classes:", $checkbox.attr('class'));
    }
});

// 5. Check if service checkboxes exist
console.log("Service checkboxes (.card-checkbox.selected-service):", jQuery('.card-checkbox.selected-service').length);

// 6. Try to manually trigger a click
console.log("\nTrying to click first service card...");
jQuery('label.btn-border01.service-content').first().click();
```

## What We're Looking For

### Expected Output:
```
MC_Booking object: Object { selectedLanguage: null, selectedService: null, ... }
jQuery version: 3.x.x
Service cards found: 3 (or however many services you have)
Service card #0:
  for attribute: service_9
  Checkbox exists: true
  Checkbox service_id: 9
  Checkbox value: 9
  Checkbox classes: card-checkbox selected-service
Service checkboxes (.card-checkbox.selected-service): 3
```

### If You See:
- ❌ `Service cards found: 0` → The selector is wrong, cards have different classes
- ❌ `Checkbox exists: false` → The checkbox ID doesn't match the label's `for` attribute
- ❌ `Service checkboxes (.card-checkbox.selected-service): 0` → Checkboxes have different classes
- ❌ `Checkbox service_id: undefined` → The service_id attribute is not set

## Possible Fixes

### Fix 1: Wrong Selectors
If the service cards don't have the expected classes, we need to find the correct selectors.

Run this to find all possible service-related elements:
```javascript
// Find all labels
console.log("All labels:", jQuery('label').length);
jQuery('label').each(function() {
    if (jQuery(this).text().includes('Service') || jQuery(this).attr('for')) {
        console.log("Label:", jQuery(this).attr('class'), "for:", jQuery(this).attr('for'));
    }
});

// Find all checkboxes
console.log("All checkboxes:", jQuery('input[type="checkbox"]').length);
jQuery('input[type="checkbox"]').each(function() {
    var $cb = jQuery(this);
    if ($cb.attr('id') && $cb.attr('id').includes('service')) {
        console.log("Checkbox:", $cb.attr('id'), "classes:", $cb.attr('class'));
    }
});
```

### Fix 2: Timing Issue
If the service cards are loaded AFTER our script runs, we need to wait for them:

```javascript
// Check if cards exist now
setTimeout(function() {
    console.log("After 2 seconds:");
    console.log("  Service cards:", jQuery('label.btn-border01.service-content').length);
    console.log("  Service checkboxes:", jQuery('.card-checkbox.selected-service').length);
}, 2000);
```

### Fix 3: Event Delegation Not Working
If event handlers aren't being attached, try manual attachment:

```javascript
// Manually attach to first service card
var firstCard = jQuery('label.btn-border01.service-content').first();
if (firstCard.length > 0) {
    firstCard.on('click', function() {
        console.log("✅ Manual click handler worked!");
        console.log("  for:", jQuery(this).attr('for'));
    });
    console.log("Manual handler attached to first card");
}
```

## Please Run and Share

1. Open browser console (F12)
2. Copy-paste the first diagnostic script above
3. Press Enter
4. Share the complete output with me

This will tell us exactly why the service selection handlers aren't firing!

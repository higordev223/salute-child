# How the Tab Visibility Fix Works

## The Complete Flow

### 🔵 **Scenario 1: Page Load (SHOULD HIDE Language Panel)**

```
┌─────────────────────────────────────────────────────┐
│ 1. Page Loads                                       │
│    - KiviCare initializes widget                    │
│    - KiviCare incorrectly adds .active to #language │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 2. Our Script Runs (IMMEDIATELY)                    │
│    - tryInitialize() runs every 50ms                │
│    - Finds #language with .active class             │
│    - Removes .active from #language                 │
│    - Ensures only #category has .active             │
│    sessionStorage: 'mc_language_tab_clicked' = false│
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 3. CSS Takes Over                                   │
│    .iq-tab-pannel:not(.active) { display: none }    │
│    - #category has .active → VISIBLE                │
│    - #language no .active → HIDDEN                  │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 4. MutationObserver Watches                         │
│    - If KiviCare tries to add .active to #language  │
│    - Checks flag: 'false'                           │
│    - Removes .active immediately                    │
└─────────────────────────────────────────────────────┘

✅ RESULT: Only Service Selection visible
```

---

### 🟢 **Scenario 2: User Clicks Language Tab (SHOULD SHOW Language Panel)**

```
┌─────────────────────────────────────────────────────┐
│ 1. User Clicks "Select Language" Button             │
│    $(document).on('click', '#language-tab')         │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 2. Our Click Handler Fires (IMMEDIATELY)            │
│    sessionStorage: 'mc_language_tab_clicked' = TRUE │
│    - Remove .active from all other panels           │
│    - Flag set BEFORE KiviCare processes click       │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 3. KiviCare's Native Tab Handler Runs               │
│    - Adds .active to #language                      │
│    - Removes .active from other panels              │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 4. MutationObserver Detects .active Change          │
│    - Sees #language got .active class               │
│    - Waits 10ms (allows flag to be set)             │
│    - Checks flag: 'TRUE'                            │
│    - Allows .active to remain                       │
│    Console: "User legitimately activated #language" │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 5. Our Backup Handler (50ms after click)            │
│    - Checks if #language has .active                │
│    - If not, manually adds it (fallback)            │
│    - Ensures panel shows even if KiviCare failed    │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 6. CSS Makes Panel Visible                          │
│    .iq-tab-pannel.active { display: block }         │
│    - #language has .active → VISIBLE                │
│    - #category no .active → HIDDEN                  │
└─────────────────────────────────────────────────────┘

✅ RESULT: Language Selection panel becomes visible
```

---

## Timing Diagram

```
Event Timeline (milliseconds)
═══════════════════════════════════════════════════════

0ms   │ User clicks language tab
      │
      ▼
0ms   │ Click handler sets flag = TRUE
      │
      ▼
5ms   │ KiviCare adds .active to #language
      │
      ▼
5ms   │ MutationObserver detects change
      │
      ▼
15ms  │ MutationObserver checks flag (after 10ms delay)
      │ Flag = TRUE → Allows .active
      │
      ▼
50ms  │ Backup handler verifies .active exists
      │ If not, manually adds it
      │
      ▼
✅    │ Panel visible with .active class
```

---

## Key Components

### 1. **sessionStorage Flag**
```javascript
'mc_language_tab_clicked'
- 'false' → Panel should be hidden (page load)
- 'true'  → Panel can be shown (user clicked)
```

### 2. **initializeTabVisibility()**
```javascript
// Runs on page load
// Ensures only #category is active
$('.iq-tab-pannel').not('#category').removeClass('active');
```

### 3. **Click Handler**
```javascript
// Runs when user clicks language tab
sessionStorage.setItem('mc_language_tab_clicked', 'true');
$('#language').addClass('active'); // Backup
```

### 4. **MutationObserver**
```javascript
// Watches for .active being added to #language
if (flag === 'false') {
    // Page load → Remove it
    $target.removeClass('active');
} else {
    // User clicked → Allow it
    console.log("Allowing activation");
}
```

### 5. **CSS Rules**
```css
/* Hide inactive panels */
.iq-tab-pannel:not(.active) {
    display: none !important;
}

/* Show active panels */
.iq-tab-pannel.active {
    display: block !important;
}
```

---

## Protection Layers

**Layer 1: CSS** (Passive)
- Hides panels without `.active` class
- Shows panels with `.active` class

**Layer 2: JavaScript Init** (Active - Page Load)
- Removes `.active` from #language on page load
- Runs multiple times (50ms, 100ms, 200ms, etc.)

**Layer 3: MutationObserver** (Reactive)
- Watches for KiviCare adding `.active` back
- Checks user intent via sessionStorage flag
- Removes `.active` if not user-initiated

**Layer 4: Click Handler** (Active - User Click)
- Sets flag BEFORE KiviCare processes click
- Manually ensures `.active` class is added
- Fallback if KiviCare doesn't handle it

---

## Why This Approach Works

### ❌ **Why CSS Alone Fails**
```
KiviCare adds .active to both panels
→ CSS can't distinguish which should show
→ Both panels visible
```

### ❌ **Why Aggressive JavaScript Fails**
```
Remove .active on every change
→ Also removes when user legitimately clicks
→ Panel never shows
```

### ✅ **Why This Approach Works**
```
Track user intent (sessionStorage flag)
→ Allow .active when user clicks
→ Remove .active on page load only
→ Panel shows when clicked, hidden on load
```

---

## Debugging Commands

### Check Current State:
```javascript
console.log('Flag:', sessionStorage.getItem('mc_language_tab_clicked'));
console.log('Category active:', $('#category').hasClass('active'));
console.log('Language active:', $('#language').hasClass('active'));
```

### Force Show Language Panel:
```javascript
sessionStorage.setItem('mc_language_tab_clicked', 'true');
$('#language').addClass('active');
```

### Force Hide Language Panel:
```javascript
sessionStorage.setItem('mc_language_tab_clicked', 'false');
$('#language').removeClass('active');
```

### Reset to Default State:
```javascript
sessionStorage.setItem('mc_language_tab_clicked', 'false');
$('.iq-tab-pannel').removeClass('active');
$('#category').addClass('active');
```

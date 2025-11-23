# Fix Applied - Doctor Session Error

## Problem
You were getting error: **"Select doctor session is not available with selected clinic, please select other doctor or other clinic"**

This happened because:
- We hid the doctor selection UI
- But KiviCare needs a doctor selected BEFORE showing date/time slots
- Our original code only assigned doctor when saving the appointment (too late!)

## Solution Applied

I've updated the code to **automatically select a doctor** as soon as a service is selected, BEFORE the user gets to the date/time step.

### What Changed:

#### 1. JavaScript (`booking-customization.js`)
- Added `autoSelectDoctor()` function
- Automatically selects first available doctor when service is clicked
- Injects doctor into all KiviCare inputs
- Intercepts AJAX calls to ensure doctor is included

#### 2. PHP (`auto-assignment.php`)
- Added new AJAX handler: `mc_get_first_available_doctor`
- Returns first available doctor for selected service
- Considers language preference if specified

### How It Works Now:

```
1. Patient clicks SERVICE (e.g., "General Medicine")
   ↓
2. JavaScript automatically calls AJAX to get first available doctor
   ↓
3. Doctor ID is stored in hidden inputs and global variables
   ↓
4. Language selection appears (optional)
   ↓
5. Patient proceeds to DATE/TIME step
   ↓
6. KiviCare loads time slots for auto-selected doctor ✓
   ↓
7. Patient completes booking
   ↓
8. Final doctor assignment happens (with language matching if selected)
```

---

## Files to Upload

Upload these **UPDATED** files to your SFTP server:

### 1. JavaScript File
**File**: `assets/js/booking-customization.js`
**Upload to**: `/wp-content/themes/salute-child/assets/js/booking-customization.js`

### 2. PHP File
**File**: `includes/kivicare-customizations/auto-assignment.php`
**Upload to**: `/wp-content/themes/salute-child/includes/kivicare-customizations/auto-assignment.php`

---

## Testing Steps

After uploading:

### Step 1: Clear Cache
- Browser cache: `Ctrl + Shift + Delete`
- WordPress cache (if you have cache plugin)

### Step 2: Test Booking Flow
1. **Go to booking page**
2. **Press F12** → Open Console
3. **Click on a service** (e.g., "General Medicine")
4. **Watch console** for messages:
   ```
   Medico Contigo: Service card clicked, ID: [number]
   Medico Contigo: Auto-selecting doctor for service: [number]
   Medico Contigo: Doctor auto-select response: {success: true...}
   Medico Contigo: Auto-selected doctor ID: [number]
   ```

### Step 3: Check Date/Time Step
1. After selecting service (and optionally language)
2. **Click Next** to go to Date/Time step
3. **You should see available time slots** (no error!)
4. **Console should show**:
   ```
   Medico Contigo: Ensuring doctor is set for date/time step
   ```

### Step 4: Complete Booking
- Select date & time
- Fill description
- Submit
- Check admin to verify doctor is assigned

---

## What to Expect

### ✅ GOOD Signs:
- No error about doctor session
- Date/time slots appear
- Console shows "Auto-selected doctor ID: [number]"
- Can complete booking successfully
- Doctor is assigned in admin panel

### ❌ BAD Signs (and how to fix):

#### Still seeing doctor session error:
**Debug in console:**
```javascript
console.log('Selected doctor:', window.MC_SELECTED_DOCTOR);
console.log('Doctor inputs:', $('input[name="doctor_id"]').val());
```

**If undefined**, manually trigger:
```javascript
MC_Booking.selectedService = 1; // Replace with actual service ID
MC_Booking.autoSelectDoctor(1); // Replace with actual service ID
```

#### AJAX error in console:
**Check:** 
```javascript
console.log('AJAX URL:', ajax_object.ajax_url);
```

**Test AJAX directly:**
```javascript
jQuery.post(ajax_object.ajax_url, {
    action: 'mc_get_first_available_doctor',
    service_id: 1  // Replace with actual service ID
}, function(response) {
    console.log('Doctor response:', response);
});
```

#### No doctors available:
**Verify doctors are configured:**
1. Go to: KiviCare → Doctors
2. Check if doctors have:
   - Services assigned
   - Clinic assigned
   - Schedules configured

---

## Quick Diagnostic

Run in browser console (F12) after clicking a service:

```javascript
console.log('=== MEDICO CONTIGO DIAGNOSTIC ===');
console.log('Service selected:', MC_Booking.selectedService);
console.log('Doctor auto-selected:', window.MC_SELECTED_DOCTOR);
console.log('Doctor in inputs:', $('input[name="doctor_id"]').val());
console.log('MC_Booking object:', typeof MC_Booking);
console.log('================================');
```

**Expected Output:**
```
Service selected: 1 (or some number)
Doctor auto-selected: {id: 123, timeSlot: 30}
Doctor in inputs: 123 (or some number)
MC_Booking object: object
```

---

## If Still Not Working

### Option 1: Check if doctors exist for service
```sql
SELECT 
    s.name AS service_name,
    u.display_name AS doctor_name,
    sdm.doctor_id
FROM wp_kc_service_doctor_mapping sdm
JOIN wp_kc_services s ON s.id = sdm.service_id
JOIN wp_users u ON u.ID = sdm.doctor_id
WHERE sdm.service_id = 1  -- Replace with your service ID
AND sdm.status = 1;
```

If empty → No doctors assigned to this service!

### Option 2: Manually set doctor in console
```javascript
// Force set doctor ID (replace 123 with actual doctor ID)
window.MC_SELECTED_DOCTOR = {id: 123, timeSlot: 30};
$('input[name="doctor_id"]').val(123);
```

Then try proceeding to date/time.

### Option 3: Check PHP errors
Enable WordPress debug:
```php
// In wp-config.php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
```

Check: `wp-content/debug.log` for errors

---

## Files Summary

**Updated Files:**
1. ✅ `assets/js/booking-customization.js` - Auto-selection logic
2. ✅ `includes/kivicare-customizations/auto-assignment.php` - AJAX handler

**Unchanged Files:**
- `functions.php` - No changes needed
- `includes/kivicare-customizations/language-tab.php` - No changes needed

---

## Upload Now!

1. **Connect to SFTP**
   - Server: `access-5018034562.webspace-host.com`
   - Port: `22`
   - Username: `a2580036`
   - Password: `F$0y)K2DEwj(K6%T@iO5T$(B`

2. **Upload 2 files:**
   - `assets/js/booking-customization.js`
   - `includes/kivicare-customizations/auto-assignment.php`

3. **Clear cache and test!**

---

**This should fix the "Select doctor session" error!** 

Let me know if you still see the error after uploading these files.


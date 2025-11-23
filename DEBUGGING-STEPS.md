# Debugging Guide - Step by Step

## Upload These Updated Files

**IMPORTANT:** Upload these files via SFTP:

1. `includes/kivicare-customizations/auto-assignment.php` (UPDATED)
2. `assets/js/booking-customization.js` (UPDATED)

Upload location: `/wp-content/themes/salute-child/`

---

## After Upload: Clear Cache

1. **Browser**: Ctrl + Shift + Delete → Clear cached files
2. **WordPress**: If using cache plugin, clear it
3. **Hard Refresh**: Ctrl + F5 on the booking page

---

## Check 1: Is Doctor Field Hidden?

### Where to Check:

1. Go to the page with KiviCare booking widget
2. Look at the left sidebar tabs

### What You Should See:

- ❌ NO "Choose Your Doctor" tab
- ✅ You should see: Clinic → Service → Date & Time → Confirm

### What You Should NOT See:

- ❌ "Choose Your Doctor" or "Select Doctor" tab

### If Still Showing:

Open browser console (F12) and paste:

```javascript
jQuery('.tab-link[href="#doctor"]').parent().remove();
jQuery("#doctor").remove();
```

If that removes it, the JavaScript is working.

---

## Check 2: Is Language Selection Appearing?

### Where to Check:

1. Go to booking widget
2. Click on a **Service** (e.g., "General Medicine")
3. Wait 2 seconds

### What You Should See:

- A new section appears titled "Select Your Preferred Language"
- You see language cards (Spanish, English, etc.)

### Debug in Console (F12):

Check for these messages:

```
Medico Contigo: Initializing booking customization
Medico Contigo: Widget found!
Medico Contigo: Service card clicked, ID: [number]
Medico Contigo: Languages displayed
```

### If Not Appearing:

Run in console:

```javascript
console.log("Widget exists:", jQuery("#kivicare-widget-main-content").length);
console.log("MC_Booking loaded:", typeof MC_Booking);
MC_Booking.injectLanguageSelection();
MC_Booking.showLanguageSelection();
```

---

## Check 3: Is AJAX Working?

### In Browser Console (F12):

1. Go to **Network** tab
2. Clear network log
3. Click on a service
4. Look for request to: `admin-ajax.php`
5. Click on it
6. Check **Response** tab

### What You Should See:

```json
{
  "success": true,
  "data": [
    { "code": "es", "name": "Español" },
    { "code": "en", "name": "English" }
  ]
}
```

### If You See Error:

- Check if `ajax_object` is defined: `console.log(ajax_object)`
- Verify AJAX URL: `console.log(ajax_object.ajax_url)`

---

## Check 4: Where to See Auto-Assigned Doctor?

### In WordPress Admin:

1. **Log into WordPress Admin**
2. **Go to:** KiviCare → Appointments
3. **Click** on the appointment you just created
4. **Look for:** "Doctor" field

### What You Should See:

- Doctor name should be filled (e.g., "Dr. Smith")
- NOT empty or "Select Doctor"

### Via Database (phpMyAdmin):

```sql
SELECT
    id,
    patient_id,
    doctor_id,
    appointment_start_date,
    appointment_start_time,
    status,
    created_at
FROM wp_kc_appointments
ORDER BY id DESC
LIMIT 10;
```

**Check:** `doctor_id` column should have a number (not 0 or NULL)

### Get Doctor Name:

```sql
SELECT
    a.id AS appointment_id,
    a.appointment_start_date,
    a.appointment_start_time,
    u.display_name AS doctor_name,
    p.display_name AS patient_name
FROM wp_kc_appointments a
LEFT JOIN wp_users u ON u.ID = a.doctor_id
LEFT JOIN wp_users p ON p.ID = a.patient_id
ORDER BY a.id DESC
LIMIT 10;
```

---

## Check 5: Test Complete Booking Flow

### Step-by-Step Test:

1. **Open booking page** (logged out or incognito)

2. **Check sidebar tabs:**

   - Should NOT see "Choose Doctor"

3. **Click on a service** (e.g., "General Medicine")

   - Wait 2 seconds
   - Language section should appear

4. **Open Console (F12)** and check for messages:

   ```
   Medico Contigo: Service card clicked
   Medico Contigo: AJAX response: {success: true, data: [...]}
   Medico Contigo: Languages displayed
   ```

5. **Click on a language** (e.g., "Español")

   - Card should highlight with blue border
   - Console should show: `Medico Contigo: Language selected: es`

6. **Continue booking:**

   - Select date & time
   - Fill description
   - Submit

7. **Check admin panel:**
   - Go to KiviCare → Appointments
   - Open the appointment
   - Verify doctor is assigned

---

## Common Issues & Fixes

### Issue: "Design is broken"

**Cause:** CSS conflicts

**Fix:** Add this to `functions.php`:

```php
add_action('wp_head', function() {
    ?>
    <style>
    #mc-language-selection-wrapper {
        max-width: 100% !important;
        overflow: visible !important;
    }
    .mc-language-card {
        box-sizing: border-box !important;
    }
    </style>
    <?php
}, 1000);
```

### Issue: "Doctor field still showing"

**Fix 1:** Run in console:

```javascript
jQuery(".tab-item").each(function () {
  if (jQuery(this).find('a[href="#doctor"]').length > 0) {
    jQuery(this).remove();
  }
});
```

**Fix 2:** Check if files uploaded correctly:

```bash
ls -la wp-content/themes/salute-child/includes/kivicare-customizations/
ls -la wp-content/themes/salute-child/assets/js/
```

### Issue: "Languages not loading"

**Fix:** Check doctor metadata:

```sql
SELECT user_id, meta_key, meta_value
FROM wp_usermeta
WHERE meta_key IN ('basic_data', 'doctor_languages')
AND user_id IN (
    SELECT DISTINCT doctor_id
    FROM wp_kc_service_doctor_mapping
);
```

If empty, add languages manually:

```sql
-- Replace 123 with actual doctor user ID
INSERT INTO wp_usermeta (user_id, meta_key, meta_value)
VALUES
(123, 'doctor_languages', 'a:2:{i:0;s:7:"Spanish";i:1;s:7:"English";}')
ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value);
```

### Issue: "No doctor assigned"

**Debug:** Check REST API interception:

1. Open Network tab (F12)
2. Submit appointment
3. Look for POST to: `/wp-json/.../save-appointment`
4. Check **Request Payload**
5. Should have: `doctor_id: {id: 123, timeSlot: 30}`

**If missing doctor_id:**

Check PHP error log:

```bash
tail -f wp-content/debug.log
```

Enable debugging in `wp-config.php`:

```php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
define('WP_DEBUG_DISPLAY', false);
```

---

## Quick Test Commands

### Check if JavaScript loaded:

```javascript
console.log(typeof MC_Booking); // Should show "object"
```

### Manually trigger language loading:

```javascript
MC_Booking.selectedService = 1; // Use actual service ID
MC_Booking.showLanguageSelection();
```

### Check doctor hiding:

```javascript
console.log("Doctor tabs:", jQuery('.tab-link[href="#doctor"]').length); // Should be 0
```

### Test AJAX directly:

```javascript
jQuery.post(
  ajax_object.ajax_url,
  {
    action: "mc_get_service_languages",
    service_id: 1, // Replace with actual service ID
  },
  function (response) {
    console.log("AJAX Response:", response);
  }
);
```

---

## Success Checklist

When everything works, you should see:

- [ ] NO doctor tab in booking widget
- [ ] Language selection appears after clicking service
- [ ] Console shows: "Medico Contigo: Languages displayed"
- [ ] Can click and select a language
- [ ] Can complete booking without errors
- [ ] In admin panel: Appointment has doctor assigned
- [ ] Database: `wp_kc_appointments.doctor_id` is not 0

---

## Get Help

If still not working:

1. **Take screenshots of:**

   - Booking widget (showing tabs)
   - Browser console (F12 → Console tab)
   - Network tab (showing AJAX request/response)
   - Admin appointment screen

2. **Provide:**

   - Which check failed?
   - What error messages appear?
   - What does console.log show?

3. **Quick diagnostic:**

Run this in console and share output:

```javascript
console.log("=== MEDICO CONTIGO DIAGNOSTIC ===");
console.log("jQuery loaded:", typeof jQuery);
console.log("MC_Booking loaded:", typeof MC_Booking);
console.log("Widget exists:", jQuery("#kivicare-widget-main-content").length);
console.log("Doctor tabs:", jQuery('.tab-link[href="#doctor"]').length);
console.log(
  "Language wrapper:",
  jQuery("#mc-language-selection-wrapper").length
);
console.log(
  "AJAX URL:",
  typeof ajax_object !== "undefined" ? ajax_object.ajax_url : "NOT DEFINED"
);
console.log("=== END DIAGNOSTIC ===");
```

Copy the output and I can help debug further.

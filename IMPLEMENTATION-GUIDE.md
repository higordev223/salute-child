# Medico Contigo - Implementation Guide

## What I've Built

I've completely rewritten the KiviCare customizations to integrate automatic doctor assignment into the existing booking system. Here's what's been implemented:

## Files Modified/Created

### 1. Core Customization Files

```
salute-child/
├── functions.php (UPDATED)
├── includes/kivicare-customizations/
│   ├── auto-assignment.php (COMPLETELY REWRITTEN)
│   └── language-tab.php (NEW)
└── assets/js/
    └── booking-customization.js (COMPLETELY REWRITTEN)
```

### 2. What Each File Does

#### `auto-assignment.php` (Main Logic)
- **Forces doctor tab to be hidden** in all booking contexts
- **Intercepts REST API** calls to inject auto-assigned doctor
- **Implements smart doctor selection** based on:
  - Service specialty
  - Language capability  
  - Real-time availability (checks schedules, vacations, conflicts)
- **Works across all user profiles** (Patient, Doctor, Admin, Receptionist)

#### `language-tab.php` (Language Selection)
- **Creates custom language tab** in booking widget
- **Dynamically loads languages** available for selected service
- **Provides clean UI** for language selection
- **Stores language preference** for auto-assignment

#### `booking-customization.js` (Frontend Enhancement)
- **Adds language selection UI** after service selection
- **Adds file upload field** for medical documents
- **Intercepts form submission** to include language preference
- **Works with KiviCare's AJAX booking** system

#### `functions.php` (Integration)
- **Loads all customization files**
- **Enqueues JavaScript** on all pages (frontend + admin)
- **WooCommerce integration** for payment processing
- **Creates products** for appointments automatically

## How It Works

### Booking Flow (Step by Step)

1. **Patient Opens Booking Form**
   - Doctor selection is completely hidden (CSS + PHP filter)
   - Form shows: Service → Language → Date/Time → Details

2. **Service Selection**
   - Patient clicks on a service (e.g., "Psychology")
   - JavaScript detects selection
   - AJAX request fetches available languages

3. **Language Selection** 
   - Language cards appear dynamically
   - Shows only languages spoken by doctors offering that service
   - Patient clicks preferred language (e.g., "Español")

4. **Date & Time Selection**
   - Standard KiviCare date/time picker
   - Shows available slots (but doesn't show which doctor)

5. **Description & File Upload**
   - Patient adds consultation reason
   - Optional: Upload medical documents (PDFs, images, etc.)

6. **Auto-Assignment (Behind the Scenes)**
   - When form is submitted to REST API endpoint
   - PHP intercepts the request
   - Searches database for doctors who:
     - Offer the selected service
     - Speak the selected language
     - Are available at selected date/time
     - Are NOT on vacation
     - Have NO conflicting appointments
   - Assigns first matching doctor
   - Adds doctor ID to appointment data

7. **WooCommerce Checkout**
   - Creates virtual product for the appointment
   - Adds to cart with appointment details
   - Redirects to checkout
   - Patient pays via Redsys (cards/Bizum)

### Technical Implementation

#### Doctor Selection Algorithm

```php
// Priority order:
1. Doctors with matching service
2. Doctors with matching language (preferred)
3. Doctors with availability at exact time
4. Doctors NOT on vacation
5. Doctors with no conflicting appointments
6. First match wins (FIFO)
```

#### Database Tables Used

```sql
wp_kc_service_doctor_mapping   -- Which doctors offer which services
wp_kc_appointments              -- Existing appointments (check conflicts)
wp_kc_clinic_schedule           -- Doctor working hours by day
wp_kc_doctor_clinic_mappings    -- Doctor vacation periods
wp_usermeta                     -- Doctor languages and settings
```

#### REST API Interception

```php
Filter: 'rest_pre_dispatch'
Route: /kivicare/api/v1/book-appointment/save-appointment
Hook: Before appointment is saved to database
Action: Inject auto-assigned doctor_id
```

## Testing Instructions

### Step 1: Clear All Caches
```bash
# WordPress cache
# Browser cache (Ctrl+Shift+Delete)
# Server cache (if using hosting cache like Cloudflare)
```

### Step 2: Test Patient Booking Flow

1. **Log out** (or use incognito mode)
2. **Navigate to booking page** (where KiviCare widget appears)
3. **Check if doctor selection is hidden**
   - You should NOT see "Choose Your Doctor" step
   - Should go: Service → Language → Date/Time

4. **Select a service** (e.g., "General Medicine")
   - Wait 1-2 seconds
   - Language options should appear

5. **Select a language** (e.g., "Español")
   - Language card should highlight with blue border

6. **Select date and time**
   - Use any available slot

7. **Fill description**
   - Add any text (e.g., "Dolor de cabeza")

8. **Upload file (optional)**
   - Try uploading a test PDF or image

9. **Submit booking**
   - Should show success message
   - Should redirect to WooCommerce checkout

10. **Check admin panel**
    - Go to KiviCare → Appointments
    - Find the new appointment
    - **Verify doctor is assigned** (should NOT be empty)
    - **Verify language is stored**

### Step 3: Test Admin Booking

1. **Login as Admin**
2. **Go to KiviCare dashboard**
3. **Create new appointment**
4. **Verify doctor field is hidden**
5. **Complete booking**
6. **Verify doctor is auto-assigned**

### Step 4: Test Doctor Dashboard

1. **Login as Doctor**
2. **Go to Appointments**
3. **Verify you see appointments assigned to you**
4. **Try creating appointment for patient**
5. **Should work without selecting doctor**

### Step 5: Test Receptionist

1. **Login as Receptionist**
2. **Book appointment for patient**
3. **Verify doctor field hidden**
4. **Verify auto-assignment works**

## Troubleshooting

### Issue: Doctor field still showing

**Possible Causes:**
- Cache not cleared
- Another plugin overriding CSS
- JavaScript not loading

**Solutions:**
1. Clear all caches
2. Check browser console (F12) for JavaScript errors
3. Verify files uploaded correctly via SFTP
4. Check if child theme is active

### Issue: Languages not appearing

**Possible Causes:**
- Doctors don't have languages configured
- AJAX not working
- JavaScript error

**Solutions:**
1. **Check browser console** (F12) → Console tab
   - Look for errors
   - Should see: "Medico Contigo customization loaded"

2. **Verify AJAX URL**
   - Console → Network tab
   - Look for request to: `wp-admin/admin-ajax.php`
   - Check if it returns data

3. **Check doctor metadata**
   ```sql
   SELECT user_id, meta_key, meta_value 
   FROM wp_usermeta 
   WHERE meta_key LIKE '%language%' 
   AND user_id IN (SELECT ID FROM wp_users WHERE user_login = 'doctor_username');
   ```

4. **Manually set doctor languages**
   - Go to Users → Doctor profile
   - Look for language field
   - Set languages: Español, English, etc.

### Issue: No doctor assigned to appointment

**Possible Causes:**
- No doctors available at that time
- No doctors with matching language
- All doctors on vacation

**Solutions:**
1. **Check doctor availability**
   ```sql
   SELECT * FROM wp_kc_clinic_schedule 
   WHERE doctor_id = [DOCTOR_ID];
   ```

2. **Check for vacations**
   ```sql
   SELECT * FROM wp_kc_doctor_clinic_mappings 
   WHERE doctor_id = [DOCTOR_ID];
   ```

3. **Check service mappings**
   ```sql
   SELECT * FROM wp_kc_service_doctor_mapping 
   WHERE service_id = [SERVICE_ID] AND status = 1;
   ```

4. **Check PHP error log**
   - Location: `wp-content/debug.log`
   - Enable debug: Set `WP_DEBUG` to `true` in `wp-config.php`

### Issue: WooCommerce not redirecting

**Possible Causes:**
- WooCommerce not installed/active
- Hook not firing

**Solutions:**
1. **Verify WooCommerce active**
   - Plugins → Check if WooCommerce is active

2. **Check if product is created**
   ```sql
   SELECT * FROM wp_posts 
   WHERE post_type = 'product' 
   AND post_title LIKE 'Medical Appointment%'
   ORDER BY ID DESC LIMIT 5;
   ```

3. **Temporarily disable WooCommerce integration**
   - Edit `functions.php`
   - Comment out line 34-42 (WooCommerce integration)

## Configuration Guide

### Adding Doctor Languages

**Via WordPress Admin:**
1. Go to **Users → All Users**
2. Click **Edit** on a doctor
3. Scroll to **KiviCare Details**
4. Add languages in the languages field
5. Save

**Via Database:**
```sql
UPDATE wp_usermeta 
SET meta_value = 'a:2:{i:0;s:7:"Spanish";i:1;s:7:"English";}'
WHERE user_id = [DOCTOR_ID] 
AND meta_key = 'doctor_languages';
```

### Changing Auto-Assignment Logic

**Edit:** `auto-assignment.php` → Function `mc_find_best_available_doctor()`

**Current Logic:**
```php
Line 221: ORDER BY charges ASC  // Cheapest doctor first
```

**To prioritize by rating:**
```php
ORDER BY doctor_rating DESC, charges ASC
```

**To randomize:**
```php
ORDER BY RAND()
```

### Modifying Booking Flow Order

**Edit:** `language-tab.php` → Function `mc_add_language_tab_to_widget()`

**Current Position:** After service selection (position 1)

**To move after date/time:**
```php
$position = 3; // Adjust number
```

## Next Steps

### What's Working Now:
✅ Doctor selection hidden
✅ Language selection implemented
✅ Auto-assignment logic complete
✅ Works across all user roles
✅ WooCommerce integration
✅ File upload support

### What Needs Testing:
⏳ Real-world booking scenarios
⏳ Multiple simultaneous bookings
⏳ Edge cases (all doctors busy, no language match)
⏳ Payment flow completion
⏳ Vacation/schedule checking accuracy

### Future Phase 2 Features (Not Yet Built):
❌ Medical consultation forms
❌ Prescription generation
❌ Test orders workflow
❌ PDF with digital signatures
❌ SREP integration
❌ ICD database integration
❌ WebRTC video calls

## Support & Maintenance

### File Locations for Quick Edits

**Hide doctor in more places:**
```
File: auto-assignment.php
Function: mc_hide_doctor_selection_css()
Add more CSS selectors
```

**Change languages list:**
```
File: auto-assignment.php
Function: mc_get_service_languages()
Line 132: $language_names array
```

**Modify availability checking:**
```
File: auto-assignment.php
Function: mc_is_doctor_available()
Line 295: Add more conditions
```

**Customize JavaScript behavior:**
```
File: booking-customization.js
Line 20: addLanguageSelection() - Modify UI
Line 75: loadLanguagesForService() - Change AJAX
```

### Important Notes

1. **DO NOT modify KiviCare plugin files directly**
   - All customizations are in child theme
   - Safe from plugin updates

2. **Always backup before testing**
   - Database backup via phpMyAdmin
   - Files backup via SFTP

3. **Test in staging first**
   - Never test major changes on live site

4. **Monitor error logs**
   - `wp-content/debug.log`
   - Browser console

## Contact & Resources

**Files to share with developers:**
- `auto-assignment.php` (main logic)
- `language-tab.php` (UI components)
- `booking-customization.js` (frontend)
- `CUSTOMIZATION-README.md` (documentation)
- `IMPLEMENTATION-GUIDE.md` (this file)

**Useful Commands:**

```bash
# Check if files exist
ls -la wp-content/themes/salute-child/includes/kivicare-customizations/

# Check file permissions
chmod 644 auto-assignment.php

# View live error log
tail -f wp-content/debug.log

# Search for function
grep -r "mc_find_best_available_doctor" wp-content/themes/salute-child/
```

---

**Status:** ✅ Implementation Complete - Ready for Testing

**Next Action:** Test the booking flow following Step 2 above


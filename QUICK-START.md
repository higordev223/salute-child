# Quick Start - What to Do Now

## Implementation Complete!

I've completely rebuilt the automatic doctor assignment system for Medico Contigo. Here's what you need to do to deploy and test it.

---

## Step 1: Upload Files to Server (SFTP)

### What to Upload:
Upload the entire `salute-child` folder to your server.

**SFTP Connection Details:**
- Server: `access-5018034562.webspace-host.com`
- Port: `22`
- Protocol: SFTP
- Username: `a2580036`
- Password: `F$0y)K2DEwj(K6%T@iO5T$(B`

**Upload Location:**
```
/wp-content/themes/salute-child/
```

**Files to Upload:**
```
salute-child/
├── functions.php                           ← UPDATED
├── includes/
│   └── kivicare-customizations/
│       ├── auto-assignment.php             ← COMPLETELY NEW
│       └── language-tab.php                ← NEW FILE
└── assets/
    └── js/
        └── booking-customization.js        ← UPDATED
```

### Upload Method Options:

**Option A: Using FileZilla**
1. Open FileZilla
2. Enter SFTP credentials above
3. Connect
4. Navigate to: `/wp-content/themes/salute-child/`
5. Drag and drop the files from your local folder
6. Confirm overwrite when prompted

**Option B: Using WinSCP**
1. Open WinSCP
2. New Session → SFTP
3. Enter credentials
4. Connect
5. Navigate to theme folder
6. Upload files

---

## Step 2: Activate Changes

### Clear ALL Caches:

1. **WordPress Cache**
   - If using a cache plugin (W3 Total Cache, WP Super Cache, etc.)
   - Go to plugin settings → Clear Cache

2. **Browser Cache**
   - Chrome/Edge: `Ctrl + Shift + Delete`
   - Select: "Cached images and files"
   - Click "Clear data"

3. **Server Cache** (if applicable)
   - IONOS hosting may have server cache
   - Login to IONOS control panel
   - Clear cache (if option exists)

### Verify Child Theme is Active:

1. Login to WordPress admin
2. Go to: **Appearance → Themes**
3. Verify "Salute Child" is active
4. If not, click "Activate" on Salute Child

---

## Step 3: Test the System

### Test 1: Frontend Patient Booking

1. **Open booking page** (where KiviCare widget appears)

2. **Check if doctor selection is GONE**
   - You should NOT see "Choose Your Doctor"
   - Should only see: Service → Language → Date → Details

3. **Select a service** (e.g., "General Medicine")
   - Wait 2 seconds
   - Language selection should appear

4. **Open browser console** (Press F12)
   - Check for message: "Medico Contigo customization loaded"
   - Check for any red errors

5. **Select a language** (e.g., "Español")
   - Card should highlight with blue border

6. **Complete booking**
   - Select date/time
   - Add description
   - Submit

7. **Verify in admin**
   - Go to: KiviCare → Appointments
   - Find the appointment
   - Check if doctor is assigned (should NOT be empty)

### Test 2: Admin Dashboard

1. **Login as Admin**
2. **Go to KiviCare → Add Appointment**
3. **Verify doctor field is HIDDEN**
4. **Complete booking**
5. **Check if doctor is auto-assigned**

### Test 3: Check JavaScript Loading

1. **Go to any page with booking widget**
2. **Press F12** (Developer Tools)
3. **Go to Console tab**
4. **You should see:**
   ```
   Medico Contigo booking customization loaded
   Medico Contigo customization ready
   ```

5. **You should NOT see:**
   - Red error messages
   - "404 Not Found" errors
   - "Uncaught ReferenceError"

---

## Step 4: Configure Doctor Languages

For auto-assignment to work properly, doctors need language metadata.

### Set Doctor Languages:

1. **Go to WordPress Admin**
2. **Users → All Users**
3. **Click on a doctor name**
4. **Scroll to "KiviCare Doctor Details" or "Basic Information"**
5. **Look for Languages field**
6. **Add languages:** Spanish, English, Arabic, etc.
7. **Save User**

**Repeat for all doctors**

### If Language Field Doesn't Exist:

You may need to add it manually via database:

```sql
INSERT INTO wp_usermeta (user_id, meta_key, meta_value) 
VALUES 
(123, 'doctor_languages', 'a:2:{i:0;s:7:"Spanish";i:1;s:7:"English";}')
ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value);
```

Replace `123` with actual doctor user ID.

---

## Step 5: Verify Database Tables

The system needs these KiviCare tables to exist:

```sql
wp_kc_appointments
wp_kc_service_doctor_mapping
wp_kc_clinic_schedule
wp_kc_doctor_clinic_mappings
```

### Check via phpMyAdmin:

1. Login to IONOS hosting
2. Go to Databases → phpMyAdmin
3. Select your WordPress database
4. Look for tables starting with `wp_kc_`
5. All should exist (created by KiviCare plugin)

---

## Expected Results

### What Should Happen:

✅ Doctor selection completely hidden in booking form
✅ Language selection appears after service
✅ Only relevant languages shown (based on service)
✅ Patient can upload files before confirmation
✅ Doctor is automatically assigned upon booking
✅ Appointment redirects to WooCommerce checkout
✅ Works in Patient, Admin, Doctor, and Receptionist dashboards

### What Should NOT Happen:

❌ "Choose Your Doctor" step should NOT appear
❌ Doctor dropdown should NOT be visible anywhere
❌ No JavaScript errors in console
❌ Appointments should NOT have empty doctor_id

---

## Troubleshooting Quick Reference

### Problem: Doctor field still showing

**Solution:**
```
1. Clear browser cache (Ctrl + Shift + Delete)
2. Clear WordPress cache
3. Press Ctrl + F5 to hard refresh page
4. Check if files uploaded correctly
```

### Problem: Languages not appearing

**Solution:**
```
1. Press F12 → Console tab
2. Look for JavaScript errors
3. Verify AJAX request to: admin-ajax.php
4. Check if doctors have languages configured
```

### Problem: JavaScript not loading

**Solution:**
```
1. Verify file uploaded: /assets/js/booking-customization.js
2. Check file permissions (should be 644)
3. View source → Search for "mc-booking-custom"
4. Should see script tag with booking-customization.js
```

### Problem: No doctor assigned to appointment

**Solution:**
```
1. Check PHP error log: wp-content/debug.log
2. Enable WP_DEBUG in wp-config.php
3. Verify doctor has:
   - Service mapping configured
   - Language set
   - Available schedule
   - Not on vacation
```

---

## Where to Find Information

**Complete Documentation:**
- `CUSTOMIZATION-README.md` - Overview of what's built
- `IMPLEMENTATION-GUIDE.md` - Detailed technical guide
- `QUICK-START.md` - This file

**Code Files:**
- `functions.php` - Main integration
- `includes/kivicare-customizations/auto-assignment.php` - Core logic
- `includes/kivicare-customizations/language-tab.php` - Language UI
- `assets/js/booking-customization.js` - Frontend JavaScript

**Key Functions to Debug:**
- `mc_find_best_available_doctor()` - Doctor selection algorithm
- `mc_get_service_languages()` - Language loading
- `mc_hide_doctor_selection_css()` - CSS hiding doctor field
- `mc_force_hide_doctor_tab()` - PHP hiding doctor tab

---

## Testing Checklist

Use this checklist to verify everything works:

### Frontend Tests:
- [ ] Doctor field is hidden in booking widget
- [ ] Language selection appears after service
- [ ] Can select a language
- [ ] Can upload files
- [ ] Booking completes successfully
- [ ] Doctor is assigned to appointment
- [ ] Redirects to WooCommerce checkout

### Admin Tests:
- [ ] Can create appointment without selecting doctor
- [ ] Doctor field is hidden in admin
- [ ] Auto-assigned doctor appears in appointment list
- [ ] Language preference is saved

### Browser Console Tests:
- [ ] No JavaScript errors (F12 → Console)
- [ ] Sees "Medico Contigo customization loaded"
- [ ] AJAX requests succeed (F12 → Network)

### Database Tests:
- [ ] Appointments have doctor_id populated
- [ ] Doctors have language metadata
- [ ] Service-doctor mappings exist

---

## Next Steps After Testing

Once basic functionality is confirmed:

### Phase 1 Remaining Features:
1. Medical consultation forms (diagnosis, examination)
2. Prescription generation
3. Test orders workflow
4. PDF generation with signatures
5. Attendance certificates

### Phase 2 Future Features:
1. SREP integration (electronic prescriptions)
2. ICD database autocomplete
3. WebRTC video consultations
4. Insurance company integrations
5. Travel agency integrations

---

## Support

If you encounter issues:

1. **Check browser console** (F12) for JavaScript errors
2. **Check PHP error log** (`wp-content/debug.log`)
3. **Verify file upload** via SFTP
4. **Test with different browsers** (Chrome, Firefox, Safari)
5. **Disable other plugins** temporarily to check for conflicts

---

## Status: Ready to Deploy

All code is complete and ready for testing. Follow the steps above to deploy and verify functionality.

**Good luck!** 

If you need help with any step, let me know which specific issue you're encountering.


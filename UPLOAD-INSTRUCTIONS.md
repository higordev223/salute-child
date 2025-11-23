# 📤 UPLOAD INSTRUCTIONS - Version 3.0.0

## 🎯 Files to Upload to WordPress Server

### Required Files (3 files):

```
salute-child/
├── assets/
│   └── js/
│       └── booking-customization-v2.js ⬅️ UPLOAD THIS
├── includes/
│   └── kivicare-customizations/
│       └── language/
│           └── tab-panel.php ⬅️ UPLOAD THIS
└── functions.php ⬅️ UPLOAD THIS
```

---

## 📋 Upload Steps (FTP/cPanel)

### Method 1: FTP (FileZilla, WinSCP, etc.)

1. **Connect to your server** via FTP
   - Host: `your-server.com`
   - Username: `your-ftp-username`
   - Password: `your-ftp-password`
   - Port: 21 (or 22 for SFTP)

2. **Navigate to WordPress directory:**
   ```
   /public_html/wp-content/themes/salute-child/
   ```

3. **Upload these 3 files:**

   **File 1:** `booking-customization-v2.js`
   ```
   Local: e:\Work\YB\Theme Customize\salute-child\assets\js\booking-customization-v2.js
   Remote: /public_html/wp-content/themes/salute-child/assets/js/booking-customization-v2.js
   ```
   ✅ Overwrite existing file

   **File 2:** `tab-panel.php`
   ```
   Local: e:\Work\YB\Theme Customize\salute-child\includes\kivicare-customizations\language\tab-panel.php
   Remote: /public_html/wp-content/themes/salute-child/includes/kivicare-customizations/language/tab-panel.php
   ```
   ✅ Overwrite existing file

   **File 3:** `functions.php`
   ```
   Local: e:\Work\YB\Theme Customize\salute-child\functions.php
   Remote: /public_html/wp-content/themes/salute-child/functions.php
   ```
   ✅ Overwrite existing file

4. **Verify upload:**
   - Check file sizes match
   - Check timestamps are recent
   - Download one file back to verify it uploaded correctly

---

### Method 2: cPanel File Manager

1. **Login to cPanel** (usually `yoursite.com/cpanel`)

2. **Open File Manager**

3. **Navigate to:**
   ```
   public_html/wp-content/themes/salute-child/
   ```

4. **Upload File 1 (booking-customization-v2.js):**
   - Navigate to: `assets/js/`
   - Click "Upload"
   - Select `booking-customization-v2.js` from your computer
   - Overwrite when asked

5. **Upload File 2 (tab-panel.php):**
   - Navigate to: `includes/kivicare-customizations/language/`
   - Click "Upload"
   - Select `tab-panel.php`
   - Overwrite when asked

6. **Upload File 3 (functions.php):**
   - Navigate back to: `salute-child/` (root of child theme)
   - Click "Upload"
   - Select `functions.php`
   - Overwrite when asked

---

### Method 3: WordPress Admin (Appearance → Theme File Editor)

⚠️ **WARNING:** This method is NOT recommended as it's risky and error-prone!

If you must use it:
1. Go to WordPress Admin → Appearance → Theme File Editor
2. Select "Salute Child" theme
3. Edit each file one by one
4. **BACKUP first!** Download original files before editing

**Better option:** Use FTP or cPanel instead!

---

## ✅ After Upload - CRITICAL STEPS!

### 1. Clear Server Cache

If you have a WordPress cache plugin:
- **W3 Total Cache:** Performance → Purge All Caches
- **WP Super Cache:** Settings → Delete Cache
- **WP Rocket:** Clear Cache button
- **LiteSpeed Cache:** Purge All

### 2. Clear CDN Cache (if applicable)

If using Cloudflare, Fastly, or similar:
- Cloudflare: Caching → Purge Everything
- Fastly: Purge → Purge All

### 3. Clear Browser Cache

**On your computer:**
- Chrome/Edge: `Ctrl+Shift+Delete` → Clear cached images/files
- Firefox: `Ctrl+Shift+Delete` → Clear cache
- **OR** Open in Incognito/Private mode

**Tell users to clear their cache:**
- Send message: "Please refresh the page with Ctrl+F5 or clear your browser cache"

### 4. Hard Refresh

After clearing cache:
- Windows: `Ctrl+F5`
- Mac: `Cmd+Shift+R`

---

## 🧪 Verify Upload Success

### Test 1: Check JavaScript Version

1. Open booking form page
2. Press `F12` (Developer Tools)
3. Go to **Console** tab
4. Look for:
   ```
   Medico Contigo: Installing ULTIMATE form submission firewall
   Medico Contigo: ✅ ULTIMATE firewall installed successfully
   ```

✅ **If you see this:** Upload successful!
❌ **If you DON'T see this:** Cache not cleared OR old file still loaded

### Test 2: Check Network Tab

1. Press `F12` (Developer Tools)
2. Go to **Network** tab
3. Refresh page (`F5`)
4. Filter by "JS"
5. Find `booking-customization-v2.js`
6. Check the query string: Should show `?ver=3.0.0`

✅ **Shows ver=3.0.0:** Correct version loaded!
❌ **Shows ver=2.1.0 or ver=2.0.0:** Old version cached!

### Test 3: Functional Test

1. Open booking form
2. Select service (Step 1) → Click "Next"
3. **CHECK:** Loading spinner is centered ✅
4. **CHECK:** Spinner disappears ✅
5. Select language → Click "Next"
6. **CHECK:** You reach Step 3 (Date & Time) ✅
7. **CHECK:** Form did NOT submit/reload ✅

✅ **All checks pass:** Everything working!
❌ **Any check fails:** See troubleshooting below

---

## 🚨 Troubleshooting Upload Issues

### Problem: "Permission Denied" when uploading

**Solution:**
1. Check file permissions (should be 644 for PHP/JS files)
2. Contact hosting provider to fix permissions
3. Try uploading via cPanel File Manager instead of FTP

### Problem: Upload succeeds but changes don't appear

**Solution:**
1. **Clear ALL caches** (WordPress, browser, CDN)
2. **Check file was actually uploaded:** Download it back and compare sizes
3. **Check you're editing the right theme:** Should be `salute-child`, not `salute`
4. **Hard refresh:** Ctrl+F5 multiple times

### Problem: Old JavaScript version still loads

**Solution:**
1. **Deactivate cache plugins temporarily:**
   - Go to Plugins → Deactivate W3 Total Cache, WP Super Cache, etc.
   - Test if it works now
   - Reactivate and clear cache again

2. **Check WordPress is loading child theme:**
   - Go to Appearance → Themes
   - "Salute Child" should be ACTIVE (not just installed)

3. **Verify functions.php was uploaded:**
   - Check line 24 shows: `'3.0.0'`
   - If it shows `'2.1.0'`, the upload failed

### Problem: White screen or error after upload

**Solution:**
1. **Syntax error in PHP file** - Most common with functions.php
2. **Fix via FTP:**
   - Download the backup of functions.php
   - Re-upload it to restore
   - Check for any syntax errors (missing semicolons, brackets)
3. **Or restore via cPanel:**
   - File Manager → Restore from backup

---

## 📦 Backup Instructions

### Before uploading, backup these files:

```bash
# Via FTP - Download these files first:
/wp-content/themes/salute-child/assets/js/booking-customization-v2.js
/wp-content/themes/salute-child/includes/kivicare-customizations/language/tab-panel.php
/wp-content/themes/salute-child/functions.php

# Save them as:
booking-customization-v2.js.backup
tab-panel.php.backup
functions.php.backup
```

### Via cPanel:
1. Right-click each file → Download
2. Save with `.backup` extension

---

## 🔒 Security Checklist

Before uploading:

- [ ] Files are from trusted source (your local development)
- [ ] No suspicious code added
- [ ] Backup created of original files
- [ ] You have FTP access to restore if needed
- [ ] Testing will be done in staging/development first (if available)

After uploading:

- [ ] Test booking form works
- [ ] Check for PHP errors (white screen)
- [ ] Check JavaScript console for errors
- [ ] Verify no 404 errors in Network tab
- [ ] Test on mobile device

---

## 📞 Need Help with Upload?

**Contact your hosting provider if:**
- You can't access FTP
- Permission errors occur
- Files won't overwrite
- Server errors after upload

**Information to provide:**
- Hosting provider name
- WordPress version
- Theme name (Salute Child)
- Error messages (screenshots)

---

## ✅ Upload Checklist

Use this checklist to ensure proper upload:

```
BEFORE UPLOAD:
- [ ] Downloaded backup of all 3 files
- [ ] Verified local files are version 3.0.0
- [ ] Have FTP/cPanel access ready

UPLOAD:
- [ ] Uploaded booking-customization-v2.js to /assets/js/
- [ ] Uploaded tab-panel.php to /includes/kivicare-customizations/language/
- [ ] Uploaded functions.php to /salute-child/
- [ ] Verified file sizes match

AFTER UPLOAD:
- [ ] Cleared WordPress cache
- [ ] Cleared CDN cache (if applicable)
- [ ] Cleared browser cache (Ctrl+Shift+Delete)
- [ ] Hard refreshed page (Ctrl+F5)
- [ ] Checked console for "ULTIMATE firewall installed"
- [ ] Checked Network tab shows ver=3.0.0
- [ ] Tested booking form (Steps 1→2→3)
- [ ] Verified spinner hides properly
- [ ] Verified form doesn't submit on Step 2
- [ ] Completed test booking (all 6 steps)

VERIFICATION:
- [ ] No PHP errors (no white screen)
- [ ] No JavaScript console errors
- [ ] All booking steps work (1 through 6)
- [ ] Form only submits on Step 6
```

---

**Upload Method:** (Choose one)
- [ ] FTP (FileZilla, WinSCP)
- [ ] cPanel File Manager
- [ ] SFTP (Secure)

**Uploaded By:** _________________
**Date:** _________________
**Server:** _________________
**Status:** [ ] Success [ ] Failed

---

**Version:** 3.0.0 - ULTIMATE FIREWALL
**Files:** 3 total (JS, PHP, functions.php)
**Estimated Upload Time:** < 5 minutes
**Difficulty:** ⭐⭐☆☆☆ (Easy-Medium)

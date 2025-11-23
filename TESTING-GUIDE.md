# KiviCare Testing Guide - Calendar & Schedule Verification

## Part 1: Verify Doctor Schedule in WP-Admin

### Step 1: Access Doctor Session Settings
Navigate to: **wp-admin/admin.php?page=dashboard#/doctor-session**

Or via menu: **KiviCare → Settings → Doctor Session**

### Step 2: Check Dr. Alice Montoya (Doctor ID 2) Schedule

Look for sessions where:
- **Doctor:** Dr. Alice Montoya (doctor_id: 2)
- **Time Slot:** Should be configured (e.g., 15 or 30 minutes)
- **Session Times:** Should have either:
  - Morning session (e.g., 09:00 - 12:00)
  - Evening session (e.g., 14:00 - 18:00)
  - Or both
- **Working Days:** Should have at least one day selected (e.g., Monday, Tuesday, etc.)

### Step 3: If No Schedule Exists - Create One

Click **"Add New Session"** and configure:
1. **Select Clinic:** Choose the clinic
2. **Select Doctor:** Choose "Dr. Alice Montoya"
3. **Time Slot:** Select "30" (30 minutes)
4. **Morning Session:**
   - Start Time: 09:00
   - End Time: 12:00
5. **Evening Session:**
   - Start Time: 14:00
   - End Time: 18:00
6. **Week Days:** Check at least "Monday" through "Friday"
7. Click **Save**

### Step 4: Verify Clinic Schedule (Holidays)

Navigate to: **KiviCare → Clinic Schedule** (or **Settings → Holidays**)

Check:
- ✅ **No holidays are blocking today's date**
- ✅ **No holidays are blocking future dates**

If you see holidays blocking the current/future dates, you can:
- Edit them to exclude the dates you want to test
- Or delete them temporarily for testing

---

## Part 2: Test Booking Widget on Frontend

### Step 1: Clear Browser Cache
Press **Ctrl + Shift + Delete** → Clear cached images and files

### Step 2: Open Booking Page
Navigate to your booking page (where the KiviCare widget is embedded)

### Step 3: Test the Booking Flow

#### A. Select Service & Language
1. **Service:** Select "Consulta" (or any service)
2. **Language:** Select "Français" (French)
3. Click **"Next"** button

#### B. Verify Doctor Auto-Assignment
**Open Browser Console** (F12) and look for:
```
✅ Medico Contigo: Doctor auto-assigned: 2
✅ Medico Contigo: preselected_doctor = 2 (type: string)
✅ Medico Contigo: preselected_single_doctor_id = true (type: boolean)
```

#### C. Check Date-Time Tab Loading
You should see console logs showing one of these scenarios:

**Scenario A: Success on First Try**
```
🔄 Medico Contigo: Triggering date-time content load
✅ Medico Contigo: Calling kcAppointmentBookJsContent (attempt 1)
✅ Medico Contigo: kcAppointmentBookJsContent('#widgetOrders') called successfully
✅ Medico Contigo: KiviCare initialized successfully!
```

**Scenario B: Success After Retries**
```
🔄 Medico Contigo: Triggering date-time content load
⚠️ Medico Contigo: kcAppointmentBookJsContent not ready, retrying in 200ms... (attempt 1/5)
⚠️ Medico Contigo: kcAppointmentBookJsContent not ready, retrying in 200ms... (attempt 2/5)
✅ Medico Contigo: Calling kcAppointmentBookJsContent (attempt 3)
✅ Medico Contigo: KiviCare initialized successfully!
```

**Scenario C: Manual Fallback**
```
🔄 Medico Contigo: Triggering date-time content load
⚠️ Medico Contigo: KiviCare didn't initialize properly, trying manual reload
🔧 Medico Contigo: Using manual date-time loading
✅ Medico Contigo: Doctor weekdays loaded via manual method: {data: ...}
```

### Step 4: Visual Verification

Check the **Date-Time Tab** on the page:

✅ **Expected Results:**
- Calendar appears (Flatpickr date picker)
- Available dates are **highlighted/enabled** (based on doctor's working days)
- Unavailable dates are **grayed out/disabled**
- When you **click an available date**, time slots appear below
- Time slots match the doctor's session times (e.g., 09:00, 09:30, 10:00...)
- Time slots are **clickable**

❌ **If Still Broken:**
- Calendar exists but **NO dates are highlighted**
- Calendar exists but **NO time slots appear when clicking a date**
- Calendar doesn't load at all

---

## Part 3: Debugging (If Calendar Still Doesn't Work)

### Option 1: Run DEBUG-DATE-TIME.js

Copy the contents of `DEBUG-DATE-TIME.js` and paste into browser console.

**Check the output:**
```
=== KIVICARE DATE-TIME TAB DEBUG ===

Doctor ID Checks:
✅ window.MC_SELECTED_DOCTOR = 2
✅ bookAppointmentWidgetData.preselected_doctor = 2
✅ bookAppointmentWidgetData.preselected_single_doctor_id = true
✅ Type: boolean

Function Checks:
✅ kcAppointmentBookJsContent exists: true
✅ kivicareGetDoctorWeekday exists: true   <-- IMPORTANT!
✅ kivicareGetSelectedItem exists: true    <-- IMPORTANT!

DOM Checks:
✅ Date-time tab exists: true
✅ Calendar exists: true
```

### Option 2: Manual Doctor Weekdays Check

Run this in browser console:
```javascript
// Check if doctor has working days configured
$.ajax({
  url: window.bookAppointmentWidgetData.ajax_url + '?action=ajax_get&route_name=get_doctor_workdays',
  data: {
    clinic_id: 1,
    doctor_id: 2,
    type: 'flatpicker',
    _ajax_nonce: window.bookAppointmentWidgetData.ajax_get_nonce
  },
  success: function(response) {
    console.log('Doctor weekdays response:', response);
    if (response.data && response.data.length > 0) {
      console.log('✅ Doctor has working days configured!');
      console.log('Available dates:', response.data);
    } else {
      console.log('❌ Doctor has NO working days! Go to wp-admin and add doctor sessions.');
    }
  }
});
```

---

## Part 4: Common Issues & Solutions

### Issue 1: Calendar Appears But No Dates Highlighted

**Cause:** Doctor has no sessions configured in wp-admin

**Solution:**
1. Go to **wp-admin → KiviCare → Settings → Doctor Session**
2. Add a session for Dr. Alice Montoya (doctor_id: 2)
3. Configure working days, times, and time slots
4. Save and test again

---

### Issue 2: Calendar Shows Dates But No Time Slots

**Cause:** Time slot duration not configured or session times invalid

**Solution:**
1. Check doctor session settings
2. Ensure **Time Slot** is set (e.g., 30 minutes)
3. Ensure session times are valid (e.g., Start: 09:00, End: 12:00)
4. Ensure there's enough time between start and end for at least one slot

---

### Issue 3: All Dates Are Grayed Out/Disabled

**Cause:** Clinic schedule has holidays blocking all dates OR doctor has no working days

**Solution:**
1. Check **Clinic Schedule** (wp-admin → KiviCare → Clinic Schedule)
2. Remove any holidays blocking current/future dates
3. Verify doctor session has at least one working day selected

---

### Issue 4: Console Shows "kivicareGetDoctorWeekday exists: false"

**Cause:** KiviCare plugin JavaScript didn't initialize properly

**Solution:**
1. This is automatically handled by v4.1.1 retry logic and manual fallback
2. Check console for "Using manual date-time loading" message
3. If manual loading also fails, check AJAX response for errors

---

## Part 5: What Service/Language to Test?

Based on your database session data from previous debug:

### ✅ Working Combination:
- **Service:** Any service (e.g., "Consulta", "Consultation")
- **Language:** "Français" (French)
- **Expected Doctor:** Dr. Alice Montoya (ID: 2)

### Testing Checklist:

1. ✅ Select service
2. ✅ Select language "Français"
3. ✅ Check console: `MC_SELECTED_DOCTOR = 2`
4. ✅ Click "Next" to date-time tab
5. ✅ Check console: Date-time loading messages
6. ✅ Verify calendar appears
7. ✅ Verify dates are highlighted
8. ✅ Click a date → verify time slots appear
9. ✅ Click a time slot → verify it's selectable
10. ✅ Click "Next" to proceed to patient details

---

## Quick Reference: File Versions

- **booking-customization.js:** v4.1.1
- **functions.php:** v4.1.1

Last Updated: 2025-11-22

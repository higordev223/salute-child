# 🚀 QUICK FIX REFERENCE - v4.1.0

## ✅ Solution Applied

**Problem:** Date-time tab shows but NO time slots load
**Root Cause:** KiviCare needs `bookAppointmentWidgetData.preselected_doctor` + flag
**Solution:** Inject correct data + trigger reload with proper widget selector

---

## 🔧 What Was Fixed

### 1. **Set Correct Data Structure**
```javascript
window.bookAppointmentWidgetData.preselected_doctor = "2";  // STRING!
window.bookAppointmentWidgetData.preselected_single_doctor_id = true;  // FLAG!
```

### 2. **Call Correct Function**
```javascript
// BEFORE (wrong):
kcAppointmentBookJsContent("date-time");  // ❌ Wrong selector!

// AFTER (correct):
kcAppointmentBookJsContent("#widgetOrders");  // ✅ Widget container!
```

### 3. **Added Fallback**
If `kcAppointmentBookJsContent` doesn't exist, directly call AJAX:
```javascript
$.ajax({
    url: bookAppointmentWidgetData.ajax_url + "?action=ajax_get&route_name=get_doctor_workdays",
    data: {
        clinic_id: 1,
        doctor_id: 2,
        type: "flatpicker",
        _ajax_nonce: bookAppointmentWidgetData.ajax_get_nonce
    }
});
```

---

## 🧪 How to Test

### 1. **Browser Console Check**
Open browser console (F12) and run:
```javascript
// Check doctor assignment
console.log(window.MC_SELECTED_DOCTOR);  // Should be: 2
console.log(window.bookAppointmentWidgetData.preselected_doctor);  // Should be: "2"
console.log(window.bookAppointmentWidgetData.preselected_single_doctor_id);  // Should be: true

// Check if calendar exists
console.log(jQuery('#date-time .iq-inline-datepicker').length);  // Should be: 1
```

### 2. **Visual Check**
- ✅ Date-time tab shows calendar
- ✅ Available dates are highlighted
- ✅ Clicking date shows time slots
- ✅ Time slots are clickable

### 3. **Network Tab**
Check for these AJAX calls:
- ✅ `get_doctor_workdays` with `doctor_id=2`
- ✅ `get_time_slots` with `doctor_id=2`

---

## 🐛 If Still Not Working

### **Debug Script**
Copy the contents of `DEBUG-DATE-TIME.js` and paste into browser console.

### **Manual Fix (Browser Console)**
```javascript
// 1. Set the doctor
window.bookAppointmentWidgetData.preselected_doctor = "2";
window.bookAppointmentWidgetData.preselected_single_doctor_id = true;

// 2. Reload the widget
window.kcAppointmentBookJsContent("#widgetOrders");

// 3. Check if it worked
setTimeout(() => {
    console.log("Calendar exists:", jQuery('#date-time .iq-inline-datepicker').length > 0);
}, 1000);
```

### **Check Database**
Run this SQL query to verify doctor has sessions:
```sql
SELECT * FROM qhuv_kc_clinic_sessions
WHERE doctor_id = 2 AND clinic_id = 1;
```

Should return rows with:
- `day`: 'mon', 'tue', 'wed', 'thu', 'fri'
- `start_time`: '08:00:00'
- `end_time`: '14:00:00'
- `time_slot`: 25

---

## 📁 Files Modified

1. **booking-customization.js** (v4.1.0)
   - `injectDoctorIntoBookingData()` - Added flag
   - `triggerDateTimeLoad()` - Fixed selector + added fallback
   - `lockDoctorSelection()` - Added flag locking

2. **functions.php**
   - Version bumped to 4.1.0

---

## 🔗 Key KiviCare Functions

### How KiviCare Gets Doctor:
```javascript
// From book-appointment-widget.js:771-776
function kivicareGetSelectedItem(element) {
    if (element === 'selected-doctor') {
        // CHECKS THIS FIRST!
        if (bookAppointmentWidgetData.preselected_single_doctor_id) {
            return bookAppointmentWidgetData.preselected_doctor  // ✅
        }
    }
    // Then looks for radio buttons...
}
```

### How Date-Time Loads:
```javascript
// From book-appointment-widget.js:473-475
case '#date-time':
    kivicareGetDoctorWeekday(kivicareGetSelectedItem('selected-doctor'));
    break;
```

### How Calendar Initializes:
```javascript
// From book-appointment-widget.js:880-977
function kivicareGetDoctorWeekday(id) {
    get('get_doctor_workdays', {
        clinic_id: selected_clinic,
        doctor_id: id,  // ← This is where our doctor_id goes!
        type: 'flatpicker'
    })
    .then((response) => {
        // Initialize flatpickr calendar
        flatpickr(".iq-inline-datepicker", {
            // ... calendar config
        });
    });
}
```

---

## ✅ Success Indicators

**Console Logs (Good):**
```
✅ Medico Contigo: Doctor auto-selected: 2
✅ Medico Contigo: preselected_doctor = 2
✅ Medico Contigo: preselected_single_doctor_id = true
✅ Medico Contigo: Widget container: #widgetOrders
✅ Medico Contigo: kcAppointmentBookJsContent('#widgetOrders') called
```

**Console Logs (Bad):**
```
❌ bookAppointmentWidgetData not found
❌ kcAppointmentBookJsContent not found
❌ No clinic_id found!
```

---

## 📞 Support

If date-time still doesn't load after v4.1:

1. Run `DEBUG-DATE-TIME.js` in console
2. Check doctor has sessions in database
3. Verify `bookAppointmentWidgetData` exists
4. Check Network tab for AJAX errors
5. Look for JavaScript errors in console

---

**Version:** 4.1.0
**Last Updated:** 2025-11-22

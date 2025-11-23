/**
 * DEBUG HELPER: KiviCare Date-Time Tab Loading
 *
 * Paste this into your browser console to diagnose date-time issues
 */

console.log("═══════════════════════════════════════════════════════════");
console.log("🔍 KIVICARE DATE-TIME DEBUG TOOL");
console.log("═══════════════════════════════════════════════════════════\n");

// 1. Check if doctor is set
console.log("1️⃣ DOCTOR ASSIGNMENT:");
console.log("   window.MC_SELECTED_DOCTOR =", window.MC_SELECTED_DOCTOR);
console.log("   bookAppointmentWidgetData.preselected_doctor =",
    window.bookAppointmentWidgetData?.preselected_doctor);
console.log("   bookAppointmentWidgetData.preselected_single_doctor_id =",
    window.bookAppointmentWidgetData?.preselected_single_doctor_id);

if (!window.MC_SELECTED_DOCTOR) {
    console.error("   ❌ MC_SELECTED_DOCTOR not set!");
}
if (!window.bookAppointmentWidgetData?.preselected_doctor) {
    console.error("   ❌ preselected_doctor not set!");
}
if (!window.bookAppointmentWidgetData?.preselected_single_doctor_id) {
    console.error("   ❌ preselected_single_doctor_id flag not set!");
}
console.log("");

// 2. Check widget container
console.log("2️⃣ WIDGET CONTAINER:");
var $dateTime = jQuery('#date-time');
var $container = $dateTime.closest('[id^="widget"], .kivi-widget');
console.log("   #date-time exists:", $dateTime.length > 0);
console.log("   Widget container:", $container.attr('id'));
console.log("   Container selector:", $container.length > 0 ? '#' + $container.attr('id') : '#widgetOrders');
console.log("");

// 3. Check date-time tab state
console.log("3️⃣ DATE-TIME TAB STATE:");
console.log("   Is visible:", $dateTime.is(':visible'));
console.log("   Has .active class:", $dateTime.hasClass('active'));
console.log("   Content:", $dateTime.html().length > 100 ?
    $dateTime.html().substring(0, 100) + '...' : $dateTime.html());
console.log("");

// 4. Check for calendar
console.log("4️⃣ CALENDAR (FLATPICKR):");
var $calendar = jQuery('#date-time .iq-inline-datepicker, #date-time .flatpickr-calendar');
console.log("   Calendar exists:", $calendar.length > 0);
if ($calendar.length > 0) {
    console.log("   ✅ Calendar found!");
} else {
    console.error("   ❌ NO CALENDAR - This is the problem!");
}
console.log("");

// 5. Check KiviCare functions
console.log("5️⃣ KIVICARE FUNCTIONS:");
console.log("   kcAppointmentBookJsContent exists:", typeof window.kcAppointmentBookJsContent === 'function');
console.log("   kivicareGetDoctorWeekday exists:", typeof window.kivicareGetDoctorWeekday === 'function');
console.log("   kivicareGetSelectedItem exists:", typeof window.kivicareGetSelectedItem === 'function');
console.log("");

// 6. Check clinic ID
console.log("6️⃣ CLINIC ASSIGNMENT:");
console.log("   bookAppointmentWidgetData.preselected_clinic_id =",
    window.bookAppointmentWidgetData?.preselected_clinic_id);
console.log("   bookAppointmentWidgetData.preselected_single_clinic_id =",
    window.bookAppointmentWidgetData?.preselected_single_clinic_id);
console.log("");

// 7. Test doctor retrieval
console.log("7️⃣ TESTING DOCTOR RETRIEVAL:");
if (typeof window.kivicareGetSelectedItem === 'function') {
    try {
        var doctorId = window.kivicareGetSelectedItem('selected-doctor');
        console.log("   kivicareGetSelectedItem('selected-doctor') returns:", doctorId);
        if (doctorId == 0) {
            console.error("   ❌ Returns 0 - Doctor not being detected!");
        } else {
            console.log("   ✅ Doctor detected:", doctorId);
        }
    } catch(e) {
        console.error("   ❌ Error:", e.message);
    }
} else {
    console.warn("   ⚠️ kivicareGetSelectedItem function not available yet");
}
console.log("");

// 8. Quick fix buttons
console.log("8️⃣ QUICK FIX OPTIONS:");
console.log("\n   Run one of these commands to try fixing:\n");

console.log("   A) Re-inject doctor into bookAppointmentWidgetData:");
console.log("      %cwindow.bookAppointmentWidgetData.preselected_doctor = '2';", "color: green; font-weight: bold");
console.log("      %cwindow.bookAppointmentWidgetData.preselected_single_doctor_id = true;", "color: green; font-weight: bold");

console.log("\n   B) Trigger date-time load manually:");
console.log("      %cwindow.kcAppointmentBookJsContent('#widgetOrders');", "color: green; font-weight: bold");

console.log("\n   C) Direct AJAX call to load working days:");
console.log("      %cjQuery.ajax({", "color: green; font-weight: bold");
console.log("      %c  url: bookAppointmentWidgetData.ajax_url + '?action=ajax_get&route_name=get_doctor_workdays',", "color: green; font-weight: bold");
console.log("      %c  data: { clinic_id: 1, doctor_id: 2, type: 'flatpicker', _ajax_nonce: bookAppointmentWidgetData.ajax_get_nonce },", "color: green; font-weight: bold");
console.log("      %c  success: (r) => console.log('Workdays:', r)", "color: green; font-weight: bold");
console.log("      %c});", "color: green; font-weight: bold");

console.log("\n   D) Check doctor sessions in database (copy to SQL):");
console.log("      %cSELECT * FROM qhuv_kc_clinic_sessions WHERE doctor_id = 2 AND clinic_id = 1;", "color: blue; font-weight: bold");

console.log("\n═══════════════════════════════════════════════════════════");
console.log("END OF DEBUG REPORT");
console.log("═══════════════════════════════════════════════════════════");

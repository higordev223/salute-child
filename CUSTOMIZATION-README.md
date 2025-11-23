# Medico Contigo - KiviCare Customizations

## Overview
This child theme contains customizations for the Medico Contigo telemedicine platform, implementing automatic doctor assignment based on service and language preferences.

## What's Implemented

### 1. Automatic Doctor Assignment
- **Location**: `includes/kivicare-customizations/auto-assignment.php`
- **Features**:
  - Completely removes doctor selection from booking process
  - Automatically assigns the most suitable doctor based on:
    - Service/specialty
    - Language capability
    - Availability (schedule, vacations, existing appointments)
  - Works across all user profiles (Patient, Doctor, Admin, Receptionist)

### 2. Language Selection
- **Location**: `includes/kivicare-customizations/language-tab.php`
- **Features**:
  - Adds language selection step in booking flow
  - Dynamically loads only languages available for selected service
  - Filters doctors based on language capability
  - Custom tab integrated into KiviCare's native booking widget

### 3. Enhanced Booking JavaScript
- **Location**: `assets/js/booking-customization.js`
- **Features**:
  - Dynamic language selection UI
  - File upload capability for medical documents
  - Intercepts booking form to inject language preference
  - Works with KiviCare's AJAX-based booking system

### 4. WooCommerce Integration
- **Location**: `functions.php` (mc_woocommerce_integration)
- **Features**:
  - Automatically creates WooCommerce product for each appointment
  - Redirects to checkout after booking
  - Links appointment to order for payment processing

## File Structure

```
salute-child/
├── functions.php                    # Main theme functions
├── style.css                        # Child theme styles
├── assets/
│   └── js/
│       └── booking-customization.js # Frontend booking enhancements
└── includes/
    └── kivicare-customizations/
        ├── auto-assignment.php      # Core auto-assignment logic
        └── language-tab.php         # Language selection tab
```

## How It Works

### Booking Flow
1. Patient selects **Service** (e.g., Psychology, General Medicine)
2. System shows **Languages** available for that service
3. Patient selects **Preferred Language**
4. Patient selects **Date & Time**
5. Patient adds **Description** and optional **File Attachments**
6. **System automatically assigns** available doctor matching:
   - Service specialty
   - Language capability
   - Availability at selected time
7. Redirects to **WooCommerce Checkout** for payment

### Database Integration
The customization hooks into KiviCare's REST API and database tables:
- `wp_kc_service_doctor_mapping` - Service to doctor relationships
- `wp_kc_appointments` - Appointment records
- `wp_kc_clinic_schedule` - Doctor working hours
- `wp_kc_doctor_clinic_mappings` - Doctor vacation/availability

### Doctor Metadata
Languages are stored in doctor user metadata:
- `basic_data['languages']` - Array of language codes
- `doctor_languages` - Standalone language meta

Supported languages:
- Spanish (es)
- English (en)
- Arabic (ar)
- French (fr)
- German (de)
- Portuguese (pt)
- Italian (it)

## Testing Checklist

### Frontend (Patient)
- [ ] Doctor field is hidden in booking widget
- [ ] Language selection appears after service selection
- [ ] Only relevant languages are shown
- [ ] File upload field appears before confirmation
- [ ] Appointment books successfully
- [ ] Redirects to WooCommerce checkout

### Admin Dashboard
- [ ] Can create appointments without selecting doctor
- [ ] Language preference is saved
- [ ] Auto-assigned doctor appears in appointment details

### Doctor Dashboard
- [ ] Doctors see appointments assigned to them
- [ ] Can create appointments for patients

### Receptionist Dashboard
- [ ] Can book appointments for patients
- [ ] Auto-assignment works correctly

## Troubleshooting

### Doctor field still showing
1. Clear all caches (WordPress, browser, server)
2. Check if another plugin is overriding the customization
3. Verify `auto-assignment.php` is being loaded

### Languages not loading
1. Check browser console for JavaScript errors
2. Verify AJAX URL is correct: `wp-admin/admin-ajax.php`
3. Ensure doctors have language metadata set
4. Check database: `SELECT * FROM wp_usermeta WHERE meta_key LIKE '%language%'`

### No doctor assigned
1. Check if doctors have:
   - Service mapping configured
   - Language capability set
   - Available schedule for selected time
   - Not on vacation
2. Check PHP error logs for database issues

### WooCommerce not redirecting
1. Verify WooCommerce is active
2. Check if `kc_appointment_booked` action exists
3. Ensure Redsys payment gateway is configured

## Configuration

### Adding New Languages
Edit `auto-assignment.php`, function `mc_get_service_languages()`:

```php
$language_names = [
    'code' => 'Display Name',
    // Add new languages here
];
```

### Modifying Doctor Selection Logic
Edit `auto-assignment.php`, function `mc_find_best_available_doctor()`:
- Line 221: Change ordering logic
- Line 235: Modify language matching
- Line 241: Adjust availability checking

### Changing Time Slot Duration
Default is 30 minutes. Modify `mc_get_doctor_time_slot()` function.

## Future Enhancements

### Phase 2 Features (Not Yet Implemented)
- [ ] Medical consultation forms (diagnosis, examination)
- [ ] Prescription generation
- [ ] Test orders workflow
- [ ] PDF generation with digital signatures
- [ ] SREP integration (electronic prescriptions)
- [ ] ICD database autocomplete
- [ ] WebRTC video consultation

### Current Limitations
- Cannot assign multiple doctors simultaneously
- No load balancing if multiple doctors available
- Vacation checking needs enhanced logic
- File uploads saved but not linked to appointment record

## Support

For issues or questions:
1. Check WordPress debug log: `wp-content/debug.log`
2. Check browser console for JavaScript errors
3. Verify KiviCare plugin is up to date
4. Ensure child theme is active

## Version History

- **v1.0.2** (Current) - Integrated auto-assignment with language selection
- **v1.0.1** - Added WooCommerce integration
- **v1.0.0** - Initial auto-assignment implementation

---

**Developer Notes**: All customizations are in the child theme to prevent loss during parent theme updates. Do NOT modify core KiviCare plugin files.


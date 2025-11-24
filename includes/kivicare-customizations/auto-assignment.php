<?php
/**
 * Medico Contigo - KiviCare Automatic Doctor Assignment
 * Integrated with KiviCare's native booking system
 * Works with all user profiles: Patient, Doctor, Admin, Receptionist
 */

// Initialize customizations
add_action('init', 'mc_initialize_integrated_customizations', 20);

function mc_initialize_integrated_customizations() {
    
    // Check if KiviCare is active
    if (!defined('KIVI_CARE_PREFIX')) {
        return;
    }
    
    // Force hide doctor selection tab in booking widget
    add_filter('option_' . KIVI_CARE_PREFIX . 'widget_order_list', 'mc_force_hide_doctor_tab', 999);
    add_filter('default_option_' . KIVI_CARE_PREFIX . 'widget_order_list', 'mc_force_hide_doctor_tab', 999);
    
    // Add language selection AJAX handler
    add_action('wp_ajax_mc_get_service_languages', 'mc_get_service_languages');
    add_action('wp_ajax_nopriv_mc_get_service_languages', 'mc_get_service_languages');
    
    // Add auto-select doctor AJAX handler
    add_action('wp_ajax_mc_get_first_available_doctor', 'mc_get_first_available_doctor');
    add_action('wp_ajax_nopriv_mc_get_first_available_doctor', 'mc_get_first_available_doctor');
    
    // Hook into REST API to intercept appointment booking
    add_action('rest_api_init', 'mc_register_auto_assignment_hooks', 999);
    
    // Add CSS and JavaScript to hide doctor selection everywhere
    add_action('wp_head', 'mc_hide_doctor_selection_css', 999);
    add_action('admin_head', 'mc_hide_doctor_selection_css', 999);
    add_action('wp_footer', 'mc_hide_doctor_selection_js', 999);
    add_action('admin_footer', 'mc_hide_doctor_selection_js', 999);
}

/**
 * Force remove doctor tab from booking widget
 */
function mc_force_hide_doctor_tab($widget_order) {
    if (!is_array($widget_order) || empty($widget_order)) {
        return $widget_order;
    }
    
    $filtered = array();
    foreach ($widget_order as $key => $tab) {
        if (isset($tab['att_name']) && $tab['att_name'] === 'doctor') {
            // Skip doctor tab
            continue;
        }
        $filtered[] = $tab;
    }
    
    return $filtered;
}

/**
 * CSS to hide doctor selection in admin panels and forms
 */
function mc_hide_doctor_selection_css() {
    ?>
    <style type="text/css">
    /* Hide doctor selection in all contexts - Medico Contigo */
    .tab-item:has(.tab-link[href="#doctor"]),
    .tab-item:has(a[href="#doctor"]),
    li:has(#doctor-tab),
    #doctor-tab,
    .tab-link[href="#doctor"],
    a[href="#doctor"],
    #doctor,
    div[id="doctor"],
    .iq-tab-pannel#doctor,
    [data-tab-name="doctor"],
    .doctor-selection-container,
    .select-doctor-wrapper,
    .kivi-doctor-field,
    [name="doctor_id"]:not([type="hidden"]),
    label[for="doctor_id"],
    .select-doctor-section {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        height: 0 !important;
        width: 0 !important;
        overflow: hidden !important;
        position: absolute !important;
        left: -9999px !important;
    }
    
    /* Hide in appointment modal/popup forms */
    .appointment-modal .doctor-field,
    .modal-body .doctor-selection,
    #appointmentModal .doctor-select {
        display: none !important;
    }
    
    /* FORCE hide inactive tab panels ONLY - Medico Contigo */
    /* Use :not(.active) to only target inactive panels */
    .iq-fade.iq-tab-pannel:not(.active) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        height: 0 !important;
        overflow: hidden !important;
        position: absolute !important;
        left: -9999px !important;
        pointer-events: none !important;
    }

    /* Extra specificity for language panel */
    #wizard-tab .iq-tab-pannel#language:not(.active),
    .tab-content .iq-tab-pannel#language:not(.active),
    body #language.iq-tab-pannel:not(.active) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        max-height: 0 !important;
        overflow: hidden !important;
        position: absolute !important;
        left: -99999px !important;
        pointer-events: none !important;
    }

    /* Ensure active panels are visible */
    .iq-fade.iq-tab-pannel.active {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
        position: relative !important;
        left: 0 !important;
        pointer-events: auto !important;
    }

    /* CRITICAL: Force category (service selection) panel to always be visible when active */
    #category.iq-tab-pannel.active,
    .iq-tab-pannel#category.active,
    div#category.active {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        height: auto !important;
        max-height: none !important;
        min-height: 200px !important;
        overflow: visible !important;
        position: relative !important;
        left: 0 !important;
        top: 0 !important;
        pointer-events: auto !important;
        z-index: 1 !important;
    }

    /* NUCLEAR OPTION: Maximum specificity for inactive language panel */
    html body #wizard-tab .iq-tab-pannel#language:not(.active),
    html body .tab-content .iq-tab-pannel#language:not(.active),
    html body div#wizard-tab div.iq-tab-pannel#language:not(.active) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        height: 0 !important;
        max-height: 0 !important;
        overflow: hidden !important;
        position: absolute !important;
        left: -99999px !important;
        top: -99999px !important;
        clip: rect(0,0,0,0) !important;
        pointer-events: none !important;
        z-index: -1 !important;
    }
    </style>
    <?php
}

/**
 * JavaScript to forcefully hide doctor tab
 */
function mc_hide_doctor_selection_js() {
    ?>
    <script type="text/javascript">
    (function() {
        // Remove doctor tab immediately
        function hideDoctorTab() {
            // Hide doctor tab in left sidebar
            jQuery('.tab-item').each(function() {
                var tabLink = jQuery(this).find('a[href="#doctor"], .tab-link[href="#doctor"]');
                if (tabLink.length > 0) {
                    jQuery(this).remove();
                }
            });

            // Hide doctor panel
            jQuery('#doctor, div[id="doctor"], .iq-tab-pannel#doctor').remove();

            // Hide any doctor selection fields
            jQuery('[name="doctor_id"]:not([type="hidden"])').closest('.form-group, .iq-form-group, div').hide();
        }

        // Run immediately
        hideDoctorTab();

        // Run on DOM ready
        jQuery(document).ready(function() {
            hideDoctorTab();

            // Watch for dynamic content
            setTimeout(hideDoctorTab, 500);
            setTimeout(hideDoctorTab, 1000);
            setTimeout(hideDoctorTab, 2000);
        });

        // Watch for mutations
        if (typeof MutationObserver !== 'undefined') {
            var observer = new MutationObserver(function(mutations) {
                hideDoctorTab();
            });

            var target = document.getElementById('kivicare-widget-main-content') || document.body;
            observer.observe(target, {
                childList: true,
                subtree: true
            });
        }
    })();
    </script>
    <?php
}

/**
 * Get available languages for a service
 */
function mc_get_service_languages() {
    $service_id = isset($_POST['service_id']) ? intval($_POST['service_id']) : 0;
    
    if (!$service_id) {
        wp_send_json_error(['message' => 'Service ID required']);
    }
    
    global $wpdb;
    
    // Get doctors who offer this service
    $doctors = $wpdb->get_results($wpdb->prepare(
        "SELECT DISTINCT doctor_id 
        FROM {$wpdb->prefix}kc_service_doctor_mapping 
        WHERE service_id = %d AND status = 1",
        $service_id
    ));
    
    if (empty($doctors)) {
        wp_send_json_error(['message' => 'No doctors found for this service']);
    }
    
    $all_languages = [];
    $debug_info = [];
    
    // Get language field ID from custom_fields table
    $language_field = $wpdb->get_row(
        "SELECT id FROM {$wpdb->prefix}kc_custom_fields 
        WHERE module_type = 'doctor_module' 
        AND fields LIKE '%Idiomas que Habla%' 
        LIMIT 1"
    );
    
    $language_field_id = $language_field ? $language_field->id : 1; // Default to 1 if not found
    
    foreach ($doctors as $doctor) {
        $doctor_id = $doctor->doctor_id;
        
        // Query KiviCare's custom fields data table for this doctor's languages
        $doctor_languages = $wpdb->get_var($wpdb->prepare(
            "SELECT fields_data 
            FROM {$wpdb->prefix}kc_custom_fields_data 
            WHERE module_type = 'doctor_module' 
            AND module_id = %d 
            AND field_id = %d",
            $doctor_id,
            $language_field_id
        ));
        
        $debug_info['doctor_' . $doctor_id] = [
            'raw_data' => $doctor_languages,
            'parsed_languages' => []
        ];
        
        if (!empty($doctor_languages)) {
            // The languages are stored as a JSON array
            $langs = json_decode($doctor_languages, true);
            
            if (is_array($langs)) {
                $all_languages = array_merge($all_languages, $langs);
                $debug_info['doctor_' . $doctor_id]['parsed_languages'] = $langs;
            }
        }
    }
    
    // Remove duplicates and empty values
    $unique_languages = array_values(array_unique(array_filter($all_languages)));
    
    // Normalize language names for consistent matching
    $language_mapping = [
        'Español' => ['code' => 'es', 'name' => 'Español', 'icon' => '🇪🇸'],
        'Catalan/Valenciano' => ['code' => 'ca', 'name' => 'Català/Valencià', 'icon' => '🇪🇸'],
        'Euskera' => ['code' => 'eu', 'name' => 'Euskara', 'icon' => '🇪🇸'],
        'Gallego' => ['code' => 'gl', 'name' => 'Galego', 'icon' => '🇪🇸'],
        'Inglés' => ['code' => 'en', 'name' => 'English', 'icon' => '🇬🇧'],
        'Árabe' => ['code' => 'ar', 'name' => 'العربية (Arabic)', 'icon' => '🇸🇦'],
        'Francés' => ['code' => 'fr', 'name' => 'Français', 'icon' => '🇫🇷'],
        'Alemán' => ['code' => 'de', 'name' => 'Deutsch', 'icon' => '🇩🇪'],
        'Portugués' => ['code' => 'pt', 'name' => 'Português', 'icon' => '🇵🇹']
    ];
    
    $formatted_languages = [];
    foreach ($unique_languages as $lang) {
        if (isset($language_mapping[$lang])) {
            $formatted_languages[] = $language_mapping[$lang];
        } else {
            // Fallback for unrecognized languages
            $formatted_languages[] = [
                'code' => strtolower(substr($lang, 0, 2)),
                'name' => $lang,
                'icon' => '🌐'
            ];
        }
    }
    
    wp_send_json_success([
        'languages' => $formatted_languages,
        'debug' => $debug_info,
        'service_id' => $service_id,
        'doctors_count' => count($doctors),
        'language_field_id' => $language_field_id
    ]);
}

/**
 * Register hooks for REST API
 */
function mc_register_auto_assignment_hooks() {
    // Hook into the appointment save endpoint
    add_filter('rest_pre_dispatch', 'mc_intercept_appointment_save', 10, 3);
}

/**
 * Intercept appointment save to auto-assign doctor
 */
function mc_intercept_appointment_save($result, $server, $request) {
    
    // Check if this is the appointment save endpoint
    $route = $request->get_route();
    
    if (strpos($route, '/book-appointment/save-appointment') !== false || 
        strpos($route, '/appointment/save') !== false) {
        
        $params = $request->get_json_params();
        if (empty($params)) {
            $params = $request->get_body_params();
        }
        
        // Check if we have the MC_SELECTED_DOCTOR from JavaScript
        $stored_doctor = isset($_REQUEST['MC_SELECTED_DOCTOR']) ? intval($_REQUEST['MC_SELECTED_DOCTOR']) : null;
        
        if ($stored_doctor) {
            $time_slot = mc_get_doctor_time_slot($stored_doctor);
            
            $params['doctor_id'] = [
                'id' => $stored_doctor,
                'timeSlot' => $time_slot
            ];
            
            // Update request params
            $request->set_body_params($params);
            $request->set_param('doctor_id', $params['doctor_id']);
        }
        // If doctor_id is not set or empty, auto-assign
        elseif (empty($params['doctor_id']) || !isset($params['doctor_id']['id'])) {
            
            $service_id = isset($params['service_id']) ? $params['service_id'] : null;
            $language = isset($params['appointment_language']) ? $params['appointment_language'] : null;
            $date = isset($params['appointment_start_date']) ? $params['appointment_start_date'] : null;
            $time = isset($params['appointment_start_time']) ? $params['appointment_start_time'] : null;
            
            if ($service_id && $date && $time) {
                $doctor_id = mc_find_best_available_doctor($service_id, $language, $date, $time);
                
                if ($doctor_id) {
                    // Get doctor's time slot setting
                    $time_slot = mc_get_doctor_time_slot($doctor_id);
                    
                    $params['doctor_id'] = [
                        'id' => $doctor_id,
                        'timeSlot' => $time_slot
                    ];
                    
                    // Update request params
                    $request->set_body_params($params);
                    $request->set_param('doctor_id', $params['doctor_id']);
                }
            }
        }
    }
    
    return $result;
}

/**
 * Find best available doctor based on service, language, and availability
 */
function mc_find_best_available_doctor($service_id, $language, $date, $time) {
    global $wpdb;
    
    // Get doctors who offer this service
    $doctors = $wpdb->get_results($wpdb->prepare(
        "SELECT doctor_id, charges 
        FROM {$wpdb->prefix}kc_service_doctor_mapping 
        WHERE service_id = %d AND status = 1
        ORDER BY charges ASC",
        $service_id
    ));
    
    if (empty($doctors)) {
        return false;
    }
    
    foreach ($doctors as $doctor_row) {
        $doctor_id = $doctor_row->doctor_id;
        
        // Check language match if specified
        if ($language) {
            if (!mc_doctor_speaks_language($doctor_id, $language)) {
                continue;
            }
        }
        
        // Check if doctor is available
        if (!mc_is_doctor_available($doctor_id, $date, $time)) {
            continue;
        }
        
        // Found a match!
        return $doctor_id;
    }
    
    // If no language match found, return first available doctor
    foreach ($doctors as $doctor_row) {
        if (mc_is_doctor_available($doctor_row->doctor_id, $date, $time)) {
            return $doctor_row->doctor_id;
        }
    }
    
    return false;
}

/**
 * Check if doctor speaks specified language
 */
function mc_doctor_speaks_language($doctor_id, $language) {
    global $wpdb;
    
    // Get language field ID from custom_fields table
    $language_field = $wpdb->get_row(
        "SELECT id FROM {$wpdb->prefix}kc_custom_fields 
        WHERE module_type = 'doctor_module' 
        AND fields LIKE '%Idiomas que Habla%' 
        LIMIT 1"
    );
    
    $language_field_id = $language_field ? $language_field->id : 1;
    
    // Query KiviCare's custom fields data table for this doctor's languages
    $doctor_languages = $wpdb->get_var($wpdb->prepare(
        "SELECT fields_data 
        FROM {$wpdb->prefix}kc_custom_fields_data 
        WHERE module_type = 'doctor_module' 
        AND module_id = %d 
        AND field_id = %d",
        $doctor_id,
        $language_field_id
    ));
    
    if (!empty($doctor_languages)) {
        // The languages are stored as a JSON array like: ["Francés","Alemán","Inglés"]
        $langs = json_decode($doctor_languages, true);
        
        if (is_array($langs)) {
            // Normalize language names for comparison
            $language_map = [
                'es' => 'Español',
                'español' => 'Español',
                'spanish' => 'Español',
                'ca' => 'Catalan/Valenciano',
                'catalan' => 'Catalan/Valenciano',
                'valencian' => 'Catalan/Valenciano',
                'eu' => 'Euskera',
                'euskera' => 'Euskera',
                'basque' => 'Euskera',
                'gl' => 'Gallego',
                'gallego' => 'Gallego',
                'galician' => 'Gallego',
                'en' => 'Inglés',
                'inglés' => 'Inglés',
                'english' => 'Inglés',
                'ar' => 'Árabe',
                'árabe' => 'Árabe',
                'arabic' => 'Árabe',
                'fr' => 'Francés',
                'francés' => 'Francés',
                'french' => 'Francés',
                'de' => 'Alemán',
                'alemán' => 'Alemán',
                'german' => 'Alemán',
                'pt' => 'Portugués',
                'portugués' => 'Portugués',
                'portuguese' => 'Portugués'
            ];
            
            // Normalize the input language
            $normalized_language = isset($language_map[strtolower($language)]) 
                ? $language_map[strtolower($language)] 
                : $language;
            
            // Check if doctor speaks this language
            foreach ($langs as $lang) {
                if (strtolower($lang) === strtolower($normalized_language)) {
                    return true;
                }
            }
        }
    }
    
    return false;
}

/**
 * Check if doctor is available at specified date/time
 */
function mc_is_doctor_available($doctor_id, $date, $time) {
    global $wpdb;
    
    // 1. Check if doctor is on vacation
    $on_vacation = $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM {$wpdb->prefix}kc_doctor_clinic_mappings 
        WHERE doctor_id = %d 
        AND %s BETWEEN start_date AND end_date",
        $doctor_id, $date
    ));
    
    if ($on_vacation > 0) {
        return false;
    }
    
    // 2. Check if doctor already has appointment at this time
    $has_appointment = $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM {$wpdb->prefix}kc_appointments 
        WHERE doctor_id = %d 
        AND appointment_start_date = %s 
        AND appointment_start_time = %s 
        AND status != 0",
        $doctor_id, $date, $time
    ));
    
    if ($has_appointment > 0) {
        return false;
    }
    
    // 3. Check if doctor has working hours on this day
    $day_of_week = strtolower(substr(date('D', strtotime($date)), 0, 3)); // 'mon', 'tue', etc.
    
    $has_schedule = $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM {$wpdb->prefix}kc_clinic_sessions 
        WHERE doctor_id = %d 
        AND day = %s 
        AND TIME(%s) BETWEEN start_time AND end_time",
        $doctor_id, $day_of_week, $time
    ));
    
    return $has_schedule > 0;
}

/**
 * Get doctor's time slot duration
 */
function mc_get_doctor_time_slot($doctor_id) {
    global $wpdb;
    
    $time_slot = $wpdb->get_var($wpdb->prepare(
        "SELECT time_slot FROM {$wpdb->prefix}kc_clinic_sessions 
        WHERE doctor_id = %d 
        LIMIT 1",
        $doctor_id
    ));
    
    return $time_slot ? intval($time_slot) : 30; // Default 30 minutes
}

/**
 * ✅ Check if doctor has any clinic sessions configured
 */
function mc_doctor_has_clinic_sessions($doctor_id) {
    global $wpdb;
    
    // Check in correct table: kc_clinic_sessions
    $session_count = $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM {$wpdb->prefix}kc_clinic_sessions 
        WHERE doctor_id = %d",
        $doctor_id
    ));
    
    return $session_count > 0;
}

/**
 * AJAX handler to get first available doctor for a service
 * Called when service is selected to auto-select a doctor
 */
function mc_get_first_available_doctor() {
    $service_id = isset($_POST['service_id']) ? intval($_POST['service_id']) : 0;
    $language = isset($_POST['language']) ? sanitize_text_field($_POST['language']) : '';
    
    if (!$service_id) {
        wp_send_json_error(['message' => 'Service ID required']);
    }
    
    global $wpdb;
    
    // Get all doctors who offer this service
    $doctors = $wpdb->get_results($wpdb->prepare(
        "SELECT DISTINCT doctor_id, charges 
        FROM {$wpdb->prefix}kc_service_doctor_mapping 
        WHERE service_id = %d AND status = 1
        ORDER BY charges ASC",
        $service_id
    ));
    
    if (empty($doctors)) {
        wp_send_json_error(['message' => 'No doctors available for this service']);
    }
    
    // If language specified, try to find doctor with that language first
    $selected_doctor = null;
    
    if ($language) {
        foreach ($doctors as $doctor) {
            $doctor_id = $doctor->doctor_id;
            
            // ✅ FIX: Check if doctor speaks language AND has clinic sessions
            if (mc_doctor_speaks_language($doctor_id, $language) && mc_doctor_has_clinic_sessions($doctor_id)) {
                $selected_doctor = $doctor_id;
                break;
            }
        }
    }
    
    // If no language match or no language specified, find first doctor with sessions
    if (!$selected_doctor && !empty($doctors)) {
        foreach ($doctors as $doctor) {
            $doctor_id = $doctor->doctor_id;
            
            // ✅ FIX: Only assign doctors who have clinic sessions configured
            if (mc_doctor_has_clinic_sessions($doctor_id)) {
                $selected_doctor = $doctor_id;
                break;
            }
        }
    }
    
    if ($selected_doctor) {
        $time_slot = mc_get_doctor_time_slot($selected_doctor);
        
        wp_send_json_success([
            'doctor_id' => $selected_doctor,
            'time_slot' => $time_slot,
            'message' => 'Doctor auto-selected with active clinic sessions'
        ]);
    } else {
        wp_send_json_error(['message' => 'No doctors with available clinic sessions for this service. Please contact support.']);
    }
}
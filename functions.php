<?php

function child_styles() {
	wp_enqueue_style( 'my-child-theme-style', get_stylesheet_directory_uri() . '/style.css', array( 'vamtam-front-all' ), false, 'all' );
}
add_action( 'wp_enqueue_scripts', 'child_styles', 11 );


// Include KiviCare customizations
require_once get_stylesheet_directory() . '/includes/kivicare-customizations/auto-assignment.php';
// Language tab integration (now using proper tab structure)
require_once get_stylesheet_directory() . '/includes/kivicare-customizations/language-tab.php';

// Enqueue custom booking script on all pages (frontend and admin)
add_action('wp_enqueue_scripts', 'mc_enqueue_booking_scripts');
add_action('admin_enqueue_scripts', 'mc_enqueue_booking_scripts');

function mc_enqueue_booking_scripts() {
    // Load on all pages since KiviCare widget can appear anywhere
    wp_enqueue_script(
        'mc-booking-custom',
        get_stylesheet_directory_uri() . '/assets/js/booking-customization.js',
        array('jquery'),
        '5.7.0', // v5.7.0 - CLEANUP: Removed all reCAPTCHA debug code and handlers (reCAPTCHA disabled in KiviCare)
        true
    );

    wp_localize_script('mc-booking-custom', 'ajax_object', array(
        'ajax_url' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('mc_booking_nonce')
    ));
}

// WooCommerce integration for appointments
add_action('init', 'mc_woocommerce_integration', 30);

function mc_woocommerce_integration() {
    if (!class_exists('WooCommerce')) {
        return;
    }
    
    // Hook into appointment booking to create WooCommerce order
    add_action('kc_appointment_booked', 'mc_create_woocommerce_order_for_appointment', 10, 2);
}

/**
 * Create WooCommerce product and redirect to checkout after appointment booking
 */
function mc_create_woocommerce_order_for_appointment($appointment_id, $appointment_data) {
    
    if (!class_exists('WooCommerce') || !$appointment_id) {
        return;
    }
    
    global $wpdb;
    
    // Get appointment details
    $appointment = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM {$wpdb->prefix}kc_appointments WHERE id = %d",
        $appointment_id
    ));
    
    if (!$appointment) {
        return;
    }
    
    // Get service details
    $service = $wpdb->get_row($wpdb->prepare(
        "SELECT charges, service_id FROM {$wpdb->prefix}kc_service_doctor_mapping 
        WHERE doctor_id = %d AND service_id = (
            SELECT id FROM {$wpdb->prefix}kc_services 
            ORDER BY id LIMIT 1
        ) LIMIT 1",
        $appointment->doctor_id
    ));
    
    if (!$service) {
        return;
    }
    
    // Create or get appointment product
    $product_id = mc_get_or_create_appointment_product($appointment, $service);
    
    if ($product_id) {
        // Clear cart and add appointment
        WC()->cart->empty_cart();
        WC()->cart->add_to_cart($product_id, 1, 0, array(), array(
            'appointment_id' => $appointment_id
        ));
        
        // Store redirect flag
        set_transient('mc_redirect_to_checkout_' . get_current_user_id(), wc_get_checkout_url(), 60);
    }
}

/**
 * Create a WooCommerce product for the appointment
 */
function mc_get_or_create_appointment_product($appointment, $service) {
    
    $product_name = 'Medical Appointment - ' . date('Y-m-d H:i', strtotime($appointment->appointment_start_date . ' ' . $appointment->appointment_start_time));
    
    $product = new WC_Product_Simple();
    $product->set_name($product_name);
    $product->set_status('private'); // Hidden from catalog
    $product->set_catalog_visibility('hidden');
    $product->set_price($service->charges);
    $product->set_regular_price($service->charges);
    $product->set_virtual(true);
    $product->set_sold_individually(true);
    
    $product_id = $product->save();
    
    // Store appointment ID as product meta
    update_post_meta($product_id, '_appointment_id', $appointment->id);
    update_post_meta($product_id, '_appointment_date', $appointment->appointment_start_date);
    
    return $product_id;
}
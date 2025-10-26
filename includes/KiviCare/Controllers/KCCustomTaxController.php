<?php

namespace SaluteChild\KiviCare\Controllers;

use App\baseClasses\KCBase;
use App\baseClasses\KCRequest;

class KCCustomTaxController extends KCBase
{
    private $db;
    private $request;
    private $filter_not_found_message;

    public function __construct()
    {

        global $wpdb;

        $this->db = $wpdb;

        $this->request = new KCRequest();

        if ( isKiviCareProActive() ) {
            $this->filter_not_found_message = esc_html__( "Please update kiviCare pro plugin", "kc-lang" );
        } else {
            $this->filter_not_found_message = esc_html__( "Please install kiviCare pro plugin", "kc-lang" );
        }
        
    }

    public function getTaxData()
    {
        // Get request data
        $request_data = $this->request->getInputs();

        // Determine clinic and user roles
        $current_user_role = $this->getLoginUserRole();
        if ($current_user_role == $this->getClinicAdminRole()) {
            $request_data['clinic_id']['id'] = kcGetClinicIdOfClinicAdmin();
        } elseif ($current_user_role == $this->getReceptionistRole()) {
            $request_data['clinic_id']['id'] = kcGetClinicIdOfReceptionist();
        }

        // Check for required data
        if (empty($request_data['clinic_id']['id']) || empty($request_data['visit_type'])) {
            wp_send_json([
                'status' => false,
                'message' => esc_html__("required data missing", "kc-lang")
            ]);
        }

        // Handle visit type data
        if (empty(array_filter($request_data['visit_type'], 'is_array'))) {
            $request_data['visit_type'] = [$request_data['visit_type']];
        }

        // Extract service IDs
        $service_ids = collect($request_data['visit_type'])
            ->pluck('service_id')
            ->map(function ($id) {
                return (int)$id;
            })
            ->toArray();
        $implode_service_ids = implode(",", $service_ids);
        $request_data['clinic_id']['id'] = (int) $request_data['clinic_id']['id'];
        $request_data['doctor_id']['id'] = (int) $request_data['doctor_id']['id'];

        // Send JSON response with calculated tax data
        wp_send_json(apply_filters('kivicare_calculate_tax', [
            'status' => false,
            'message' => $this->filter_not_found_message,
            'data' => [],
            'total_tax' => 0
        ], [
            "id" => !empty($request_data['id']) ? $request_data['id'] : '',
            "type" => 'appointment',
            "doctor_id" => !empty($request_data['doctor_id']['id']) ? $request_data['doctor_id']['id'] : null,
            "clinic_id" => $request_data['clinic_id']['id'],
            "service_id" => $service_ids,
            "total_charge" => $this->db->get_var("SELECT SUM(charges) FROM {$this->db->prefix}kc_service_doctor_mapping
                                        WHERE clinic_id = {$request_data['clinic_id']['id']} 
                                         AND service_id IN ({$implode_service_ids}) "),
            'extra_data' => $request_data
        ]));
    }
}

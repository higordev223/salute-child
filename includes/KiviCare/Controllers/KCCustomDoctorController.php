<?php

namespace SaluteChild\KiviCare\Controllers;

use App\baseClasses\KCRequest;
use SaluteChild\KiviCare\Helpers\DoctorHelper;

class KCCustomDoctorController
{
    public $db;

    private $request;

    public function __construct()
    {

        global $wpdb;

        $this->db = $wpdb;

        $this->request = new KCRequest();
    }

    public function getDoctorWorkdays()
    {
        $request_data = $this->request->getInputs();
        $lang = sanitize_text_field($request_data['preferred_language'] ?? '');

        $service_id = (int) ($request_data['service'][0]['service_id'] ?? 0);

        $doctor_ids = DoctorHelper::getAvailableDoctors($lang, $service_id);

        if (empty($doctor_ids)) {
            wp_send_json(['status' => false, 'data' => [], 'holiday' => []]);
        }

        $doctor_ids_placeholder = implode(',', array_map('intval', $doctor_ids));
        $clinic = intval($request_data['clinic_id']);
        $days = [0 => 'sun', 1 => 'mon', 2 => 'tue', 3 => 'wed', 4 => 'thu', 5 => 'fri', 6 => 'sat'];

        $rs = collect($this->db->get_results("SELECT DISTINCT day FROM {$this->db->prefix}kc_clinic_sessions WHERE doctor_id IN ($doctor_ids_placeholder) AND clinic_id = {$clinic}"))->pluck('day')->toArray();
        if (count($rs)) {
            $rs = array_diff(array_values($days), $rs);
            $rs = array_map(fn($v) => array_search($v, $days), $rs);
            $rs = array_values($rs);
        } else {
            $rs = array_keys($days);
        }
        wp_send_json(['status' => true, 'data' => $rs, 'holiday' => []]);
    }
}

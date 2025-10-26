<?php

namespace SaluteChild\KiviCare\Controllers;

use App\baseClasses\KCBase;
use App\baseClasses\KCRequest;
use App\controllers\KCPaymentController;
use App\models\KCAppointment;
use App\models\KCAppointmentServiceMapping;
use App\models\KCBillItem;
use App\models\KCPatientEncounter;
use SaluteChild\KiviCare\Helpers\AppointmentHelper;
use SaluteChild\KiviCare\Helpers\DoctorHelper;
use Exception;

class KCCustomAppointmentController extends KCBase
{
    public $db;

    private $request;

    public function __construct()
    {

        global $wpdb;

        $this->db = $wpdb;

        $this->request = new KCRequest();
    }

    public function getAppointmentSlots()
    {

        $request_data = $this->request->getInputs();

        if ($this->getLoginUserRole() === $this->getDoctorRole()) {
            $request_data['doctor_id'] = get_current_user_id();
        }

        if (isKiviCareProActive()) {
            if ($this->getLoginUserRole() === $this->getReceptionistRole()) {
                $request_data['clinic_id'] = kcGetClinicIdOfReceptionist();
            }
            if ($this->getLoginUserRole() === $this->getClinicAdminRole()) {
                $request_data['clinic_id'] = kcGetClinicIdOfClinicAdmin();
            }
        }

        $rules = [
            'date'      => 'required|date',
            'clinic_id' => 'required',
            'service'   => 'required',
            'preferred_language'   => 'required',
        ];

        $message = [
            'clinic_id' => esc_html__('Clinic is required', 'kc-lang'),
            'service' => esc_html__('Service is required', 'kc-lang'),
            'preferred_language' => esc_html__('Preferred Language is required', 'kc-lang'),
        ];

        $errors = kcValidateRequest($rules, $request_data, $message);

        if (count($errors)) {
            wp_send_json([
                'status'  => false,
                'message' => $errors[0]
            ]);
        }

        try {

            if (isset($request_data['service'][0])) {
                $rawService = $request_data['service'][0];
                if (is_string($rawService)) {
                    $decoded = json_decode(stripslashes($rawService), true);

                    if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                        $serviceData[0] = AppointmentHelper::kcRecursiveSanitizeTextField($decoded);
                    } else {
                        $serviceData[0] = [];
                    }
                } else {
                    $serviceData[0] = AppointmentHelper::kcRecursiveSanitizeTextField($rawService);
                }
            }

            $lang = sanitize_text_field($request_data['preferred_language'] ?? '');
            $service_id = (int) ($serviceData[0]['service_id'] ?? 0);

            if (empty($request_data['doctor_id'])) {
                $doctor_ids = DoctorHelper::getAvailableDoctors($lang, $service_id);
            } else {
                $doctor_ids = [$request_data['doctor_id']];
            }


            $all_slots = [];
            $morning = [];
            $afternoon = [];
            foreach ($doctor_ids as $doc_id) {
                $request_data['doctor_id'] = $doc_id;
                $slots = kvGetTimeSlots($request_data, "", true);

                if (is_array($slots)) {
                    foreach ($slots as $session_slots) {
                        if (is_array($session_slots) && count($session_slots) === 1 && is_array($session_slots[0])) {
                            $session_slots = $session_slots[0];
                        }

                        foreach ($session_slots as $slot) {
                            if (!isset($slot['time'])) {
                                continue;
                            }

                            $hour = intval(explode(':', $slot['time'])[0]);

                            if ($hour < 14) {
                                $morning[] = $slot;
                            } else {
                                $afternoon[] = $slot;
                            }
                        }
                    }
                }
            }

            $morning = is_array($morning) ? $morning : [];
            $afternoon = is_array($afternoon) ? $afternoon : [];

            if (!empty($morning)) {
                $morning = array_map("unserialize", array_unique(array_map("serialize", $morning)));
                usort($morning, fn($a, $b) => strcmp($a['time'], $b['time']));
            }

            if (!empty($afternoon)) {
                $afternoon = array_map("unserialize", array_unique(array_map("serialize", $afternoon)));
                usort($afternoon, fn($a, $b) => strcmp($a['time'], $b['time']));
            }

            if (!empty($morning)) {
                $all_slots[] = $morning;
            }
            if (!empty($afternoon)) {
                $all_slots[] = $afternoon;
            }

            wp_send_json([
                'status'  => true,
                'message' => esc_html__('Appointment slots', 'kc-lang'),
                'data'    => $all_slots
            ]);
        } catch (Exception $e) {

            $code    = $e->getCode();
            $message = $e->getMessage();

            header("Status: $code $message");

            wp_send_json([
                'status'  => false,
                'message' => $message
            ]);
        }
    }

    public function getAppointmentDetails()
    {

        if (! kcCheckPermission('appointment_list')) {
            wp_send_json(kcUnauthorizeAccessResponse());
        }

        $request_data = $this->request->getInputs();

        if (isset($request_data['appointment_data'])) {
            $appointment_data_json = stripslashes($request_data['appointment_data']);
            $decoded_appointment_data = json_decode($appointment_data_json, true);

            if (isset($decoded_appointment_data['appointment_start_date'])) {
                $decoded_appointment_data['appointment_start_date'] = kcGetFormatedDate($decoded_appointment_data['appointment_start_date']);
            }

            if (empty($decoded_appointment_data['preferred_language'][0]['id'])) {
                wp_send_json([
                    'status' => false,
                    'message' => __('No language selected', 'kc-lang'),
                ]);
            }

            $doctor_ids = DoctorHelper::getAvailableDoctors($decoded_appointment_data['preferred_language'][0]['id'], $decoded_appointment_data['visit_type'][0]['service_id']);
            if (empty($doctor_ids)) {
                wp_send_json([
                    'status' => false,
                    'message' => __('No doctors found for selected language and services.', 'kc-lang'),
                ]);
            }

            $available_doctors = [];
            foreach ($doctor_ids as $doctor_id) {
                if (DoctorHelper::checkDoctorAvailability($doctor_id, $decoded_appointment_data['appointment_start_date'], $decoded_appointment_data['appointment_start_time'])) {
                    $available_doctors[] = $doctor_id;
                }
            }

            if (empty($available_doctors)) {
                wp_send_json([
                    'status' => false,
                    'message' => __('No available doctors at the selected time.', 'kc-lang'),
                ]);
            }

            $selected_doctor_id = $available_doctors[array_rand($available_doctors)];

            $decoded_appointment_data['doctor_id'] = $selected_doctor_id;

            $request_data['appointment_data'] = $decoded_appointment_data;
        }

        wp_send_json([
            'status'  => false,
            'message' => esc_html__("Appointment Date.", 'kc-lang'),
            'data'    => $request_data
        ]);
    }

    public function getPreferredLanguages()
    {

        try {

            $request_data = $this->request->getInputs();

            if (!empty($request_data['doctor_id']) && $this->getLoginUserRole() === $this->getDoctorRole()) {
                $available_languages = AppointmentHelper::getPreferredLanguagesByDoctor($request_data['doctor_id']);

                wp_send_json([
                    'status'  => true,
                    'message' => esc_html__('Preferred Languages', 'kc-lang'),
                    'data'    => $available_languages ? $available_languages : []
                ]);
            }

            if (empty($request_data['service_id'])) {
                wp_send_json([
                    'status' => false,
                    'message' => __('No service selected', 'kc-lang'),
                ]);
            }

            $available_languages = AppointmentHelper::getPreferredLanguagesByService($request_data['clinic_id'], $request_data['service_id']);

            wp_send_json([
                'status'  => true,
                'message' => esc_html__('Preferred Languages', 'kc-lang'),
                'data'    => $available_languages ? $available_languages : []
            ]);
        } catch (Exception $e) {

            $code    = $e->getCode();
            $message = $e->getMessage();

            header("Status: $code $message");

            wp_send_json([
                'status'  => false,
                'message' => $message
            ]);
        }
    }

    public function save()
    {

        global $wpdb;

        if (! kcCheckPermission('appointment_add') && !kcCheckPermission('appointment_edit')) {
            wp_send_json(kcUnauthorizeAccessResponse(403));
        }

        $request_data = $this->request->getInputs();
        $rules = [
            'appointment_start_date' => 'required|date',
            'appointment_start_time' => 'required',
            'clinic_id'              => 'required',
            'patient_id'             => 'required',
            'status'                 => 'required',
        ];

        $message = [
            'status'     => esc_html__('Status is required', 'kc-lang'),
            'patient_id' => esc_html__('Patient is required', 'kc-lang'),
            'clinic_id'  => esc_html__('Clinic is required', 'kc-lang'),
        ];

        $errors = kcValidateRequest($rules, $request_data, $message);

        if (empty($request_data['doctor_id']['id'])) {
            $doctor_ids = DoctorHelper::getAvailableDoctors($request_data['preferred_language'][0]['id'], $request_data['visit_type'][0]['service_id']);
            if (empty($doctor_ids)) {
                wp_send_json([
                    'status' => false,
                    'message' => __('No doctors found for selected language and services.', 'kc-lang'),
                ]);
            }

            $available_doctors = [];
            foreach ($doctor_ids as $doctor_id) {
                if (DoctorHelper::checkDoctorAvailability($doctor_id, $request_data['appointment_start_date'], $request_data['appointment_start_time'])) {
                    $available_doctors[] = $doctor_id;
                }
            }

            if (empty($available_doctors)) {
                wp_send_json([
                    'status' => false,
                    'message' => __('No available doctors at the selected time.', 'kc-lang'),
                ]);
            }

            $request_data['doctor_id']['id'] = $available_doctors[array_rand($available_doctors)];
        }

        if (count($errors)) {
            wp_send_json([
                'status'  => false,
                'message' => $errors[0]
            ]);
        }

        $proPluginActive = isKiviCareProActive();
        $telemedZoomPluginActive = isKiviCareTelemedActive();
        $telemedGooglemeetPluginActive = isKiviCareGoogleMeetActive();

        //check if service is single or multiple, if single create array
        if (empty(array_filter($request_data['visit_type'], 'is_array'))) {
            $request_data['visit_type'] = [$request_data['visit_type']];
        };

        $current_user_role = $this->getLoginUserRole();
        $current_login_user_id = get_current_user_id();
        if ($proPluginActive) {
            if ($current_user_role == $this->getClinicAdminRole()) {
                $request_data['clinic_id']['id'] = kcGetClinicIdOfClinicAdmin();
            } elseif ($current_user_role == $this->getReceptionistRole()) {
                $request_data['clinic_id']['id'] = kcGetClinicIdOfReceptionist();
            }
        } else {
            $request_data['clinic_id'] = [];
            $request_data['clinic_id']['id'] = kcGetDefaultClinicId();
        }
        $notification = '';
        $current_date = current_time("Y-m-d H:i:s");
        $appointment_day = esc_sql(strtolower(date('l', strtotime($request_data['appointment_start_date']))));
        $day_short = esc_sql(substr($appointment_day, 0, 3));
        $query = "SELECT time_slot FROM {$wpdb->prefix}kc_clinic_sessions  WHERE `doctor_id` = " . (int)$request_data['doctor_id']['id'] . " AND `clinic_id` = " . (int)$request_data['clinic_id']['id'] . "  AND ( `day` = '{$day_short}' OR `day` = '{$appointment_day}') ";
        $clinic_session_time_slots = $wpdb->get_var($query);
        $time_slot             = !empty($clinic_session_time_slots) ? $clinic_session_time_slots : 15;
        $end_time             = strtotime("+" . $time_slot . " minutes", strtotime($request_data['appointment_start_time']));
        $appointment_end_time = date('H:i:s', $end_time);
        $appointment_date     = date('Y-m-d', strtotime($request_data['appointment_start_date']));
        $appointment_start_date = esc_sql($appointment_date);
        $appointment_start_time = esc_sql(date('H:i:s', strtotime($request_data['appointment_start_time'])));
        if (isset($request_data['payment_mode']) && $request_data['payment_mode'] !== 'paymentOffline') {
            $request_data['status'] = 0;
        }
        $appointment_status = esc_sql($request_data['status']);
        if (isKiviCareProActive()) {
            $verifyTimeslot = apply_filters('kcpro_verify_appointment_timeslot', $request_data);
            if (is_array($verifyTimeslot) && array_key_exists('end_time', $verifyTimeslot) && !empty($verifyTimeslot['end_time'])) {
                if (empty($verifyTimeslot['status'])) {
                    wp_send_json($verifyTimeslot);
                }
                $appointment_end_time = date('H:i:s', $verifyTimeslot['end_time']);
            }
        }

        $clinic_id = (int)$request_data['clinic_id']['id'];
        $doctor_id = (int)$request_data['doctor_id']['id'];
        $patient_id = (int)$request_data['patient_id']['id'];

        if ($current_user_role === $this->getPatientRole() && $patient_id !== $current_login_user_id) {
            wp_send_json(kcUnauthorizeAccessResponse(403));
        }

        if ($current_user_role === $this->getDoctorRole() && $doctor_id !== $current_login_user_id) {
            wp_send_json(kcUnauthorizeAccessResponse(403));
        }

        $temp = [
            'appointment_start_date' => $appointment_start_date,
            'appointment_start_time' => $appointment_start_time,
            'appointment_end_date'   => esc_sql($appointment_date),
            'appointment_end_time'   => esc_sql($appointment_end_time),
            'clinic_id'              => $clinic_id,
            'doctor_id'              => $doctor_id,
            'patient_id'             => $patient_id,
            'description'            => esc_sql($request_data['description']),
            'status'                 => $appointment_status,
        ];

        $appointment_table_name = $this->db->prefix . 'kc_appointments';
        if (isset($request_data['file']) && is_array($request_data['file']) && count($request_data['file']) > 0) {
            kcUpdateFields($appointment_table_name, ['appointment_report' => 'longtext NULL']);
            $temp['appointment_report'] = json_encode($request_data['file']);
        }

        $appointment = new KCAppointment();
        $oldMappingServiceDelete = false;
        $beforeUpdateAppointmentData = (object)[];
        if (!empty($request_data['id'])) {
            if (!((new KCAppointment())->appointmentPermissionUserWise($request_data['id']))) {
                wp_send_json(kcUnauthorizeAccessResponse(403));
            }
            $appointment_id = (int)$request_data['id'];

            if ($current_user_role == $this->getPatientRole()) {
                $kcGetCancellationBuffer = kcGetCancellationBufferData($current_date, $appointment_start_date, $appointment_start_time);
                if ($kcGetCancellationBuffer === false) {
                    $message = esc_html__('This Appointment can not be edited.', 'kc-lang');
                    wp_send_json([
                        'status'  => true,
                        'message' => $message,
                        'notification' => $notification,
                    ]);
                }
            }

            $beforeUpdateAppointmentData =  $this->db->get_row("SELECT * FROM {$appointment_table_name} WHERE id={$appointment_id}");
            $appointment->update($temp, array('id' => (int)$request_data['id']));
            (new KCPatientEncounter())->update([
                'encounter_date' => $appointment_date,
                'patient_id'             => $patient_id,
                'doctor_id'              => $doctor_id,
                'clinic_id'              => $clinic_id,
                'description'            => esc_sql($request_data['description']),
            ], ['appointment_id' => $appointment_id]);
            $encounter_id = (new KCPatientEncounter())->get_var(['appointment_id' => $appointment_id], 'id');
            do_action('kc_encounter_update', $encounter_id);
            if (isset($request_data['custom_fields_data']) && $request_data['custom_fields_data'] !== []) {
                kvSaveCustomFields('appointment_module', $appointment_id, $request_data['custom_fields_data']);
            }
            $message = esc_html__('Appointment has been updated successfully', 'kc-lang');
            $reminder_setting = get_option(KIVI_CARE_PREFIX . 'email_appointment_reminder', true);
            if (gettype($reminder_setting) !== 'boolean' && !empty($reminder_setting['time'])) {
                $msg_reminder_table = $wpdb->prefix . "kc_appointment_reminder_mapping";
                $temp = [
                    'sms_status' => 0,
                    'email_status' => 0,
                    'whatsapp_status' => 0
                ];
                $wpdb->update($msg_reminder_table, $temp, ['appointment_id' => (int)$request_data['id']]);
            }

            if (
                $beforeUpdateAppointmentData->appointment_start_date == $appointment_start_date
                && $beforeUpdateAppointmentData->appointment_start_time == $appointment_start_time &&
                $beforeUpdateAppointmentData->status == $appointment_status && (!isset($request_data['custom_fields_data']) && $request_data['custom_fields_data'] == [])
            ) {
                wp_send_json([
                    'status'  => true,
                    'message' => $message,
                    'notification' => $notification,
                ]);
            }

            if (!empty($appointment_id) && $appointment_id !== 0) {
                // hook for appointment update
                do_action('kc_appointment_update', $appointment_id);
            }
        } else {


            $temp['created_at'] = current_time('Y-m-d H:i:s');

            $checkAppointmentData =  $this->db->get_row("SELECT * FROM {$appointment_table_name} WHERE appointment_start_date='{$appointment_start_date}' AND appointment_start_time='{$appointment_start_time}' AND appointment_end_date='{$appointment_date}' AND appointment_end_time='{$appointment_end_time}' AND clinic_id={$clinic_id} AND doctor_id={$doctor_id} AND status != '0'");

            if (!empty($checkAppointmentData)) {
                $message = __('Appointment Already Booked For This Time Slot.', 'kc-lang');
                wp_send_json([
                    'status'  => false,
                    'message' => $message,
                ]);
            }

            $appointment_id = (int)$appointment->insert($temp);

            // if appointment is not successfully created. (WP Error handle) 
            if (is_wp_error($appointment_id) || empty($appointment_id)) {
                $message = __('Appointment booking Failed. Please try again.', 'kc-lang');
                wp_send_json([
                    'status'  => false,
                    'message' => $message,
                ]);
            }

            $message = esc_html__('Appointment is Successfully booked.', 'kc-lang');
            if (isset($request_data['custom_fields_data']) && $request_data['custom_fields_data'] !== []) {
                kvSaveCustomFields('appointment_module', $appointment_id, $request_data['custom_fields_data']);
            }
            if ($proPluginActive && !empty($request_data['tax'])) {
                apply_filters('kivicare_save_tax_data', [
                    'type' => 'appointment',
                    'id' => $appointment_id,
                    'tax_data' => $request_data['tax']
                ]);
            }
        }

        $telemed_service_include = false;
        if (gettype($request_data['visit_type']) === 'array') {
            $telemed_service_in_appointment_service = collect($request_data['visit_type'])->map(function ($v) use ($request_data, $clinic_id) {
                $temp_service_id = (int)$v['service_id'];
                return $this->db->get_var("SELECT telemed_service FROM {$this->db->prefix}kc_service_doctor_mapping WHERE service_id = {$temp_service_id} AND clinic_id ={$clinic_id} AND doctor_id=" . (int)$request_data['doctor_id']['id']);
            })->toArray();
            foreach ($request_data['visit_type'] as $key => $value) {

                //			    $service = strtolower($value['name']);


                // generate zoom link request (Telemed AddOn filter)
                if ($value['telemed_service'] === 'yes') {

                    if ($telemedZoomPluginActive || $telemedGooglemeetPluginActive) {

                        $request_data['appointment_id'] = $appointment_id;
                        $request_data['time_slot'] = $time_slot;

                        if ($request_data['payment_mode'] !== 'paymentWoocommerce') {
                            if (kcCheckDoctorTelemedType($appointment_id) == 'googlemeet') {
                                $res_data = apply_filters('kcgm_save_appointment_event', ['appoinment_id' => $appointment_id, 'service' => kcServiceListFromRequestData($request_data)]);
                            } else {
                                $res_data = apply_filters('kct_create_appointment_meeting', $request_data);
                            }
                            // if zoom meeting is not created successfully
                            if (empty($res_data['status'])) {
                                if (empty($request_data['id'])) {
                                    (new KCAppointmentServiceMapping())->delete(['appointment_id' => (int)$appointment_id]);
                                    (new KCAppointment())->delete(['id' =>  (int)$appointment_id]);
                                    do_action('kc_appointment_cancel', $appointment_id);
                                }
                                wp_send_json([
                                    'status'  => false,
                                    'message' => esc_html__($res_data['message'], 'kc-lang'),
                                    'error' => $res_data
                                ]);
                            }
                            $telemed_service_include = true;
                        }
                    }
                }

                if (!empty($appointment_id) && $appointment_id !== 0) {
                    if (!$oldMappingServiceDelete) {
                        (new KCAppointmentServiceMapping())->delete(['appointment_id' => $appointment_id]);
                        $oldMappingServiceDelete = true;
                    }
                    (new KCAppointmentServiceMapping())->insert([
                        'appointment_id' => (int)$appointment_id,
                        'service_id' => (int)$value['service_id'],
                        'created_at' => current_time('Y-m-d H:i:s'),
                        'status' => 1
                    ]);
                }
            }
        }

        if ((string)$request_data['status'] == '0') {
            if (!empty($request_data['id'])) {
                kcAppointmentCancelMail($beforeUpdateAppointmentData);

                //zoom telemed entry delete
                if (isKiviCareTelemedActive()) {
                    apply_filters('kct_delete_appointment_meeting', ['id' => $appointment_id]);
                }

                //googlemeet telemed entry delete
                if (isKiviCareGoogleMeetActive()) {
                    apply_filters('kcgm_remove_appointment_event', ['appoinment_id' => $appointment_id]);
                }

                //google calendar event delete
                if (kcCheckGoogleCalendarEnable()) {
                    apply_filters('kcpro_remove_appointment_event', ['appoinment_id' => $appointment_id]);
                }
                do_action('kc_appointment_cancel', $appointment_id);
            }
        }

        if (in_array((string)$request_data['status'], ['4'])) {
            KCPatientEncounter::createEncounter($appointment_id);
            KCBillItem::createAppointmentBillItem($appointment_id);
        }

        if (empty($request_data['id'])) {
            // hook for appointment booked
            do_action('kc_appointment_book', $appointment_id);
        }

        switch ($request_data['payment_mode']) {
            case 'paymentWoocommerce':
                $woocommerce_response  = kcWoocommerceRedirect($appointment_id, $request_data);
                if (isset($woocommerce_response['status']) && $woocommerce_response['status']) {
                    if (!empty($woocommerce_response['woocommerce_cart_data'])) {
                        wp_send_json($woocommerce_response);
                    }
                }
                break;
            case 'paymentPaypal':
                $this->db->update($this->db->prefix . "kc_appointments", ['status' => 0], ['id' => $appointment_id]);
                $paypal_response = (new KCPaymentController())->makePaypalPayment($request_data, $appointment_id);
                if (empty($paypal_response['status'])) {
                    (new KCAppointment())->loopAndDelete(['id' => $appointment_id], true);
                }

                $paypal_response['appointment_id'] = $appointment_id;
                $paypal_response['data'] = $request_data;
                wp_send_json($paypal_response);
                break;
            case 'paymentRazorpay':
                $this->db->update($this->db->prefix . "kc_appointments", ['status' => 0], ['id' => $appointment_id]);
                $request_data['appointment_id'] = $appointment_id;
                $request_data['page'] = 'dashboard';
                $razorpay_response = apply_filters('kivicare_create_razorpay_order', $request_data);
                if (is_array($razorpay_response) && array_key_exists('checkout_detail', $razorpay_response) && !empty($razorpay_response['status'])) {
                    $razorpay_response['appointment_id'] = $appointment_id;
                    $razorpay_response['data'] = $request_data;
                    wp_send_json($razorpay_response);
                } else {
                    (new KCAppointment())->loopAndDelete(['id' => $appointment_id], true);
                    wp_send_json([
                        'status' => false,
                        'message' => esc_html__('Failed to create razorpay payment link', 'kc-lang'),
                        'error_message' => is_array($razorpay_response) && !empty($razorpay_response['message']) ? $razorpay_response['message'] : ''
                    ]);
                }
                break;
            case 'paymentStripepay':
                $this->db->update($this->db->prefix . "kc_appointments", ['status' => 0], ['id' => $appointment_id]);
                $stripepay_response = apply_filters('kivicare_create_stripepay_order', [], $request_data, $appointment_id);
                $request_data['page'] = 'dashboard';
                if (empty($stripepay_response['status'])) {
                    (new KCAppointment())->loopAndDelete(['id' => $appointment_id], true);
                }
                $stripepay_response['appointment_id'] = $appointment_id;
                $stripepay_response['data'] = $request_data;
                wp_send_json($stripepay_response);
                break;
            case 'paymentOffline':
                if (!(in_array($request_data['status'], [0, 2]))) {
                    $service_name = kcServiceListFromRequestData($request_data);
                    if ($proPluginActive || $telemedZoomPluginActive || $telemedGooglemeetPluginActive) {
                        $notification = kcProAllNotification($appointment_id, $service_name, $telemed_service_include);
                    } else {
                        $notification = kivicareCommonSendEmailIfOnlyLitePluginActive($appointment_id, $service_name);
                    }
                }
                break;
        }
        if (!empty($appointment_id) && $appointment_id !== 0) {
            wp_send_json([
                'status'  => true,
                'message' => $message,
                'notification' => $notification,
            ]);
        } else {
            $message = esc_html__('Appointment booking Failed. Please try again.', 'kc-lang');
            wp_send_json([
                'status'  => false,
                'message' => $message,
                'notification' => $notification,
            ]);
        }
    }
};

<?php

namespace SaluteChild\KiviCare\Controllers;

use App\baseClasses\KCRequest;
use App\models\KCAppointment;
use App\models\KCAppointmentServiceMapping;
use App\models\KCBillItem;
use App\models\KCPatientEncounter;
use App\controllers\KCPaymentController;
use SaluteChild\KiviCare\Helpers\DoctorHelper;

use Exception;

class KCCustomBookAppointmentWidgetController
{
    public $db;

    private $request;

    public function __construct()
    {

        global $wpdb;

        $this->db = $wpdb;

        $this->request = new KCRequest();
    }

    public function getTimeSlots()
    {
        $formData = $this->request->getInputs();
        if (empty($formData['date'])) {
            wp_send_json(['status' => false, 'message' => 'Faltan datos', 'data' => [], 'html' => '']);
        }

        $formData = $this->request->getInputs();
        if (!function_exists('kvGetTimeSlots')) {
            wp_send_json(['status' => false, 'message' => 'kvGetTimeSlots not available', 'data' => [], 'html' => '']);
        }

        $lang = sanitize_text_field($formData['preferred_language'] ?? '');
        $service_id = (int) ($formData['service'][0]['service_id'] ?? 0);

        $doctor_ids = DoctorHelper::getAvailableDoctors($lang, $service_id);

        $all_slots = [];
        foreach ($doctor_ids as $doc_id) {
            $slots = kvGetTimeSlots([
                'date' => $formData['date'],
                'doctor_id' => $doc_id,
                'clinic_id' => $formData['clinic_id'],
                'service' => $formData['service'],
                'widgetType' => 'phpWidget'
            ], "", true);

            if (is_array($slots)) {
                foreach ($slots as $session_slots) {
                    foreach ($session_slots as $slot) {
                        $all_slots[] = $slot;
                    }
                }
            }
        }

        $all_slots = array_unique($all_slots, SORT_REGULAR);

        $status = count($all_slots) > 0;
        $msg = $status ? __('Time slots', 'kc-lang') : __('Doctor is not available for this date', 'kc-lang');

        ob_start();
        if ($status) {

            usort($all_slots, function ($a, $b) {
                return strtotime($a['time']) - strtotime($b['time']);
            });

            set_transient("appointment_data_user", ['preferred_language' => $lang], 0);

            foreach ($all_slots as $t) {
?>
                <div class="iq-client-widget iq-time-slot">
                    <input type="radio" class="card-checkbox selected-time" name="card_main"
                        id="time_slot_<?php echo esc_html($t['time']); ?>"
                        value="<?php echo esc_html($t['time']); ?>">
                    <label class="iq-button iq-button-white"
                        for="time_slot_<?php echo esc_html($t['time']); ?>"><?php echo esc_html($t['time']); ?></label>
                </div>
        <?php
            }
        }
        $html = ob_get_clean();

        wp_send_json(['status' => $status, 'message' => $msg, 'data' => $all_slots, 'html' => $html]);
    }

    public function appointmentConfirmPage()
    {
        $request_data = $this->request->getInputs();

        $field_id = 0;
        $label_list = [];
        if (!empty($request_data['custom_field']) && count($request_data['custom_field'])) {
            foreach ($request_data['custom_field'] as $custom_key => $custom) {
                $field_id = (int)str_replace("custom_field_", "", $custom_key);
                $query = "SELECT fields FROM {$this->db->prefix}kc_custom_fields WHERE id = {$field_id}";
                $label_list[$custom_key] = collect($this->db->get_results($query))->pluck('fields')->map(function ($x) use ($custom) {
                    return !empty(json_decode($x)->label) ? json_decode($x)->label : '';
                })->toArray();
            }
        }

        $temp_appointment_data = get_transient('appointment_data_user');

        if (empty($temp_appointment_data['preferred_language'])) {
            wp_send_json([
                'status' => false,
                'message' => __('No language selected', 'kc-lang'),
            ]);
        }

        $doctor_ids = DoctorHelper::getAvailableDoctors($temp_appointment_data['preferred_language'], $request_data['service_list']);
        if (empty($doctor_ids)) {
            wp_send_json([
                'status' => false,
                'message' => __('No doctors found for selected language and services.', 'kc-lang'),
            ]);
        }

        $available_doctors = [];
        foreach ($doctor_ids as $doctor_id) {
            if (DoctorHelper::checkDoctorAvailability($doctor_id, $request_data['date'], $request_data['time'])) {
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

        $updated_transient_data = $temp_appointment_data;
        $updated_transient_data['doctor_id'] = $selected_doctor_id;

        set_transient("appointment_data_user", $updated_transient_data, 0);

        $request_data['doctor_id'] = $selected_doctor_id;
        $request_data['clinic_id'] = (int)$request_data['clinic_id'];
        $doctor_name =  $this->db->get_var("SELECT display_name FROM {$this->db->base_prefix}users WHERE ID = {$request_data['doctor_id']}");
        $request_data['service_list_data'] = $request_data['service_list'];
        $request_data['service_list_data'] = array_map('absint', $request_data['service_list_data']);
        $request_data['service_list'] = implode(",", array_map('absint', $request_data['service_list']));
        $request_data['tax_details'] = apply_filters('kivicare_calculate_tax', [
            'status' => false,
            'message' => '',
            'data' => []
        ], [
            "id" => '',
            "type" => 'appointment',
            "doctor_id" => $request_data['doctor_id'],
            "clinic_id" => $request_data['clinic_id'],
            "service_id" => $request_data['service_list_data'],
            "total_charge" => $this->db->get_var("SELECT SUM(charges) FROM {$this->db->prefix}kc_service_doctor_mapping
                                    WHERE doctor_id = {$request_data['doctor_id']} AND  clinic_id = {$request_data['clinic_id']} 
                                        AND service_id IN ({$request_data['service_list']}) "),
            'extra_data' => $request_data
        ]);
        $patient_id = get_current_user_id();
        $patient_data = $this->db->get_row("SELECT * FROM {$this->db->base_prefix}users WHERE ID = {$patient_id}");
        $clinic_currency_detail = kcGetClinicCurrenyPrefixAndPostfix();
        $patient_basic_data = json_decode(get_user_meta($patient_id, 'basic_data', true));

        $service_list_data = $this->db->get_results("SELECT service.*, doctor_service.charges FROM {$this->db->prefix}kc_services AS service 
                                                    LEFT JOIN {$this->db->prefix}kc_service_doctor_mapping AS doctor_service ON doctor_service.service_id = service.id
                                                    WHERE service.id IN ({$request_data['service_list']} ) AND doctor_service.clinic_id= {$request_data['clinic_id']}
                                                        AND  doctor_service.doctor_id={$request_data['doctor_id']}");

        $name = $address = '';
        $patient_country_calling_code  = get_user_meta($patient_id, 'country_calling_code', true);
        $country_calling_code = !empty($patient_country_calling_code) ? '+' . $patient_country_calling_code : '';

        if (!isKiviCareProActive()) {
            $data =  kcClinicDetail(kcGetDefaultClinicId());
        } else {
            $data =  kcClinicDetail((int)$request_data['clinic_id']);
        }

        if (!empty($data)) {
            $name = $data->name;
            $address = $data->address . ', ' . $data->postal_code . ', ' . $data->city . ', ' . $data->country;
        }
        ob_start();
        ?>
        <div class="kivi-col-6 pr-4">
            <div class="kc-confirmation-info-section">
                <h6 class="iq-text-uppercase iq-color-secondary iq-letter-spacing-1 mb-2"><?php echo esc_html__('Clinic info', 'kc-lang'); ?></h6>
                <div class="iq-card iq-preview-details">
                    <table class="iq-table-border mb-0" style="border:0;">
                        <tr>
                            <td>
                                <h6 style="width: 15em;"><?php echo esc_html($name); ?></h6>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <p style="width: 15em;"><?php echo esc_html(!empty($address) ? $address : ''); ?></p>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
            <div class="kc-confirmation-info-section">
                <h6 class="iq-text-uppercase iq-color-secondary iq-letter-spacing-1 mb-2"><?php echo esc_html__('Patient info', 'kc-lang'); ?></h6>
                <div class="iq-card iq-preview-details kc-patient-info">
                    <table class="iq-table-border mb-0" style="border:0;">
                        <tr>
                            <td>
                                <h6><?php echo esc_html__('Name', 'kc-lang'); ?>:</h6>
                            </td>
                            <td id="patientName">
                                <p><?php echo esc_html(!empty($patient_data->display_name) ? $patient_data->display_name : ''); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <h6><?php echo esc_html__('Number', 'kc-lang'); ?>:</h6>
                            </td>
                            <td id="patientTelephone">
                                <p><?php echo esc_html(!empty($patient_basic_data->mobile_number) ? $country_calling_code . ' ' . $patient_basic_data->mobile_number : ''); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <h6><?php echo esc_html__('Email', 'kc-lang'); ?>:</h6>
                            </td>
                            <td id="patientEmail">
                                <p><?php echo esc_html(!empty($patient_data->user_email) ? $patient_data->user_email : ''); ?></p>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
        </div>
        <?php
        ?>
        <div class="item-img-1 kivi-col-6 mb-2 pr-4">
            <h6 class="iq-text-uppercase iq-color-secondary iq-letter-spacing-1"><?php echo esc_html__('Appointment summary', 'kc-lang'); ?></h6>
            <div class="iq-card iq-card-border mt-3">
                <div class="d-flex justify-content-between align-items-center">
                    <p><?php echo esc_html__('Doctor', 'kc-lang'); ?> :</p>
                    <h6 id="doctorname"><?php echo esc_html($doctor_name); ?></h6>
                </div>
                <div class="d-flex justify-content-between align-items-center mt-3">
                    <p><?php echo esc_html__('Date ', 'kc-lang'); ?> :</p>
                    <h6><span id="dateOfAppointment"><?php echo esc_html(kcGetFormatedDate($request_data['date'])); ?></span></h6>
                </div>
                <div class="d-flex justify-content-between align-items-center mt-3">
                    <p><?php echo esc_html__('Time ', 'kc-lang'); ?> :</p>
                    <h6><span id="timeOfAppointment"><?php echo esc_html($request_data['time']); ?></span></h6>
                </div>
                <div class="iq-card iq-preview-details mt-4">
                    <h6><?php echo esc_html__('Services', 'kc-lang'); ?></h6>

                    <span id="services_list">
                        <?php
                        if (!empty($service_list_data) && count($service_list_data) > 0) {
                            $service_total_charge = array_sum(collect($service_list_data)->pluck('charges')->toArray());
                            foreach ($service_list_data as $service_data) {
                        ?>
                                <div class="d-flex justify-content-between align-items-center mt-1">
                                    <p> <?php echo esc_html($service_data->name); ?></p>
                                    <h6><?php echo esc_html((!empty($clinic_currency_detail['prefix']) ? $clinic_currency_detail['prefix'] : '') . $service_data->charges . (!empty($clinic_currency_detail['postfix']) ? $clinic_currency_detail['postfix'] : '')); ?></h6>
                                </div>
                        <?php
                            }
                        }
                        ?>
                    </span>
                    <?php
                    if (!empty($request_data['tax_details']['data'])) {
                    ?>
                        <h6 style="padding-top: 16px;"><?php echo esc_html__('Taxes', 'kc-lang'); ?></h6>
                        <?php
                        foreach ($request_data['tax_details']['data'] as $tax) {
                        ?>
                            <div class="d-flex justify-content-between align-items-center mt-1">
                                <p> <?php echo esc_html($tax->name); ?></p>
                                <h6><?php echo esc_html((!empty($clinic_currency_detail['prefix']) ? $clinic_currency_detail['prefix'] : '') . $tax->charges . (!empty($clinic_currency_detail['postfix']) ? $clinic_currency_detail['postfix'] : '')); ?></h6>
                            </div>
                    <?php
                        }
                    }
                    ?>
                </div>
                <?php
                $request_data['service_total_charge'] = $service_total_charge;
                $request_data['clinic_currency_detail'] = $clinic_currency_detail;
                $this->appointmentTaxDetailHtml($request_data);
                ?>
            </div>
        </div>

        <?php
        if (kcAppointmentMultiFileUploadEnable() && !empty($request_data['file'])) {
            $request_data['file'] = array_map('absint', $request_data['file']);
        ?>
            <div class="kivi-col-6 pr-4">
                <h6 class="iq-text-uppercase iq-color-secondary iq-letter-spacing-1"><?php echo esc_html__('Uploaded files', 'kc-lang'); ?></h6>
                <div class="iq-card iq-preview-details mt-3">
                    <table class="iq-table-border" style="border: 0;">
                        <?php
                        foreach ($request_data['file'] as $key => $file) {
                        ?>
                            <tr>
                                <td>
                                    <a href="<?php echo esc_url(wp_get_attachment_url($file)); ?>" target="_blank" alt="<?php echo esc_html(get_the_title($file)); ?>">
                                        <i class="fas fa-external-link-alt"></i><?php echo ' ' . esc_html(get_the_title($file)) ?>
                                    </a>
                                </td>
                            </tr>
                        <?php
                        }
                        ?>
                    </table>
                </div>
            </div>
        <?php
        }
        $custom_field_values = [];
        if (!empty($request_data['custom_field'])) {
            foreach ($request_data['custom_field'] as $key => $val) {
                if (!empty($val)) {
                    array_push($custom_field_values, $val);
                }
            }
        }
        if ((kcCheckExtraTabConditionInAppointmentWidget('description') && !empty($request_data['description'])) || (!empty($request_data['custom_field']) && !empty($custom_field_values))) {
        ?>
            <div class="kivi-col-6 pr-4">
                <h6 class="iq-text-uppercase iq-color-secondary iq-letter-spacing-1"><?php echo esc_html__('Other info', 'kc-lang'); ?></h6>
                <div class="iq-card iq-preview-details mt-3">
                    <table class="iq-table-border" style="border: 0;">
                        <?php if (!empty($request_data['description'])) { ?>
                            <tr>
                                <td>
                                    <h6><?php echo esc_html__('Description', 'kc-lang'); ?>:</h6>
                                </td>
                                <td id="AppointmentDescription">
                                    <?php echo esc_html(!empty($request_data['description']) ? $request_data['description'] : ''); ?>
                                </td>
                            </tr>
                            <?php
                        }
                        if (!empty($label_list)) {
                            foreach ($label_list as $label_key => $label_value) {
                                if (!empty($request_data['custom_field'][$label_key])) {
                                    if (
                                        is_array($request_data['custom_field'][$label_key]) &&
                                        isset($request_data['custom_field'][$label_key][0]['text'])
                                    ) {
                                        $request_data['custom_field'][$label_key] = collect($request_data['custom_field'][$label_key])->pluck('text')->implode(', ');
                                    } else {
                                        $request_data['custom_field'][$label_key] = is_array($request_data['custom_field'][$label_key])
                                            ? implode(', ', $request_data['custom_field'][$label_key]) : $request_data['custom_field'][$label_key];
                                    }
                            ?>
                                    <tr>
                                        <td>
                                            <h6><?php echo esc_html($label_value[0]); ?>:</h6>
                                        </td>
                                        <td>
                                            <?php echo esc_html(!empty($request_data['custom_field'][$label_key]) ? $request_data['custom_field'][$label_key] : ''); ?>
                                        </td>
                                    </tr>
                        <?php
                                }
                            }
                        }
                        ?>
                    </table>
                </div>
            </div>
        <?php
        }

        $htmldata = ob_get_clean();

        wp_send_json([
            'status' => true,
            'message' => __('confirm page details', 'kc-lang'),
            'data' => $htmldata,
            'service_charges' => ($request_data['service_total_charge'] ?? 0),
            'tax_details' => !empty($request_data['tax_details']['data']) ? $request_data['tax_details']['data'] : []
        ]);
    }

    public function appointmentTaxDetailHtml($request_data, $appointment_id = '')
    {
        $service_total_charge = $request_data['service_total_charge'];
        $clinic_currency_detail = $request_data['clinic_currency_detail'];
        $tax_details = $request_data['tax_details'];

        if (!empty($tax_details['tax_total'])) {
            $service_total_charge += $tax_details['tax_total'];
        }
        ?>
        <hr class="mb-0">
        <div class="d-flex justify-content-between align-items-center kc-total-price mt-4">
            <h5><?php echo esc_html__('Total Price', 'kc-lang'); ?></h5>
            <h5 class="iq-color-primary kc-services-total" id="services_total"> <?php echo esc_html((!empty($clinic_currency_detail['prefix']) ? $clinic_currency_detail['prefix'] : '') . $service_total_charge . (!empty($clinic_currency_detail['postfix']) ? $clinic_currency_detail['postfix'] : '')); ?></h5>
        </div>
<?php
    }

    public function saveAppointment()
    {
        if (!is_user_logged_in()) {
            wp_send_json([
                "status" => false,
                "message" => __('Sign in to book appointment', 'kc-lang')
            ]);
        }
        $user = wp_get_current_user();
        if (!in_array('kiviCare_patient', (array) $user->roles)) {
            wp_send_json([
                "status" => false,
                "message" => __('User must be patient to book appointment', 'kc-lang')
            ]);
        }

        $formData = $this->request->getInputs();
        $proPluginActive = isKiviCareProActive();
        $telemedZoomPluginActive = isKiviCareTelemedActive();
        $telemedGooglemeetPluginActive = isKiviCareGoogleMeetActive();
        $temp_appointment_data = get_transient('appointment_data_user');

        try {
            if (empty(array_filter($formData['visit_type'], 'is_array'))) {
                $formData['visit_type'] = [$formData['visit_type']];
            };
            $clinic_id = (int)(isset($formData['clinic_id']['id']) ? $formData['clinic_id']['id'] : kcGetDefaultClinicId());
            $formData['doctor_id']['id'] = $temp_appointment_data['doctor_id'];
            $appointment_day = strtolower(date('l', strtotime($formData['appointment_start_date'])));
            $day_short = substr($appointment_day, 0, 3);

            $doctor_time_slot = $this->db->get_var("SELECT time_slot FROM {$this->db->prefix}kc_clinic_sessions  
				WHERE `doctor_id` = {$formData['doctor_id']['id']} AND `clinic_id` ={$clinic_id}  
				AND ( `day` = '{$day_short}' OR `day` = '{$appointment_day}') ");

            $time_slot             = !empty($doctor_time_slot) ? $doctor_time_slot : 15;

            $end_time             = strtotime("+" . $time_slot . " minutes", strtotime($formData['appointment_start_time']));
            $appointment_end_time = date('H:i:s', $end_time);
            $appointment_date     = date('Y-m-d', strtotime($formData['appointment_start_date']));
            $appointment_start_time = date('H:i:s', strtotime($formData['appointment_start_time']));
            if (isKiviCareProActive()) {
                $verifyTimeslot = apply_filters('kcpro_verify_appointment_timeslot', $formData);
                if (is_array($verifyTimeslot) && array_key_exists('end_time', $verifyTimeslot) && !empty($verifyTimeslot['end_time'])) {
                    if (empty($verifyTimeslot['status'])) {
                        wp_send_json($verifyTimeslot);
                    }
                    $appointment_end_time = date('H:i:s', $verifyTimeslot['end_time']);
                }
            }
            if (isset($formData['payment_mode']) && $formData['payment_mode'] !== 'paymentOffline') {
                $formData['status'] = 0;
            }
            $tempAppointmentData = [
                'appointment_start_date' => $appointment_date,
                'appointment_start_time' => $appointment_start_time,
                'appointment_end_date' => $appointment_date,
                'appointment_end_time' => $appointment_end_time,
                'visit_type' => $formData['visit_type'],
                'clinic_id' => $clinic_id,
                'doctor_id' => $formData['doctor_id']['id'],
                'patient_id' => get_current_user_id(),
                'description' => $formData['description'],
                'status' => $formData['status'],
                'created_at' => current_time('Y-m-d H:i:s')
            ];


            if (isset($formData['file']) && is_array($formData['file']) && count($formData['file']) > 0) {
                kcUpdateFields($this->db->prefix . 'kc_appointments', ['appointment_report' => 'longtext NULL']);
                $tempAppointmentData['appointment_report'] = json_encode($formData['file']);
            }

            $patient_appointment_id = (new KCAppointment())->insert($tempAppointmentData);

            if ($patient_appointment_id) {
                $formData['id'] = $patient_appointment_id;
                if (isset($formData['custom_fields']) && $formData['custom_fields'] !== []) {
                    kvSaveCustomFields('appointment_module', $patient_appointment_id, $formData['custom_fields']);
                }
                if (!empty($formData['tax'])) {
                    apply_filters('kivicare_save_tax_data', [
                        'type' => 'appointment',
                        'id' => $patient_appointment_id,
                        'tax_data' => $formData['tax']
                    ]);
                }
                $message = __('Appointment has been booked successfully', 'kc-lang');
                $status  = true;
            } else {
                $message = __('Appointment booking failed.', 'kc-lang');
                $status  = false;
            }

            $doctorTelemedType = kcCheckDoctorTelemedType($patient_appointment_id);
            $notification = '';
            $telemed_service_include = false;
            $all_appointment_service_name = [];
            if (gettype($formData['visit_type']) === 'array') {
                $telemed_service_in_appointment_service = collect($formData['visit_type'])->map(function ($v) use ($formData, $clinic_id) {
                    $temp_service_id = (int)$v['service_id'];
                    return $this->db->get_var("SELECT telemed_service FROM {$this->db->prefix}kc_service_doctor_mapping WHERE service_id = {$temp_service_id} AND clinic_id={$clinic_id} AND doctor_id=" . (int)$formData['doctor_id']['id']);
                })->toArray();
                foreach ($formData['visit_type'] as $key => $value) {
                    $service = strtolower($value['name']);
                    $all_appointment_service_name[] = $service;
                    if ($value['telemed_service'] === 'yes') {
                        if ($telemedZoomPluginActive || $telemedGooglemeetPluginActive) {
                            $formData['appointment_id'] = $patient_appointment_id;
                            $formData['time_slot'] = $time_slot;

                            if ($formData['payment_mode'] !== 'paymentWoocommerce') {
                                if ($doctorTelemedType == 'googlemeet') {
                                    $telemed_res_data = apply_filters('kcgm_save_appointment_event', ['appoinment_id' => $patient_appointment_id, 'service' => kcServiceListFromRequestData($formData)]);
                                } else {
                                    $telemed_res_data = apply_filters('kct_create_appointment_meeting', $formData);
                                }
                                if (empty($telemed_res_data['status'])) {
                                    (new KCAppointmentServiceMapping())->delete(['appointment_id' =>  (int)$patient_appointment_id]);
                                    (new KCAppointment())->delete(['id' =>  (int)$patient_appointment_id]);
                                    do_action('kc_appointment_cancel', $patient_appointment_id);
                                    wp_send_json([
                                        'status'  => false,
                                        'message' => __('Failed to generate Video Meeting.', 'kc-lang'),
                                    ]);
                                }
                                $telemed_service_include = true;
                            }
                        }
                    }

                    if ($patient_appointment_id) {
                        (new KCAppointmentServiceMapping())->insert([
                            'appointment_id' => (int)$patient_appointment_id,
                            'service_id' => (int)$value['service_id'],
                            'created_at' => current_time('Y-m-d H:i:s'),
                            'status' => 1
                        ]);
                    }
                }
            }

            if (in_array((string)$formData['status'], ['2', '4'])) {
                KCPatientEncounter::createEncounter($patient_appointment_id);
                KCBillItem::createAppointmentBillItem($patient_appointment_id);
            }

            if (!empty($patient_appointment_id) && $patient_appointment_id !== 0) {
                do_action('kc_appointment_book', $patient_appointment_id);
            }
            $formData['calender_content'] = '';
            if ($proPluginActive && $formData['status'] == '1') {

                $clinic_data = $this->db->get_row("SELECT name, CONCAT(address, ', ',city,', '
		           ,postal_code,', ',country) AS clinic_full_address FROM {$this->db->prefix}kc_clinics WHERE id={$clinic_id}");

                $appointment_data = [
                    "clinic_name" => !empty($clinic_data->name) ? $clinic_data->name : '',
                    "clinic_address" =>  !empty($clinic_data->clinic_full_address) ? $clinic_data->clinic_full_address : '',
                    "id" => $patient_appointment_id,
                    "start_date" => $appointment_date,
                    "start_time" => $appointment_start_time,
                    "end_date" => $appointment_date,
                    "end_time" => $appointment_end_time,
                    "appointment_service" => implode(",", $all_appointment_service_name),
                    "extra" => $formData
                ];

                $formData['calender_content'] = kcAddToCalendarContent($appointment_data);
            }

            delete_transient('appointment_data_user');

            switch ($formData['payment_mode']) {
                case 'paymentWoocommerce':
                    $woocommerce_response  = kcWoocommerceRedirect($patient_appointment_id, $formData);
                    if (isset($woocommerce_response['status']) && $woocommerce_response['status']) {
                        if (!empty($woocommerce_response['woocommerce_cart_data'])) {
                            wp_send_json($woocommerce_response);
                        }
                    }
                    break;
                case 'paymentPaypal':
                    $this->db->update($this->db->prefix . "kc_appointments", ['status' => 0], ['id' => $patient_appointment_id]);
                    $paypal_response = (new KCPaymentController())->makePaypalPayment($formData, $patient_appointment_id);
                    if (empty($paypal_response['status'])) {
                        (new KCAppointment())->loopAndDelete(['id' => $patient_appointment_id], true);
                    }
                    $paypal_response['appointment_id'] = $patient_appointment_id;
                    $paypal_response['data'] = $formData;
                    wp_send_json($paypal_response);
                    break;
                case 'paymentStripepay':
                    $this->db->update($this->db->prefix . "kc_appointments", ['status' => 0], ['id' => $patient_appointment_id]);
                    $stripepay_response = apply_filters('kivicare_create_stripepay_order', [], $formData, $patient_appointment_id);
                    if (empty($stripepay_response['status'])) {
                        (new KCAppointment())->loopAndDelete(['id' => $patient_appointment_id], true);
                    }
                    $stripepay_response['appointment_id'] = $patient_appointment_id;
                    $stripepay_response['data'] = $formData;
                    wp_send_json($stripepay_response);
                    break;
                case 'paymentRazorpay':
                    $this->db->update($this->db->prefix . "kc_appointments", ['status' => 0], ['id' => $patient_appointment_id]);
                    $formData['appointment_id'] = $patient_appointment_id;
                    $formData['page'] = 'dashboard';
                    $razorpay_response = apply_filters('kivicare_create_razorpay_order', $formData);
                    if (is_array($razorpay_response) && array_key_exists('checkout_detail', $razorpay_response) && !empty($razorpay_response['status'])) {
                        $razorpay_response['appointment_id'] = $patient_appointment_id;
                        $razorpay_response['data'] = $formData;
                        wp_send_json($razorpay_response);
                    } else {
                        (new KCAppointment())->loopAndDelete(['id' => $patient_appointment_id], true);
                        wp_send_json([
                            'status' => false,
                            'message' => esc_html__('Failed to create razorpay payment link', 'kc-lang'),
                            'error_message' => is_array($razorpay_response) && !empty($razorpay_response['message']) ? $razorpay_response['message'] : ''
                        ]);
                    }
                    break;
                case 'paymentOffline':
                    $service_name = kcServiceListFromRequestData($formData);
                    if ($proPluginActive || $telemedZoomPluginActive || $telemedGooglemeetPluginActive) {
                        $notification = kcProAllNotification($patient_appointment_id, $service_name, $telemed_service_include);
                    } else {
                        $notification = kivicareCommonSendEmailIfOnlyLitePluginActive($patient_appointment_id, $service_name);
                    }
                    break;
            }

            wp_send_json([
                'status'      => $status,
                'message'     => $message,
                'data'           => $formData,
                'notification' => $notification,
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
}

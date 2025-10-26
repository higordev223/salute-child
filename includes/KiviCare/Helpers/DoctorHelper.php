<?php

namespace SaluteChild\KiviCare\Helpers;

defined('ABSPATH') || exit;

class DoctorHelper
{

  public static function getAvailableDoctors($language, $service_id)
  {

    global $wpdb;

    if (!is_array($service_id)) {
      $service_id = [$service_id];
    }

    $results = $wpdb->get_results("
        SELECT module_id, fields_data
        FROM {$wpdb->prefix}kc_custom_fields_data
        WHERE module_type = 'doctor_module' AND field_id = 1
    ");

    $normalized_lang = strtolower(trim($language));
    $doctor_ids = [];

    foreach ($results as $row) {
      $langs = json_decode($row->fields_data, true);
      if (!is_array($langs)) continue;

      foreach ($langs as $lang) {
        if (strtolower(trim($lang)) === $normalized_lang) {
          $doctor_ids[] = (int) $row->module_id;
          break;
        }
      }
    }

    if (empty($doctor_ids)) {
      return [];
    }

    $placeholders = implode(',', array_fill(0, count($doctor_ids), '%d'));
    $service_placeholders = implode(',', array_fill(0, count($service_id), '%d'));
    $query = "
        SELECT doctor_id 
        FROM {$wpdb->prefix}kc_service_doctor_mapping
        WHERE service_id IN ($service_placeholders)
          AND doctor_id IN ($placeholders)
    ";
    $prepared = $wpdb->prepare($query, array_merge($service_id, $doctor_ids));
    $doctor_ids = $wpdb->get_col($prepared);

    if (empty($doctor_ids)) {
      return [];
    }

    return $doctor_ids;
  }

  public static function checkDoctorAvailability($doctor_id, $date, $time)
  {
    global $wpdb;

    $day_of_week = strtolower(date('w', strtotime($date)));
    $days = [0 => 'sun', 1 => 'mon', 2 => 'tue', 3 => 'wed', 4 => 'thu', 5 => 'fri', 6 => 'sat'];

    $sessions = $wpdb->get_results($wpdb->prepare("
        SELECT start_time, end_time 
        FROM {$wpdb->prefix}kc_clinic_sessions 
        WHERE doctor_id = %d AND LOWER(day) = %s
    ", $doctor_id, $days[$day_of_week]));

    if (empty($sessions)) {
      return false;
    }

    $in_session = false;
    foreach ($sessions as $session) {
      $start = strtotime($session->start_time);
      $end = strtotime($session->end_time);
      $appt = strtotime($time);

      if ($appt >= $start && $appt < $end) {
        $in_session = true;
        break;
      }
    }

    if (!$in_session) {
      return false;
    }

    $existing_appointment = $wpdb->get_var($wpdb->prepare("
        SELECT COUNT(*) 
        FROM {$wpdb->prefix}kc_appointments 
        WHERE doctor_id = %d AND appointment_date = %s AND appointment_time = %s AND status != 'cancelled'
    ", $doctor_id, $date, $time));

    return $existing_appointment == 0;
  }
}

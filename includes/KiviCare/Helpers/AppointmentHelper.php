<?php

namespace SaluteChild\KiviCare\Helpers;

defined('ABSPATH') || exit;

class AppointmentHelper
{
    public static function getAllPreferredLanguages()
    {
        global $wpdb;

        $results = $wpdb->get_results("
            SELECT module_id, module_type, fields, status
            FROM {$wpdb->prefix}kc_custom_fields
            WHERE module_type = 'doctor_module' AND status = 1 AND fields LIKE '%Idiomas%'
        ");

        if (empty($results)) {
            return false;
        }

        $languages = [];

        if (!empty($results)) {
            foreach ($results as $row) {
                $fields = json_decode($row->fields, true);

                if (
                    isset($fields['name']) &&
                    stripos($fields['name'], 'Idiomas') !== false &&
                    isset($fields['options']) &&
                    is_array($fields['options'])
                ) {
                    foreach ($fields['options'] as $option) {
                        $languages[] = [
                            'id'   => $option['id'],
                            'label' => $option['text'],
                        ];
                    }
                }
            }
        }

        return $languages;
    }

    public static function getPreferredLanguagesByDoctor($doctor_id)
    {
        global $wpdb;

        $query_fields = "
            SELECT id 
            FROM {$wpdb->prefix}kc_custom_fields
            WHERE module_type = 'doctor_module' AND status = 1 AND fields LIKE '%Idiomas%'
            LIMIT 1
        ";

        $field_id = $wpdb->get_var($query_fields);

        $query_languages = "
            SELECT fields_data 
            FROM {$wpdb->prefix}kc_custom_fields_data
            WHERE module_type = 'doctor_module'
                AND module_id = $doctor_id
                AND field_id = $field_id
        ";
        $available_languages = $wpdb->get_col($query_languages);

        if (empty($available_languages)) {
            return false;
        }

        $languages = [];

        foreach ($available_languages as $language) {
            $decoded_lang = json_decode($language, true);
            if (is_array($decoded_lang)) {
                $languages = array_merge($languages, $decoded_lang);
            }
        }

        $unique_languages = array_values(array_unique($languages));

        $service_languages = array_map(function ($lang) {
            return [
                'id' => $lang,
                'label' => $lang
            ];
        }, $unique_languages);


        return $service_languages;
    }

    public static function getPreferredLanguagesByService($clinic_id, $service_id)
    {
        global $wpdb;

        $service_doctors = "
            SELECT doctor_id 
            FROM {$wpdb->prefix}kc_service_doctor_mapping
            WHERE service_id = $service_id
                AND clinic_id = $clinic_id
        ";

        $prepared_doctors = $wpdb->prepare($service_doctors);
        $doctor_ids = $wpdb->get_col($prepared_doctors);

        $doctor_placeholder = implode(',', array_map('intval', $doctor_ids));

        $query_fields = "
            SELECT id 
            FROM {$wpdb->prefix}kc_custom_fields
            WHERE module_type = 'doctor_module' AND status = 1 AND fields LIKE '%Idiomas%'
            LIMIT 1
        ";

        $field_id = $wpdb->get_var($query_fields);

        $query_languages = "
            SELECT fields_data 
            FROM {$wpdb->prefix}kc_custom_fields_data
            WHERE module_type = 'doctor_module'
                AND module_id IN ($doctor_placeholder)
                AND field_id = $field_id
        ";
        $available_languages = $wpdb->get_col($query_languages);

        if (empty($available_languages)) {
            return false;
        }

        $languages = [];

        foreach ($available_languages as $language) {
            $decoded_lang = json_decode($language, true);
            if (is_array($decoded_lang)) {
                $languages = array_merge($languages, $decoded_lang);
            }
        }

        $unique_languages = array_values(array_unique($languages));

        $service_languages = array_map(function ($lang) {
            return [
                'id' => $lang,
                'label' => $lang
            ];
        }, $unique_languages);


        return $service_languages;
    }

    public static function kcRecursiveSanitizeTextField($array, $allow_key_sanitize = ['email'])
    {
        $filterParameters = [];

        foreach ($array as $key => $value) {

            if ($value === '') {
                $filterParameters[$key] = null;
            } elseif (is_array($value)) {
                $filterParameters[$key] = kcRecursiveSanitizeTextField($value, $allow_key_sanitize);
            } elseif (is_object($value)) {
                $filterParameters[$key] = $value;
            } elseif (is_string($value)) {

                if (preg_match("/<[^<]+>/", $value) !== 0) {
                    $filterParameters[$key] = kcSanitizeHTML($value);
                } elseif (in_array('email', $allow_key_sanitize) && strpos(strtolower($key), 'email') !== false) {
                    $filterParameters[$key] = kcSanitizeHTML(sanitize_email($value));
                } elseif (strpos(strtolower($key), '_ajax_nonce') !== false) {
                    $filterParameters[$key] = kcSanitizeHTML(sanitize_key($value));
                } else {
                    $filterParameters[$key] = kcSanitizeHTML(sanitize_text_field(stripslashes($value)));
                }
            } else {
                // fallback: enteros, bool, null, etc. se devuelven tal cual
                $filterParameters[$key] = $value;
            }
        }

        return $filterParameters;
    }
}

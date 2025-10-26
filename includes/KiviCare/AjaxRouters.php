<?php

namespace SaluteChild\KiviCare;

defined('ABSPATH') || exit;

use App\baseClasses\KCRequest;
use SaluteChild\KiviCare\Controllers\KCCustomAppointmentController;
use SaluteChild\KiviCare\Controllers\KCCustomDoctorController;
use SaluteChild\KiviCare\Controllers\KCCustomBookAppointmentWidgetController;
use SaluteChild\KiviCare\Controllers\KCCustomServiceController;
use SaluteChild\KiviCare\Controllers\KCCustomTaxController;

class AjaxRouters
{

  public $db;

  private $request;

  public function __construct()
  {

    global $wpdb;

    $this->db = $wpdb;

    $this->request = new KCRequest();
  }

  public function register()
  {
    add_action('wp_ajax_nopriv_ajax_get', [$this, 'handleGetRoutes'], 0);
    add_action('wp_ajax_ajax_get', [$this, 'handleGetRoutes'], 0);
    add_action('wp_ajax_ajax_post', [$this, 'handlePostRoutes'], 0);
    add_action('wp_ajax_nopriv_ajax_post', [$this, 'handlePostRoutes'], 0);
  }

  public function handleGetRoutes()
  {
    $formData = $this->request->getInputs();
    if (empty($formData['route_name'])) return;
    switch ($formData['route_name']) {
      case 'get_preferred_languages':
        $AppointmentController = new KCCustomAppointmentController;
        $AppointmentController->getPreferredLanguages();
        break;
      case 'service_list':
        $servicesController = new KCCustomServiceController;
        $servicesController->index();
        break;
      case 'get_appointment_slots':
        $AppointmentController = new KCCustomAppointmentController;
        $AppointmentController->getAppointmentSlots();
        break;
      case 'appointment_details':
        $AppointmentController = new KCCustomAppointmentController;
        $AppointmentController->getAppointmentDetails();
        break;
      case 'get_doctor_workdays':
        $doctorController = new KCCustomDoctorController;
        $doctorController->getDoctorWorkdays();
        break;
      case 'get_time_slots':
        $BookAppointmentWidgetController = new KCCustomBookAppointmentWidgetController;
        $BookAppointmentWidgetController->getTimeSlots();
        break;
      default:
        return;
    }
    exit;
  }

  public function handlePostRoutes()
  {
    $formData = $this->request->getInputs();
    if (empty($formData['route_name'])) return;
    switch ($formData['route_name']) {
      case 'tax_calculated_data':
        $TaxController = new KCCustomTaxController;
        $TaxController->getTaxData();
        break;
      case 'appointment_confirm_page':
        $BookAppointmentWidgetController = new KCCustomBookAppointmentWidgetController;
        $BookAppointmentWidgetController->appointmentConfirmPage();
        break;
      case 'save_appointment':
        $BookAppointmentWidgetController = new KCCustomBookAppointmentWidgetController;
        $BookAppointmentWidgetController->saveAppointment();
        break;
      case 'appointment_save':
        $AppointmentController = new KCCustomAppointmentController;
        $AppointmentController->save();
        break;
      default:
        return;
    }
    exit;
  }
}

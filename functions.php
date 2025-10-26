<?php
defined('ABSPATH') || exit;

/**
 * --- KiviCare boot (solo una vez) ---
 * Conserva estas líneas si tu tema las necesita; de lo contrario, elimínalas.
 */
require_once get_stylesheet_directory() . '/includes/KiviCare/Autoloader.php';
SaluteChild\KiviCare\Autoloader::register();
use SaluteChild\KiviCare\AjaxRouters;
(new AjaxRouters())->register();

/**
 * Redirección para panel profesional
 */
function redireccionar_panel_profesional() {
    if (is_page('panel-profesional')) {
        if (is_user_logged_in()) {
            $usuario = wp_get_current_user();
            if (in_array('doctor', (array) $usuario->roles, true)) {
                wp_redirect(admin_url('admin.php?page=dashboard'));
                exit;
            }
            wp_redirect(home_url());
            exit;
        }
        wp_redirect(home_url('/iniciar-sesion/'));
        exit;
    }
}
add_action('template_redirect', 'redireccionar_panel_profesional');

/**
 * ===============================
 *  Alta profesional (admin-post)
 * ===============================
 * No definas aquí MC_RECAPTCHA_SITE_KEY ni MC_RECAPTCHA_SECRET_V3.
 */
add_action('admin_post_nopriv_mc_prof_form_submit', 'mc_prof_form_handle');
add_action('admin_post_mc_prof_form_submit',        'mc_prof_form_handle');

if (!function_exists('mc_prof_form_handle')) {
function mc_prof_form_handle() {

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        wp_die('Método no permitido', 'Error', array('response' => 405));
    }

    // Helper para leer POST saneado
    $f = static function($key, $default = '') {
        return isset($_POST[$key]) ? trim(wp_unslash($_POST[$key])) : $default;
    };

    // URL de redirección (por si el front la envía)
    $redirect_url = esc_url_raw( $f('redirect', home_url('/gracias-solicitud/')) );

    /* ----------- reCAPTCHA v3 (clásica) ----------- */
    if (!defined('MC_RECAPTCHA_SECRET_V3') || !MC_RECAPTCHA_SECRET_V3) {
        error_log('MC: Falta MC_RECAPTCHA_SECRET_V3 en wp-config.php');
        mc_prof_redirect($redirect_url, 'err=captcha');
    }

    $token = $f('recaptcha_token');
    if (empty($token)) {
        error_log('MC: token reCAPTCHA vacío');
        mc_prof_redirect($redirect_url, 'err=captcha');
    }

    $resp = wp_remote_post(
        'https://www.google.com/recaptcha/api/siteverify',
        array(
            'timeout' => 12,
            'body'    => array(
                'secret'   => MC_RECAPTCHA_SECRET_V3,
                'response' => $token,
                'remoteip' => $_SERVER['REMOTE_ADDR'] ?? '',
            ),
        )
    );

    if (is_wp_error($resp)) {
        error_log('MC: reCAPTCHA HTTP error: ' . $resp->get_error_message());
        mc_prof_redirect($redirect_url, 'err=captcha');
    }

    $data = json_decode(wp_remote_retrieve_body($resp), true);
    error_log('MC: reCAPTCHA response: ' . wp_json_encode($data));

    $ok       = !empty($data['success']);
    $score    = isset($data['score']) ? (float)$data['score'] : 0.0;
    $action   = $data['action'] ?? '';
    $hostname = $data['hostname'] ?? '';

    // Permitir 'mc_prof_form' o 'submit' por si el front usa uno u otro
    $actionOk = ($action === '' || in_array($action, array('mc_prof_form','submit'), true));

    // Hostname del sitio (acepta www / sin www)
    $site_host = parse_url(home_url(), PHP_URL_HOST);
    $hostOk    = ($hostname === '' || stripos($hostname, $site_host) !== false);

    // Umbral bajo para pruebas; en producción súbelo a 0.5
    if (!$ok || !$hostOk || !$actionOk || $score < 0.3) {
        mc_prof_redirect($redirect_url, 'err=captcha');
    }
    /* ----------- FIN reCAPTCHA ----------- */

    // === Datos del formulario ===
    $nombre         = sanitize_text_field( $f('nombre') );
    $apellidos      = sanitize_text_field( $f('apellidos') );
    $email          = sanitize_email( $f('email') );
    $telefono       = preg_replace('/\D+/', '', $f('telefono') );
    $perfil         = sanitize_text_field( $f('perfil') );
    $especialidad   = sanitize_text_field( $f('especialidad') );
    $dni            = strtoupper( sanitize_text_field( $f('dni') ) );
    $ciudad         = sanitize_text_field( $f('ciudad') );
    $idiomas        = ( isset($_POST['idiomas']) && is_array($_POST['idiomas']) )
                        ? array_map('sanitize_text_field', $_POST['idiomas']) : array();
    $disponibilidad = sanitize_textarea_field( $f('disponibilidad') );
    $experiencia    = sanitize_textarea_field( $f('experiencia') );
    $mensaje        = sanitize_textarea_field( $f('mensaje') );
    $colegiado      = sanitize_text_field( $f('numeroColegiado') );

    // === Validaciones mínimas ===
    if (
        !$nombre || !$apellidos || !is_email($email) || !$perfil || !$especialidad ||
        !$dni || !$ciudad || !$disponibilidad || !$experiencia
    ) {
        mc_prof_redirect($redirect_url, 'err=required');
    }

    // Si es Médico/Psicólogo, exigir nº colegiado y adjuntos
    $require_docs = in_array( $perfil, array('Médico/a','Psicólogo/a'), true );
    if ($require_docs && !$colegiado) {
        mc_prof_redirect($redirect_url, 'err=colegiado');
    }

    // === Adjuntos (PDF/JPG/PNG, máx. 10 MB c/u) ===
    $attachments = array();
    if (!empty($_FILES['adjuntos']) && is_array($_FILES['adjuntos']['name'])) {
        $allowed = array('pdf','jpg','jpeg','png');
        $count   = count($_FILES['adjuntos']['name']);
        for ($i = 0; $i < $count; $i++) {
            if ((int) $_FILES['adjuntos']['error'][$i] !== UPLOAD_ERR_OK) {
                continue;
            }

            $tmp  = $_FILES['adjuntos']['tmp_name'][$i];
            $name = $_FILES['adjuntos']['name'][$i];
            $size = (int) $_FILES['adjuntos']['size'][$i];

            if ($size > 10 * 1024 * 1024) {
                mc_prof_redirect($redirect_url, 'err=file_too_big');
            }

            $ft  = wp_check_filetype_and_ext($tmp, $name);
            $ext = strtolower( $ft['ext'] ? $ft['ext'] : pathinfo($name, PATHINFO_EXTENSION) );
            if (!in_array($ext, $allowed, true)) {
                mc_prof_redirect($redirect_url, 'err=file_type');
            }

            $dest = wp_tempnam($name);
            if ($dest && @copy($tmp, $dest)) {
                $attachments[] = $dest;
            }
        }
    }
    if ($require_docs && empty($attachments)) {
        mc_prof_redirect($redirect_url, 'err=files_required');
    }

    // === Email ===
    $to      = 'contacto@medicocontigo.com';
    $subject = sprintf('Nueva solicitud profesional – %s – %s %s', $perfil, $nombre, $apellidos);

    $idiomas_txt   = $idiomas ? implode(', ', $idiomas) : '—';
    $colegiado_txt = $colegiado ? esc_html($colegiado) : '—';
    $mensaje_html  = nl2br( esc_html($mensaje) );
    $exp_html      = nl2br( esc_html($experiencia) );
    $disp_html     = nl2br( esc_html($disponibilidad) );

    $body = '
    <h2>Nueva solicitud profesional</h2>
    <p><strong>Nombre:</strong> '.esc_html("$nombre $apellidos").'</p>
    <p><strong>Email:</strong> '.esc_html($email).' | <strong>Tel:</strong> '.esc_html($telefono).'</p>
    <p><strong>Perfil:</strong> '.esc_html($perfil).' | <strong>Especialidad:</strong> '.esc_html($especialidad).'</p>
    <p><strong>Nº colegiado:</strong> '.$colegiado_txt.' | <strong>DNI/NIE:</strong> '.esc_html($dni).'</p>
    <p><strong>Ciudad/Provincia:</strong> '.esc_html($ciudad).'</p>
    <p><strong>Idiomas:</strong> '.esc_html($idiomas_txt).'</p>
    <p><strong>Disponibilidad:</strong><br>'.$disp_html.'</p>
    <p><strong>Experiencia:</strong><br>'.$exp_html.'</p>
    <p><strong>Mensaje adicional:</strong><br>'.$mensaje_html.'</p>
    ';

    // From del dominio y Reply-To del solicitante
    $headers = array(
        'Content-Type: text/html; charset=UTF-8',
        'From: Medico Contigo <no-reply@medicocontigo.com>',
        'Reply-To: "'.esc_html("$nombre $apellidos").'" <'.$email.'>',
    );

    $ok = wp_mail($to, $subject, $body, $headers, $attachments);

    // Limpiar temporales
    foreach ($attachments as $path) { @unlink($path); }

    if ($ok) {
        mc_prof_redirect($redirect_url, 'ok=1');
    } else {
        error_log('MC: fallo wp_mail (no se pudo enviar el correo)');
        mc_prof_redirect($redirect_url, 'err=mail');
    }
}}
/**
 * Redirección segura con querystring
 */
if (!function_exists('mc_prof_redirect')) {
function mc_prof_redirect($url, $qs) {
    $url = $url ? $url : home_url('/');
    $sep = (strpos($url, '?') !== false) ? '&' : '?';
    wp_safe_redirect($url . $sep . $qs);
    exit;
}}
/**
 * Log detallado si wp_mail falla (diagnóstico)
 */
add_action('wp_mail_failed', function($wp_error){
    if (is_wp_error($wp_error)) {
        error_log('MC: wp_mail_failed -> ' . $wp_error->get_error_message() . ' | data: ' . wp_json_encode($wp_error->get_error_data()));
    }
});

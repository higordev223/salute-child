<?php
/**
 * Medico Contigo - Custom Language Selection Tab
 * Integrates language selection as a proper tab in KiviCare booking widget
 */

// Ensure KIVI_CARE_PREFIX is defined
if (!defined('KIVI_CARE_PREFIX')) {
    define('KIVI_CARE_PREFIX', 'kiviCare_');
}

/**
 * Auto-copy language tab files to plugin directory
 * This ensures the files exist even after plugin updates
 */
add_action('init', 'mc_ensure_language_tab_files_exist', 5);

function mc_ensure_language_tab_files_exist() {
    // Plugin directory where KiviCare expects the files
    $plugin_language_dir = WP_PLUGIN_DIR . '/kivicare-clinic-management-system/app/baseClasses/bookAppointment/components/language';
    
    // Child theme directory where we maintain the source files
    $theme_language_dir = get_stylesheet_directory() . '/includes/kivicare-customizations/language';
    
    // Check if plugin directory exists, if not create it
    if (!file_exists($plugin_language_dir)) {
        wp_mkdir_p($plugin_language_dir);
    }
    
    // Files to copy
    $files_to_copy = array('tab.php', 'tab-panel.php');
    
    foreach ($files_to_copy as $file) {
        $source = $theme_language_dir . '/' . $file;
        $destination = $plugin_language_dir . '/' . $file;
        
        // Copy if source exists and (destination doesn't exist OR source is newer)
        if (file_exists($source)) {
            $should_copy = false;
            
            if (!file_exists($destination)) {
                $should_copy = true;
                error_log('Medico Contigo: Language tab file missing, copying: ' . $file);
            } elseif (filemtime($source) > filemtime($destination)) {
                $should_copy = true;
                error_log('Medico Contigo: Language tab file outdated, updating: ' . $file);
            }
            
            if ($should_copy) {
                copy($source, $destination);
                error_log('Medico Contigo: Copied ' . $file . ' to plugin directory');
            }
        }
    }
}

/**
 * Add language tab to widget order list (Step 2 in booking flow)
 */
add_filter('option_' . KIVI_CARE_PREFIX . 'widget_order_list', 'mc_add_language_tab_to_widget_order', 998);
add_filter('default_option_' . KIVI_CARE_PREFIX . 'widget_order_list', 'mc_add_language_tab_to_widget_order', 998);

function mc_add_language_tab_to_widget_order($widget_order) {
    if (!is_array($widget_order) || empty($widget_order)) {
        return $widget_order;
    }
    
    // Check if language tab already exists
    foreach ($widget_order as $tab) {
        if (isset($tab['att_name']) && $tab['att_name'] === 'language') {
            return $widget_order; // Already added
        }
    }
    
    // Find position after category (service selection)
    $position = 1; // Default: after first tab
    
    foreach ($widget_order as $key => $tab) {
        if (isset($tab['att_name']) && $tab['att_name'] === 'category') {
            $position = $key + 1;
            break;
        }
    }
    
    // Create language tab configuration
    $language_tab = array(
        'att_name' => 'language',
        'title' => __('Select Language', 'kc-lang'),
        'name' => 'Language',
        'status' => true
    );
    
    // Insert language tab at correct position (Step 2)
    array_splice($widget_order, $position, 0, array($language_tab));
    
    return array_values($widget_order);
}

/**
 * Render language tab button (sidebar)
 */
add_action('kivicare_widget_tab_language', 'mc_render_language_tab');

function mc_render_language_tab() {
    $template_path = get_stylesheet_directory() . '/includes/kivicare-customizations/language/tab.php';
    
    if (file_exists($template_path)) {
        include $template_path;
    } else {
        // Fallback inline HTML
        ?>
        <a class="tab-link" href="#language" data-iq-toggle="tab" data-iq-tab="prevent" id="language-tab">
            <span class="sidebar-heading-text"><?php echo esc_html__("Select Language", "kc-lang"); ?></span>
            <p><?php echo esc_html__("Choose your preferred language", "kc-lang"); ?></p>
        </a>
        <?php
    }
}

/**
 * Render language tab panel (main content area)
 */
add_action('kivicare_widget_tab_panel_language', 'mc_render_language_tab_panel');

function mc_render_language_tab_panel() {
    $template_path = get_stylesheet_directory() . '/includes/kivicare-customizations/language/tab-panel.php';
    
    if (file_exists($template_path)) {
        include $template_path;
    } else {
        // Fallback inline HTML
        ?>
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-1">
            <div class="iq-kivi-tab-panel-title-animation">
                <h3 class="iq-kivi-tab-panel-title"><?php echo esc_html__("Select Your Preferred Language", "kc-lang"); ?></h3>
            </div>
        </div>
        <hr>
        <div class="widget-content" id="mc-language-widget-content">
            <div id="mc-language-loader" style="text-align: center; padding: 40px;">
                <div class="double-lines-spinner"></div>
                <p style="margin-top: 15px;"><?php echo esc_html__("Loading languages...", "kc-lang"); ?></p>
            </div>
            <div class="card-list-data flex-wrap gap-3 pe-2" id="mc-language-cards" style="display: none;"></div>
            <input type="hidden" id="mc-selected-language" name="appointment_language" value="">
        </div>
        <?php
    }
}

/**
 * Hook into KiviCare's template loading system
 * This ensures our templates are used when the language tab is rendered
 */
add_filter('kivicare_bookappointment_component_path', 'mc_override_language_component_path', 10, 2);

function mc_override_language_component_path($path, $component) {
    if ($component === 'language') {
        $child_theme_path = get_stylesheet_directory() . '/includes/kivicare-customizations/language/';
        
        if (file_exists($child_theme_path)) {
            return $child_theme_path;
        }
    }
    
    return $path;
}

/**
 * Enqueue JavaScript for language tab functionality
 */
add_action('wp_footer', 'mc_enqueue_language_tab_script', 999);

function mc_enqueue_language_tab_script() {
    // Only enqueue on pages with the booking widget
    if (!is_admin() && (has_shortcode(get_post()->post_content, 'kivicareBookAppointment') || is_page('reservar-cita'))) {
        ?>
        <script type="text/javascript">
        (function($) {
            console.log("Medico Contigo: Language tab script loaded");

            // Clear any previous session flags
            sessionStorage.setItem('mc_language_tab_clicked', 'false');

            // CRITICAL FIX: Remove active class from language panel on page load
            function initializeTabVisibility() {
                var $languagePanel = $('#language');
                var $categoryPanel = $('#category');

                // Skip if elements don't exist yet
                if ($languagePanel.length === 0 || $categoryPanel.length === 0) {
                    return false;
                }

                // Check if language panel incorrectly has active class
                if ($languagePanel.hasClass('active')) {
                    console.warn("Medico Contigo: Language panel has .active class on load - REMOVING IT");
                    $languagePanel.removeClass('active');
                }

                // Ensure category panel is the only active one on load
                if (!$categoryPanel.hasClass('active')) {
                    console.warn("Medico Contigo: Category panel missing .active class - ADDING IT");
                    $categoryPanel.addClass('active');
                }

                // Remove active from all other panels except category
                $('.iq-tab-pannel').not('#category').each(function() {
                    if ($(this).hasClass('active')) {
                        var panelId = $(this).attr('id');
                        console.log("Medico Contigo: Removing .active from panel: " + panelId);
                        $(this).removeClass('active');
                    }
                });

                console.log("Medico Contigo: Tab visibility initialized - only #category should be active");
                return true;
            }

            // Lightweight enforcement of tab panel visibility (CSS should handle most of it)
            function enforceTabVisibility() {
                // Remove any inline styles that might override CSS
                $('.iq-tab-pannel:not(.active)').each(function() {
                    var $panel = $(this);
                    // Remove inline display styles to let CSS take over
                    if ($panel.attr('style')) {
                        var currentStyle = $panel.attr('style');
                        // Only remove display/visibility related inline styles
                        var cleanedStyle = currentStyle
                            .replace(/display\s*:\s*[^;]+;?/gi, '')
                            .replace(/visibility\s*:\s*[^;]+;?/gi, '')
                            .replace(/opacity\s*:\s*[^;]+;?/gi, '')
                            .trim();

                        if (cleanedStyle) {
                            $panel.attr('style', cleanedStyle);
                        } else {
                            $panel.removeAttr('style');
                        }
                    }
                });

                // Log current state for debugging
                if (!$('#language').hasClass('active')) {
                    console.log("Medico Contigo: Language panel correctly hidden (no active class)");
                } else {
                    console.log("Medico Contigo: Language panel is ACTIVE and visible");
                }
            }

            // Run initialization immediately (before document.ready)
            var initAttempts = 0;
            var maxAttempts = 20;

            function tryInitialize() {
                initAttempts++;
                var success = initializeTabVisibility();

                if (!success && initAttempts < maxAttempts) {
                    // Elements don't exist yet, try again
                    setTimeout(tryInitialize, 50);
                }
            }

            // Start trying immediately
            tryInitialize();

            // Also run on document ready
            $(document).ready(function() {
                initializeTabVisibility();
                setTimeout(enforceTabVisibility, 100);

                // Keep enforcing for a few seconds
                setTimeout(initializeTabVisibility, 200);
                setTimeout(initializeTabVisibility, 500);
                setTimeout(initializeTabVisibility, 1000);
                setTimeout(initializeTabVisibility, 2000);
            });

            // Watch for DOM changes to remove conflicting inline styles AND incorrect active classes
            if (typeof MutationObserver !== 'undefined') {
                var styleObserver = new MutationObserver(function(mutations) {
                    mutations.forEach(function(mutation) {
                        var $target = $(mutation.target);

                        // Watch for style attribute changes
                        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                            if ($target.hasClass('iq-tab-pannel') && !$target.hasClass('active')) {
                                // Remove inline styles that make inactive panels visible
                                if ($target.css('display') !== 'none') {
                                    console.log("Medico Contigo: Removing conflicting inline style from inactive panel:", $target.attr('id'));
                                    $target.css('display', '');
                                }
                            }
                        }

                        // Watch for class attribute changes (when KiviCare adds .active)
                        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                            if ($target.attr('id') === 'language' && $target.hasClass('active')) {
                                console.log("Medico Contigo: 🔍 DETECTED .active added to #language");

                                // Small delay to allow click handler to set the flag
                                setTimeout(function() {
                                    var languageTabClicked = sessionStorage.getItem('mc_language_tab_clicked') === 'true';
                                    var allowedByProgram = sessionStorage.getItem('mc_language_tab_allowed_by_kivicare') === 'true';

                                    console.log("Medico Contigo: Flag check - clicked:", languageTabClicked, "allowed:", allowedByProgram);

                                    if (!languageTabClicked && !allowedByProgram) {
                                        console.warn("Medico Contigo: ❌ KiviCare incorrectly added .active to #language - REMOVING IT");
                                        $target.removeClass('active');
                                    } else {
                                        console.log("Medico Contigo: ✅ Language tab activation allowed (user click or service selection)");
                                    }
                                }, 10);
                            }
                        }
                    });
                });

                var widgetArea = document.getElementById('wizard-tab');
                if (widgetArea) {
                    styleObserver.observe(widgetArea, {
                        attributes: true,
                        attributeFilter: ['style', 'class'],
                        subtree: true
                    });
                }
            }

            // Track when user actually clicks language tab
            $(document).on('click', '#language-tab, a[href="#language"]', function(e) {
                console.log("Medico Contigo: Language tab clicked - allowing activation");

                // Set flag IMMEDIATELY before KiviCare processes the click
                sessionStorage.setItem('mc_language_tab_clicked', 'true');

                // Remove active from all other panels
                $('.iq-tab-pannel').not('#language').removeClass('active');

                // Add active to language panel
                setTimeout(function() {
                    if (!$('#language').hasClass('active')) {
                        $('#language').addClass('active');
                        console.log("Medico Contigo: Manually activated #language panel");
                    } else {
                        console.log("Medico Contigo: #language panel already active (KiviCare handled it)");
                    }
                }, 50);
            });

            // Clear the flags when navigating away from language tab
            $(document).on('click', '.tab-link:not([href="#language"])', function() {
                console.log("Medico Contigo: User clicked another tab - clearing language flags");
                sessionStorage.setItem('mc_language_tab_clicked', 'false');
                sessionStorage.setItem('mc_language_tab_allowed_by_kivicare', 'false');
            });

            // Load languages when language tab becomes active
            $(document).on('shown.bs.tab shown.iq.tab', '#language-tab, a[href="#language"]', function() {
                console.log("Medico Contigo: Language tab activated");

                // Check if MC_Booking object exists
                if (typeof MC_Booking !== 'undefined' && MC_Booking.selectedService) {
                    console.log("Medico Contigo: Loading languages for service:", MC_Booking.selectedService);

                    // Show loader
                    $('#mc-language-loader').show();
                    $('#mc-language-cards').hide();

                    // Load languages via existing AJAX handler
                    if (typeof MC_Booking.loadLanguagesForTab === 'function') {
                        MC_Booking.loadLanguagesForTab();
                    }
                } else {
                    console.warn("Medico Contigo: No service selected yet");
                }
            });

            // Also trigger on tab click
            $(document).on('click', '#language-tab', function() {
                console.log("Medico Contigo: Language tab clicked");
            });

        })(jQuery);
        </script>
        <?php
    }
}

<div class="d-flex justify-content-between align-items-center flex-wrap gap-1">
    <div class="iq-kivi-tab-panel-title-animation">
        <h3 class="iq-kivi-tab-panel-title"><?php echo esc_html__("Select Your Preferred Language", "kc-lang"); ?></h3>
    </div>
</div>
<hr>
<div class="widget-content" id="mc-language-widget-content">
    <!-- Loader -->
    <div id="mc-language-loader" style="text-align: center; padding: 40px;">
        <?php if (function_exists('isLoaderCustomUrl') && isLoaderCustomUrl()) { ?>
            <img src="<?php echo esc_url(kcAppointmentWidgetLoader()); ?>" alt="loader">
        <?php } else { ?>
            <div class="double-lines-spinner"></div>
        <?php } ?>
        <p style="margin-top: 15px; color: #666;">
            <?php echo esc_html__("Loading available languages...", "kc-lang"); ?>
        </p>
    </div>
    
    <!-- Language Cards Container -->
    <div class="card-list-data flex-wrap gap-3 justify-content-center" id="mc-language-cards" style="display: none; padding: 20px;">
        <!-- Language cards will be loaded via AJAX -->
    </div>
    
    <!-- Hidden input to store selected language -->
    <input type="hidden" id="mc-selected-language" name="appointment_language" value="">
    
    <!-- No languages message (hidden by default) -->
    <div id="mc-no-languages" class="loader-class" style="display: none; text-align: center; padding: 40px;">
        <p style="color: #666;">
            <?php echo esc_html__("No languages configured for the selected service.", "kc-lang"); ?>
        </p>
    </div>
</div>

<style>
/* Loading Spinner Centering - FIX: Allow JavaScript to control visibility */
#mc-language-loader,
#language_loader,
.loader-class {
    text-align: center !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
}

/* FIX: When hidden, stay hidden! */
#mc-language-loader[style*="display: none"],
#language_loader[style*="display: none"] {
    display: none !important;
}

/* Language Card Styles */
.mc-language-card {
    display: inline-flex !important;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 25px 20px !important;
    min-width: 150px;
    max-width: 180px;
    border: 2px solid #e0e0e0 !important;
    border-radius: 12px !important;
    cursor: pointer !important;
    transition: all 0.3s ease !important;
    background: #fff !important;
    text-align: center;
    margin: 10px;
}

.mc-language-card:hover {
    border-color: #007bff !important;
    box-shadow: 0 4px 12px rgba(0, 123, 255, 0.15) !important;
    transform: translateY(-2px) !important;
}

.mc-language-card.selected {
    border-color: #007bff !important;
    background: #e7f3ff !important;
    box-shadow: 0 4px 12px rgba(0, 123, 255, 0.25) !important;
}

.mc-language-card .language-icon {
    font-size: 40px;
    margin-bottom: 10px;
    line-height: 1;
}

.mc-language-card .language-name {
    font-size: 16px;
    font-weight: 600;
    color: #333;
    margin: 0;
}

.mc-language-card.selected .language-name {
    color: #007bff;
}

/* Ensure visibility when needed */
#mc-language-widget-content {
    min-height: 200px;
}

/* FIX: Only show language cards when they're not set to display:none */
.iq-tab-pannel.active #mc-language-cards:not([style*="display: none"]) {
    display: flex !important;
}

/* FIX: Don't force loader visible if JavaScript hides it */
.iq-tab-pannel.active #mc-language-loader:not([style*="display: none"]) {
    display: flex !important;
}
</style>

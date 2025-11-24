/**
 * Medico Contigo - Booking Form Customization (Tab-Based)
 * Works with proper language tab structure in KiviCare
 */

(function ($) {
  "use strict";

  var MC_Booking = {
    selectedLanguage: null,
    selectedService: null,
    selectedDoctor: null,
    initialized: false,

    // Debug helper
    logState: function(location) {
      console.log("========================================");
      console.log("🔍 MC_Booking State at: " + location);
      console.log("selectedService:", this.selectedService);
      console.log("selectedLanguage:", this.selectedLanguage);
      console.log("selectedDoctor:", this.selectedDoctor);
      console.log("MC_SELECTED_DOCTOR:", window.MC_SELECTED_DOCTOR);
      console.log("SessionStorage flags:");
      console.log("  - mc_language_tab_allowed_by_kivicare:", sessionStorage.getItem("mc_language_tab_allowed_by_kivicare"));
      console.log("  - mc_language_tab_clicked:", sessionStorage.getItem("mc_language_tab_clicked"));
      console.log("Active tab:", $(".iq-tab-pannel.active").attr("id"));
      console.log("========================================");
    },

    init: function () {
      if (this.initialized) return;
      this.initialized = true;

      console.log("🚀 MC_Booking initialized");
      this.logState("INIT");

      // ✅ CRITICAL FIX: Ensure bookAppointmentWidgetData exists and has proper structure
      if (typeof window.bookAppointmentWidgetData !== 'undefined') {
        // Force the flag to be boolean true (not string, not empty)
        if (!window.bookAppointmentWidgetData.preselected_single_doctor_id) {
          window.bookAppointmentWidgetData.preselected_single_doctor_id = false;
        }
      }

      // ✅ CRITICAL: Intercept ALL AJAX requests to inject doctor selection
      this.interceptAjaxRequests();

      // Listen for service selection
      this.listenForServiceSelection();

      // Listen for language tab activation
      this.listenForLanguageTabActivation();

      // Intercept navigation to ensure language is selected
      this.interceptTabNavigation();

      // Bind language card clicks
      this.bindLanguageCardClicks();

      // ✅ NUCLEAR OPTION: Add capture phase event listeners
      this.addCapturePhaseBlockers();

      // ✅ Convert submit buttons to regular buttons in language tab
      this.convertSubmitButtons();

      // ✅ Disable form action when on language tab
      this.disableFormActionOnLanguageTab();

      // ✅ Monitor date-time tab activation
      this.monitorDateTimeTab();

      // Back button handling removed - let KiviCare handle it naturally
    },

    /**
     * ✅ Monitor when date-time tab becomes active
     */
    monitorDateTimeTab: function () {
      var self = this;

      // Watch for date-time tab activation
      $(document).on(
        "click",
        'a[href="#date-time"], #date-time-tab',
        function () {
          setTimeout(function () {
            if (window.MC_SELECTED_DOCTOR) {

              // ✅ FIX: Ensure clinic_id is set (get from bookAppointmentWidgetData or default to 1)
              var clinicId = window.bookAppointmentWidgetData?.preselected_clinic_id ||
                             window.bookAppointmentWidgetData?.clinic_id ||
                             $("input[name='clinic_id']").val() ||
                             1;

              // Set all doctor fields (traditional inputs)
              $("input[name='doctor_id']").val(window.MC_SELECTED_DOCTOR);
              $("input[name='appointment_doctor_id']").val(
                window.MC_SELECTED_DOCTOR
              );
              $("#selected_doctor_id").val(window.MC_SELECTED_DOCTOR);
              $("#doctor_id").val(window.MC_SELECTED_DOCTOR);
              $("input[type='hidden'][name*='doctor']").val(
                window.MC_SELECTED_DOCTOR
              );

              // ✅ FIX: Also set clinic_id in form inputs
              $("input[name='clinic_id']").val(clinicId);
              $("#clinic_id").val(clinicId);

              // ✅ CRITICAL: Set in bookAppointmentWidgetData
              self.injectDoctorIntoBookingData(window.MC_SELECTED_DOCTOR);

              // ✅ CRITICAL: Trigger KiviCare to load date-time content
              self.triggerDateTimeLoad();

              // Trigger change event so KiviCare reacts
              $("input[name='doctor_id']").trigger("change");
              $("input[name='clinic_id']").trigger("change");

              // Check if clinic is set
              if (!clinicId || clinicId === "0") {
                clinicId = 1;
                $("input[name='clinic_id']").val(clinicId);
              }
            }
          }, 100);
        }
      );

      // Also watch for .active class being added to date-time panel
      var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          if (mutation.attributeName === "class") {
            var $target = $(mutation.target);
            var targetId = $target.attr("id");

            // Handle date-time panel becoming active
            if (targetId === "date-time" && $target.hasClass("active")) {
              if (window.MC_SELECTED_DOCTOR) {
                // ✅ FIX: Ensure clinic_id is set
                var clinicId = window.bookAppointmentWidgetData?.preselected_clinic_id ||
                               window.bookAppointmentWidgetData?.clinic_id ||
                               $("input[name='clinic_id']").val() ||
                               1;

                $(
                  "input[name='doctor_id'], input[name='appointment_doctor_id']"
                )
                  .val(window.MC_SELECTED_DOCTOR)
                  .trigger("change");

                // ✅ FIX: Also set clinic_id
                $("input[name='clinic_id']").val(clinicId).trigger("change");

                // ✅ CRITICAL: Inject into bookAppointmentWidgetData
                self.injectDoctorIntoBookingData(window.MC_SELECTED_DOCTOR);

                // ✅ CRITICAL: Trigger date-time content load
                setTimeout(function () {
                  self.triggerDateTimeLoad();
                }, 300);
              }

              // Mark that we're currently on date-time
              window.MC_LAST_ACTIVE_TAB = "date-time";
            }

            // ✅ CRITICAL: Intercept ANY tab becoming active and enforce language requirement
            if ($target.hasClass("iq-tab-pannel") && $target.hasClass("active")) {
              // Check if 'active' class was just added (wasn't in old value)
              var wasJustActivated = mutation.oldValue && mutation.oldValue.indexOf('active') === -1;

              // If a tab was just activated (wasn't active before)
              if (wasJustActivated && targetId !== 'category' && targetId !== 'language') {
                console.log("🔔 TAB ACTIVATED:", targetId);

                // ✅ FIX: When detail-info (login/register) tab activates, ensure register tab is shown
                if (targetId === 'detail-info' || targetId === 'kc_register') {
                  // Use retry logic to wait for KiviCare to fully initialize the login/register tabs
                  var attempts = 0;
                  var maxAttempts = 10;

                  function tryActivateRegisterTab() {
                    attempts++;
                    console.log("📝 Attempting to activate register tab (attempt " + attempts + "/" + maxAttempts + ")");

                    // Look for register tab link with multiple selectors
                    var $registerTabLink = $(
                      '#detail-info .kc-tab-link[href="#kc_register"], ' +
                      '#detail-info a[href="#kc_register"], ' +
                      '.kc-tab-link[href="#kc_register"], ' +
                      'a.kc-tab-link[data-target="#kc_register"], ' +
                      '[data-bs-target="#kc_register"], ' +
                      'button[data-bs-target="#kc_register"]'
                    );

                    if ($registerTabLink.length > 0) {
                      console.log("   ✅ Found register tab link, clicking it");

                      // Click the tab to trigger KiviCare's initialization
                      $registerTabLink.first().trigger('click');

                      // Also trigger Bootstrap tab events if they exist
                      if (typeof bootstrap !== 'undefined' && bootstrap.Tab) {
                        try {
                          var tab = new bootstrap.Tab($registerTabLink[0]);
                          tab.show();
                        } catch(e) {
                          console.log("   Bootstrap Tab not available:", e.message);
                        }
                      }

                      // Wait for reCAPTCHA to initialize
                      setTimeout(function() {
                        // Check if reCAPTCHA loaded
                        if (typeof grecaptcha !== 'undefined' && typeof grecaptcha.render === 'function') {
                          console.log("   🔐 reCAPTCHA available, checking if it needs initialization");

                          // Look for reCAPTCHA container
                          var $recaptchaContainer = $('#kc_register .g-recaptcha, #kc_register [data-sitekey]');
                          if ($recaptchaContainer.length > 0 && $recaptchaContainer.children().length === 0) {
                            console.log("   🔄 Initializing reCAPTCHA manually");
                            try {
                              var sitekey = $recaptchaContainer.attr('data-sitekey');
                              if (sitekey) {
                                grecaptcha.render($recaptchaContainer[0], {
                                  'sitekey': sitekey
                                });
                                console.log("   ✅ reCAPTCHA initialized successfully");
                              }
                            } catch(e) {
                              console.log("   ⚠️ reCAPTCHA initialization error:", e.message);
                            }
                          } else {
                            console.log("   ℹ️ reCAPTCHA already initialized or no container found");
                          }
                        } else {
                          console.log("   ⚠️ reCAPTCHA not loaded on page");
                        }
                      }, 500);

                    } else if (attempts < maxAttempts) {
                      // Tab not found yet, retry
                      console.log("   ⏳ Register tab not found yet, retrying in 200ms...");
                      setTimeout(tryActivateRegisterTab, 200);
                    } else {
                      // Max attempts reached, use fallback
                      console.log("   ⚠️ Max attempts reached, using fallback method");
                      $('#kc_register').addClass('active show').css('display', 'block');
                      $('#kc_login').removeClass('active show').css('display', 'none');

                      // Try to initialize reCAPTCHA even with fallback
                      setTimeout(function() {
                        if (typeof grecaptcha !== 'undefined') {
                          $('.g-recaptcha').each(function() {
                            if ($(this).children().length === 0) {
                              var sitekey = $(this).attr('data-sitekey');
                              if (sitekey) {
                                try {
                                  grecaptcha.render(this, {'sitekey': sitekey});
                                } catch(e) {}
                              }
                            }
                          });
                        }
                      }, 500);
                    }
                  }

                  // Start trying after a brief delay
                  setTimeout(tryActivateRegisterTab, 300);
                }

                // Check if language selection is required
                if (self.selectedService && !self.selectedLanguage) {
                  console.log("⚠️ BLOCKING AUTO-ADVANCE - Language not selected!");
                  console.log("   Current tab:", targetId);
                  console.log("   Redirecting to language tab...");

                  // Remove active from this tab
                  $target.removeClass("active");

                  // Activate language tab instead
                  setTimeout(function() {
                    $(".iq-tab-pannel").removeClass("active");
                    $("#language").addClass("active");

                    // Also activate the language tab link
                    $(".tab-link, .tab-item a").removeClass("active");
                    var $languageTabLink = $('a[href="#language"], #language-tab');
                    $languageTabLink.addClass("active");
                    $languageTabLink.closest(".tab-item, li").addClass("active");

                    console.log("✅ Redirected to language tab");
                  }, 10);

                  return;
                }
              }

              // Update tracking
              window.MC_LAST_ACTIVE_TAB = targetId;
            }
          }
        });
      });

      // Initialize tab tracking
      window.MC_LAST_ACTIVE_TAB = null;

      // Observe all tab panels
      $(".iq-tab-pannel").each(function () {
        observer.observe(this, {
          attributes: true,
          attributeFilter: ["class"],
          attributeOldValue: true, // Track previous class value
        });
      });

      // ✅ GENERAL: Update MC_LAST_ACTIVE_TAB whenever ANY tab becomes active
      $(document).on("click", ".tab-link, .tab-item a, a[href^='#']", function() {
        var href = $(this).attr("href");
        if (href && href.startsWith("#")) {
          var targetId = href.replace("#", "");

          // Wait a bit for the tab to actually activate
          setTimeout(function() {
            var $targetPanel = $("#" + targetId);
            if ($targetPanel.hasClass("iq-tab-pannel") && $targetPanel.hasClass("active")) {
              window.MC_LAST_ACTIVE_TAB = targetId;
            }
          }, 50);
        }
      });
    },

    /**
     * Back button handler REMOVED - Let KiviCare handle back navigation naturally
     * The aggressive interception was breaking KiviCare's show/hide logic for panels
     */

    /**
     * ✅ CRITICAL: Intercept ALL AJAX requests to inject MC_SELECTED_DOCTOR
     */
    interceptAjaxRequests: function () {
      var self = this;

      // Hook into jQuery's ajaxSend event (fires before every AJAX request)
      $(document).ajaxSend(function (event, jqxhr, settings) {
        // Check if this is an appointment-related request
        if (
          settings.url &&
          (settings.url.indexOf("book-appointment") !== -1 ||
            settings.url.indexOf("appointment/save") !== -1 ||
            settings.url.indexOf("wp-json") !== -1)
        ) {
          if (window.MC_SELECTED_DOCTOR) {
            // Inject into URL parameters
            if (settings.url.indexOf("?") !== -1) {
              settings.url +=
                "&MC_SELECTED_DOCTOR=" + window.MC_SELECTED_DOCTOR;
            } else {
              settings.url +=
                "?MC_SELECTED_DOCTOR=" + window.MC_SELECTED_DOCTOR;
            }

            // Inject into POST data
            if (settings.data) {
              if (typeof settings.data === "string") {
                settings.data +=
                  "&MC_SELECTED_DOCTOR=" + window.MC_SELECTED_DOCTOR;
              } else if (typeof settings.data === "object") {
                settings.data.MC_SELECTED_DOCTOR = window.MC_SELECTED_DOCTOR;
              }
            }
          }
        }
      });
    },

    /**
     * Listen for service selection in Step 1
     */
    listenForServiceSelection: function () {
      var self = this;

      // ✅ NEW: Watch for when user returns to service selection (category) tab
      // Use MutationObserver to detect when category panel becomes active (handles back button)
      if (typeof MutationObserver !== 'undefined') {
        var categoryObserver = new MutationObserver(function(mutations) {
          mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
              var $target = $(mutation.target);
              if ($target.attr('id') === 'category' && $target.hasClass('active')) {
                console.log("🔙 CATEGORY PANEL BECAME ACTIVE (via back button or click)");
                self.logState("BEFORE clearing language data");

                // Clear language selection so user must select again
                self.selectedLanguage = null;
                self.selectedDoctor = null;
                window.MC_SELECTED_DOCTOR = null;

                // Clear language cards
                $("#mc-language-cards").empty();
                $("#mc-selected-language").val("");

                // Remove selected class from any language cards
                $(".mc-language-card").removeClass("selected");

                // Clear session flags
                sessionStorage.setItem("mc_language_tab_allowed_by_kivicare", "false");
                sessionStorage.setItem("mc_language_tab_clicked", "false");

                self.logState("AFTER clearing language data");
              }
            }
          });
        });

        // Start observing the category panel
        var $categoryPanel = $('#category');
        if ($categoryPanel.length > 0) {
          categoryObserver.observe($categoryPanel[0], {
            attributes: true,
            attributeFilter: ['class']
          });
        } else {
          // If panel doesn't exist yet, try again after a delay
          setTimeout(function() {
            var $categoryPanel = $('#category');
            if ($categoryPanel.length > 0) {
              categoryObserver.observe($categoryPanel[0], {
                attributes: true,
                attributeFilter: ['class']
              });
            }
          }, 1000);
        }
      }

      // Also handle direct clicks (for manual tab switching)
      $(document).on("click", 'a[href="#category"], #category-tab', function() {
        console.log("Medico Contigo: Category tab clicked - clearing language data");

        // Clear language selection so user must select again
        self.selectedLanguage = null;
        self.selectedDoctor = null;
        window.MC_SELECTED_DOCTOR = null;

        // Clear language cards
        $("#mc-language-cards").empty();
        $("#mc-selected-language").val("");

        // Remove selected class from any language cards
        $(".mc-language-card").removeClass("selected");

        // Clear session flags
        sessionStorage.setItem("mc_language_tab_allowed_by_kivicare", "false");
        sessionStorage.setItem("mc_language_tab_clicked", "false");
      });

      // Listen for service checkbox changes
      $(document).on("change", ".card-checkbox.selected-service", function () {
        if ($(this).is(":checked")) {
          var serviceId = $(this).attr("service_id") || $(this).val();
          console.log("✅ SERVICE SELECTED (checkbox):", serviceId);

          self.selectedService = serviceId;

          // Clear previous language selection when service changes
          self.selectedLanguage = null;
          self.selectedDoctor = null;
          window.MC_SELECTED_DOCTOR = null;
          $("#mc-language-cards").empty();
          $("#mc-selected-language").val("");

          // Allow language tab to be activated (KiviCare will auto-advance to it)
          sessionStorage.setItem("mc_language_tab_allowed_by_kivicare", "true");

          self.logState("AFTER service selection (checkbox)");
        }
      });

      // Also listen for label clicks
      $(document).on(
        "click",
        "label.btn-border01.service-content",
        function () {
          var forAttr = $(this).attr("for");
          if (forAttr && forAttr.startsWith("service_")) {
            var checkbox = $("#" + forAttr);
            var serviceId = checkbox.attr("service_id") || checkbox.val();

            if (serviceId) {
              console.log("✅ SERVICE SELECTED (label click):", serviceId);

              self.selectedService = serviceId;

              // Clear previous language selection when service changes
              self.selectedLanguage = null;
              self.selectedDoctor = null;
              window.MC_SELECTED_DOCTOR = null;
              $("#mc-language-cards").empty();
              $("#mc-selected-language").val("");

              // Allow language tab to be activated (KiviCare will auto-advance to it)
              sessionStorage.setItem(
                "mc_language_tab_allowed_by_kivicare",
                "true"
              );

              self.logState("AFTER service selection (label)");
            }
          }
        }
      );
    },

    /**
     * Listen for language tab activation (Step 2)
     */
    listenForLanguageTabActivation: function () {
      var self = this;

      // Watch for language tab becoming active
      $(document).on(
        "click",
        '#language-tab, a[href="#language"]',
        function (e) {
          // Small delay to ensure tab panel is visible
          setTimeout(function () {
            self.loadLanguagesForTab();
          }, 300);
        }
      );

      // Also watch for tab shown events (Bootstrap/KiviCare)
      $(document).on(
        "shown.bs.tab shown.iq.tab",
        '#language-tab, a[href="#language"]',
        function () {
          self.loadLanguagesForTab();
        }
      );

      // Use MutationObserver to detect when #language panel becomes visible
      if (typeof MutationObserver !== "undefined") {
        var observer = new MutationObserver(function (mutations) {
          mutations.forEach(function (mutation) {
            if (
              mutation.target.id === "language" ||
              $(mutation.target).closest("#language").length > 0
            ) {
              var languagePanel = $("#language");
              if (
                languagePanel.is(":visible") &&
                languagePanel.hasClass("active")
              ) {
                self.loadLanguagesForTab();
              }
            }
          });
        });

        // Observe the main widget area for changes
        var widgetArea =
          document.getElementById("widgetOrders") || document.body;
        observer.observe(widgetArea, {
          attributes: true,
          attributeFilter: ["class", "style"],
          childList: true,
          subtree: true,
        });
      }
    },

    /**
     * Load languages when language tab is active
     */
    loadLanguagesForTab: function () {
      var self = this;

      // Check if language panel is visible
      var languagePanel = $("#language");
      if (!languagePanel.is(":visible")) {
        return;
      }

      // Check if we have a selected service
      if (!this.selectedService) {
        $("#mc-language-loader, #language_loader").hide();
        $("#mc-language-cards")
          .html(
            '<p style="text-align: center; padding: 40px; color: #999;">Please select a service first.</p>'
          )
          .css("display", "block");
        return;
      }

      // Check if languages already loaded
      if ($("#mc-language-cards .mc-language-card").length > 0) {
        // Hide loader if languages are already there
        $("#mc-language-loader, #language_loader").hide();
        $("#mc-language-cards").css("display", "flex");
        return;
      }

      // Show loader, hide cards (with explicit inline styles to override CSS)
      $("#mc-language-loader, #language_loader").css("display", "flex").show();
      $("#mc-language-cards").css("display", "none").hide();

      // Load languages via AJAX
      $.ajax({
        url: ajax_object.ajax_url,
        type: "POST",
        data: {
          action: "mc_get_service_languages",
          service_id: self.selectedService,
        },
        success: function (response) {
          // ✅ FIX: FORCE hide loader with inline style
          $("#mc-language-loader, #language_loader")
            .css("display", "none")
            .hide()
            .attr("style", "display: none !important;");

          // Extract languages from response
          var languages = null;
          if (response.success === true && response.data) {
            if (
              response.data.languages &&
              Array.isArray(response.data.languages)
            ) {
              languages = response.data.languages;
            } else if (Array.isArray(response.data)) {
              languages = response.data;
            }
          }

          if (languages && languages.length > 0) {
            var cards = "";

            languages.forEach(function (lang) {
              cards += `
                <div class="mc-language-card iq-card" data-lang-code="${
                  lang.code
                }" data-lang-name="${lang.name}">
                  <div class="language-icon">${lang.icon || "🌐"}</div>
                  <h4 class="language-name">${lang.name}</h4>
                </div>
              `;
            });

            // Show cards with explicit display style
            $("#mc-language-cards")
              .html(cards)
              .css("display", "flex")
              .fadeIn(300);
          } else {
            $("#mc-language-cards")
              .html(
                '<p style="text-align: center; padding: 40px; color: #999;">No languages configured for this service.</p>'
              )
              .css("display", "block")
              .fadeIn(300);
          }
        },
        error: function (xhr, status, error) {
          // ✅ FIX: Hide loader on error too (with inline style)
          $("#mc-language-loader, #language_loader")
            .css("display", "none")
            .hide()
            .attr("style", "display: none !important;");

          $("#mc-language-cards")
            .html(
              '<p style="text-align: center; padding: 40px; color: #f00;">Error loading languages.</p>'
            )
            .css("display", "block")
            .fadeIn(300);
        },
      });
    },

    /**
     * Bind clicks on language cards
     */
    bindLanguageCardClicks: function () {
      var self = this;

      $(document).on("click", ".mc-language-card", function () {
        var langCode = $(this).data("lang-code");
        var langName = $(this).data("lang-name");

        console.log("🌐 LANGUAGE SELECTED:", langName, "(" + langCode + ")");

        // Visual feedback
        $(".mc-language-card").removeClass("selected");
        $(this).addClass("selected");

        // Store selection
        self.selectedLanguage = langCode;
        $("#mc-selected-language").val(langCode);

        self.logState("AFTER language selection");

        // ✅ NOW auto-assign doctor based on service + language
        if (self.selectedService && self.selectedLanguage) {
          console.log("🔄 Auto-assigning doctor for service:", self.selectedService, "language:", self.selectedLanguage);
          self.autoSelectDoctor(self.selectedService, self.selectedLanguage);
        }

        // Enable next button
        $("#language .iq-next-btn, #language .widget-next-btn")
          .prop("disabled", false)
          .css("opacity", "1");
      });
    },

    /**
     * Intercept tab navigation to ensure language is selected
     */
    interceptTabNavigation: function () {
      var self = this;

      // ✅ FIX: Intercept "Next" button clicks from language tab with HIGHEST PRIORITY
      $(document).on(
        "click",
        "#language .iq-next-btn, #language .widget-next-btn, #language button[type='submit'], #language button[type='button']",
        function (e) {
          console.log("⏭️ NEXT BUTTON CLICKED on language tab");

          // ALWAYS prevent default form submission behavior
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          self.logState("Next button on language tab");

          if (!self.selectedLanguage) {
            console.log("⚠️ No language selected - showing alert");
            alert(
              "Por favor, selecciona un idioma antes de continuar.\n\nPlease select a language before continuing."
            );
            return false;
          }

          console.log("✅ Language selected, proceeding to next tab");

          // ✅ CRITICAL: Re-enforce doctor before navigating to date-time
          if (window.MC_SELECTED_DOCTOR) {

            // ✅ FIX: Ensure clinic_id is set
            var clinicId = window.bookAppointmentWidgetData?.preselected_clinic_id ||
                           window.bookAppointmentWidgetData?.clinic_id ||
                           $("input[name='clinic_id']").val() ||
                           1;

            $("input[name='doctor_id']").val(window.MC_SELECTED_DOCTOR);
            $("input[name='appointment_doctor_id']").val(
              window.MC_SELECTED_DOCTOR
            );
            $("#selected_doctor_id").val(window.MC_SELECTED_DOCTOR);
            $("#doctor_id").val(window.MC_SELECTED_DOCTOR);

            // Also set in any hidden doctor fields
            $("input[type='hidden'][name*='doctor']").val(
              window.MC_SELECTED_DOCTOR
            );

            // ✅ FIX: Also set clinic_id
            $("input[name='clinic_id']").val(clinicId);
            $("#clinic_id").val(clinicId);

            // ✅ CRITICAL: Inject into KiviCare's bookAppointmentWidgetData BEFORE navigating
            self.injectDoctorIntoBookingData(window.MC_SELECTED_DOCTOR);
          }

          // ✅ FIX: Find and activate the next tab more reliably
          var nextTabActivated = false;

          // Method 1: Find next tab by tab order
          var $currentTabLink = $('#language-tab, a[href="#language"]');
          if ($currentTabLink.length > 0) {
            var $parentLi = $currentTabLink.closest("li, .tab-item");
            var $nextTabLi = $parentLi.next();
            var $nextTabLink = $nextTabLi.find("a");

            if ($nextTabLink.length > 0) {
              $nextTabLink.trigger("click");
              nextTabActivated = true;
            }
          }

          // Method 2: Find datetime tab directly (fallback)
          if (!nextTabActivated) {
            var $datetimeTab = $('a[href="#datetime"], #datetime-tab');
            if ($datetimeTab.length > 0) {
              $datetimeTab.trigger("click");
              nextTabActivated = true;
            }
          }

          // Method 3: Find all tabs and go to next one (last resort)
          if (!nextTabActivated) {
            var $allTabs = $(".tab-link, .tab-item a, .tab-side-nav a");
            var currentIndex = -1;

            $allTabs.each(function (index) {
              var href = $(this).attr("href");
              if (
                href === "#language" ||
                $(this).attr("id") === "language-tab"
              ) {
                currentIndex = index;
              }
            });

            if (currentIndex >= 0 && currentIndex < $allTabs.length - 1) {
              var $nextTab = $allTabs.eq(currentIndex + 1);
              $nextTab.trigger("click");
              nextTabActivated = true;
            }
          }

          return false;
        }
      );

      // Only intercept tab clicks to enforce language selection requirement
      $(document).on("click", ".tab-link, .tab-item a", function (e) {
        var targetTab = $(this).attr("href");

        if (!targetTab || !targetTab.startsWith("#")) {
          return; // Not a tab link
        }

        // Get current active tab
        var $activePanel = $(".iq-tab-pannel.active");
        var currentTabId = $activePanel.attr("id");

        // Get tab order/index for both current and target tabs
        var $allTabLinks = $(".tab-item a, .tab-link");
        var currentIndex = -1;
        var targetIndex = -1;

        $allTabLinks.each(function(index) {
          var href = $(this).attr("href");
          if (href === "#" + currentTabId) {
            currentIndex = index;
          }
          if (href === targetTab) {
            targetIndex = index;
          }
        });

        // Allow clicking on previous tabs (going backwards)
        if (targetIndex >= 0 && currentIndex >= 0 && targetIndex < currentIndex) {
          return; // Allow the click
        }

        // ONLY BLOCK: If trying to go forward without selecting language
        if (self.selectedService && !self.selectedLanguage) {
          if (
            targetTab &&
            targetTab !== "#category" &&
            targetTab !== "#language"
          ) {
            console.log("🚫 BLOCKED TAB NAVIGATION - Language not selected");
            console.log("   Tried to go to:", targetTab);
            self.logState("Tab navigation blocked");

            e.preventDefault();
            e.stopPropagation();

            // Show language tab instead
            var $languageTab = $('#language-tab, a[href="#language"]');
            if ($languageTab.length > 0) {
              console.log("   Redirecting to language tab");
              $languageTab.trigger("click");
            }

            return false;
          }
        }

        // Let KiviCare handle all other navigation naturally
        console.log("✅ ALLOWING TAB NAVIGATION to:", targetTab);
      });

      // ✅ REMOVED: This code was too aggressive and broke KiviCare's native tab navigation
      // Only intercept language tab specifically (handled above)
      // Let KiviCare handle all other tab navigation naturally

      // ✅ FIX: CRITICAL - Prevent form submission when on language tab (STRONGEST PREVENTION)
      $(document).on("submit", "form", function (e) {
        var $activeTab = $(".iq-tab-pannel.active");
        var isLanguageTabActive = $activeTab.attr("id") === "language";

        if (isLanguageTabActive) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          if (!self.selectedLanguage) {
            alert(
              "Por favor, selecciona un idioma antes de continuar.\n\nPlease select a language before continuing."
            );
          } else {
            // If language is selected, navigate to next tab instead
            $("#language .iq-next-btn, #language .widget-next-btn")
              .first()
              .trigger("click");
          }

          return false;
        }

        // ✅ CRITICAL: Before ANY form submission, inject MC_SELECTED_DOCTOR
        if (window.MC_SELECTED_DOCTOR) {
          // Add as hidden field if not exists
          if ($("input[name='MC_SELECTED_DOCTOR']").length === 0) {
            $(this).append(
              '<input type="hidden" name="MC_SELECTED_DOCTOR" value="' +
                window.MC_SELECTED_DOCTOR +
                '">'
            );
          } else {
            $("input[name='MC_SELECTED_DOCTOR']").val(
              window.MC_SELECTED_DOCTOR
            );
          }

          // Also re-enforce doctor_id fields
          $("input[name='doctor_id'], input[name='appointment_doctor_id']").val(
            window.MC_SELECTED_DOCTOR
          );
        }
      });

      // ✅ FIX: Additional prevention - catch any button clicks inside language tab
      $(document).on("click", "#language button", function (e) {
        var buttonType = $(this).attr("type");

        // If it's a submit button, convert it to navigation
        if (buttonType === "submit" || !buttonType) {
          e.preventDefault();
          e.stopPropagation();

          // Check if language is selected
          if (self.selectedLanguage) {
            // This will trigger the navigation logic above
          } else {
            alert(
              "Por favor, selecciona un idioma antes de continuar.\n\nPlease select a language before continuing."
            );
          }

          return false;
        }
      });
    },

    /**
     * Auto-select doctor based on service
     */
    /**
     * ✅ CRITICAL: Inject doctor into KiviCare's bookAppointmentWidgetData
     */
    injectDoctorIntoBookingData: function (doctorId) {
      // CRITICAL: Set in bookAppointmentWidgetData (KiviCare's global data object)
      if (typeof window.bookAppointmentWidgetData !== "undefined") {
        // ✅ FIX: Ensure clinic_id is set (default to 1 if not present)
        var clinicId = window.bookAppointmentWidgetData.preselected_clinic_id ||
                       window.bookAppointmentWidgetData.clinic_id ||
                       1;

        window.bookAppointmentWidgetData.doctor_id = doctorId;
        window.bookAppointmentWidgetData.appointment_doctor_id = doctorId;
        window.bookAppointmentWidgetData.selectedDoctor = doctorId;
        window.bookAppointmentWidgetData.preselected_doctor = String(doctorId); // Must be STRING!

        // ✅ CRITICAL: Ensure clinic_id is also set
        window.bookAppointmentWidgetData.clinic_id = clinicId;
        window.bookAppointmentWidgetData.preselected_clinic_id = String(clinicId);
        window.bookAppointmentWidgetData.preselected_single_clinic_id = true;

        // ✅ CRITICAL: Force boolean TRUE (not string "true", not 1, but actual boolean)
        window.bookAppointmentWidgetData.preselected_single_doctor_id = Boolean(true);
      }
    },

    /**
     * ✅ Trigger KiviCare to load date-time content
     */
    triggerDateTimeLoad: function () {
      var self = this;

      // Find the widget container (could be #widgetOrders, .kivi-widget, etc.)
      var $widgetContainer = $("#date-time").closest(
        '[id^="widget"], .kivi-widget'
      );
      var containerSelector =
        $widgetContainer.length > 0
          ? "#" + $widgetContainer.attr("id")
          : "#widgetOrders";

      // ✅ CRITICAL: Wait for KiviCare to fully initialize
      var attemptLoad = function(attempt) {
        attempt = attempt || 1;

        if (typeof window.kcAppointmentBookJsContent === "function") {
          try {
            // Re-initialize the widget's date-time tab with the doctor set
            window.kcAppointmentBookJsContent(containerSelector);

            // Verify it worked by checking if the internal functions now exist
            setTimeout(function() {
              if (typeof window.kivicareGetDoctorWeekday !== 'function') {
                self.manualDateTimeLoad();
              }
            }, 500);

          } catch (e) {
            // Error calling kcAppointmentBookJsContent
          }
        } else if (attempt < 5) {
          // Retry up to 5 times with 200ms delay
          setTimeout(function() {
            attemptLoad(attempt + 1);
          }, 200);
        } else {
          self.manualDateTimeLoad();
        }
      };

      // Start the loading attempt
      attemptLoad(1);
    },

    /**
     * ✅ Manual date-time loading when KiviCare function isn't available
     */
    manualDateTimeLoad: function() {
      if (!window.MC_SELECTED_DOCTOR || !window.bookAppointmentWidgetData) {
        return;
      }

      // ✅ FIX: Ensure clinic_id is properly retrieved
      var clinicId = window.bookAppointmentWidgetData.preselected_clinic_id ||
                     window.bookAppointmentWidgetData.clinic_id ||
                     $("input[name='clinic_id']").val() ||
                     1;

      var containerSelector = "#widgetOrders";

      // Show loader
      $(containerSelector + " #doctor-datepicker-loader").removeClass("d-none");

      // Direct AJAX call to load doctor's working days
      $.ajax({
        url:
          window.bookAppointmentWidgetData.ajax_url +
          "?action=ajax_get&route_name=get_doctor_workdays",
        data: {
          clinic_id: clinicId,
          doctor_id: window.MC_SELECTED_DOCTOR,
          type: "flatpicker",
          _ajax_nonce: window.bookAppointmentWidgetData.ajax_get_nonce,
        },
        success: function (response) {
          // Hide loader
          $(containerSelector + " #doctor-datepicker-loader").addClass("d-none");
        },
        error: function (xhr, status, error) {
          $(containerSelector + " #doctor-datepicker-loader").addClass("d-none");
        },
      });
    },

    /**
     * ✅ DEPRECATED: Old Vue injection (not needed - KiviCare doesn't use Vue)
     */
    injectDoctorIntoVueComponent: function (doctorId) {
      // Method 1: Set in window.kiviCareBooking global
      if (typeof window.kiviCareBooking !== "undefined") {
        window.kiviCareBooking.doctor_id = doctorId;
        window.kiviCareBooking.selectedDoctor = doctorId;
        window.kiviCareBooking.appointment_doctor_id = doctorId;
      }

      // Method 2: Try to find Vue instance on date-time element
      var $dateTime = $("#date-time");
      if ($dateTime.length > 0 && $dateTime[0].__vue__) {
        var vueInstance = $dateTime[0].__vue__;
        if (vueInstance.$data) {
          vueInstance.$data.doctor_id = doctorId;
          vueInstance.$data.selectedDoctor = doctorId;
        }
        if (vueInstance.$set) {
          vueInstance.$set(vueInstance, "doctor_id", doctorId);
        }
      }

      // Method 3: Set in any global Vue app
      if (typeof window.Vue !== "undefined" && window.Vue._instance) {
        if (window.Vue._instance.$data) {
          window.Vue._instance.$data.doctor_id = doctorId;
          window.Vue._instance.$data.selectedDoctor = doctorId;
        }
      }

      // Method 4: Set in localStorage (some components read from there)
      try {
        localStorage.setItem("kc_selected_doctor", doctorId);
        localStorage.setItem("mc_doctor_id", doctorId);
      } catch (e) {
        // Could not set localStorage
      }

      // Method 5: Dispatch custom events that components might listen to
      var event = new CustomEvent("kcDoctorSelected", {
        detail: { doctor_id: doctorId },
        bubbles: true,
      });
      document.dispatchEvent(event);
      $("#date-time")[0]?.dispatchEvent(event);

      // Method 6: Try to set via data attributes
      $("#date-time").attr("data-doctor-id", doctorId);
      $("#date-time form").attr("data-doctor-id", doctorId);
    },

    /**
     * ✅ Lock doctor selection to prevent KiviCare from overriding it
     */
    lockDoctorSelection: function (doctorId) {
      var self = this;

      // Monitor and enforce doctor value every 100ms
      if (self.doctorLockInterval) {
        clearInterval(self.doctorLockInterval);
      }

      self.doctorLockInterval = setInterval(function () {
        // Check traditional form fields
        var $doctorFields = $(
          "input[name='doctor_id'], input[name='appointment_doctor_id'], #selected_doctor_id, #doctor_id"
        );

        $doctorFields.each(function () {
          var currentVal = $(this).val();
          if (currentVal != doctorId && currentVal !== "") {
            $(this).val(doctorId);
          }
        });

        // Also re-inject into bookAppointmentWidgetData every cycle
        if (window.bookAppointmentWidgetData) {
          if (
            window.bookAppointmentWidgetData.preselected_doctor !=
            String(doctorId) ||
            window.bookAppointmentWidgetData.preselected_single_doctor_id !== true
          ) {
            window.bookAppointmentWidgetData.doctor_id = doctorId;
            window.bookAppointmentWidgetData.appointment_doctor_id = doctorId;
            window.bookAppointmentWidgetData.selectedDoctor = doctorId;
            window.bookAppointmentWidgetData.preselected_doctor =
              String(doctorId);
            // Force boolean true
            window.bookAppointmentWidgetData.preselected_single_doctor_id = Boolean(true);
          }
        }
      }, 100);

      // Keep monitoring until appointment is complete (30 seconds)
      setTimeout(function () {
        if (self.doctorLockInterval) {
          clearInterval(self.doctorLockInterval);
        }
      }, 30000);
    },

    autoSelectDoctor: function (serviceId, language) {
      var self = this;

      $.ajax({
        url: ajax_object.ajax_url,
        type: "POST",
        data: {
          action: "mc_get_first_available_doctor",
          service_id: serviceId,
          language: language || "",
        },
        success: function (response) {
          if (response.success && response.data && response.data.doctor_id) {
            var doctorId = response.data.doctor_id;
            self.selectedDoctor = doctorId;

            // ✅ CRITICAL: Set doctor in ALL possible field names
            $("input[name='doctor_id']").val(doctorId);
            $("input[name='appointment_doctor_id']").val(doctorId);
            $("#selected_doctor_id").val(doctorId);
            $("#doctor_id").val(doctorId);
            $(".selected-doctor").val(doctorId);

            // Store in KiviCare globals
            if (typeof window.kiviCareBooking !== "undefined") {
              window.kiviCareBooking.selectedDoctor = doctorId;
            }

            window.MC_SELECTED_DOCTOR = doctorId;

            // ✅ CRITICAL: Inject into KiviCare's bookAppointmentWidgetData
            self.injectDoctorIntoBookingData(doctorId);

            // ✅ PROTECTION: Lock the doctor value and prevent overrides
            self.lockDoctorSelection(doctorId);
          }
        },
        error: function (xhr, status, error) {
          // Doctor auto-select error
        },
      });
    },

    /**
     * ✅ NUCLEAR OPTION: Add capture phase event listeners
     * These fire BEFORE bubble phase, catching events earlier
     */
    addCapturePhaseBlockers: function () {
      var self = this;

      // Get all forms on the page
      var forms = document.querySelectorAll("form");

      forms.forEach(function (form) {
        // Add submit blocker in CAPTURE phase (fires first!)
        form.addEventListener(
          "submit",
          function (e) {
            var $activeTab = $(".iq-tab-pannel.active");
            var isLanguageTabActive = $activeTab.attr("id") === "language";

            if (isLanguageTabActive) {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();

              if (self.selectedLanguage) {
                setTimeout(function () {
                  $("#language .iq-next-btn, #language .widget-next-btn")
                    .first()
                    .trigger("click");
                }, 100);
              } else {
                alert(
                  "Por favor, selecciona un idioma antes de continuar.\n\nPlease select a language before continuing."
                );
              }

              return false;
            }
          },
          true
        ); // TRUE = capture phase!

        // Also block in bubble phase (double protection)
        form.addEventListener(
          "submit",
          function (e) {
            var $activeTab = $(".iq-tab-pannel.active");
            var isLanguageTabActive = $activeTab.attr("id") === "language";

            if (isLanguageTabActive) {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              return false;
            }
          },
          false
        ); // FALSE = bubble phase
      });

      // ✅ REMOVED: Overly aggressive capture phase click listener
      // This was preventing KiviCare's natural tab navigation
      // Let KiviCare handle tab order based on its widget settings
    },

    /**
     * ✅ Convert submit buttons to regular buttons in language tab
     * This prevents form submission at the source
     */
    convertSubmitButtons: function () {
      var self = this;

      // Function to convert buttons
      function convertButtons() {
        $('#language button[type="submit"]').each(function () {
          $(this).attr("type", "button");
          $(this).attr("data-original-type", "submit"); // Store original type
        });
      }

      // Convert immediately
      convertButtons();

      // Convert periodically in case buttons are added dynamically
      setInterval(convertButtons, 500);

      // Reconvert when language tab becomes active
      $(document).on(
        "click",
        '#language-tab, a[href="#language"]',
        function () {
          setTimeout(convertButtons, 100);
          setTimeout(convertButtons, 500);
        }
      );
    },

    /**
     * ✅ NUCLEAR: Disable form action when on language tab
     */
    disableFormActionOnLanguageTab: function () {
      var self = this;
      var originalAction = null;
      var $form = null;

      // Watch for tab changes
      setInterval(function () {
        var $activeTab = $(".iq-tab-pannel.active");
        var isLanguageTabActive = $activeTab.attr("id") === "language";

        if (!$form || $form.length === 0) {
          $form = $("#language").closest("form");
        }

        if ($form && $form.length > 0) {
          if (isLanguageTabActive) {
            // Save original action if not saved yet
            if (!originalAction) {
              originalAction = $form.attr("action");
            }

            // Disable form submission by removing action and method
            $form.attr("action", "javascript:void(0);");
            $form.attr("data-mc-blocked", "true");
          } else if (
            originalAction &&
            $form.attr("data-mc-blocked") === "true"
          ) {
            // Restore original action when leaving language tab
            $form.attr("action", originalAction);
            $form.removeAttr("data-mc-blocked");
          }
        }
      }, 100);
    },
  };

  // ✅ ULTIMATE FIREWALL: Global form submission blocker (runs BEFORE everything)
  // This uses native DOM Level 0 event handlers which fire FIRST
  (function installGlobalFirewall() {
    // Hook into HTMLFormElement.prototype.submit to block programmatic submissions
    var originalSubmit = HTMLFormElement.prototype.submit;
    HTMLFormElement.prototype.submit = function () {
      var $activeTab = jQuery(".iq-tab-pannel.active");
      var isLanguageTabActive = $activeTab.attr("id") === "language";

      if (isLanguageTabActive) {
        return false;
      }

      return originalSubmit.apply(this, arguments);
    };

    // Also intercept form submissions at the document level (earliest possible)
    document.addEventListener(
      "submit",
      function (e) {
        var $activeTab = jQuery(".iq-tab-pannel.active");
        var isLanguageTabActive = $activeTab.attr("id") === "language";

        if (isLanguageTabActive) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          if (MC_Booking.selectedLanguage) {
            setTimeout(function () {
              jQuery("#language .iq-next-btn, #language .widget-next-btn")
                .first()
                .trigger("click");
            }, 100);
          } else {
            alert(
              "Por favor, selecciona un idioma antes de continuar.\n\nPlease select a language before continuing."
            );
          }

          return false;
        }
      },
      true
    ); // TRUE = capture phase (fires FIRST!)
  })();

  // Initialize when DOM is ready
  $(document).ready(function () {
    MC_Booking.init();
  });

  // Also try initialization after a delay (for dynamic widgets)
  setTimeout(function () {
    MC_Booking.init();
  }, 1000);

  setTimeout(function () {
    MC_Booking.init();
  }, 3000);

  // Expose globally for debugging
  window.MC_Booking = MC_Booking;
})(jQuery);

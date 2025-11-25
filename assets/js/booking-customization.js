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
    doctorAssignmentInProgress: false, // Flag to block navigation during AJAX
    lastAlertTime: 0, // Timestamp to prevent duplicate alerts

    // Debug helper
    logState: function (location) {
      // console.log("========================================");
      // console.log("🔍 MC_Booking State at: " + location);
      // console.log("selectedService:", this.selectedService);
      // console.log("selectedLanguage:", this.selectedLanguage);
      // console.log("selectedDoctor:", this.selectedDoctor);
      // console.log("MC_SELECTED_DOCTOR:", window.MC_SELECTED_DOCTOR);
      // console.log("SessionStorage flags:");
      // console.log(
      //   "  - mc_language_tab_allowed_by_kivicare:",
      //   sessionStorage.getItem("mc_language_tab_allowed_by_kivicare")
      // );
      // console.log(
      //   "  - mc_language_tab_clicked:",
      //   sessionStorage.getItem("mc_language_tab_clicked")
      // );
      // console.log("Active tab:", $(".iq-tab-pannel.active").attr("id"));
      // console.log("========================================");
    },

    // Helper to show alert only once (debounced)
    showWaitAlert: function () {
      var now = Date.now();
      // Only show if last alert was more than 2 seconds ago
      if (now - this.lastAlertTime > 2000) {
        this.lastAlertTime = now;
        alert(
          "⏳ Por favor, espera mientras asignamos un médico.\n\n⏳ Please wait while we assign a doctor."
        );
      } else {
        // console.log("⚠️ Alert suppressed - already shown recently");
      }
    },

    init: function () {
      if (this.initialized) return;
      this.initialized = true;

      // console.log("🚀 MC_Booking initialized");
      this.logState("INIT");

      // ✅ CRITICAL FIX: Ensure bookAppointmentWidgetData exists and has proper structure
      if (typeof window.bookAppointmentWidgetData !== "undefined") {
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

      // ✅ NUCLEAR OPTION: Watch for unauthorized tab changes
      this.enforceLanguageTabLock();

      // ✅ NUCLEAR OPTION: Add capture phase event listeners
      this.addCapturePhaseBlockers();

      // ✅ Convert submit buttons to regular buttons in language tab
      this.convertSubmitButtons();

      // ✅ Disable form action when on language tab
      this.disableFormActionOnLanguageTab();

      // ✅ Monitor date-time tab activation
      this.monitorDateTimeTab();

      // ✅ Skip hidden doctor tab when navigating from date-time
      this.skipDoctorTabNavigation();

      // ✅ FIX: Implement proper back button navigation
      this.fixBackButtonNavigation();

      // ✅ NEW: Disable sidebar tab clicking - force button-only navigation
      this.disableSidebarTabClicking();
    },

    /**
     * ✅ FIX: Implement proper back button navigation
     * Ensures each back button goes to the correct previous step
     */
    fixBackButtonNavigation: function () {
      var self = this;

      // ✅ Add back button to language step (it doesn't have one by default)
      function addLanguageBackButton() {
        var $languagePanel = $("#language");
        console.log("🔍 Checking for language panel:", $languagePanel.length);

        if ($languagePanel.length > 0) {
          // Check if back button already exists
          if (
            $languagePanel.find(
              "#iq-widget-back-button, .iq-button[data-step='prev']"
            ).length === 0
          ) {
            // Find the button container or next button
            var $buttonContainer = $languagePanel
              .find(".iq-button-container, .button-container, .widget-actions")
              .first();
            var $nextBtn = $languagePanel
              .find("#iq-widget-next-button, .iq-button[data-step='next']")
              .first();

            console.log("🔍 Button container found:", $buttonContainer.length);
            console.log("🔍 Next button found:", $nextBtn.length);

            if ($nextBtn.length > 0) {
              var $backBtn = $(
                '<button type="button" class="iq-button iq-button-secondary" id="iq-widget-back-button-language" data-step="prev">Back</button>'
              );
              $backBtn.css({
                "margin-right": "10px",
              });

              if ($buttonContainer.length > 0) {
                $buttonContainer.prepend($backBtn);
              } else {
                $nextBtn.before($backBtn);
              }

              console.log("✅ Added back button to language step");
            } else {
              console.log("⚠️ Could not find next button in language panel");
            }
          } else {
            console.log("ℹ️ Back button already exists in language panel");
          }
        } else {
          console.log("⚠️ Language panel not found");
        }
      }

      // Try to add immediately and also after delays
      setTimeout(addLanguageBackButton, 500);
      setTimeout(addLanguageBackButton, 1500);
      setTimeout(addLanguageBackButton, 3000);

      // ✅ NUCLEAR OPTION: Use native addEventListener with capture phase
      // This runs BEFORE any other handlers
      function attachCapturePhaseHandler() {
        // Get all back buttons
        var backButtons = document.querySelectorAll(
          "#iq-widget-back-button, #iq-widget-back-button-language, .iq-button[data-step='prev']"
        );

        backButtons.forEach(function (button) {
          // Remove any existing listener first
          button.removeEventListener("click", handleBackButtonCapture, true);
          // Add listener in CAPTURE phase (runs first!)
          button.addEventListener("click", handleBackButtonCapture, true);
        });

        if (backButtons.length > 0) {
          console.log(
            "✅ Attached capture phase handlers to",
            backButtons.length,
            "back buttons"
          );
        }
      }

      // The handler that runs in capture phase
      function handleBackButtonCapture(e) {
        console.log("🔴 CAPTURE HANDLER TRIGGERED!");
        console.log("   Event type:", e.type);
        console.log("   Target:", e.target);
        console.log("   Button ID:", e.target.id);

        // IMMEDIATELY stop everything
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Find which tab is CURRENTLY active (before any navigation)
        var $activeTab = $(".iq-tab-pannel.active");
        var currentTabId = $activeTab.attr("id");

        console.log("◄ BACK BUTTON CLICKED (CAPTURE) from:", currentTabId);

        // Determine the correct previous tab
        var previousTabId = null;

        switch (currentTabId) {
          case "language":
            previousTabId = "category";
            console.log("  → Going to: Service (category)");
            break;

          case "date-time":
            previousTabId = "language";
            console.log("  → Going to: Language");
            break;

          case "file-uploads-custom": // Extra Data
            previousTabId = "date-time";
            console.log("  → Going to: Date-Time");
            break;

          case "detail-info":
          case "kc_detail_info":
            // Check if extra data tab exists
            if ($("#file-uploads-custom").length > 0) {
              previousTabId = "file-uploads-custom";
              console.log("  → Going to: Extra Data");
            } else {
              previousTabId = "date-time";
              console.log("  → Going to: Date-Time (no extra data)");
            }
            break;

          default:
            // For other tabs, still block KiviCare and do nothing
            console.log("  → Unknown tab, blocking navigation");
            return false;
        }

        // If we determined a previous tab, navigate to it
        if (previousTabId) {
          // ✅ CRITICAL: Deactivate ALL tabs first (not just current one)
          $(".iq-tab-pannel").removeClass("active");

          // Activate previous tab
          var $previousTab = $("#" + previousTabId);
          $previousTab.addClass("active");

          // ✅ CRITICAL: Ensure the panel is visible (remove any hidden styles)
          $previousTab
            .css({
              display: "block !important",
              opacity: "1",
              visibility: "visible",
              height: "auto",
              overflow: "visible",
            })
            .show()
            .removeClass("d-none hidden");

          // Also remove hide/hidden classes
          $previousTab.attr(
            "style",
            $previousTab.attr("style") + "; display: block !important;"
          );

          // ✅ CRITICAL: Clear ALL sidebar active states first
          $(".tab-link, .tab-item a, .tab-item, li").removeClass("active");

          // Then activate only the correct one
          var $previousTabLink = $('a[href="#' + previousTabId + '"]');
          $previousTabLink.addClass("active");
          $previousTabLink.closest(".tab-item, li").addClass("active");

          // ✅ NUCLEAR: Trigger click on the sidebar link to force parent theme to show panel
          if ($previousTabLink.length > 0) {
            console.log(
              "🔨 Clicking sidebar link to force parent theme visibility"
            );
            // Trigger actual click event on the link
            setTimeout(function () {
              $previousTabLink[0].click();
            }, 50);
          }

          console.log("✅ Navigated back to:", previousTabId);
          console.log("✅ Made panel visible:", previousTabId);

          // ✅ CRITICAL: Clear data from the step we just left AND all future steps
          console.log(
            "🗑️ Clearing data from step:",
            currentTabId,
            "and all future steps"
          );

          // Define step order
          var stepOrder = [
            "category",
            "language",
            "date-time",
            "file-uploads-custom",
            "detail-info",
          ];
          var currentStepIndex = stepOrder.indexOf(currentTabId);

          // Clear current step and all steps after it
          for (var i = currentStepIndex; i < stepOrder.length; i++) {
            var stepToClear = stepOrder[i];
            console.log("  🗑️ Clearing step:", stepToClear);

            switch (stepToClear) {
              case "language":
                // Clear language selection
                console.log("    → Clearing language selection");
                self.selectedLanguage = null;
                $(".mc-language-card").removeClass("selected");
                $("#mc-selected-language").val("");
                // Remove active/completed state and data-check from sidebar
                $('a[href="#language"]')
                  .parent()
                  .removeClass("active completed")
                  .attr("data-check", "false");
                $('a[href="#language"]').removeClass("active");
                break;

              case "date-time":
                // Clear date/time selections
                console.log("    → Clearing date-time selections");
                $(".iq-calendar-date.selected").removeClass("selected");
                $(".iq-time-slot.selected").removeClass("selected");
                $("input[name='appointment_date']").val("");
                $("input[name='appointment_time']").val("");
                $("input[name='appointment_start_time']").val("");
                $("input[name='appointment_end_time']").val("");
                // Remove active/completed state and data-check from sidebar
                $('a[href="#date-time"]')
                  .parent()
                  .removeClass("active completed")
                  .attr("data-check", "false");
                $('a[href="#date-time"]').removeClass("active");
                break;

              case "file-uploads-custom":
                // Clear extra data
                console.log("    → Clearing extra data (files/descriptions)");
                $("#file-uploads-custom input[type='file']").val("");
                $("#file-uploads-custom textarea").val("");
                $("#file-uploads-custom input[type='text']").val("");
                $(
                  "#file-uploads-custom .file-preview, .uploaded-file"
                ).remove();
                // Remove active/completed state and data-check from sidebar
                $('a[href="#file-uploads-custom"]')
                  .parent()
                  .removeClass("active completed")
                  .attr("data-check", "false");
                $('a[href="#file-uploads-custom"]').removeClass("active");
                console.log(
                  "    ✅ Set data-check=false for file-uploads-custom"
                );
                break;

              case "detail-info":
                // Clear user details
                console.log("    → Clearing user detail form");
                $("input[name='first_name']").val("");
                $("input[name='last_name']").val("");
                $("input[name='user_email']").val("");
                $("input[name='mobile_number']").val("");
                $("input[name='gender']").val("").prop("checked", false);
                $("textarea[name='description']").val("");
                $("#detail-info .error, #detail-info .invalid").removeClass(
                  "error invalid"
                );
                // Remove active/completed state and data-check from sidebar
                $('a[href="#detail-info"]')
                  .parent()
                  .removeClass("active completed")
                  .attr("data-check", "false");
                $('a[href="#detail-info"]').removeClass("active");
                break;
            }
          }

          // ✅ ADDITIONAL: If going back to Step 1, also clear doctor and clinic
          if (previousTabId === "category") {
            console.log("🔄 Back to Step 1 - clearing doctor and clinic");
            self.selectedDoctor = null;
            window.MC_SELECTED_DOCTOR = null;
            window.MC_SELECTED_DOCTOR_NAME = null;
            window.MC_SELECTED_CLINIC = null;
            self.doctorAssignmentInProgress = false;

            // Clear doctor/clinic form fields
            $("input[name='doctor_id']").val("");
            $("input[name='clinic_id']").val("");

            // Clear bookAppointmentWidgetData
            if (typeof window.bookAppointmentWidgetData !== "undefined") {
              window.bookAppointmentWidgetData.doctor_id = null;
              window.bookAppointmentWidgetData.clinic_id = null;
              window.bookAppointmentWidgetData.preselected_doctor = null;
              window.bookAppointmentWidgetData.preselected_single_doctor_id = false;
            }
          }

          console.log(
            "✅ Data and tab states cleared from:",
            currentTabId,
            "onwards"
          );

          // ✅ Force parent theme to recognize the language tab as active
          if (previousTabId === "language") {
            // Set session storage flag that parent theme checks
            sessionStorage.setItem(
              "mc_language_tab_allowed_by_kivicare",
              "true"
            );

            // Trigger any parent theme watchers
            $(document).trigger("languageTabActivated");

            // Force a reflow to ensure CSS is applied
            $previousTab[0].offsetHeight;

            console.log("🔧 Triggered parent theme language tab activation");
          }

          // ✅ SPECIAL: If going back to language tab, ensure language cards are rendered
          if (previousTabId === "language" && self.selectedService) {
            console.log(
              "🔄 Re-rendering language cards for service:",
              self.selectedService
            );

            // Trigger the service selection to re-render language cards
            setTimeout(function () {
              // Check if language cards container exists and is empty
              var $languageCards = $("#mc-language-cards");
              if (
                $languageCards.length === 0 ||
                $languageCards.children().length === 0
              ) {
                console.log("⚠️ Language cards missing, triggering re-render");

                // Simulate service selection to trigger language card rendering
                var $serviceCheckbox = $(
                  '.card-checkbox.selected-service[service_id="' +
                    self.selectedService +
                    '"]'
                );
                if ($serviceCheckbox.length > 0) {
                  $serviceCheckbox.trigger("change");
                } else {
                  // Alternative: trigger label click
                  var $serviceLabel = $(
                    'label[for="service_' + self.selectedService + '"]'
                  );
                  if ($serviceLabel.length > 0) {
                    $serviceLabel.trigger("click");
                  }
                }
              } else {
                console.log(
                  "✅ Language cards already present:",
                  $languageCards.children().length
                );
              }
            }, 100);
          }
        }

        return false;
      }

      // Attach handlers at multiple times to catch dynamically added buttons
      setTimeout(attachCapturePhaseHandler, 600);
      setTimeout(attachCapturePhaseHandler, 1600);
      setTimeout(attachCapturePhaseHandler, 3100);

      // Also re-attach when new tabs become active
      $(document).on("DOMNodeInserted", function (e) {
        if (
          $(e.target).hasClass("iq-button") ||
          $(e.target).attr("id") === "iq-widget-back-button"
        ) {
          setTimeout(attachCapturePhaseHandler, 50);
        }
      });
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
              var clinicId =
                window.bookAppointmentWidgetData?.preselected_clinic_id ||
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
              self.injectDoctorIntoBookingData(
                window.MC_SELECTED_DOCTOR,
                clinicId
              );

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
                var clinicId =
                  window.bookAppointmentWidgetData?.preselected_clinic_id ||
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
                self.injectDoctorIntoBookingData(
                  window.MC_SELECTED_DOCTOR,
                  clinicId
                );

                // ✅ CRITICAL: Trigger date-time content load
                setTimeout(function () {
                  self.triggerDateTimeLoad();
                }, 300);
              }

              // Mark that we're currently on date-time
              window.MC_LAST_ACTIVE_TAB = "date-time";
            }

            // ✅ CRITICAL: Intercept ANY tab becoming active and enforce language requirement
            if (
              $target.hasClass("iq-tab-pannel") &&
              $target.hasClass("active")
            ) {
              // Check if 'active' class was just added (wasn't in old value)
              var wasJustActivated =
                mutation.oldValue && mutation.oldValue.indexOf("active") === -1;

              // If a tab was just activated (wasn't active before)
              if (
                wasJustActivated &&
                targetId !== "category" &&
                targetId !== "language"
              ) {
                console.log("🔔 TAB ACTIVATED:", targetId);

                // ✅ FIX: When detail-info (login/register) tab activates, ensure register tab is shown
                if (targetId === "detail-info" || targetId === "kc_register") {
                  // Use retry logic to wait for KiviCare to fully initialize the login/register tabs
                  var attempts = 0;
                  var maxAttempts = 10;

                  function tryActivateRegisterTab() {
                    attempts++;
                    console.log(
                      "📝 Attempting to activate register tab (attempt " +
                        attempts +
                        "/" +
                        maxAttempts +
                        ")"
                    );

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
                      $registerTabLink.first().trigger("click");

                      // Also trigger Bootstrap tab events if they exist
                      if (typeof bootstrap !== "undefined" && bootstrap.Tab) {
                        try {
                          var tab = new bootstrap.Tab($registerTabLink[0]);
                          tab.show();
                        } catch (e) {
                          console.log(
                            "   Bootstrap Tab not available:",
                            e.message
                          );
                        }
                      }

                      // Wait for reCAPTCHA to initialize
                      setTimeout(function () {
                        // Check if reCAPTCHA loaded
                        if (
                          typeof grecaptcha !== "undefined" &&
                          typeof grecaptcha.render === "function"
                        ) {
                          // console.log(
                          //   "   🔐 reCAPTCHA available, checking if it needs initialization"
                          // );

                          // Look for reCAPTCHA container
                          var $recaptchaContainer = $(
                            "#kc_register .g-recaptcha, #kc_register [data-sitekey]"
                          );
                          if (
                            $recaptchaContainer.length > 0 &&
                            $recaptchaContainer.children().length === 0
                          ) {
                            // console.log(
                            //   "   🔄 Initializing reCAPTCHA manually"
                            // );
                            try {
                              var sitekey =
                                $recaptchaContainer.attr("data-sitekey");
                              if (sitekey) {
                                grecaptcha.render($recaptchaContainer[0], {
                                  sitekey: sitekey,
                                });
                                // console.log(
                                //   "   ✅ reCAPTCHA initialized successfully"
                                // );
                              }
                            } catch (e) {
                              // console.log(
                              //   "   ⚠️ reCAPTCHA initialization error:",
                              //   e.message
                              // );
                            }
                          } else {
                            // console.log(
                            //   "   ℹ️ reCAPTCHA already initialized or no container found"
                            // );
                          }
                        } else {
                          // console.log("   ⚠️ reCAPTCHA not loaded on page");
                        }
                      }, 500);
                    } else if (attempts < maxAttempts) {
                      // Tab not found yet, retry
                      // console.log(
                      //   "   ⏳ Register tab not found yet, retrying in 200ms..."
                      // );
                      setTimeout(tryActivateRegisterTab, 200);
                    } else {
                      // Max attempts reached, use fallback
                      // console.log(
                      //   "   ⚠️ Max attempts reached, using fallback method"
                      // );
                      $("#kc_register")
                        .addClass("active show")
                        .css("display", "block");
                      $("#kc_login")
                        .removeClass("active show")
                        .css("display", "none");

                      // Try to initialize reCAPTCHA even with fallback
                      setTimeout(function () {
                        if (typeof grecaptcha !== "undefined") {
                          $(".g-recaptcha").each(function () {
                            if ($(this).children().length === 0) {
                              var sitekey = $(this).attr("data-sitekey");
                              if (sitekey) {
                                try {
                                  grecaptcha.render(this, { sitekey: sitekey });
                                } catch (e) {}
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
                  // console.log(
                  //   "⚠️ BLOCKING AUTO-ADVANCE - Language not selected!"
                  // );
                  // console.log("   Current tab:", targetId);
                  // console.log("   Redirecting to language tab...");

                  // Remove active from this tab
                  $target.removeClass("active");

                  // Activate language tab instead
                  setTimeout(function () {
                    $(".iq-tab-pannel").removeClass("active");
                    $("#language").addClass("active");

                    // Also activate the language tab link
                    $(".tab-link, .tab-item a").removeClass("active");
                    var $languageTabLink = $(
                      'a[href="#language"], #language-tab'
                    );
                    $languageTabLink.addClass("active");
                    $languageTabLink
                      .closest(".tab-item, li")
                      .addClass("active");

                    // console.log("✅ Redirected to language tab");
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
      $(document).on(
        "click",
        ".tab-link, .tab-item a, a[href^='#']",
        function () {
          var href = $(this).attr("href");
          if (href && href.startsWith("#")) {
            var targetId = href.replace("#", "");

            // Wait a bit for the tab to actually activate
            setTimeout(function () {
              var $targetPanel = $("#" + targetId);
              if (
                $targetPanel.hasClass("iq-tab-pannel") &&
                $targetPanel.hasClass("active")
              ) {
                window.MC_LAST_ACTIVE_TAB = targetId;
              }
            }, 50);
          }
        }
      );
    },

    /**
     * ✅ CRITICAL: Skip doctor tab when navigating from date-time to detail-info
     * This fixes the issue where selecting a time slot shows wrong active tab
     */
    skipDoctorTabNavigation: function () {
      var self = this;

      // Watch for when doctor tab tries to become active
      if (typeof MutationObserver !== "undefined") {
        var doctorTabObserver = new MutationObserver(function (mutations) {
          mutations.forEach(function (mutation) {
            if (mutation.attributeName === "class") {
              var $target = $(mutation.target);
              var targetId = $target.attr("id");

              // If doctor tab is trying to become active, skip it
              if (targetId === "doctor" && $target.hasClass("active")) {
                // console.log(
                //   "🚫 SKIPPING hidden doctor tab, finding next tab in sequence"
                // );

                // Remove active from doctor tab
                $target.removeClass("active");

                // Find the NEXT tab in the widget order (not hardcoded)
                setTimeout(function () {
                  // Get all tab links in order
                  var $allTabLinks = $(".tab-item a, .tab-link");
                  var doctorTabIndex = -1;
                  var nextTabHref = null;

                  // Find the doctor tab index
                  $allTabLinks.each(function (index) {
                    var href = $(this).attr("href");
                    if (href === "#doctor") {
                      doctorTabIndex = index;
                    }
                  });

                  // Get the next tab after doctor
                  if (
                    doctorTabIndex >= 0 &&
                    doctorTabIndex < $allTabLinks.length - 1
                  ) {
                    var $nextTabLink = $allTabLinks.eq(doctorTabIndex + 1);
                    nextTabHref = $nextTabLink.attr("href");
                    console.log("✅ Next tab after doctor:", nextTabHref);

                    // Activate the next tab
                    var nextTabId = nextTabHref.replace("#", "");
                    $("#" + nextTabId).addClass("active");

                    // Update sidebar
                    $(".tab-link, .tab-item a").removeClass("active");
                    $nextTabLink.addClass("active");
                    $nextTabLink.closest(".tab-item, li").addClass("active");

                    console.log("✅ Jumped to next tab:", nextTabId);
                  } else {
                    // Fallback to detail-info if we can't find next tab
                    console.log(
                      "⚠️ Could not find next tab, using detail-info"
                    );
                    $("#detail-info, #kc_detail_info").addClass("active");

                    $(".tab-link, .tab-item a").removeClass("active");
                    var $detailTabLink = $(
                      'a[href="#detail-info"], a[href="#kc_detail_info"], #detail-info-tab'
                    );
                    $detailTabLink.addClass("active");
                    $detailTabLink.closest(".tab-item, li").addClass("active");
                  }
                }, 10);
              }
            }
          });
        });

        // Observe the doctor panel (if it exists in DOM even though hidden)
        var $doctorPanel = $("#doctor");
        if ($doctorPanel.length > 0) {
          doctorTabObserver.observe($doctorPanel[0], {
            attributes: true,
            attributeFilter: ["class"],
          });
        }

        // Also try to find it after a delay in case it's added dynamically
        setTimeout(function () {
          var $doctorPanel = $("#doctor");
          if ($doctorPanel.length > 0) {
            doctorTabObserver.observe($doctorPanel[0], {
              attributes: true,
              attributeFilter: ["class"],
            });
          }
        }, 1000);
      }

      // ✅ ADDITIONAL FIX: Intercept clicks on "Next" button in date-time tab
      $(document).on(
        "click",
        "#date-time .iq-next-btn, #date-time .widget-next-btn, #date-time button[type='submit']",
        function (e) {
          console.log("⏭️ Next button clicked on date-time tab");

          // Small delay to let KiviCare process, then check if doctor tab became active
          setTimeout(function () {
            // Debug: Log current active tab
            var $activeTab = $(".iq-tab-pannel.active");
            console.log("📍 Active tab after delay:", $activeTab.attr("id"));

            // Debug: Log all available tabs
            console.log("📋 All tabs in sidebar:");
            $(".tab-item a, .tab-link").each(function (index) {
              console.log(
                "  " + index + ":",
                $(this).attr("href"),
                $(this).text().trim()
              );
            });

            var $doctorTab = $("#doctor");
            console.log("🔍 Doctor tab exists:", $doctorTab.length > 0);
            console.log(
              "🔍 Doctor tab has active class:",
              $doctorTab.hasClass("active")
            );

            if ($doctorTab.hasClass("active")) {
              console.log(
                "🚫 Doctor tab activated, finding next tab in sequence"
              );

              // Deactivate doctor tab
              $doctorTab.removeClass("active");

              // Find the NEXT tab after doctor (not hardcoded)
              var $allTabLinks = $(".tab-item a, .tab-link");
              var doctorTabIndex = -1;

              // Find the doctor tab index
              $allTabLinks.each(function (index) {
                var href = $(this).attr("href");
                if (href === "#doctor") {
                  doctorTabIndex = index;
                }
              });

              // Get the next tab after doctor
              if (
                doctorTabIndex >= 0 &&
                doctorTabIndex < $allTabLinks.length - 1
              ) {
                var $nextTabLink = $allTabLinks.eq(doctorTabIndex + 1);
                var nextTabHref = $nextTabLink.attr("href");
                var nextTabId = nextTabHref.replace("#", "");

                console.log("✅ Activating next tab:", nextTabId);

                // Activate the next tab
                $("#" + nextTabId).addClass("active");

                // Update sidebar
                $(".tab-link, .tab-item a").removeClass("active");
                $nextTabLink.addClass("active");
                $nextTabLink.closest(".tab-item, li").addClass("active");
              } else {
                // Fallback to detail-info
                console.log("⚠️ Using fallback: detail-info");
                $("#detail-info, #kc_detail_info").addClass("active");

                $(".tab-link, .tab-item a").removeClass("active");
                var $detailTabLink = $(
                  'a[href="#detail-info"], a[href="#kc_detail_info"], #detail-info-tab'
                );
                $detailTabLink.addClass("active");
                $detailTabLink.closest(".tab-item, li").addClass("active");
              }
            } else {
              console.log(
                "ℹ️ Doctor tab did NOT become active - KiviCare skipped it automatically"
              );
              console.log(
                "   This means KiviCare is handling tab skipping, not our code"
              );

              // ✅ CRITICAL FIX: Check if KiviCare jumped to detail-info, skipping extra data
              if (
                $activeTab.attr("id") === "detail-info" ||
                $activeTab.attr("id") === "kc_detail_info"
              ) {
                // Check if file-uploads-custom (extra data) tab exists
                var $extraDataTab = $("#file-uploads-custom");
                if ($extraDataTab.length > 0) {
                  console.log("🔄 REDIRECTING to skipped extra data tab");

                  // Deactivate detail-info
                  $activeTab.removeClass("active");

                  // Activate extra data tab
                  $extraDataTab.addClass("active");

                  // Update sidebar
                  $(".tab-link, .tab-item a").removeClass("active");
                  var $extraDataLink = $('a[href="#file-uploads-custom"]');
                  $extraDataLink.addClass("active");
                  $extraDataLink.closest(".tab-item, li").addClass("active");

                  console.log("✅ Redirected to: file-uploads-custom");
                } else {
                  console.log(
                    "ℹ️ No extra data tab found - staying on detail-info"
                  );
                }
              }
            }
          }, 100);
        }
      );

      // ✅ ALSO: Watch for when detail-info actually becomes active and ensure sidebar matches
      $(document).on(
        "DOMSubtreeModified",
        "#detail-info, #kc_detail_info",
        function () {
          var $this = $(this);
          if ($this.hasClass("active")) {
            // Make sure sidebar reflects this
            setTimeout(function () {
              $(".tab-link, .tab-item a").removeClass("active");
              var $detailTabLink = $(
                'a[href="#detail-info"], a[href="#kc_detail_info"], #detail-info-tab'
              );
              if (!$detailTabLink.hasClass("active")) {
                $detailTabLink.addClass("active");
                $detailTabLink.closest(".tab-item, li").addClass("active");
              }
            }, 50);
          }
        }
      );
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
      if (typeof MutationObserver !== "undefined") {
        var categoryObserver = new MutationObserver(function (mutations) {
          mutations.forEach(function (mutation) {
            if (
              mutation.type === "attributes" &&
              mutation.attributeName === "class"
            ) {
              var $target = $(mutation.target);
              if (
                $target.attr("id") === "category" &&
                $target.hasClass("active")
              ) {
                console.log(
                  "🔙 CATEGORY PANEL BECAME ACTIVE (via back button or click)"
                );
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
                sessionStorage.setItem(
                  "mc_language_tab_allowed_by_kivicare",
                  "false"
                );
                sessionStorage.setItem("mc_language_tab_clicked", "false");

                self.logState("AFTER clearing language data");
              }
            }
          });
        });

        // Start observing the category panel
        var $categoryPanel = $("#category");
        if ($categoryPanel.length > 0) {
          categoryObserver.observe($categoryPanel[0], {
            attributes: true,
            attributeFilter: ["class"],
          });
        } else {
          // If panel doesn't exist yet, try again after a delay
          setTimeout(function () {
            var $categoryPanel = $("#category");
            if ($categoryPanel.length > 0) {
              categoryObserver.observe($categoryPanel[0], {
                attributes: true,
                attributeFilter: ["class"],
              });
            }
          }, 1000);
        }
      }

      // Also handle direct clicks (for manual tab switching)
      $(document).on(
        "click",
        'a[href="#category"], #category-tab',
        function () {
          console.log(
            "Medico Contigo: Category tab clicked - clearing language data"
          );

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
          sessionStorage.setItem(
            "mc_language_tab_allowed_by_kivicare",
            "false"
          );
          sessionStorage.setItem("mc_language_tab_clicked", "false");
        }
      );

      // Listen for service checkbox changes
      $(document).on("change", ".card-checkbox.selected-service", function () {
        if ($(this).is(":checked")) {
          var serviceId = $(this).attr("service_id") || $(this).val();
          // console.log("✅ SERVICE SELECTED (checkbox):", serviceId);

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
              // console.log("✅ SERVICE SELECTED (label click):", serviceId);

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

      // ✅ DISABLE Next button until language is selected and doctor is assigned
      $("#language .iq-next-btn, #language .widget-next-btn")
        .prop("disabled", true)
        .css({
          opacity: "0.5",
          cursor: "not-allowed",
          "pointer-events": "none",
        });

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

        // console.log("🌐 LANGUAGE SELECTED:", langName, "(" + langCode + ")");

        // Visual feedback
        $(".mc-language-card").removeClass("selected");
        $(this).addClass("selected");

        // Store selection
        self.selectedLanguage = langCode;
        $("#mc-selected-language").val(langCode);

        self.logState("AFTER language selection");

        // ✅ CRITICAL: Set flag to block navigation
        self.doctorAssignmentInProgress = true;
        // console.log("🚫 NAVIGATION BLOCKED - Doctor assignment in progress");

        // ✅ CRITICAL: DISABLE Next button immediately and add loading state
        var $nextBtn = $("#language .iq-next-btn, #language .widget-next-btn");
        var originalText = $nextBtn.first().text();

        // Store original text for restoration
        $nextBtn.data("original-text", originalText);

        // Disable with multiple layers of protection
        $nextBtn
          .prop("disabled", true)
          .attr("disabled", "disabled")
          .addClass("mc-loading")
          .css({
            opacity: "0.5",
            cursor: "not-allowed",
            "pointer-events": "none",
          })
          .html("🔄 Asignando médico... / Assigning doctor...");

        // ✅ Add event blocker to prevent ANY clicks during loading
        $nextBtn
          .off("click.loadingBlock")
          .on("click.loadingBlock", function (e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log(
              "⚠️ Button click blocked - doctor assignment in progress"
            );
            return false;
          });

        // ✅ NOW auto-assign doctor based on service + language
        if (self.selectedService && self.selectedLanguage) {
          // console.log(
          //   "🔄 Auto-assigning doctor for service:",
          //   self.selectedService,
          //   "language:",
          //   self.selectedLanguage
          // );
          self.autoSelectDoctor(
            self.selectedService,
            self.selectedLanguage,
            function (success) {
              // Remove loading blocker
              $nextBtn.off("click.loadingBlock");

              // Restore button text
              var restoredText = $nextBtn.data("original-text") || originalText;
              $nextBtn.html(restoredText);

              if (success) {
                // ✅ CLEAR flag - navigation now allowed
                self.doctorAssignmentInProgress = false;
                console.log("✅ NAVIGATION UNBLOCKED - Doctor assigned");

                // ✅ ENABLE Next button ONLY after successful doctor assignment
                $nextBtn
                  .prop("disabled", false)
                  .removeAttr("disabled")
                  .removeClass("mc-loading")
                  .css({
                    opacity: "1",
                    cursor: "pointer",
                    "pointer-events": "auto",
                  });
                console.log(
                  "✅ Next button ENABLED - Doctor assigned successfully"
                );
              } else {
                // Keep blocked and disabled if doctor assignment failed
                self.doctorAssignmentInProgress = false; // Allow retry
                $nextBtn.html("❌ Error - Please contact support");
                console.log(
                  "⚠️ Next button remains DISABLED - Doctor assignment failed"
                );
              }
            }
          );
        }
      });
    },

    /**
     * ✅ NUCLEAR OPTION: Enforce language tab lock during doctor assignment
     * Watches for ANY tab change and forces back to language if doctor not assigned
     */
    enforceLanguageTabLock: function () {
      var self = this;

      if (typeof MutationObserver === "undefined") {
        return; // Browser doesn't support MutationObserver
      }

      var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          if (mutation.attributeName === "class") {
            var $target = $(mutation.target);

            // Check if a NON-language tab just became active
            if (
              $target.hasClass("iq-tab-pannel") &&
              $target.hasClass("active")
            ) {
              var tabId = $target.attr("id");

              // If doctor assignment is in progress and user tries to leave language tab
              if (
                self.doctorAssignmentInProgress &&
                tabId !== "language" &&
                tabId !== "category"
              ) {
                console.log(
                  "🚫 BLOCKING UNAUTHORIZED TAB CHANGE to:",
                  tabId,
                  "- Doctor assignment in progress!"
                );

                // Force back to language tab
                setTimeout(function () {
                  // Deactivate the unauthorized tab
                  $target.removeClass("active");

                  // Activate language tab
                  $("#language").addClass("active");

                  // Update sidebar
                  $(".tab-link, .tab-item a").removeClass("active");
                  var $languageTabLink = $(
                    'a[href="#language"], #language-tab'
                  );
                  $languageTabLink.addClass("active");
                  $languageTabLink.closest(".tab-item, li").addClass("active");

                  // Show alert (debounced to prevent duplicates)
                  self.showWaitAlert();
                }, 10);
              }
            }
          }
        });
      });

      // Observe all tab panels
      $(".iq-tab-pannel").each(function () {
        observer.observe(this, {
          attributes: true,
          attributeFilter: ["class"],
        });
      });

      // Also observe the parent container in case tabs are added dynamically
      var $container = $(".iq-tab-pannel").parent();
      if ($container.length > 0) {
        observer.observe($container[0], {
          childList: true,
          subtree: true,
        });
      }
    },

    /**
     * Intercept tab navigation to ensure language is selected
     */
    interceptTabNavigation: function () {
      var self = this;

      // ✅ FIX: Intercept "Next" button clicks from CATEGORY tab (Step 1)
      // This ensures language cards are rendered when navigating to Step 2 with a saved service
      $(document).on(
        "click",
        "#category .iq-next-btn, #category .widget-next-btn, #category .iq-button[data-step='next'], #category button[type='submit']:not([data-step='prev'])",
        function (e) {
          console.log("⏭️ NEXT BUTTON CLICKED on category tab (Step 1)");

          // Check if a service is already selected (from previous navigation)
          if (!self.selectedService) {
            // No service selected at all - block and show alert
            console.log("⚠️ No service selected - BLOCKING navigation");
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            alert(
              "Por favor, selecciona un servicio.\n\nPlease select a service."
            );
            return false;
          }

          // Service is selected but user didn't re-select it
          // KiviCare might try to skip language tab, so we need to force navigation to it
          console.log("✅ Service is selected:", self.selectedService);
          console.log("   Preventing KiviCare from skipping language tab...");

          // ✅ CRITICAL: Prevent KiviCare's default navigation
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          // ✅ MANUALLY navigate to language tab
          console.log("🔄 Manually activating language tab...");

          // Deactivate all tabs
          $(".iq-tab-pannel").removeClass("active");

          // Activate language tab
          var $languagePanel = $("#language");
          $languagePanel.addClass("active");

          // Update sidebar
          $(".tab-link, .tab-item a").removeClass("active");
          var $languageTabLink = $('a[href="#language"], #language-tab');
          $languageTabLink.addClass("active");
          $languageTabLink.closest(".tab-item, li").addClass("active");

          // Mark language tab as available
          sessionStorage.setItem("mc_language_tab_allowed_by_kivicare", "true");

          console.log("✅ Language tab manually activated");

          // Now render language cards with the saved service
          setTimeout(function () {
            console.log("🔄 Checking if language cards need to be rendered...");

            var $languageCards = $("#mc-language-cards");
            if (
              $languageCards.length === 0 ||
              $languageCards.children().length === 0 ||
              $languageCards.children(".mc-language-card").length === 0
            ) {
              console.log("⚠️ Language cards not rendered, triggering render with saved service:", self.selectedService);

              // Re-trigger language card loading with the saved service
              self.loadLanguagesForTab();
            } else {
              console.log("✅ Language cards already rendered:", $languageCards.children(".mc-language-card").length, "cards");
            }
          }, 300);

          return false;
        }
      );

      // ✅ FIX: Intercept "Next" button clicks from language tab with HIGHEST PRIORITY
      $(document).on(
        "click",
        "#language .iq-next-btn, #language .widget-next-btn, #language .iq-button[data-step='next'], #language button[type='submit']",
        function (e) {
          // Skip if this is a back button
          if (
            $(this).attr("data-step") === "prev" ||
            $(this).attr("id") === "iq-widget-back-button-language"
          ) {
            return; // Let the back button handler deal with it
          }

          console.log("⏭️ NEXT BUTTON CLICKED on language tab");

          self.logState("Next button on language tab");

          // ✅ VALIDATION 1: Check if language is selected
          if (!self.selectedLanguage) {
            console.log("⚠️ No language selected - BLOCKING navigation");
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            alert(
              "Por favor, selecciona un idioma antes de continuar.\n\nPlease select a language before continuing."
            );
            return false;
          }

          // ✅ VALIDATION 2: Check if doctor has been assigned
          if (!window.MC_SELECTED_DOCTOR) {
            console.log("⚠️ Doctor not yet assigned - BLOCKING navigation");
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            self.showWaitAlert();
            return false;
          }

          // ✅ VALIDATION 3: Verify doctor/clinic data is set
          if (
            !window.bookAppointmentWidgetData?.doctor_id ||
            !window.bookAppointmentWidgetData?.clinic_id
          ) {
            // console.log("⚠️ Doctor/clinic data not properly set - BLOCKING navigation");
            // console.log("Doctor ID:", window.bookAppointmentWidgetData?.doctor_id);
            // console.log("Clinic ID:", window.bookAppointmentWidgetData?.clinic_id);
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            alert(
              "❌ Error: Datos del médico no configurados. Por favor, intenta de nuevo.\n\n❌ Error: Doctor data not set. Please try again."
            );
            return false;
          }

          // ✅ ALL VALIDATIONS PASSED - Now prevent default and proceed
          // console.log("✅ All validations passed - proceeding to next tab");
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          // ✅ CRITICAL: Re-enforce doctor before navigating to date-time
          if (window.MC_SELECTED_DOCTOR) {
            // ✅ FIX: Ensure clinic_id is set
            var clinicId =
              window.bookAppointmentWidgetData?.preselected_clinic_id ||
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
            self.injectDoctorIntoBookingData(
              window.MC_SELECTED_DOCTOR,
              clinicId
            );
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

        $allTabLinks.each(function (index) {
          var href = $(this).attr("href");
          if (href === "#" + currentTabId) {
            currentIndex = index;
          }
          if (href === targetTab) {
            targetIndex = index;
          }
        });

        // Allow clicking on previous tabs (going backwards)
        if (
          targetIndex >= 0 &&
          currentIndex >= 0 &&
          targetIndex < currentIndex
        ) {
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
    injectDoctorIntoBookingData: function (doctorId, clinicId) {
      // ✅ FIX: Create bookAppointmentWidgetData if it doesn't exist
      if (typeof window.bookAppointmentWidgetData === "undefined") {
        console.warn(
          "⚠️ bookAppointmentWidgetData doesn't exist, creating it..."
        );
        window.bookAppointmentWidgetData = {};
      }

      // ✅ FIX: Ensure clinic_id is set (use parameter, or get from widget data, or default to 1)
      if (!clinicId) {
        clinicId =
          window.bookAppointmentWidgetData.preselected_clinic_id ||
          window.bookAppointmentWidgetData.clinic_id ||
          window.MC_SELECTED_CLINIC ||
          1;
      }

      // CRITICAL: Set all doctor-related properties
      window.bookAppointmentWidgetData.doctor_id = doctorId;
      window.bookAppointmentWidgetData.appointment_doctor_id = doctorId;
      window.bookAppointmentWidgetData.selectedDoctor = doctorId;
      window.bookAppointmentWidgetData.preselected_doctor = String(doctorId); // Must be STRING!

      // ✅ CRITICAL: Ensure clinic_id is also set
      window.bookAppointmentWidgetData.clinic_id = clinicId;
      window.bookAppointmentWidgetData.preselected_clinic_id = String(clinicId);
      window.bookAppointmentWidgetData.preselected_single_clinic_id = true;

      // ✅ CRITICAL: Force boolean TRUE (not string "true", not 1, but actual boolean)
      window.bookAppointmentWidgetData.preselected_single_doctor_id = true;

      // console.log("✅ Injected into bookAppointmentWidgetData:", {
      //   doctor_id: window.bookAppointmentWidgetData.doctor_id,
      //   clinic_id: window.bookAppointmentWidgetData.clinic_id,
      //   preselected_doctor: window.bookAppointmentWidgetData.preselected_doctor,
      //   preselected_single_doctor_id: window.bookAppointmentWidgetData.preselected_single_doctor_id
      // });
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
      var attemptLoad = function (attempt) {
        attempt = attempt || 1;

        if (typeof window.kcAppointmentBookJsContent === "function") {
          try {
            // Re-initialize the widget's date-time tab with the doctor set
            window.kcAppointmentBookJsContent(containerSelector);

            // Verify it worked by checking if the internal functions now exist
            setTimeout(function () {
              if (typeof window.kivicareGetDoctorWeekday !== "function") {
                self.manualDateTimeLoad();
              }
            }, 500);
          } catch (e) {
            // Error calling kcAppointmentBookJsContent
          }
        } else if (attempt < 5) {
          // Retry up to 5 times with 200ms delay
          setTimeout(function () {
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
    manualDateTimeLoad: function () {
      if (!window.MC_SELECTED_DOCTOR || !window.bookAppointmentWidgetData) {
        return;
      }

      // ✅ FIX: Ensure clinic_id is properly retrieved
      var clinicId =
        window.bookAppointmentWidgetData.preselected_clinic_id ||
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
          $(containerSelector + " #doctor-datepicker-loader").addClass(
            "d-none"
          );
        },
        error: function (xhr, status, error) {
          $(containerSelector + " #doctor-datepicker-loader").addClass(
            "d-none"
          );
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
     * ✅ Lock doctor and clinic selection to prevent KiviCare from overriding it
     */
    lockDoctorSelection: function (doctorId, clinicId) {
      var self = this;

      // Get clinic_id if not provided
      if (!clinicId) {
        clinicId =
          window.MC_SELECTED_CLINIC ||
          window.bookAppointmentWidgetData?.clinic_id ||
          1;
      }

      // Monitor and enforce doctor and clinic values every 100ms
      if (self.doctorLockInterval) {
        clearInterval(self.doctorLockInterval);
      }

      self.doctorLockInterval = setInterval(function () {
        // Check traditional doctor form fields
        var $doctorFields = $(
          "input[name='doctor_id'], input[name='appointment_doctor_id'], #selected_doctor_id, #doctor_id"
        );

        $doctorFields.each(function () {
          var currentVal = $(this).val();
          if (currentVal != doctorId && currentVal !== "") {
            $(this).val(doctorId);
          }
        });

        // Check clinic form fields
        var $clinicFields = $("input[name='clinic_id'], #clinic_id");
        $clinicFields.each(function () {
          var currentVal = $(this).val();
          if (currentVal != clinicId && currentVal !== "") {
            $(this).val(clinicId);
          }
        });

        // Also re-inject into bookAppointmentWidgetData every cycle
        if (window.bookAppointmentWidgetData) {
          if (
            window.bookAppointmentWidgetData.preselected_doctor !=
              String(doctorId) ||
            window.bookAppointmentWidgetData.preselected_single_doctor_id !==
              true ||
            window.bookAppointmentWidgetData.clinic_id != clinicId
          ) {
            window.bookAppointmentWidgetData.doctor_id = doctorId;
            window.bookAppointmentWidgetData.appointment_doctor_id = doctorId;
            window.bookAppointmentWidgetData.selectedDoctor = doctorId;
            window.bookAppointmentWidgetData.preselected_doctor =
              String(doctorId);
            // Force boolean true
            window.bookAppointmentWidgetData.preselected_single_doctor_id =
              Boolean(true);
            // Also lock clinic_id
            window.bookAppointmentWidgetData.clinic_id = clinicId;
            window.bookAppointmentWidgetData.preselected_clinic_id =
              String(clinicId);
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

    autoSelectDoctor: function (serviceId, language, callback) {
      var self = this;

      // ✅ FIX: Get clinic_id to pass to backend
      var clinicId =
        window.bookAppointmentWidgetData?.preselected_clinic_id ||
        window.bookAppointmentWidgetData?.clinic_id ||
        $("input[name='clinic_id']").val() ||
        1;

      $.ajax({
        url: ajax_object.ajax_url,
        type: "POST",
        data: {
          action: "mc_get_first_available_doctor",
          service_id: serviceId,
          language: language || "",
          clinic_id: clinicId,
        },
        success: function (response) {
          if (response.success && response.data && response.data.doctor_id) {
            var doctorId = response.data.doctor_id;
            var doctorName = response.data.doctor_name || "Doctor #" + doctorId;
            var returnedClinicId = response.data.clinic_id || clinicId;

            self.selectedDoctor = doctorId;

            // ✅ CRITICAL: Set global variables FIRST
            window.MC_SELECTED_DOCTOR = doctorId;
            window.MC_SELECTED_DOCTOR_NAME = doctorName;
            window.MC_SELECTED_CLINIC = returnedClinicId;

            // ✅ CRITICAL: Inject into KiviCare's bookAppointmentWidgetData BEFORE anything else
            self.injectDoctorIntoBookingData(doctorId, returnedClinicId);

            // ✅ CRITICAL: Set doctor in ALL possible field names
            $("input[name='doctor_id']").val(doctorId);
            $("input[name='appointment_doctor_id']").val(doctorId);
            $("#selected_doctor_id").val(doctorId);
            $("#doctor_id").val(doctorId);
            $(".selected-doctor").val(doctorId);

            // ✅ CRITICAL: Also set clinic_id in all possible field names
            $("input[name='clinic_id']").val(returnedClinicId);
            $("#clinic_id").val(returnedClinicId);

            // Store in KiviCare globals
            if (typeof window.kiviCareBooking !== "undefined") {
              window.kiviCareBooking.selectedDoctor = doctorId;
              window.kiviCareBooking.clinic_id = returnedClinicId;
            }

            // ✅ LOG SELECTED DOCTOR INFO (AFTER setting values)
            // console.log("========================================");
            // console.log("👨‍⚕️ DOCTOR AUTO-SELECTED");
            // console.log("Doctor ID:", doctorId);
            // console.log("Doctor Name:", doctorName);
            // console.log("Language:", language);
            // console.log("Service ID:", serviceId);
            // console.log("Clinic ID:", returnedClinicId);
            // console.log("---");
            // console.log("📊 DATABASE INFO:");
            // if (response.data.debug) {
            //   console.log("Session count:", response.data.debug.session_count);
            //   console.log("Sessions:", response.data.debug.sessions);
            //   console.log("Doctor-Clinic mapping:", response.data.debug.doctor_clinic_mapping);
            // }
            // console.log("---");
            // console.log("🔍 VERIFICATION (AFTER injection):");
            // console.log("bookAppointmentWidgetData exists:", typeof window.bookAppointmentWidgetData !== "undefined");
            // console.log("bookAppointmentWidgetData.doctor_id:", window.bookAppointmentWidgetData?.doctor_id);
            // console.log("bookAppointmentWidgetData.clinic_id:", window.bookAppointmentWidgetData?.clinic_id);
            // console.log("bookAppointmentWidgetData.preselected_doctor:", window.bookAppointmentWidgetData?.preselected_doctor);
            // console.log("bookAppointmentWidgetData.preselected_single_doctor_id:", window.bookAppointmentWidgetData?.preselected_single_doctor_id);
            // console.log("input[name='doctor_id']:", $("input[name='doctor_id']").val());
            // console.log("input[name='clinic_id']:", $("input[name='clinic_id']").val());
            // console.log("window.MC_SELECTED_DOCTOR:", window.MC_SELECTED_DOCTOR);
            // console.log("window.MC_SELECTED_CLINIC:", window.MC_SELECTED_CLINIC);
            // console.log("========================================");

            // ✅ PROTECTION: Lock the doctor and clinic values to prevent overrides
            self.lockDoctorSelection(doctorId, returnedClinicId);

            // ✅ Call callback with success
            if (typeof callback === "function") {
              callback(true);
            }
          } else {
            // No doctor found
            // console.log(
            //   "⚠️ No doctor available for this service/language combination"
            // );
            if (typeof callback === "function") {
              callback(false);
            }
          }
        },
        error: function (xhr, status, error) {
          // console.log("❌ Error auto-selecting doctor:", error);
          if (typeof callback === "function") {
            callback(false);
          }
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

    /**
     * ✅ NEW: Disable sidebar tab clicking - force button-only navigation
     * Prevents users from clicking sidebar tabs to navigate
     */
    disableSidebarTabClicking: function () {
      var self = this;

      console.log("🚫 Disabling sidebar tab clicking - navigation only via buttons");

      // Function to block tab clicks
      function blockTabClicks(e) {
        // Get the clicked element
        var $clicked = $(e.target).closest(".tab-link, .tab-item a, a[href^='#']");

        // Check if it's a tab link (not a button)
        if ($clicked.length > 0) {
          var href = $clicked.attr("href");

          // Check if it's a tab navigation link (starts with #)
          if (href && href.startsWith("#")) {
            var targetTabId = href.replace("#", "");

            // Check if it's one of the booking step tabs
            var bookingTabs = ["category", "language", "date-time", "file-uploads-custom", "detail-info", "doctor"];
            if (bookingTabs.indexOf(targetTabId) !== -1) {
              console.log("🚫 BLOCKING sidebar tab click to:", targetTabId);
              console.log("   Users must use Back/Next buttons for navigation");

              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();

              // Show a friendly message
              alert(
                "⚠️ Por favor, usa los botones 'Atrás' y 'Siguiente' para navegar.\n\n⚠️ Please use the 'Back' and 'Next' buttons to navigate."
              );

              return false;
            }
          }
        }
      }

      // Attach in both capture and bubble phases for maximum coverage
      $(document).on("click", ".tab-link, .tab-item a, a[href^='#']", blockTabClicks);

      // Also attach in capture phase using native DOM
      document.addEventListener("click", function(e) {
        var $target = $(e.target);
        var $link = $target.closest(".tab-link, .tab-item a, a[href^='#']");

        if ($link.length > 0) {
          var href = $link.attr("href");
          if (href && href.startsWith("#")) {
            var targetTabId = href.replace("#", "");
            var bookingTabs = ["category", "language", "date-time", "file-uploads-custom", "detail-info", "doctor"];

            if (bookingTabs.indexOf(targetTabId) !== -1) {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              return false;
            }
          }
        }
      }, true); // true = capture phase

      // Visual feedback: Add pointer-events CSS to make it clear tabs aren't clickable
      function addVisualFeedback() {
        $(".tab-link, .tab-item a").each(function() {
          var href = $(this).attr("href");
          if (href && href.startsWith("#")) {
            var targetTabId = href.replace("#", "");
            var bookingTabs = ["category", "language", "date-time", "file-uploads-custom", "detail-info", "doctor"];

            if (bookingTabs.indexOf(targetTabId) !== -1) {
              $(this).css({
                "cursor": "not-allowed",
                "opacity": "0.7"
              });
            }
          }
        });
      }

      // Apply visual feedback immediately and periodically
      addVisualFeedback();
      setInterval(addVisualFeedback, 1000);

      console.log("✅ Sidebar tab clicking disabled - button-only navigation enforced");
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

/**
 * Medico Contigo - Booking Form Customization (Tab-Based)
 * Works with proper language tab structure in KiviCare
 */

(function ($) {
  "use strict";

  console.log("Medico Contigo: Initializing booking customization (Tab-Based)");

  var MC_Booking = {
    selectedLanguage: null,
    selectedService: null,
    selectedDoctor: null,
    initialized: false,

    init: function () {
      if (this.initialized) return;
      this.initialized = true;

      console.log("Medico Contigo: Setting up event listeners");

      // ✅ CRITICAL FIX: Ensure bookAppointmentWidgetData exists and has proper structure
      if (typeof window.bookAppointmentWidgetData !== 'undefined') {
        // Force the flag to be boolean true (not string, not empty)
        if (!window.bookAppointmentWidgetData.preselected_single_doctor_id) {
          window.bookAppointmentWidgetData.preselected_single_doctor_id = false;
        }
        console.log("Medico Contigo: bookAppointmentWidgetData initialized");
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

      console.log("Medico Contigo: Initialization complete");
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
          console.log("Medico Contigo: 📅 Date-time tab clicked");

          setTimeout(function () {
            if (window.MC_SELECTED_DOCTOR) {
              console.log(
                "Medico Contigo: 🔒 Enforcing doctor for date-time tab:",
                window.MC_SELECTED_DOCTOR
              );

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

              console.log(
                "Medico Contigo: ✅ Doctor enforced for date-time, triggered change event"
              );

              // Debug: Check all doctor AND clinic fields
              console.log("Medico Contigo: 🔍 All field values:");
              $("input[name*='doctor'], input[name*='clinic']").each(
                function () {
                  console.log("  -", $(this).attr("name"), "=", $(this).val());
                }
              );

              // Check if clinic is set
              if (!clinicId || clinicId === "0") {
                console.warn(
                  "Medico Contigo: ⚠️ No clinic_id found! Defaulting to clinic_id=1"
                );
                clinicId = 1;
                $("input[name='clinic_id']").val(clinicId);
              } else {
                console.log("Medico Contigo: ✅ Clinic ID:", clinicId);
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
            if (
              $target.attr("id") === "date-time" &&
              $target.hasClass("active")
            ) {
              console.log("Medico Contigo: 📅 Date-time panel became active");

              if (window.MC_SELECTED_DOCTOR) {
                console.log(
                  "Medico Contigo: 🔒 Re-enforcing doctor:",
                  window.MC_SELECTED_DOCTOR
                );

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
    },

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
            console.log(
              "Medico Contigo: 🚀 Intercepting AJAX request, injecting doctor:",
              window.MC_SELECTED_DOCTOR
            );

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

            console.log("Medico Contigo: ✅ Doctor injected into AJAX request");
          }
        }
      });
    },

    /**
     * Listen for service selection in Step 1
     */
    listenForServiceSelection: function () {
      var self = this;

      // Listen for service checkbox changes
      $(document).on("change", ".card-checkbox.selected-service", function () {
        if ($(this).is(":checked")) {
          var serviceId = $(this).attr("service_id") || $(this).val();
          var serviceName = $(this).attr("service_name");

          console.log(
            "Medico Contigo: Service selected:",
            serviceId,
            serviceName
          );
          self.selectedService = serviceId;

          // Allow language tab to be activated (KiviCare will auto-advance to it)
          sessionStorage.setItem("mc_language_tab_allowed_by_kivicare", "true");
          console.log(
            "Medico Contigo: ✅ FLAG SET - Allowing language tab activation after service selection"
          );
          console.log(
            "Medico Contigo: Flag value:",
            sessionStorage.getItem("mc_language_tab_allowed_by_kivicare")
          );

          // ✅ NOTE: Doctor will be auto-assigned AFTER language selection (not here)
          console.log(
            "Medico Contigo: Waiting for language selection before assigning doctor"
          );
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
              console.log("Medico Contigo: Service card clicked:", serviceId);
              self.selectedService = serviceId;

              // Allow language tab to be activated (KiviCare will auto-advance to it)
              sessionStorage.setItem(
                "mc_language_tab_allowed_by_kivicare",
                "true"
              );
              console.log(
                "Medico Contigo: ✅ FLAG SET (label click) - Allowing language tab activation"
              );
              console.log(
                "Medico Contigo: Flag value:",
                sessionStorage.getItem("mc_language_tab_allowed_by_kivicare")
              );
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
          console.log("Medico Contigo: Language tab clicked");

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
          console.log("Medico Contigo: Language tab shown");
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
                console.log(
                  "Medico Contigo: Language panel became visible (MutationObserver)"
                );
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
        console.log(
          "Medico Contigo: Language panel not visible yet, skipping load"
        );
        return;
      }

      // Check if we have a selected service
      if (!this.selectedService) {
        console.warn(
          "Medico Contigo: No service selected, cannot load languages"
        );
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
        console.log("Medico Contigo: Languages already loaded");
        // Hide loader if languages are already there
        $("#mc-language-loader, #language_loader").hide();
        $("#mc-language-cards").css("display", "flex");
        return;
      }

      console.log(
        "Medico Contigo: Loading languages for service:",
        this.selectedService
      );

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
          console.log("Medico Contigo: Language AJAX response:", response);

          // ✅ FIX: FORCE hide loader with inline style
          $("#mc-language-loader, #language_loader")
            .css("display", "none")
            .hide()
            .attr("style", "display: none !important;");

          console.log("Medico Contigo: ✅ Loading spinner forcefully hidden");

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

          console.log("Medico Contigo: Extracted languages:", languages);

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

            console.log(
              "Medico Contigo: ✅ " +
                languages.length +
                " language cards displayed"
            );
          } else {
            console.warn("Medico Contigo: No languages found");
            $("#mc-language-cards")
              .html(
                '<p style="text-align: center; padding: 40px; color: #999;">No languages configured for this service.</p>'
              )
              .css("display", "block")
              .fadeIn(300);
          }
        },
        error: function (xhr, status, error) {
          console.error("Medico Contigo: AJAX error:", error);

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

        console.log("Medico Contigo: Language selected:", langCode, langName);

        // Visual feedback
        $(".mc-language-card").removeClass("selected");
        $(this).addClass("selected");

        // Store selection
        self.selectedLanguage = langCode;
        $("#mc-selected-language").val(langCode);

        // ✅ NOW auto-assign doctor based on service + language
        if (self.selectedService && self.selectedLanguage) {
          console.log(
            "Medico Contigo: ⭐ Auto-assigning doctor for service:",
            self.selectedService,
            "language:",
            self.selectedLanguage
          );
          self.autoSelectDoctor(self.selectedService, self.selectedLanguage);
        }

        // Enable next button
        $("#language .iq-next-btn, #language .widget-next-btn")
          .prop("disabled", false)
          .css("opacity", "1");

        console.log(
          "Medico Contigo: ✅ Language selection complete, Next button enabled"
        );
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
          console.log("Medico Contigo: Next button clicked from language tab");

          // ALWAYS prevent default form submission behavior
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          if (!self.selectedLanguage) {
            console.warn(
              "Medico Contigo: ❌ Language not selected, blocking navigation"
            );
            alert(
              "Por favor, selecciona un idioma antes de continuar.\n\nPlease select a language before continuing."
            );
            return false;
          }

          console.log(
            "Medico Contigo: ✅ Language selected, navigating to next step"
          );

          // ✅ CRITICAL: Re-enforce doctor before navigating to date-time
          if (window.MC_SELECTED_DOCTOR) {
            console.log(
              "Medico Contigo: 🔒 Re-enforcing doctor before date-time tab:",
              window.MC_SELECTED_DOCTOR
            );

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

            console.log(
              "Medico Contigo: ✅ All doctor fields set to:",
              window.MC_SELECTED_DOCTOR
            );
            console.log(
              "Medico Contigo: ✅ All clinic fields set to:",
              clinicId
            );

            // Debug: Show all doctor-related fields
            $("input[name*='doctor'], input[name*='clinic']").each(function () {
              console.log(
                "Medico Contigo: Field",
                $(this).attr("name"),
                "=",
                $(this).val()
              );
            });
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
              console.log(
                "Medico Contigo: Found next tab (Method 1):",
                $nextTabLink.attr("href")
              );
              $nextTabLink.trigger("click");
              nextTabActivated = true;
            }
          }

          // Method 2: Find datetime tab directly (fallback)
          if (!nextTabActivated) {
            var $datetimeTab = $('a[href="#datetime"], #datetime-tab');
            if ($datetimeTab.length > 0) {
              console.log(
                "Medico Contigo: Found datetime tab (Method 2 - direct)"
              );
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
              console.log(
                "Medico Contigo: Found next tab (Method 3):",
                $nextTab.attr("href")
              );
              $nextTab.trigger("click");
              nextTabActivated = true;
            }
          }

          if (!nextTabActivated) {
            console.error(
              "Medico Contigo: ❌ Could not find next tab to activate!"
            );
          }

          return false;
        }
      );

      // Also intercept direct tab clicks trying to skip language
      $(document).on("click", ".tab-link, .tab-item a", function (e) {
        var targetTab = $(this).attr("href");

        // If trying to go to date-time or later without selecting language
        if (self.selectedService && !self.selectedLanguage) {
          if (
            targetTab &&
            targetTab !== "#category" &&
            targetTab !== "#language"
          ) {
            console.warn(
              "Medico Contigo: ❌ Attempting to skip language tab, blocking"
            );
            e.preventDefault();
            e.stopPropagation();

            // Show language tab instead
            var $languageTab = $('#language-tab, a[href="#language"]');
            if ($languageTab.length > 0) {
              $languageTab.trigger("click");
            }

            return false;
          }
        }
      });

      // ✅ FIX: CRITICAL - Prevent form submission when on language tab (STRONGEST PREVENTION)
      $(document).on("submit", "form", function (e) {
        var $activeTab = $(".iq-tab-pannel.active");
        var isLanguageTabActive = $activeTab.attr("id") === "language";

        if (isLanguageTabActive) {
          console.warn(
            "Medico Contigo: 🚫 BLOCKING form submission - Still on language tab!"
          );
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          if (!self.selectedLanguage) {
            alert(
              "Por favor, selecciona un idioma antes de continuar.\n\nPlease select a language before continuing."
            );
          } else {
            // If language is selected, navigate to next tab instead
            console.log(
              "Medico Contigo: Language selected, navigating instead of submitting"
            );
            $("#language .iq-next-btn, #language .widget-next-btn")
              .first()
              .trigger("click");
          }

          return false;
        }

        // ✅ CRITICAL: Before ANY form submission, inject MC_SELECTED_DOCTOR
        if (window.MC_SELECTED_DOCTOR) {
          console.log(
            "Medico Contigo: 🔒 Injecting MC_SELECTED_DOCTOR into form:",
            window.MC_SELECTED_DOCTOR
          );

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
          console.log(
            "Medico Contigo: ✅ Doctor fields enforced before submission"
          );
        }
      });

      // ✅ FIX: Additional prevention - catch any button clicks inside language tab
      $(document).on("click", "#language button", function (e) {
        var buttonType = $(this).attr("type");

        // If it's a submit button, convert it to navigation
        if (buttonType === "submit" || !buttonType) {
          console.log(
            "Medico Contigo: Button in language tab clicked, preventing submission"
          );
          e.preventDefault();
          e.stopPropagation();

          // Check if language is selected
          if (self.selectedLanguage) {
            console.log(
              "Medico Contigo: Language selected, navigating to next tab"
            );
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
      console.log(
        "Medico Contigo: 🔧 Injecting doctor into bookAppointmentWidgetData:",
        doctorId
      );

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

        console.log(
          "Medico Contigo: ✅ Set doctor in bookAppointmentWidgetData"
        );
        console.log(
          "Medico Contigo: preselected_doctor =",
          window.bookAppointmentWidgetData.preselected_doctor,
          "(type:", typeof window.bookAppointmentWidgetData.preselected_doctor + ")"
        );
        console.log(
          "Medico Contigo: preselected_single_doctor_id =",
          window.bookAppointmentWidgetData.preselected_single_doctor_id,
          "(type:", typeof window.bookAppointmentWidgetData.preselected_single_doctor_id + ")"
        );
        console.log(
          "Medico Contigo: clinic_id =",
          window.bookAppointmentWidgetData.clinic_id
        );
      } else {
        console.warn("Medico Contigo: ⚠️ bookAppointmentWidgetData not found");
      }
    },

    /**
     * ✅ Trigger KiviCare to load date-time content
     */
    triggerDateTimeLoad: function () {
      var self = this;
      console.log("Medico Contigo: 🔄 Triggering date-time content load");

      // Find the widget container (could be #widgetOrders, .kivi-widget, etc.)
      var $widgetContainer = $("#date-time").closest(
        '[id^="widget"], .kivi-widget'
      );
      var containerSelector =
        $widgetContainer.length > 0
          ? "#" + $widgetContainer.attr("id")
          : "#widgetOrders";

      console.log("Medico Contigo: Widget container:", containerSelector);

      // ✅ CRITICAL: Wait for KiviCare to fully initialize
      var attemptLoad = function(attempt) {
        attempt = attempt || 1;

        if (typeof window.kcAppointmentBookJsContent === "function") {
          try {
            // Re-initialize the widget's date-time tab with the doctor set
            console.log("Medico Contigo: Calling kcAppointmentBookJsContent (attempt " + attempt + ")");
            window.kcAppointmentBookJsContent(containerSelector);
            console.log(
              "Medico Contigo: ✅ kcAppointmentBookJsContent('" +
                containerSelector +
                "') called successfully"
            );

            // Verify it worked by checking if the internal functions now exist
            setTimeout(function() {
              if (typeof window.kivicareGetDoctorWeekday !== 'function') {
                console.warn("Medico Contigo: ⚠️ KiviCare didn't initialize properly, trying manual reload");
                self.manualDateTimeLoad();
              } else {
                console.log("Medico Contigo: ✅ KiviCare initialized successfully!");
              }
            }, 500);

          } catch (e) {
            console.warn(
              "Medico Contigo: Error calling kcAppointmentBookJsContent:",
              e
            );
          }
        } else if (attempt < 5) {
          // Retry up to 5 times with 200ms delay
          console.log("Medico Contigo: kcAppointmentBookJsContent not ready, retrying in 200ms... (attempt " + attempt + "/5)");
          setTimeout(function() {
            attemptLoad(attempt + 1);
          }, 200);
        } else {
          console.warn("Medico Contigo: ⚠️ kcAppointmentBookJsContent not found after 5 attempts, using fallback");
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
      console.log("Medico Contigo: 🔧 Using manual date-time loading");

      if (!window.MC_SELECTED_DOCTOR || !window.bookAppointmentWidgetData) {
        console.error("Medico Contigo: ❌ Cannot load date-time: missing doctor or widget data");
        return;
      }

      // ✅ FIX: Ensure clinic_id is properly retrieved
      var clinicId = window.bookAppointmentWidgetData.preselected_clinic_id ||
                     window.bookAppointmentWidgetData.clinic_id ||
                     $("input[name='clinic_id']").val() ||
                     1;

      var containerSelector = "#widgetOrders";

      console.log("Medico Contigo: 🔧 Manual load parameters:");
      console.log("  doctor_id:", window.MC_SELECTED_DOCTOR);
      console.log("  clinic_id:", clinicId);

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
          console.log(
            "Medico Contigo: ✅ Doctor weekdays loaded via manual method:",
            response
          );
          // Hide loader
          $(containerSelector + " #doctor-datepicker-loader").addClass("d-none");
        },
        error: function (xhr, status, error) {
          console.error(
            "Medico Contigo: ❌ Manual AJAX error:",
            error,
            "xhr:", xhr.responseText
          );
          $(containerSelector + " #doctor-datepicker-loader").addClass("d-none");
        },
      });
    },

    /**
     * ✅ DEPRECATED: Old Vue injection (not needed - KiviCare doesn't use Vue)
     */
    injectDoctorIntoVueComponent: function (doctorId) {
      console.log(
        "Medico Contigo: 🔧 Injecting doctor into Vue/React component:",
        doctorId
      );

      // Method 1: Set in window.kiviCareBooking global
      if (typeof window.kiviCareBooking !== "undefined") {
        console.log("Medico Contigo: Found kiviCareBooking object");
        window.kiviCareBooking.doctor_id = doctorId;
        window.kiviCareBooking.selectedDoctor = doctorId;
        window.kiviCareBooking.appointment_doctor_id = doctorId;
        console.log("Medico Contigo: ✅ Set doctor in kiviCareBooking");
      }

      // Method 2: Try to find Vue instance on date-time element
      var $dateTime = $("#date-time");
      if ($dateTime.length > 0 && $dateTime[0].__vue__) {
        console.log("Medico Contigo: Found Vue instance on date-time");
        var vueInstance = $dateTime[0].__vue__;
        if (vueInstance.$data) {
          vueInstance.$data.doctor_id = doctorId;
          vueInstance.$data.selectedDoctor = doctorId;
          console.log("Medico Contigo: ✅ Set doctor in Vue $data");
        }
        if (vueInstance.$set) {
          vueInstance.$set(vueInstance, "doctor_id", doctorId);
          console.log("Medico Contigo: ✅ Used Vue $set for doctor");
        }
      }

      // Method 3: Set in any global Vue app
      if (typeof window.Vue !== "undefined" && window.Vue._instance) {
        console.log("Medico Contigo: Found global Vue instance");
        if (window.Vue._instance.$data) {
          window.Vue._instance.$data.doctor_id = doctorId;
          window.Vue._instance.$data.selectedDoctor = doctorId;
          console.log("Medico Contigo: ✅ Set doctor in global Vue");
        }
      }

      // Method 4: Set in localStorage (some components read from there)
      try {
        localStorage.setItem("kc_selected_doctor", doctorId);
        localStorage.setItem("mc_doctor_id", doctorId);
        console.log("Medico Contigo: ✅ Set doctor in localStorage");
      } catch (e) {
        console.warn("Medico Contigo: Could not set localStorage");
      }

      // Method 5: Dispatch custom events that components might listen to
      var event = new CustomEvent("kcDoctorSelected", {
        detail: { doctor_id: doctorId },
        bubbles: true,
      });
      document.dispatchEvent(event);
      $("#date-time")[0]?.dispatchEvent(event);
      console.log("Medico Contigo: ✅ Dispatched kcDoctorSelected event");

      // Method 6: Try to set via data attributes
      $("#date-time").attr("data-doctor-id", doctorId);
      $("#date-time form").attr("data-doctor-id", doctorId);
      console.log("Medico Contigo: ✅ Set data-doctor-id attributes");
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
            console.warn(
              "Medico Contigo: 🛡️ Prevented doctor override! Restoring:",
              doctorId,
              "(was:",
              currentVal + ")"
            );
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
            console.warn(
              "Medico Contigo: 🛡️ Prevented bookAppointmentWidgetData override! Restoring:",
              doctorId
            );
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
          console.log("Medico Contigo: Doctor lock released after 30s");
        }
      }, 30000);
    },

    autoSelectDoctor: function (serviceId, language) {
      var self = this;

      console.log(
        "Medico Contigo: Auto-selecting doctor for service:",
        serviceId
      );

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

            console.log("Medico Contigo: ✅ Doctor auto-selected:", doctorId);

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

            console.log("Medico Contigo: 🔒 Doctor locked to:", doctorId);
          }
        },
        error: function (xhr, status, error) {
          console.error("Medico Contigo: Doctor auto-select error:", error);
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
              console.warn(
                "Medico Contigo: 🚫🚫🚫 CAPTURE PHASE - BLOCKING form submission!"
              );
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();

              if (self.selectedLanguage) {
                console.log(
                  "Medico Contigo: Navigating to next tab instead of submitting"
                );
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
              console.warn(
                "Medico Contigo: 🚫 BUBBLE PHASE - BLOCKING form submission!"
              );
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              return false;
            }
          },
          false
        ); // FALSE = bubble phase
      });

      console.log(
        "Medico Contigo: ✅ Capture phase blockers installed on",
        forms.length,
        "forms"
      );
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
          console.log(
            "Medico Contigo: Converting submit button to regular button"
          );
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

      console.log("Medico Contigo: ✅ Submit button converter installed");
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
              console.log(
                "Medico Contigo: Saved original form action:",
                originalAction
              );
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
            console.log("Medico Contigo: Restored form action");
          }
        }
      }, 100);

      console.log("Medico Contigo: ✅ Form action disabler installed");
    },
  };

  // ✅ ULTIMATE FIREWALL: Global form submission blocker (runs BEFORE everything)
  // This uses native DOM Level 0 event handlers which fire FIRST
  (function installGlobalFirewall() {
    console.log("Medico Contigo: Installing ULTIMATE form submission firewall");

    // Hook into HTMLFormElement.prototype.submit to block programmatic submissions
    var originalSubmit = HTMLFormElement.prototype.submit;
    HTMLFormElement.prototype.submit = function () {
      var $activeTab = jQuery(".iq-tab-pannel.active");
      var isLanguageTabActive = $activeTab.attr("id") === "language";

      if (isLanguageTabActive) {
        console.error(
          "Medico Contigo: 🚫 FIREWALL BLOCKED programmatic form.submit() on language tab!"
        );
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
          console.error(
            "Medico Contigo: 🚫🚫🚫 DOCUMENT-LEVEL FIREWALL BLOCKED form submission!"
          );
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          if (MC_Booking.selectedLanguage) {
            console.log(
              "Medico Contigo: Language selected, will navigate to next tab"
            );
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

    console.log("Medico Contigo: ✅ ULTIMATE firewall installed successfully");
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

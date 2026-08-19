sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, UIComponent, Filter, FilterOperator, JSONModel, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("companymanagement.controller.View", {

        onBeforeRebindTable: function (oEvent) {
            var mBindingParams = oEvent.getParameter("bindingParams");

            mBindingParams.parameters = mBindingParams.parameters || {};
            mBindingParams.parameters.expand = "department";

            var sQuery = (this.byId("smartFilterBar").getBasicSearchValue() || "").trim();

            if (!sQuery) {
                return;
            }

            var aSearchFilters = [];
            aSearchFilters.push(new Filter("firstName", FilterOperator.Contains, sQuery));
            aSearchFilters.push(new Filter("lastName", FilterOperator.Contains, sQuery));
            aSearchFilters.push(new Filter("email", FilterOperator.Contains, sQuery));

            mBindingParams.filters.push(new Filter({ filters: aSearchFilters, and: false }));
        },

        onItemPress: function (oEvent) {
            var oItem = oEvent.getParameter("listItem");
            var oContext = oItem.getBindingContext();

            if (!oContext) {
                return;
            }
            oEvent.getSource().removeSelections(true);

            var oRouter = UIComponent.getRouterFor(this);
            oRouter.navTo("RouteDetail", { param: oContext.getProperty("ID") });
        },

        onNavToSearch: function () {
            UIComponent.getRouterFor(this).navTo("RouteSearch");
        },

        onNavToMasterData: function () {
            UIComponent.getRouterFor(this).navTo("RouteAdmin");
        },

        onNavToDashboard: function () {
            UIComponent.getRouterFor(this).navTo("RouteDashboard");
        },

        // ADD EMPLOYEE

        onOpenAddEmployeeDialog: async function () {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();

            if (!this._oEmployeeForm) {
                this._oEmployeeForm = await this.loadFragment({
                    name: "companymanagement.view.EmployeeFormDialog"
                });
            }

            if (!this.getView().getModel("form")) {
                this.getView().setModel(new JSONModel(), "form");
            }

            this.getView().getModel("form").setData({
                title: oBundle.getText("addEmployee"),
                confirmText: oBundle.getText("addEmployee")
            });

            this.byId("formFirstName").setValue("");
            this.byId("formLastName").setValue("");
            this.byId("formEmail").setValue("");
            this.byId("formDateOfBirth").setDateValue(null);
            this.byId("formExperience").setValue(0);
            this.byId("formDepartment").setSelectedKey("");

            this.byId("formFirstName").setValueState("None");
            this.byId("formLastName").setValueState("None");
            this.byId("formEmail").setValueState("None");
            this.byId("formDateOfBirth").setValueState("None");
            this.byId("formExperience").setValueState("None");
            this.byId("formDepartment").setValueState("None");

            this._oEmployeeForm.open();
        },

        onCloseEmployeeForm: function () {
            this._oEmployeeForm.close();
        },

        onRequiredFieldLiveChange: function (oEvent) {
            var oField = oEvent.getSource();
            var sValue;

            if (oField.getSelectedKey) {
                sValue = oField.getSelectedKey();
            } else {
                sValue = oField.getValue().trim();
            }

            oField.setValueState(sValue ? "None" : "Error");
        },

        onDateOfBirthChange: function (oEvent) {
            var oDatePicker = oEvent.getSource();
            var bValid = oEvent.getParameter("valid");
            var oDate = oDatePicker.getDateValue();

            if (!bValid || (oDate && oDate > new Date())) {
                oDatePicker.setValueState("Error");
            } else {
                oDatePicker.setValueState("None");
            }
        },

        onEmployeeFormConfirm: function () {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            var oModel = this.getOwnerComponent().getModel();
            var rEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

            var oFirstName = this.byId("formFirstName");
            var oLastName = this.byId("formLastName");
            var oEmail = this.byId("formEmail");
            var oDateOfBirth = this.byId("formDateOfBirth");
            var oDepartment = this.byId("formDepartment");

            var sFirstName = oFirstName.getValue().trim();
            var sLastName = oLastName.getValue().trim();
            var sEmail = oEmail.getValue().trim();
            var sDepartmentId = oDepartment.getSelectedKey();
            var oBirthDate = oDateOfBirth.getDateValue();

            oFirstName.setValueState(sFirstName ? "None" : "Error");
            oLastName.setValueState(sLastName ? "None" : "Error");
            oEmail.setValueState(sEmail ? "None" : "Error");
            oDepartment.setValueState(sDepartmentId ? "None" : "Error");

            if (!sFirstName || !sLastName || !sEmail || !sDepartmentId) {
                MessageToast.show(oBundle.getText("msgFillRequiredFields"));
                return;
            }

            if (!rEmail.test(sEmail)) {
                oEmail.setValueState("Error");
                oEmail.setValueStateText(oBundle.getText("msgInvalidEmail"));
                MessageToast.show(oBundle.getText("msgInvalidEmail"));
                return;
            }

            if (oBirthDate && oBirthDate > new Date()) {
                oDateOfBirth.setValueState("Error");
                oDateOfBirth.setValueStateText(oBundle.getText("msgInvalidDateOfBirth"));
                MessageToast.show(oBundle.getText("msgInvalidDateOfBirth"));
                return;
            }

            var oNewEmployee = {
                firstName: sFirstName,
                lastName: sLastName,
                email: sEmail,
                dateOfBirth: oBirthDate || null,
                experience: this.byId("formExperience").getValue() || 0,
                department_ID: sDepartmentId
            };

            oModel.create("/Employees", oNewEmployee, {
                success: () => {
                    MessageToast.show(oBundle.getText("msgEmployeeAdded"));
                    this.byId("employeeSmartTable").rebindTable();
                    this._oEmployeeForm.close();
                },
                error: () => MessageToast.show(oBundle.getText("msgEmployeeAddError"))
            });
        },

        onSeedData: async function () {
            var oModel = this.getOwnerComponent().getModel("v4");
            var oBinding = oModel.bindContext("/seedDemoData(...)");

            oBinding.setParameter("count", 25);

            try {
                await oBinding.execute();
                var sMessage = oBinding.getBoundContext().getObject().value;

                MessageToast.show(sMessage);
                this.byId("employeeSmartTable").rebindTable();
            } catch (oError) {
                MessageToast.show("Seeding failed: " + oError.message);
            }
        },

        // CV UPLOAD

        onOpenUploadCvDialog: async function () {
            if (!this._oCvDialog) {
                this._oCvDialog = await this.loadFragment({
                    name: "companymanagement.view.UploadCvDialog"
                });
            }

            if (!this.getView().getModel("cv")) {
                this.getView().setModel(new JSONModel(), "cv");
            }

            this.getView().getModel("cv").setData({
                busy: false,
                profile: null,
                departmentID: ""
            });

            this._oCvFile = null;
            this.byId("cvFileUploader").clear();
            this._oCvDialog.open();
        },

        onCloseCvDialog: function () {
            this._oCvDialog.close();
        },

        onCvFileSelected: function (oEvent) {
            var aFiles = oEvent.getParameter("files");
            this._oCvFile = aFiles && aFiles[0] ? aFiles[0] : null;
        },

        onCvTypeMismatch: function () {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            MessageToast.show(oBundle.getText("msgCvNotPdf"));
        },

        onCvFileSizeExceed: function () {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            MessageToast.show(oBundle.getText("msgCvTooLarge"));
        },

        onCvExtract: async function () {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            var oCvModel = this.getView().getModel("cv");

            if (!this._oCvFile) {
                MessageToast.show(oBundle.getText("msgCvPickFile"));
                return;
            }

            oCvModel.setProperty("/busy", true);

            try {
                var sBase64 = await this._readFileAsBase64(this._oCvFile);

                var oModel = this.getOwnerComponent().getModel("v4");
                var oBinding = oModel.bindContext("/extractCv(...)");

                oBinding.setParameter("fileName", this._oCvFile.name);
                oBinding.setParameter("contentBase64", sBase64);

                await oBinding.execute();
                var oProfile = oBinding.getBoundContext().getObject();

                var aSkills = oProfile.skills || [];
                for (var i = 0; i < aSkills.length; i++) {
                    aSkills[i].selected = !!aSkills[i].skillID;
                }
                oProfile.skills = aSkills;

                oCvModel.setProperty("/profile", oProfile);

                if (!aSkills.length) {
                    MessageToast.show(oBundle.getText("msgCvNoSkills"));
                }
            } catch (oError) {
                MessageToast.show(oBundle.getText("msgCvExtractError", [oError.message]));
            }

            oCvModel.setProperty("/busy", false);
        },

        _readFileAsBase64: function (oFile) {
            return new Promise(function (resolve, reject) {
                var oReader = new FileReader();

                oReader.onload = function () {
                    resolve(String(oReader.result).split(",")[1]);
                };
                oReader.onerror = function () {
                    reject(new Error("Could not read the file."));
                };

                oReader.readAsDataURL(oFile);
            });
        },

        onCvCreateEmployee: async function () {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            var oCvModel = this.getView().getModel("cv");
            var oData = oCvModel.getData();
            var oProfile = oData.profile;

            if (!oProfile) {
                return;
            }

            var aSkills = [];
            var aNewNames = [];

            for (var i = 0; i < oProfile.skills.length; i++) {
                var oSkill = oProfile.skills[i];

                if (!oSkill.selected) {
                    continue;
                }

                aSkills.push({
                    skillID: oSkill.skillID,
                    name: oSkill.name,
                    rating: oSkill.rating,
                    lastUsed: oSkill.lastUsed,
                    evidence: oSkill.evidence
                });

                if (!oSkill.skillID && oSkill.name && oSkill.name.trim()) {
                    aNewNames.push(oSkill.name.trim());
                }
            }

            // skill nou = intra in catalogul comun, deci intrebam intai
            if (aNewNames.length) {
                var bConfirmed = await this._confirmNewSkills(aNewNames);
                if (!bConfirmed) {
                    return;
                }
            }

            oCvModel.setProperty("/busy", true);

            try {
                var oModel = this.getOwnerComponent().getModel("v4");
                var oBinding = oModel.bindContext("/createEmployeeFromCv(...)");

                oBinding.setParameter("profile", {
                    firstName: oProfile.firstName,
                    lastName: oProfile.lastName,
                    email: oProfile.email,
                    experience: Number(oProfile.experience) || 0,
                    skills: aSkills
                });
                oBinding.setParameter("departmentID", oData.departmentID || null);

                await oBinding.execute();
                var sMessage = oBinding.getBoundContext().getObject().value;

                MessageToast.show(sMessage);

                this._oCvDialog.close();
                this.getOwnerComponent().getModel().refresh();
                this.byId("employeeSmartTable").rebindTable();
            } catch (oError) {
                MessageToast.show(oBundle.getText("msgCvCreateError", [oError.message]));
            }

            oCvModel.setProperty("/busy", false);
        },

        _confirmNewSkills: function (aNames) {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();

            return new Promise(function (resolve) {
                MessageBox.confirm(oBundle.getText("msgCvConfirmNewSkills", [aNames.join(", ")]), {
                    title: oBundle.getText("cvConfirmNewSkillsTitle"),
                    onClose: function (oAction) {
                        resolve(oAction === MessageBox.Action.OK);
                    }
                });
            });
        }

    });
});

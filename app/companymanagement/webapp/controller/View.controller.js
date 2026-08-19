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

        _t: function (sKey, aArgs) { return this.getView().getModel("i18n").getResourceBundle().getText(sKey, aArgs); },

        _action: function (sName) { return this.getOwnerComponent().getModel("v4").bindContext("/" + sName + "(...)"); },

        onBeforeRebindTable: function (oEvent) {
            var mBindingParams = oEvent.getParameter("bindingParams");

            mBindingParams.parameters = mBindingParams.parameters || {};
            mBindingParams.parameters.expand = "department";

            var sQuery = this.byId("smartFilterBar").getBasicSearchValue().trim();

            if (sQuery) {
                mBindingParams.filters.push(new Filter({
                    filters: [
                        new Filter("firstName", FilterOperator.Contains, sQuery),
                        new Filter("lastName", FilterOperator.Contains, sQuery),
                        new Filter("email", FilterOperator.Contains, sQuery)
                    ],
                    and: false
                }));
            }
        },

        onItemPress: function (oEvent) {
            var oContext = oEvent.getParameter("listItem").getBindingContext();

            oEvent.getSource().removeSelections(true);
            UIComponent.getRouterFor(this).navTo("RouteDetail", { param: oContext.getProperty("ID") });
        },

        onNavToSearch: function () { UIComponent.getRouterFor(this).navTo("RouteSearch"); },

        onNavToMasterData: function () { UIComponent.getRouterFor(this).navTo("RouteAdmin"); },

        onNavToDashboard: function () { UIComponent.getRouterFor(this).navTo("RouteDashboard"); },

        // ADD EMPLOYEE

        onOpenAddEmployeeDialog: async function () {
            if (!this._oEmployeeForm) {
                this._oEmployeeForm = await this.loadFragment({ name: "companymanagement.view.EmployeeFormDialog" });
                this.getView().setModel(new JSONModel(), "form");
            }

            this.getView().getModel("form").setData({
                title: this._t("addEmployee"),
                confirmText: this._t("addEmployee")
            });

            this.byId("formFirstName").setValue("");
            this.byId("formLastName").setValue("");
            this.byId("formEmail").setValue("");
            this.byId("formDateOfBirth").setDateValue(null);
            this.byId("formExperience").setValue(0);
            this.byId("formDepartment").setSelectedKey("");

            var aFields = ["formFirstName", "formLastName", "formEmail", "formDateOfBirth", "formExperience", "formDepartment"];
            for (var i = 0; i < aFields.length; i++) {
                this.byId(aFields[i]).setValueState("None");
            }

            this._oEmployeeForm.open();
        },

        onCloseEmployeeForm: function () { this._oEmployeeForm.close(); },

        onRequiredFieldLiveChange: function (oEvent) {
            var oField = oEvent.getSource();
            var sValue = oField.getSelectedKey ? oField.getSelectedKey() : oField.getValue().trim();

            oField.setValueState(sValue ? "None" : "Error");
        },

        onDateOfBirthChange: function (oEvent) {
            var oDatePicker = oEvent.getSource();
            var oDate = oDatePicker.getDateValue();
            var bBad = !oEvent.getParameter("valid") || (oDate && oDate > new Date());

            oDatePicker.setValueState(bBad ? "Error" : "None");
        },

        onEmployeeFormConfirm: function () {
            var oEmail = this.byId("formEmail");
            var oDateOfBirth = this.byId("formDateOfBirth");
            var oDepartment = this.byId("formDepartment");

            var sFirstName = this.byId("formFirstName").getValue().trim();
            var sLastName = this.byId("formLastName").getValue().trim();
            var sEmail = oEmail.getValue().trim();
            var sDepartmentId = oDepartment.getSelectedKey();
            var oBirthDate = oDateOfBirth.getDateValue();

            this.byId("formFirstName").setValueState(sFirstName ? "None" : "Error");
            this.byId("formLastName").setValueState(sLastName ? "None" : "Error");
            oEmail.setValueState(sEmail ? "None" : "Error");
            oDepartment.setValueState(sDepartmentId ? "None" : "Error");

            if (!sFirstName || !sLastName || !sEmail || !sDepartmentId) {
                MessageToast.show(this._t("msgFillRequiredFields"));
                return;
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(sEmail)) {
                oEmail.setValueState("Error");
                oEmail.setValueStateText(this._t("msgInvalidEmail"));
                MessageToast.show(this._t("msgInvalidEmail"));
                return;
            }

            if (oBirthDate && oBirthDate > new Date()) {
                oDateOfBirth.setValueState("Error");
                oDateOfBirth.setValueStateText(this._t("msgInvalidDateOfBirth"));
                MessageToast.show(this._t("msgInvalidDateOfBirth"));
                return;
            }

            var that = this;
            this.getOwnerComponent().getModel().create("/Employees", {
                firstName: sFirstName,
                lastName: sLastName,
                email: sEmail,
                dateOfBirth: oBirthDate || null,
                experience: this.byId("formExperience").getValue() || 0,
                department_ID: sDepartmentId
            }, {
                success: function () {
                    MessageToast.show(that._t("msgEmployeeAdded"));
                    that.byId("employeeSmartTable").rebindTable();
                    that._oEmployeeForm.close();
                },
                error: function () { MessageToast.show(that._t("msgEmployeeAddError")); }
            });
        },

        onSeedData: async function () {
            var oBinding = this._action("seedDemoData");
            oBinding.setParameter("count", 25);

            try {
                await oBinding.execute();
                MessageToast.show(oBinding.getBoundContext().getObject().value);
                this.byId("employeeSmartTable").rebindTable();
            } catch (oError) {
                MessageToast.show("Seeding failed: " + oError.message);
            }
        },

        // CV UPLOAD

        onOpenUploadCvDialog: async function () {
            if (!this._oCvDialog) {
                this._oCvDialog = await this.loadFragment({ name: "companymanagement.view.UploadCvDialog" });
                this.getView().setModel(new JSONModel(), "cv");
            }

            this.getView().getModel("cv").setData({ busy: false, profile: null, departmentID: "" });
            this._oCvFile = null;
            this.byId("cvFileUploader").clear();
            this._oCvDialog.open();
        },

        onCloseCvDialog: function () { this._oCvDialog.close(); },

        onCvFileSelected: function (oEvent) { this._oCvFile = (oEvent.getParameter("files") || [])[0]; },

        onCvTypeMismatch: function () { MessageToast.show(this._t("msgCvNotPdf")); },

        onCvFileSizeExceed: function () { MessageToast.show(this._t("msgCvTooLarge")); },

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

        onCvExtract: async function () {
            var oCvModel = this.getView().getModel("cv");

            if (!this._oCvFile) {
                MessageToast.show(this._t("msgCvPickFile"));
                return;
            }

            oCvModel.setProperty("/busy", true);

            try {
                var oBinding = this._action("extractCv");
                oBinding.setParameter("fileName", this._oCvFile.name);
                oBinding.setParameter("contentBase64", await this._readFileAsBase64(this._oCvFile));

                await oBinding.execute();
                var oProfile = oBinding.getBoundContext().getObject();

                for (var i = 0; i < oProfile.skills.length; i++) {
                    oProfile.skills[i].selected = !!oProfile.skills[i].skillID;
                }

                oCvModel.setProperty("/profile", oProfile);

                if (!oProfile.skills.length) {
                    MessageToast.show(this._t("msgCvNoSkills"));
                }
            } catch (oError) {
                MessageToast.show(this._t("msgCvExtractError", [oError.message]));
            }

            oCvModel.setProperty("/busy", false);
        },

        onCvCreateEmployee: async function () {
            var oCvModel = this.getView().getModel("cv");
            var oData = oCvModel.getData();
            var oProfile = oData.profile;
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

            if (aNewNames.length && !await this._confirmNewSkills(aNewNames)) {
                return;
            }

            oCvModel.setProperty("/busy", true);

            try {
                var oBinding = this._action("createEmployeeFromCv");
                oBinding.setParameter("profile", {
                    firstName: oProfile.firstName,
                    lastName: oProfile.lastName,
                    email: oProfile.email,
                    experience: Number(oProfile.experience) || 0,
                    skills: aSkills
                });
                oBinding.setParameter("departmentID", oData.departmentID || null);

                await oBinding.execute();
                MessageToast.show(oBinding.getBoundContext().getObject().value);

                this._oCvDialog.close();
                this.getOwnerComponent().getModel().refresh();
                this.byId("employeeSmartTable").rebindTable();
            } catch (oError) {
                MessageToast.show(this._t("msgCvCreateError", [oError.message]));
            }

            oCvModel.setProperty("/busy", false);
        },

        _confirmNewSkills: function (aNames) {
            var sMessage = this._t("msgCvConfirmNewSkills", [aNames.join(", ")]);
            var sTitle = this._t("cvConfirmNewSkillsTitle");

            return new Promise(function (resolve) {
                MessageBox.confirm(sMessage, {
                    title: sTitle,
                    onClose: function (oAction) { resolve(oAction === MessageBox.Action.OK); }
                });
            });
        }

    });
});

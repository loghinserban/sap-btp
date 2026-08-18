sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/core/library",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], (Controller, UIComponent, coreLibrary, JSONModel, MessageToast) => {
    "use strict";

    const ValueState = coreLibrary.ValueState;
    const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.44;

    const FIELD_IDS = [
        "formFirstName",
        "formLastName",
        "formEmail",
        "formDateOfBirth",
        "formExperience",
        "formDepartment"
    ];

    return Controller.extend("companymanagement.controller.BaseController", {

        getRouter() {
            return UIComponent.getRouterFor(this);
        },

        getResourceBundle() {
            return this.getView().getModel("i18n").getResourceBundle();
        },

        getODataModel() {
            return this.getOwnerComponent().getModel();
        },

        // Actiunile CAP se cheama prin POST, functiile prin GET cu ().
        async callAction(sName, oPayload) {
            const oRes = await fetch("/odata/v4/catalog/" + sName, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(oPayload || {})
            });

            if (!oRes.ok) {
                throw new Error((await oRes.text()).slice(0, 300));
            }

            return oRes.json();
        },

        async callFunction(sName) {
            const oRes = await fetch("/odata/v4/catalog/" + sName + "()");

            if (!oRes.ok) {
                throw new Error((await oRes.text()).slice(0, 300));
            }

            return oRes.json();
        },

        // Cele doua callback-uri pe care le cere modelul V2 la create/update/remove.
        crudCallbacks(sOkKey, sErrorKey, fnAfterSuccess) {
            const oBundle = this.getResourceBundle();

            return {
                success: () => {
                    MessageToast.show(oBundle.getText(sOkKey));
                    if (fnAfterSuccess) {
                        fnAfterSuccess();
                    }
                },
                error: (oError) => {
                    console.error(sErrorKey, oError);
                    MessageToast.show(oBundle.getText(sErrorKey));
                }
            };
        },


        async openEmployeeForm(sMode, oEmployee) {
            const oBundle = this.getResourceBundle();
            const bEdit = sMode === "edit";

            this._oEmployeeForm ??= await this.loadFragment({
                name: "companymanagement.view.EmployeeFormDialog"
            });

            if (!this.getView().getModel("form")) {
                this.getView().setModel(new JSONModel(), "form");
            }

            this.getView().getModel("form").setData({
                title: oBundle.getText(bEdit ? "editEmployee" : "addEmployee"),
                confirmText: oBundle.getText(bEdit ? "save" : "addEmployee")
            });

            this._fillEmployeeForm(oEmployee);
            this._oEmployeeForm.open();
        },

        closeEmployeeForm() {
            this._oEmployeeForm?.close();
        },

        _fillEmployeeForm(oEmployee) {
            const oData = oEmployee || {};

            this.byId("formFirstName").setValue(oData.firstName || "");
            this.byId("formLastName").setValue(oData.lastName || "");
            this.byId("formEmail").setValue(oData.email || "");
            this.byId("formDateOfBirth").setDateValue(oData.dateOfBirth || null);
            this.byId("formExperience").setValue(oData.experience || 0);
            this.byId("formDepartment").setSelectedKey(oData.department_ID || "");

            FIELD_IDS.forEach((sId) => this.byId(sId).setValueState(ValueState.None));
        },

    
        collectEmployeeForm() {
            const oBundle = this.getResourceBundle();

            const oFirstName = this.byId("formFirstName");
            const oLastName = this.byId("formLastName");
            const oEmail = this.byId("formEmail");
            const oDepartment = this.byId("formDepartment");
            const oDateOfBirth = this.byId("formDateOfBirth");

            const sFirstName = oFirstName.getValue().trim();
            const sLastName = oLastName.getValue().trim();
            const sEmail = oEmail.getValue().trim();
            const sDepartmentId = oDepartment.getSelectedKey();
            const oBirthDate = oDateOfBirth.getDateValue();

            let bValid = true;

            [
                [oFirstName, sFirstName],
                [oLastName, sLastName],
                [oEmail, sEmail]
            ].forEach(([oField, sValue]) => {
                const bEmpty = !sValue;
                oField.setValueState(bEmpty ? ValueState.Error : ValueState.None);
                bValid = bValid && !bEmpty;
            });

            if (!sDepartmentId) {
                oDepartment.setValueState(ValueState.Error);
                bValid = false;
            } else {
                oDepartment.setValueState(ValueState.None);
            }

            if (!bValid) {
                MessageToast.show(oBundle.getText("msgFillRequiredFields"));
                return null;
            }

            if (!EMAIL_PATTERN.test(sEmail)) {
                oEmail.setValueState(ValueState.Error);
                oEmail.setValueStateText(oBundle.getText("msgInvalidEmail"));
                MessageToast.show(oBundle.getText("msgInvalidEmail"));
                return null;
            }

            if (oBirthDate && oBirthDate > new Date()) {
                oDateOfBirth.setValueState(ValueState.Error);
                oDateOfBirth.setValueStateText(oBundle.getText("msgInvalidDateOfBirth"));
                MessageToast.show(oBundle.getText("msgInvalidDateOfBirth"));
                return null;
            }

            return {
                firstName: sFirstName,
                lastName: sLastName,
                email: sEmail,
                dateOfBirth: oBirthDate || null,
                experience: this.byId("formExperience").getValue() || 0,
                department_ID: sDepartmentId
            };
        },


        onRequiredFieldLiveChange(oEvent) {
            const oField = oEvent.getSource();
            const sValue = oField.getSelectedKey ? oField.getSelectedKey() : oField.getValue().trim();
            oField.setValueState(sValue ? ValueState.None : ValueState.Error);
        },

        onDateOfBirthChange(oEvent) {
            const oDatePicker = oEvent.getSource();
            const bValid = oEvent.getParameter("valid");
            const oDate = oDatePicker.getDateValue();

            oDatePicker.setValueState(
                !bValid || (oDate && oDate > new Date()) ? ValueState.Error : ValueState.None
            );
        },


        // Cate luni au trecut de la o data. null daca data lipseste.
        monthsSince(sDate) {
            if (!sDate) {
                return null;
            }
            return Math.floor((new Date() - new Date(sDate)) / MS_PER_MONTH);
        },

        calculateAge(sDateOfBirth) {
            if (!sDateOfBirth) {
                return null;
            }

            const oBirth = new Date(sDateOfBirth);
            const oToday = new Date();
            let iAge = oToday.getFullYear() - oBirth.getFullYear();
            const iMonthDiff = oToday.getMonth() - oBirth.getMonth();

            if (iMonthDiff < 0 || (iMonthDiff === 0 && oToday.getDate() < oBirth.getDate())) {
                iAge--;
            }

            return iAge;
        },

        // green under 1 year, yellow 1-2 years, red over 2
        formatFreshness(sLastUsed) {
            const iMonths = this.monthsSince(sLastUsed);

            if (iMonths === null) {
                return ValueState.None;
            }
            if (iMonths <= 12) {
                return ValueState.Success;
            }
            return iMonths <= 24 ? ValueState.Warning : ValueState.Error;
        }
    });
});

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
        }
    });
});

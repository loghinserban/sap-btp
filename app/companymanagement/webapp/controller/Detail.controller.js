sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/core/routing/History",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, UIComponent, History, JSONModel, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("companymanagement.controller.Detail", {

        onInit: function () {
            this.getView().setModel(new JSONModel({ averageRating: 0 }), "detail");

            var oRouter = UIComponent.getRouterFor(this);
            oRouter.getRoute("RouteDetail").attachPatternMatched(this._onMatched, this);
        },

        _onMatched: function (oEvent) {
            var sId = oEvent.getParameter("arguments").param;

            this.getView().bindElement({
                path: "/Employees(guid'" + sId + "')",
                parameters: {
                    expand: "department,skills/skill,reviews"
                },
                events: {
                    dataReceived: this._onDataReceived.bind(this)
                }
            });
        },

        _onDataReceived: function () {
            var oModel = this.getOwnerComponent().getModel();
            var oContext = this.getView().getBindingContext();
            var aReviews = oContext ? oContext.getProperty("reviews") : null;

            if (!aReviews) {
                aReviews = [];
            }

            var iSum = 0;
            var iCount = 0;

            for (var i = 0; i < aReviews.length; i++) {
                var oReview = aReviews[i];

                if (typeof oReview === "string") {
                    oReview = oModel.getObject("/" + oReview);
                }

                if (oReview && typeof oReview.stars === "number") {
                    iSum = iSum + oReview.stars;
                    iCount = iCount + 1;
                }
            }

            var fAverage = 0;
            if (iCount) {
                fAverage = iSum / iCount;
            }

            this.getView().getModel("detail").setProperty("/averageRating", fAverage);
        },

        formatFreshness: function (sLastUsed) {
            if (!sLastUsed) {
                return "None";
            }

            var iMonths = Math.floor((new Date() - new Date(sLastUsed)) / (1000 * 60 * 60 * 24 * 30.44));

            if (iMonths <= 12) {
                return "Success";
            }
            if (iMonths <= 24) {
                return "Warning";
            }
            return "Error";
        },

        onNavBack: function () {
            var oHistory = History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                UIComponent.getRouterFor(this).navTo("RouteView", {}, true);
            }
        },

        // EDIT EMPLOYEE

        onOpenEditDialog: async function () {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            var oContext = this.getView().getBindingContext();

            if (!oContext) {
                return;
            }

            if (!this._oEmployeeForm) {
                this._oEmployeeForm = await this.loadFragment({
                    name: "companymanagement.view.EmployeeFormDialog"
                });
            }

            if (!this.getView().getModel("form")) {
                this.getView().setModel(new JSONModel(), "form");
            }

            this.getView().getModel("form").setData({
                title: oBundle.getText("editEmployee"),
                confirmText: oBundle.getText("save")
            });

            this.byId("formFirstName").setValue(oContext.getProperty("firstName") || "");
            this.byId("formLastName").setValue(oContext.getProperty("lastName") || "");
            this.byId("formEmail").setValue(oContext.getProperty("email") || "");
            this.byId("formDateOfBirth").setDateValue(oContext.getProperty("dateOfBirth") || null);
            this.byId("formExperience").setValue(oContext.getProperty("experience") || 0);
            this.byId("formDepartment").setSelectedKey(oContext.getProperty("department_ID") || "");

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

            var oUpdatedEmployee = {
                firstName: sFirstName,
                lastName: sLastName,
                email: sEmail,
                dateOfBirth: oBirthDate || null,
                experience: this.byId("formExperience").getValue() || 0,
                department_ID: sDepartmentId
            };

            var sPath = this.getView().getBindingContext().getPath();

            oModel.update(sPath, oUpdatedEmployee, {
                success: () => {
                    MessageToast.show(oBundle.getText("msgEmployeeUpdated"));
                    this._oEmployeeForm.close();
                },
                error: () => MessageToast.show(oBundle.getText("msgEmployeeUpdateError"))
            });
        },

        onDeleteEmployee: function () {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            var oModel = this.getOwnerComponent().getModel();
            var sPath = this.getView().getBindingContext().getPath();

            MessageBox.confirm(oBundle.getText("msgConfirmDelete"), {
                title: oBundle.getText("msgConfirmDeleteTitle"),
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                onClose: (oAction) => {
                    if (oAction !== MessageBox.Action.OK) {
                        return;
                    }

                    oModel.remove(sPath, {
                        success: () => {
                            MessageToast.show(oBundle.getText("msgEmployeeDeleted"));
                            this.onNavBack();
                        },
                        error: () => MessageToast.show(oBundle.getText("msgEmployeeDeleteError"))
                    });
                }
            });
        },

        // SKILLS

        onAddSkillDialog: async function () {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();

            if (!this._oSkillDialog) {
                this._oSkillDialog = await this.loadFragment({
                    name: "companymanagement.view.SkillDialog"
                });
            }

            this._sEditSkillPath = null;

            this._oSkillDialog.setTitle(oBundle.getText("addSkill"));
            this.byId("skillSelect").setEnabled(true);
            this.byId("skillSelect").setSelectedKey("");
            this.byId("skillSelect").setValueState("None");
            this.byId("skillRating").setValue(3);
            this.byId("skillLastUsed").setDateValue(null);
            this._oSkillDialog.open();
        },

        onEditSkillDialog: async function (oEvent) {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            var oContext = oEvent.getSource().getBindingContext();

            if (!oContext) {
                return;
            }

            if (!this._oSkillDialog) {
                this._oSkillDialog = await this.loadFragment({
                    name: "companymanagement.view.SkillDialog"
                });
            }

            var oSkill = oContext.getObject();
            this._sEditSkillPath = oContext.getPath();

            this._oSkillDialog.setTitle(oBundle.getText("editSkill"));
            this.byId("skillSelect").setEnabled(false);
            this.byId("skillSelect").setSelectedKey(oSkill.skill_ID);
            this.byId("skillSelect").setValueState("None");
            this.byId("skillRating").setValue(oSkill.rating);
            this.byId("skillLastUsed").setDateValue(oSkill.lastUsed ? new Date(oSkill.lastUsed) : null);
            this._oSkillDialog.open();
        },

        onCloseSkillDialog: function () {
            this._oSkillDialog.close();
        },

        onSaveSkill: function () {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            var oModel = this.getOwnerComponent().getModel();
            var oSkillSelect = this.byId("skillSelect");
            var sSkillId = oSkillSelect.getSelectedKey();

            if (!sSkillId) {
                oSkillSelect.setValueState("Error");
                MessageToast.show(oBundle.getText("msgFillRequiredFields"));
                return;
            }
            oSkillSelect.setValueState("None");

            var oSkillValues = {
                rating: this.byId("skillRating").getValue(),
                lastUsed: this.byId("skillLastUsed").getDateValue()
            };

            if (this._sEditSkillPath) {
                oModel.update(this._sEditSkillPath, oSkillValues, {
                    success: () => {
                        MessageToast.show(oBundle.getText("msgSkillUpdated"));
                        oModel.refresh();
                        this._oSkillDialog.close();
                    },
                    error: () => MessageToast.show(oBundle.getText("msgSkillUpdateError"))
                });
                return;
            }

            var oNewSkill = {
                employee_ID: this.getView().getBindingContext().getProperty("ID"),
                skill_ID: sSkillId,
                rating: oSkillValues.rating,
                lastUsed: oSkillValues.lastUsed
            };

            oModel.create("/EmployeeSkills", oNewSkill, {
                success: () => {
                    MessageToast.show(oBundle.getText("msgSkillAdded"));
                    oModel.refresh();
                    this._oSkillDialog.close();
                },
                error: () => MessageToast.show(oBundle.getText("msgSkillAddError"))
            });
        },

        onRatingChange: function (oEvent) {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            var oModel = this.getOwnerComponent().getModel();
            var sPath = oEvent.getSource().getBindingContext().getPath();

            oModel.update(sPath, { rating: oEvent.getParameter("value") }, {
                success: () => {
                    MessageToast.show(oBundle.getText("msgSkillUpdated"));
                    oModel.refresh();
                },
                error: () => MessageToast.show(oBundle.getText("msgSkillUpdateError"))
            });
        },

        onDeleteSkill: function (oEvent) {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            var oModel = this.getOwnerComponent().getModel();
            var sPath = oEvent.getSource().getBindingContext().getPath();

            MessageBox.confirm(oBundle.getText("msgConfirmDeleteSkill"), {
                title: oBundle.getText("msgConfirmDeleteTitle"),
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                onClose: function (oAction) {
                    if (oAction !== MessageBox.Action.OK) {
                        return;
                    }

                    oModel.remove(sPath, {
                        success: function () {
                            MessageToast.show(oBundle.getText("msgSkillDeleted"));
                            oModel.refresh();
                        },
                        error: function () {
                            MessageToast.show(oBundle.getText("msgSkillDeleteError"));
                        }
                    });
                }
            });
        }

    });
});

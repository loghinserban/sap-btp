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
            UIComponent.getRouterFor(this).getRoute("RouteDetail").attachPatternMatched(this._onMatched, this);
        },

        _t: function (sKey, aArgs) { return this.getView().getModel("i18n").getResourceBundle().getText(sKey, aArgs); },

        _model: function () { return this.getOwnerComponent().getModel(); },

        _after: function (sOkKey, sErrKey, fnDone) {
            var that = this;
            return {
                success: function () {
                    MessageToast.show(that._t(sOkKey));
                    if (fnDone) {
                        fnDone();
                    }
                },
                error: function () { MessageToast.show(that._t(sErrKey)); }
            };
        },

        _onMatched: function (oEvent) {
            this.getView().bindElement({
                path: "/Employees(guid'" + oEvent.getParameter("arguments").param + "')",
                parameters: { expand: "department,skills/skill,reviews" },
                events: { dataReceived: this._onDataReceived.bind(this) }
            });
        },

        _onDataReceived: function () {
            var oModel = this._model();
            var aReviews = this.getView().getBindingContext().getProperty("reviews") || [];
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

            this.getView().getModel("detail").setProperty("/averageRating", iCount ? iSum / iCount : 0);
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
            if (History.getInstance().getPreviousHash() !== undefined) {
                window.history.go(-1);
            } else {
                UIComponent.getRouterFor(this).navTo("RouteView", {}, true);
            }
        },

        // EDIT EMPLOYEE

        onOpenEditDialog: async function () {
            var oContext = this.getView().getBindingContext();

            if (!this._oEmployeeForm) {
                this._oEmployeeForm = await this.loadFragment({ name: "companymanagement.view.EmployeeFormDialog" });
                this.getView().setModel(new JSONModel(), "form");
            }

            this.getView().getModel("form").setData({
                title: this._t("editEmployee"),
                confirmText: this._t("save")
            });

            this.byId("formFirstName").setValue(oContext.getProperty("firstName"));
            this.byId("formLastName").setValue(oContext.getProperty("lastName"));
            this.byId("formEmail").setValue(oContext.getProperty("email"));
            this.byId("formDateOfBirth").setDateValue(oContext.getProperty("dateOfBirth"));
            this.byId("formExperience").setValue(oContext.getProperty("experience"));
            this.byId("formDepartment").setSelectedKey(oContext.getProperty("department_ID"));

            var aFields = ["formFirstName", "formLastName", "formEmail", "formDateOfBirth", "formExperience", "formDepartment"];
            for (var i = 0; i < aFields.length; i++) {
                this.byId(aFields[i]).setValueState("None");
            }

            this._oEmployeeForm.open();
        },

        onCloseEmployeeForm: function () { this._oEmployeeForm.close(); },

        onRequiredFieldLiveChange: function (oEvent) {
            var oField = oEvent.getSource();
            var sValue;

            if (oField.isA("sap.m.ComboBox")) {
                sValue = oField.getSelectedKey();
            } else {
                sValue = oField.getValue().trim();
            }

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
            this._model().update(this.getView().getBindingContext().getPath(), {
                firstName: sFirstName,
                lastName: sLastName,
                email: sEmail,
                dateOfBirth: oBirthDate || null,
                experience: this.byId("formExperience").getValue() || 0,
                department_ID: sDepartmentId
            }, this._after("msgEmployeeUpdated", "msgEmployeeUpdateError", function () {
                that._oEmployeeForm.close();
            }));
        },

        onDeleteEmployee: function () {
            var that = this;
            var sPath = this.getView().getBindingContext().getPath();

            MessageBox.confirm(this._t("msgConfirmDelete"), {
                title: this._t("msgConfirmDeleteTitle"),
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                onClose: function (oAction) {
                    if (oAction === MessageBox.Action.OK) {
                        that._model().remove(sPath, that._after("msgEmployeeDeleted", "msgEmployeeDeleteError", function () {
                            that.onNavBack();
                        }));
                    }
                }
            });
        },

        // SKILLS

        onAddSkillDialog: async function () { await this._openSkillDialog("addSkill", null); },

        onEditSkillDialog: async function (oEvent) {
            await this._openSkillDialog("editSkill", oEvent.getSource().getBindingContext());
        },

        _openSkillDialog: async function (sTitleKey, oContext) {
            if (!this._oSkillDialog) {
                this._oSkillDialog = await this.loadFragment({ name: "companymanagement.view.SkillDialog" });
            }

            this._sEditSkillPath = oContext ? oContext.getPath() : null;

            this._oSkillDialog.setTitle(this._t(sTitleKey));
            this.byId("skillSelect").setEnabled(!oContext);
            this.byId("skillSelect").setSelectedKey(oContext ? oContext.getProperty("skill_ID") : "");
            this.byId("skillSelect").setValueState("None");
            this.byId("skillRating").setValue(oContext ? oContext.getProperty("rating") : 3);
            this.byId("skillLastUsed").setDateValue(oContext && oContext.getProperty("lastUsed") ? new Date(oContext.getProperty("lastUsed")) : null);
            this._oSkillDialog.open();
        },

        onCloseSkillDialog: function () { this._oSkillDialog.close(); },

        onSaveSkill: function () {
            var oSkillSelect = this.byId("skillSelect");
            var sSkillId = oSkillSelect.getSelectedKey();

            if (!sSkillId) {
                oSkillSelect.setValueState("Error");
                MessageToast.show(this._t("msgFillRequiredFields"));
                return;
            }
            oSkillSelect.setValueState("None");

            var that = this;
            var iRating = this.byId("skillRating").getValue();
            var oLastUsed = this.byId("skillLastUsed").getDateValue();

            function onSaved() {
                that._model().refresh();
                that._oSkillDialog.close();
            }

            if (this._sEditSkillPath) {
                this._model().update(this._sEditSkillPath, { rating: iRating, lastUsed: oLastUsed },
                    this._after("msgSkillUpdated", "msgSkillUpdateError", onSaved));
                return;
            }

            this._model().create("/EmployeeSkills", {
                employee_ID: this.getView().getBindingContext().getProperty("ID"),
                skill_ID: sSkillId,
                rating: iRating,
                lastUsed: oLastUsed
            }, this._after("msgSkillAdded", "msgSkillAddError", onSaved));
        },

        onRatingChange: function (oEvent) {
            var that = this;

            this._model().update(oEvent.getSource().getBindingContext().getPath(), {
                rating: oEvent.getParameter("value")
            }, this._after("msgSkillUpdated", "msgSkillUpdateError", function () {
                that._model().refresh();
            }));
        },

        onDeleteSkill: function (oEvent) {
            var that = this;
            var sPath = oEvent.getSource().getBindingContext().getPath();

            MessageBox.confirm(this._t("msgConfirmDeleteSkill"), {
                title: this._t("msgConfirmDeleteTitle"),
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                onClose: function (oAction) {
                    if (oAction === MessageBox.Action.OK) {
                        that._model().remove(sPath, that._after("msgSkillDeleted", "msgSkillDeleteError", function () {
                            that._model().refresh();
                        }));
                    }
                }
            });
        }

    });
});

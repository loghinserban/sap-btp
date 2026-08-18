sap.ui.define([
    "companymanagement/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/routing/History",
    "sap/ui/core/UIComponent"
], (BaseController, JSONModel, MessageToast, MessageBox, History, UIComponent) => {
    "use strict";

    return BaseController.extend("companymanagement.controller.Detail", {

        onInit() {
            this.getView().setModel(new JSONModel({ averageRating: 0 }), "detail");

            this.getRouter()
                .getRoute("RouteDetail")
                .attachPatternMatched(this._onMatched, this);
        },

        _onMatched(oEvent) {
            const sId = oEvent.getParameter("arguments").param;

            this.getView().bindElement({
                path: `/Employees(guid'${sId}')`,
                parameters: {
                    expand: "department,skills/skill,reviews"
                },
                events: {
                    dataReceived: this._onDataReceived.bind(this)
                }
            });
        },

        _onDataReceived() {
            const oContext = this.getView().getBindingContext();
            const aReviews = (oContext && oContext.getProperty("reviews")) || [];
            const oModel = this.getODataModel();


            const aStars = aReviews
                .map((vReview) => {
                    const oReview = typeof vReview === "string"
                        ? oModel.getObject(`/${vReview}`)
                        : vReview;
                    return oReview && oReview.stars;
                })
                .filter((iStars) => typeof iStars === "number");

            const fAverage = aStars.length
                ? aStars.reduce((iSum, iStars) => iSum + iStars, 0) / aStars.length
                : 0;

            this.getView().getModel("detail").setProperty("/averageRating", fAverage);
        },

        //edit
        onOpenEditDialog() {
            const oContext = this.getView().getBindingContext();

            if (!oContext) {
                return undefined;
            }

            return this.openEmployeeForm("edit", {
                firstName: oContext.getProperty("firstName"),
                lastName: oContext.getProperty("lastName"),
                email: oContext.getProperty("email"),
                dateOfBirth: oContext.getProperty("dateOfBirth"),
                experience: oContext.getProperty("experience"),
                department_ID: oContext.getProperty("department_ID")
            });
        },

        onCloseEmployeeForm() {
            this.closeEmployeeForm();
        },

        onEmployeeFormConfirm() {
            const oPayload = this.collectEmployeeForm();

            if (!oPayload) {
                return;
            }

            const sPath = this.getView().getBindingContext().getPath();

            this.getODataModel().update(sPath, oPayload,
                this.crudCallbacks("msgEmployeeUpdated", "msgEmployeeUpdateError",
                    () => this.closeEmployeeForm()));
        },

        //delete nav
        onDeleteEmployee() {
            const oBundle = this.getResourceBundle();
            const oModel = this.getODataModel();
            const sPath = this.getView().getBindingContext().getPath();

            MessageBox.confirm(oBundle.getText("msgConfirmDelete"), {
                title: oBundle.getText("msgConfirmDeleteTitle"),
                onClose: (sAction) => {
                    if (sAction !== MessageBox.Action.OK) {
                        return;
                    }

                    oModel.remove(sPath,
                        this.crudCallbacks("msgEmployeeDeleted", "msgEmployeeDeleteError",
                            () => this.onNavBack()));
                }
            });
        },

        onNavBack: function () {
            const history = History.getInstance();
            const previousHash = history.getPreviousHash();
            if (previousHash !== undefined) {
                window.history.go(-1);
            } else {
                const router = UIComponent.getRouterFor(this);
                router.navTo("RouteView", {}, true);
            }
        },


        // SKILLS

        _loadSkillDialog: async function () {
            if (!this._oSkillDialog) {
                this._oSkillDialog = await this.loadFragment({
                    name: "companymanagement.view.SkillDialog"
                });
            }
            return this._oSkillDialog;
        },

        onAddSkillDialog: async function () {
            const oDialog = await this._loadSkillDialog();

            this._sEditSkillPath = null;

            oDialog.setTitle(this.getResourceBundle().getText("addSkill"));
            this.byId("skillSelect").setEnabled(true);
            this.byId("skillSelect").setSelectedKey("");
            this.byId("skillSelect").setValueState("None");
            this.byId("skillRating").setValue(3);
            this.byId("skillLastUsed").setDateValue(null);
            oDialog.open();
        },

        onEditSkillDialog: async function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext();
            if (!oContext) {
                return;
            }

            const oDialog = await this._loadSkillDialog();
            const oSkillData = oContext.getObject();

            this._sEditSkillPath = oContext.getPath();

            oDialog.setTitle(this.getResourceBundle().getText("editSkill"));
            this.byId("skillSelect").setEnabled(false);
            this.byId("skillSelect").setSelectedKey(oSkillData.skill_ID);
            this.byId("skillSelect").setValueState("None");
            this.byId("skillRating").setValue(oSkillData.rating);
            this.byId("skillLastUsed").setDateValue(oSkillData.lastUsed ? new Date(oSkillData.lastUsed) : null);
            oDialog.open();
        },

        onCloseSkillDialog: function () {
            this._oSkillDialog.close();
        },

        onSaveSkill: function () {
            const oModel = this.getODataModel();
            const oBundle = this.getResourceBundle();
            const oSkillSelect = this.byId("skillSelect");
            const sSkillId = oSkillSelect.getSelectedKey();

            if (!sSkillId) {
                oSkillSelect.setValueState("Error");
                MessageToast.show(oBundle.getText("msgFillRequiredFields"));
                return;
            }
            oSkillSelect.setValueState("None");

            const oSkillValues = {
                rating: this.byId("skillRating").getValue(),
                lastUsed: this.byId("skillLastUsed").getDateValue()
            };

            const fnAfterSave = () => {
                oModel.refresh();
                this._oSkillDialog.close();
            };

            if (this._sEditSkillPath) {
                oModel.update(this._sEditSkillPath, oSkillValues,
                    this.crudCallbacks("msgSkillUpdated", "msgSkillUpdateError", fnAfterSave));
                return;
            }

            oModel.create("/EmployeeSkills", {
                employee_ID: this.getView().getBindingContext().getProperty("ID"),
                skill_ID: sSkillId,
                ...oSkillValues
            }, this.crudCallbacks("msgSkillAdded", "msgSkillAddError", fnAfterSave));
        },

        onRatingChange: function (oEvent) {
            const oModel = this.getODataModel();
            const sPath = oEvent.getSource().getBindingContext().getPath();

            oModel.update(sPath, { rating: oEvent.getParameter("value") },
                this.crudCallbacks("msgSkillUpdated", "msgSkillUpdateError",
                    () => oModel.refresh()));
        },
        onDeleteSkill: function (oEvent) {
            const oModel = this.getODataModel();
            const sPath = oEvent.getSource().getBindingContext().getPath();

            MessageBox.confirm(this.getResourceBundle().getText("msgConfirmDeleteSkill"), {
                title: this.getResourceBundle().getText("msgConfirmDeleteTitle"),
                onClose: (sAction) => {
                    if (sAction !== MessageBox.Action.OK) {
                        return;
                    }

                    oModel.remove(sPath,
                        this.crudCallbacks("msgSkillDeleted", "msgSkillDeleteError",
                            () => oModel.refresh()));
                }
            });
        }

    });
});

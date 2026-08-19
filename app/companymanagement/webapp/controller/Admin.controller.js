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

    return Controller.extend("companymanagement.controller.Admin", {

        onInit: function () {
            this.getView().setModel(new JSONModel({ message: "" }), "reassign");
            this.getView().setModel(new JSONModel({ message: "" }), "merge");
        },

        formatUsageState: function (iCount) {
            return iCount ? "Information" : "Success";
        },

        onSearchSkills: function (oEvent) {
            this._filterByName("skillsMasterTable", oEvent.getSource().getValue());
        },

        onSearchDepartments: function (oEvent) {
            this._filterByName("departmentsMasterTable", oEvent.getSource().getValue());
        },

        _filterByName: function (sTableId, sQuery) {
            var oBinding = this.byId(sTableId).getBinding("items");

            if (!oBinding) {
                return;
            }

            var sValue = (sQuery || "").trim();

            if (sValue) {
                oBinding.filter([new Filter("name", FilterOperator.Contains, sValue)]);
            } else {
                oBinding.filter([]);
            }
        },

        onNavBack: function () {
            UIComponent.getRouterFor(this).navTo("RouteView", {}, true);
        },

        // SKILLS

        onAddSkill: async function () {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();

            if (!this._oSkillDialog) {
                this._oSkillDialog = await this.loadFragment({
                    name: "companymanagement.view.SkillFormDialog"
                });
            }

            this._sEditSkillPath = null;

            this._oSkillDialog.setTitle(oBundle.getText("createSkill"));
            this.byId("skillFormName").setValue("");
            this.byId("skillFormName").setValueState("None");
            this.byId("skillFormDescription").setValue("");
            this._oSkillDialog.open();
        },

        onEditSkill: async function (oEvent) {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            var oContext = oEvent.getSource().getBindingContext();

            if (!oContext) {
                return;
            }

            if (!this._oSkillDialog) {
                this._oSkillDialog = await this.loadFragment({
                    name: "companymanagement.view.SkillFormDialog"
                });
            }

            var oSkill = oContext.getObject();
            this._sEditSkillPath = oContext.getPath();

            this._oSkillDialog.setTitle(oBundle.getText("editSkill"));
            this.byId("skillFormName").setValue(oSkill.name || "");
            this.byId("skillFormName").setValueState("None");
            this.byId("skillFormDescription").setValue(oSkill.description || "");
            this._oSkillDialog.open();
        },

        onSaveSkill: function () {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            var oModel = this.getOwnerComponent().getModel();
            var oNameInput = this.byId("skillFormName");
            var sName = oNameInput.getValue().trim();

            if (!sName) {
                oNameInput.setValueState("Error");
                MessageToast.show(oBundle.getText("msgFillRequiredFields"));
                return;
            }
            oNameInput.setValueState("None");

            var oSkill = {
                name: sName,
                description: this.byId("skillFormDescription").getValue().trim()
            };

            if (this._sEditSkillPath) {
                oModel.update(this._sEditSkillPath, oSkill, {
                    success: () => {
                        MessageToast.show(oBundle.getText("msgSkillMasterUpdated"));
                        oModel.refresh(true);
                        this._oSkillDialog.close();
                    },
                    error: () => MessageToast.show(oBundle.getText("msgSkillMasterUpdateError"))
                });
                return;
            }

            oModel.create("/Skills", oSkill, {
                success: () => {
                    MessageToast.show(oBundle.getText("msgSkillMasterAdded"));
                    oModel.refresh(true);
                    this._oSkillDialog.close();
                },
                error: () => MessageToast.show(oBundle.getText("msgSkillMasterAddError"))
            });
        },

        onDeleteSkill: function (oEvent) {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            var oModel = this.getOwnerComponent().getModel();
            var oContext = oEvent.getSource().getBindingContext();
            var sPath = oContext.getPath();

            var iUsed = oContext.getProperty("usageCount") || 0;

            if (iUsed > 0) {
                MessageBox.error(oBundle.getText("msgSkillInUse", [iUsed]));
                return;
            }

            MessageBox.confirm(oBundle.getText("msgConfirmDeleteSkillMaster"), {
                title: oBundle.getText("msgConfirmDeleteTitle"),
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                onClose: function (oAction) {
                    if (oAction !== MessageBox.Action.OK) {
                        return;
                    }

                    oModel.remove(sPath, {
                        success: function () {
                            MessageToast.show(oBundle.getText("msgSkillMasterDeleted"));
                            oModel.refresh(true);
                        },
                        error: function () {
                            MessageToast.show(oBundle.getText("msgSkillMasterDeleteError"));
                        }
                    });
                }
            });
        },

        onCloseSkillDialog: function () {
            this._oSkillDialog.close();
        },

        // DEPARTMENTS

        onAddDepartment: async function () {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();

            if (!this._oDepartmentDialog) {
                this._oDepartmentDialog = await this.loadFragment({
                    name: "companymanagement.view.DepartmentFormDialog"
                });
            }

            this._sEditDepartmentPath = null;

            this._oDepartmentDialog.setTitle(oBundle.getText("createDepartment"));
            this.byId("departmentFormName").setValue("");
            this.byId("departmentFormName").setValueState("None");
            this.byId("departmentFormDescription").setValue("");
            this._oDepartmentDialog.open();
        },

        onEditDepartment: async function (oEvent) {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            var oContext = oEvent.getSource().getBindingContext();

            if (!oContext) {
                return;
            }

            if (!this._oDepartmentDialog) {
                this._oDepartmentDialog = await this.loadFragment({
                    name: "companymanagement.view.DepartmentFormDialog"
                });
            }

            var oDepartment = oContext.getObject();
            this._sEditDepartmentPath = oContext.getPath();

            this._oDepartmentDialog.setTitle(oBundle.getText("editDepartment"));
            this.byId("departmentFormName").setValue(oDepartment.name || "");
            this.byId("departmentFormName").setValueState("None");
            this.byId("departmentFormDescription").setValue(oDepartment.description || "");
            this._oDepartmentDialog.open();
        },

        onSaveDepartment: function () {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            var oModel = this.getOwnerComponent().getModel();
            var oNameInput = this.byId("departmentFormName");
            var sName = oNameInput.getValue().trim();

            if (!sName) {
                oNameInput.setValueState("Error");
                MessageToast.show(oBundle.getText("msgFillRequiredFields"));
                return;
            }
            oNameInput.setValueState("None");

            var oDepartment = {
                name: sName,
                description: this.byId("departmentFormDescription").getValue().trim()
            };

            if (this._sEditDepartmentPath) {
                oModel.update(this._sEditDepartmentPath, oDepartment, {
                    success: () => {
                        MessageToast.show(oBundle.getText("msgDepartmentUpdated"));
                        oModel.refresh(true);
                        this._oDepartmentDialog.close();
                    },
                    error: () => MessageToast.show(oBundle.getText("msgDepartmentUpdateError"))
                });
                return;
            }

            oModel.create("/Departments", oDepartment, {
                success: () => {
                    MessageToast.show(oBundle.getText("msgDepartmentAdded"));
                    oModel.refresh(true);
                    this._oDepartmentDialog.close();
                },
                error: () => MessageToast.show(oBundle.getText("msgDepartmentAddError"))
            });
        },

        onDeleteDepartment: function (oEvent) {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            var oModel = this.getOwnerComponent().getModel();
            var oContext = oEvent.getSource().getBindingContext();
            var sPath = oContext.getPath();

            // cati angajati are departamentul, tot din usageCount
            var iUsed = oContext.getProperty("usageCount") || 0;

            if (iUsed > 0) {
                this._openReassignDialog(oContext.getProperty("ID"), iUsed);
                return;
            }

            MessageBox.confirm(oBundle.getText("msgConfirmDeleteDepartment"), {
                title: oBundle.getText("msgConfirmDeleteTitle"),
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                onClose: function (oAction) {
                    if (oAction !== MessageBox.Action.OK) {
                        return;
                    }

                    oModel.remove(sPath, {
                        success: function () {
                            MessageToast.show(oBundle.getText("msgDepartmentDeleted"));
                            oModel.refresh(true);
                        },
                        error: function () {
                            MessageToast.show(oBundle.getText("msgDepartmentDeleteError"));
                        }
                    });
                }
            });
        },

        onCloseDepartmentDialog: function () {
            this._oDepartmentDialog.close();
        },

        // REASSIGN

        _openReassignDialog: async function (sDepartmentId, iCount) {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();

            if (!this._oReassignDialog) {
                this._oReassignDialog = await this.loadFragment({
                    name: "companymanagement.view.ReassignDepartmentDialog"
                });
            }

            this._sReassignFromId = sDepartmentId;

            this.getView().getModel("reassign").setProperty(
                "/message",
                oBundle.getText("msgDepartmentInUse", [iCount])
            );

            this.byId("reassignTarget").setSelectedKey("");
            this.byId("reassignTarget").setValueState("None");
            this._oReassignDialog.open();
        },

        onConfirmReassign: async function () {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            var oTarget = this.byId("reassignTarget");
            var sToId = oTarget.getSelectedKey();

            if (!sToId || sToId === this._sReassignFromId) {
                oTarget.setValueState("Error");
                MessageToast.show(oBundle.getText("msgPickOtherDepartment"));
                return;
            }
            oTarget.setValueState("None");

            var oModel = this.getOwnerComponent().getModel("v4");
            var oBinding = oModel.bindContext("/reassignDepartment(...)");

            oBinding.setParameter("fromID", this._sReassignFromId);
            oBinding.setParameter("toID", sToId);

            try {
                await oBinding.execute();

                MessageToast.show(oBundle.getText("msgDepartmentReassigned"));
                this.getOwnerComponent().getModel().refresh(true);
                this._oReassignDialog.close();
            } catch (oError) {
                MessageToast.show(oBundle.getText("msgDepartmentDeleteError"));
            }
        },

        onCloseReassignDialog: function () {
            this._oReassignDialog.close();
        },

        // MERGE SKILLS

        onMergeSkill: async function (oEvent) {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            var oContext = oEvent.getSource().getBindingContext();

            if (!oContext) {
                return;
            }

            if (!this._oMergeSkillDialog) {
                this._oMergeSkillDialog = await this.loadFragment({
                    name: "companymanagement.view.MergeSkillDialog"
                });
            }

            this._sMergeFromId = oContext.getProperty("ID");

            this.getView().getModel("merge").setProperty(
                "/message",
                oBundle.getText("msgMergeSkillInfo", [
                    oContext.getProperty("name"),
                    oContext.getProperty("usageCount") || 0
                ])
            );

            this.byId("mergeSkillTarget").setSelectedKey("");
            this.byId("mergeSkillTarget").setValueState("None");
            this._oMergeSkillDialog.open();
        },

        onConfirmMergeSkill: async function () {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            var oTarget = this.byId("mergeSkillTarget");
            var sToId = oTarget.getSelectedKey();

            if (!sToId || sToId === this._sMergeFromId) {
                oTarget.setValueState("Error");
                MessageToast.show(oBundle.getText("msgPickOtherSkill"));
                return;
            }
            oTarget.setValueState("None");

            var oModel = this.getOwnerComponent().getModel("v4");
            var oBinding = oModel.bindContext("/mergeSkills(...)");

            oBinding.setParameter("fromID", this._sMergeFromId);
            oBinding.setParameter("toID", sToId);

            try {
                await oBinding.execute();

                MessageToast.show(oBundle.getText("msgSkillsMerged"));
                this.getOwnerComponent().getModel().refresh(true);
                this._oMergeSkillDialog.close();
            } catch (oError) {
                MessageToast.show(oBundle.getText("msgSkillsMergeError"));
            }
        },

        onCloseMergeSkillDialog: function () {
            this._oMergeSkillDialog.close();
        }

    });
});

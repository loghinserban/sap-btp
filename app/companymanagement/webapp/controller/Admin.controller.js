sap.ui.define([
    "companymanagement/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (BaseController, JSONModel, Filter, FilterOperator, MessageToast, MessageBox) {
    "use strict";

    return BaseController.extend("companymanagement.controller.Admin", {

        onInit: function () {
            // modele locale doar pentru textele din dialoguri
            this.getView().setModel(new JSONModel({ message: "" }), "reassign");
            this.getView().setModel(new JSONModel({ message: "" }), "merge");
        },

        // verde = neatribuit (se poate sterge), altfel doar informativ
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
            const oBinding = this.byId(sTableId).getBinding("items");
            if (!oBinding) {
                return;
            }

            const sValue = (sQuery || "").trim();
            oBinding.filter(sValue ? [new Filter("name", FilterOperator.Contains, sValue)] : []);
        },

        onNavBack: function () {
            this.getRouter().navTo("RouteView", {}, true);
        },

    //skills

        onAddSkill: async function () {
            const oDialog = await this._loadSkillDialog();

            this._sEditSkillPath = null;  

            oDialog.setTitle(this.getResourceBundle().getText("createSkill"));
            this.byId("skillFormName").setValue("");
            this.byId("skillFormName").setValueState("None");
            this.byId("skillFormDescription").setValue("");
            oDialog.open();
        },

        onEditSkill: async function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext();
            if (!oContext) {
                return;
            }

            const oDialog = await this._loadSkillDialog();
            const oSkill = oContext.getObject();

            this._sEditSkillPath = oContext.getPath();   

            oDialog.setTitle(this.getResourceBundle().getText("editSkill"));
            this.byId("skillFormName").setValue(oSkill.name || "");
            this.byId("skillFormName").setValueState("None");
            this.byId("skillFormDescription").setValue(oSkill.description || "");
            oDialog.open();
        },

        onSaveSkill: function () {
            const oModel = this.getODataModel();
            const oBundle = this.getResourceBundle();
            const oNameInput = this.byId("skillFormName");
            const sName = oNameInput.getValue().trim();

            if (!sName) {
                oNameInput.setValueState("Error");
                MessageToast.show(oBundle.getText("msgFillRequiredFields"));
                return;
            }
            oNameInput.setValueState("None");

            const oSkill = {
                name: sName,
                description: this.byId("skillFormDescription").getValue().trim()
            };

          // same object 2 outcomes
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
            const oModel = this.getODataModel();
            const oBundle = this.getResourceBundle();
            const oContext = oEvent.getSource().getBindingContext();
            const sPath = oContext.getPath();

            // usageCount vine deja calculat din serviciu, nu mai citim EmployeeSkills
            const iUsed = oContext.getProperty("usageCount") || 0;

            if (iUsed > 0) {
                MessageBox.error(oBundle.getText("msgSkillInUse", [iUsed]));
                return;
            }

            MessageBox.confirm(oBundle.getText("msgConfirmDeleteSkillMaster"), {
                title: oBundle.getText("msgConfirmDeleteTitle"),
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                onClose: (oAction) => {
                    if (oAction !== MessageBox.Action.OK) {
                        return;
                    }

                    oModel.remove(sPath, {
                        success: () => {
                            MessageToast.show(oBundle.getText("msgSkillMasterDeleted"));
                            oModel.refresh(true);
                        },
                        error: () => MessageToast.show(oBundle.getText("msgSkillMasterDeleteError"))
                    });
                }
            });
        },

        onCloseSkillDialog: function () {
            this._oSkillDialog.close();
        },

        _loadSkillDialog: async function () {
            if (!this._oSkillDialog) {
                this._oSkillDialog = await this.loadFragment({
                    name: "companymanagement.view.SkillFormDialog"
                });
            }
            return this._oSkillDialog;
        },

       //departments

        onAddDepartment: async function () {
            const oDialog = await this._loadDepartmentDialog();

            this._sEditDepartmentPath = null;

            oDialog.setTitle(this.getResourceBundle().getText("createDepartment"));
            this.byId("departmentFormName").setValue("");
            this.byId("departmentFormName").setValueState("None");
            this.byId("departmentFormDescription").setValue("");
            oDialog.open();
        },

        onEditDepartment: async function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext();
            if (!oContext) {
                return;
            }

            const oDialog = await this._loadDepartmentDialog();
            const oDepartment = oContext.getObject();

            this._sEditDepartmentPath = oContext.getPath();

            oDialog.setTitle(this.getResourceBundle().getText("editDepartment"));
            this.byId("departmentFormName").setValue(oDepartment.name || "");
            this.byId("departmentFormName").setValueState("None");
            this.byId("departmentFormDescription").setValue(oDepartment.description || "");
            oDialog.open();
        },

        onSaveDepartment: function () {
            const oModel = this.getODataModel();
            const oBundle = this.getResourceBundle();
            const oNameInput = this.byId("departmentFormName");
            const sName = oNameInput.getValue().trim();

            if (!sName) {
                oNameInput.setValueState("Error");
                MessageToast.show(oBundle.getText("msgFillRequiredFields"));
                return;
            }
            oNameInput.setValueState("None");

            const oDepartment = {
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
            const oModel = this.getODataModel();
            const oBundle = this.getResourceBundle();
            const oContext = oEvent.getSource().getBindingContext();
            const sPath = oContext.getPath();
            const sDepartmentId = oContext.getProperty("ID");

            // cati angajati are departamentul, tot din usageCount
            const iUsed = oContext.getProperty("usageCount") || 0;

            if (iUsed > 0) {
                this._openReassignDialog(sDepartmentId, iUsed);
                return;
            }

            MessageBox.confirm(oBundle.getText("msgConfirmDeleteDepartment"), {
                title: oBundle.getText("msgConfirmDeleteTitle"),
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                onClose: (oAction) => {
                    if (oAction !== MessageBox.Action.OK) {
                        return;
                    }

                    oModel.remove(sPath, {
                        success: () => {
                            MessageToast.show(oBundle.getText("msgDepartmentDeleted"));
                            oModel.refresh(true);
                        },
                        error: () => MessageToast.show(oBundle.getText("msgDepartmentDeleteError"))
                    });
                }
            });
        },

        onCloseDepartmentDialog: function () {
            this._oDepartmentDialog.close();
        },

        _loadDepartmentDialog: async function () {
            if (!this._oDepartmentDialog) {
                this._oDepartmentDialog = await this.loadFragment({
                    name: "companymanagement.view.DepartmentFormDialog"
                });
            }
            return this._oDepartmentDialog;
        },

        //reasign

        _openReassignDialog: async function (sDepartmentId, iCount) {
            if (!this._oReassignDialog) {
                this._oReassignDialog = await this.loadFragment({
                    name: "companymanagement.view.ReassignDepartmentDialog"
                });
            }

            this._sReassignFromId = sDepartmentId;

            this.getView().getModel("reassign").setProperty(
                "/message",
                this.getResourceBundle().getText("msgDepartmentInUse", [iCount])
            );

            this.byId("reassignTarget").setSelectedKey("");
            this.byId("reassignTarget").setValueState("None");
            this._oReassignDialog.open();
        },

        onConfirmReassign: async function () {
            const oBundle = this.getResourceBundle();
            const oTarget = this.byId("reassignTarget");
            const sToId = oTarget.getSelectedKey();

            if (!sToId || sToId === this._sReassignFromId) {
                oTarget.setValueState("Error");
                MessageToast.show(oBundle.getText("msgPickOtherDepartment"));
                return;
            }
            oTarget.setValueState("None");

            try {
                
                // acelasi tipar ca la onSeedData din View.controller.js
                const oRes = await fetch("/odata/v4/catalog/reassignDepartment", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ fromID: this._sReassignFromId, toID: sToId })
                });

                if (!oRes.ok) {
                    throw new Error(await oRes.text());
                }

                MessageToast.show(oBundle.getText("msgDepartmentReassigned"));
                this.getODataModel().refresh(true);
                this._oReassignDialog.close();
            } catch (oError) {
                console.error("Reassign failed:", oError);
                MessageToast.show(oBundle.getText("msgDepartmentDeleteError"));
            }
        },

        onCloseReassignDialog: function () {
            this._oReassignDialog.close();
        },

        //merge skills

        onMergeSkill: async function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext();
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
                this.getResourceBundle().getText("msgMergeSkillInfo", [
                    oContext.getProperty("name"),
                    oContext.getProperty("usageCount") || 0
                ])
            );

            this.byId("mergeSkillTarget").setSelectedKey("");
            this.byId("mergeSkillTarget").setValueState("None");
            this._oMergeSkillDialog.open();
        },

        onConfirmMergeSkill: async function () {
            const oBundle = this.getResourceBundle();
            const oTarget = this.byId("mergeSkillTarget");
            const sToId = oTarget.getSelectedKey();

            if (!sToId || sToId === this._sMergeFromId) {
                oTarget.setValueState("Error");
                MessageToast.show(oBundle.getText("msgPickOtherSkill"));
                return;
            }
            oTarget.setValueState("None");

            try {
                // acelasi tipar ca la reassignDepartment
                const oRes = await fetch("/odata/v4/catalog/mergeSkills", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ fromID: this._sMergeFromId, toID: sToId })
                });

                if (!oRes.ok) {
                    throw new Error(await oRes.text());
                }

                MessageToast.show(oBundle.getText("msgSkillsMerged"));
                this.getODataModel().refresh(true);
                this._oMergeSkillDialog.close();
            } catch (oError) {
                console.error("Merge failed:", oError);
                MessageToast.show(oBundle.getText("msgSkillsMergeError"));
            }
        },

        onCloseMergeSkillDialog: function () {
            this._oMergeSkillDialog.close();
        }

    });
});
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

        _t: function (sKey, aArgs) { return this.getView().getModel("i18n").getResourceBundle().getText(sKey, aArgs); },

        _model: function () { return this.getOwnerComponent().getModel(); },

        _dialog: async function (sProp, sFragment) {
            if (!this[sProp]) {
                this[sProp] = await this.loadFragment({ name: "companymanagement.view." + sFragment });
            }
            return this[sProp];
        },

        _after: function (sOkKey, sErrKey, oDialog) {
            var that = this;
            return {
                success: function () {
                    MessageToast.show(that._t(sOkKey));
                    that._model().refresh(true);
                    if (oDialog) {
                        oDialog.close();
                    }
                },
                error: function () { MessageToast.show(that._t(sErrKey)); }
            };
        },

        _confirmDelete: function (sPath, sConfirmKey, sOkKey, sErrKey) {
            var that = this;

            MessageBox.confirm(this._t(sConfirmKey), {
                title: this._t("msgConfirmDeleteTitle"),
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                onClose: function (oAction) {
                    if (oAction === MessageBox.Action.OK) {
                        that._model().remove(sPath, that._after(sOkKey, sErrKey));
                    }
                }
            });
        },

        formatUsageState: function (iCount) { return iCount ? "Information" : "Success"; },

        onSearchSkills: function (oEvent) { this._filterByName("skillsMasterTable", oEvent.getSource().getValue()); },

        onSearchDepartments: function (oEvent) { this._filterByName("departmentsMasterTable", oEvent.getSource().getValue()); },

        _filterByName: function (sTableId, sQuery) {
            var sValue = sQuery.trim();
            var aFilters = sValue ? [new Filter("name", FilterOperator.Contains, sValue)] : [];

            this.byId(sTableId).getBinding("items").filter(aFilters);
        },

        onNavBack: function () {
            UIComponent.getRouterFor(this).navTo("RouteView", {}, true);
        },

        _openForm: async function (sProp, sFragment, sPrefix, sTitleKey, oContext) {
            var oDialog = await this._dialog(sProp, sFragment);

            this[sProp + "Path"] = oContext ? oContext.getPath() : null;

            oDialog.setTitle(this._t(sTitleKey));
            this.byId(sPrefix + "Name").setValue(oContext ? oContext.getProperty("name") : "");
            this.byId(sPrefix + "Name").setValueState("None");
            this.byId(sPrefix + "Description").setValue(oContext ? oContext.getProperty("description") : "");
            oDialog.open();
        },

        _saveForm: function (sProp, sPrefix, sEntitySet, sAddKey, sAddErrKey, sUpdKey, sUpdErrKey) {
            var oNameInput = this.byId(sPrefix + "Name");
            var sName = oNameInput.getValue().trim();

            if (!sName) {
                oNameInput.setValueState("Error");
                MessageToast.show(this._t("msgFillRequiredFields"));
                return;
            }
            oNameInput.setValueState("None");

            var oData = {
                name: sName,
                description: this.byId(sPrefix + "Description").getValue().trim()
            };
            var sPath = this[sProp + "Path"];

            if (sPath) {
                this._model().update(sPath, oData, this._after(sUpdKey, sUpdErrKey, this[sProp]));
            } else {
                this._model().create(sEntitySet, oData, this._after(sAddKey, sAddErrKey, this[sProp]));
            }
        },

        // SKILLS

        onAddSkill: function () { this._openForm("_oSkillDialog", "SkillFormDialog", "skillForm", "createSkill", null); },

        onEditSkill: function (oEvent) {
            this._openForm("_oSkillDialog", "SkillFormDialog", "skillForm", "editSkill", oEvent.getSource().getBindingContext());
        },

        onSaveSkill: function () {
            this._saveForm("_oSkillDialog", "skillForm", "/Skills", "msgSkillMasterAdded", "msgSkillMasterAddError", "msgSkillMasterUpdated", "msgSkillMasterUpdateError");
        },

        onDeleteSkill: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var iUsed = oContext.getProperty("usageCount") || 0;

            if (iUsed) {
                MessageBox.error(this._t("msgSkillInUse", [iUsed]));
                return;
            }

            this._confirmDelete(oContext.getPath(), "msgConfirmDeleteSkillMaster", "msgSkillMasterDeleted", "msgSkillMasterDeleteError");
        },

        onCloseSkillDialog: function () { this._oSkillDialog.close(); },

        // DEPARTMENTS

        onAddDepartment: function () {
            this._openForm("_oDepartmentDialog", "DepartmentFormDialog", "departmentForm", "createDepartment", null);
        },

        onEditDepartment: function (oEvent) {
            this._openForm("_oDepartmentDialog", "DepartmentFormDialog", "departmentForm", "editDepartment", oEvent.getSource().getBindingContext());
        },

        onSaveDepartment: function () {
            this._saveForm("_oDepartmentDialog", "departmentForm", "/Departments", "msgDepartmentAdded", "msgDepartmentAddError", "msgDepartmentUpdated", "msgDepartmentUpdateError");
        },

        onDeleteDepartment: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var iUsed = oContext.getProperty("usageCount") || 0;

            if (iUsed) {
                this._openReassignDialog(oContext.getProperty("ID"), iUsed);
                return;
            }

            this._confirmDelete(oContext.getPath(), "msgConfirmDeleteDepartment", "msgDepartmentDeleted", "msgDepartmentDeleteError");
        },

        onCloseDepartmentDialog: function () { this._oDepartmentDialog.close(); },

        // REASSIGN AND MERGE

        _openTransferDialog: async function (sProp, sFragment, sModelName, sSelectId, sMessage) {
            var oDialog = await this._dialog(sProp, sFragment);

            this.getView().getModel(sModelName).setProperty("/message", sMessage);
            this.byId(sSelectId).setSelectedKey("");
            this.byId(sSelectId).setValueState("None");
            oDialog.open();
        },

        _runTransfer: async function (sSelectId, sFromId, sAction, sPickKey, sOkKey, sErrKey, oDialog) {
            var oTarget = this.byId(sSelectId);
            var sToId = oTarget.getSelectedKey();

            if (!sToId || sToId === sFromId) {
                oTarget.setValueState("Error");
                MessageToast.show(this._t(sPickKey));
                return;
            }
            oTarget.setValueState("None");

            var oBinding = this.getOwnerComponent().getModel("v4").bindContext("/" + sAction + "(...)");
            oBinding.setParameter("fromID", sFromId);
            oBinding.setParameter("toID", sToId);

            try {
                await oBinding.execute();
                MessageToast.show(this._t(sOkKey));
                this._model().refresh(true);
                oDialog.close();
            } catch (oError) {
                MessageToast.show(this._t(sErrKey));
            }
        },

        _openReassignDialog: function (sDepartmentId, iCount) {
            this._sReassignFromId = sDepartmentId;
            this._openTransferDialog("_oReassignDialog", "ReassignDepartmentDialog", "reassign", "reassignTarget", this._t("msgDepartmentInUse", [iCount]));
        },

        onConfirmReassign: function () {
            this._runTransfer("reassignTarget", this._sReassignFromId, "reassignDepartment", "msgPickOtherDepartment", "msgDepartmentReassigned", "msgDepartmentDeleteError", this._oReassignDialog);
        },

        onCloseReassignDialog: function () { this._oReassignDialog.close(); },

        onMergeSkill: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();

            this._sMergeFromId = oContext.getProperty("ID");
            this._openTransferDialog("_oMergeSkillDialog", "MergeSkillDialog", "merge", "mergeSkillTarget", this._t("msgMergeSkillInfo", [
                oContext.getProperty("name"),
                oContext.getProperty("usageCount") || 0
            ]));
        },

        onConfirmMergeSkill: function () {
            this._runTransfer("mergeSkillTarget", this._sMergeFromId, "mergeSkills", "msgPickOtherSkill", "msgSkillsMerged", "msgSkillsMergeError", this._oMergeSkillDialog);
        },

        onCloseMergeSkillDialog: function () { this._oMergeSkillDialog.close(); }

    });
});

sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/routing/History",
    "sap/ui/core/UIComponent"
], function (Controller, MessageToast, MessageBox, History, UIComponent) {
    "use strict";

    return Controller.extend("companymanagement.controller.Detail", {

        onInit: function () {
            const oRouter = UIComponent.getRouterFor(this);
            oRouter.getRoute("RouteDetail").attachPatternMatched(this._onMatched, this);
        },

        _onMatched: function (oEvent) {
            const sId = oEvent.getParameter("arguments").param;

            //binding la entitatea employees
            this.getView().bindElement(`/Employees('${sId}')`);
        },

        onEnterEditMode: function () {
            this.byId("viewMode").addStyleClass("sapUiHidden");
            this.byId("editMode").removeStyleClass("sapUiHidden");
        },

        onCancelEditMode: function () {
            this.byId("editMode").addStyleClass("sapUiHidden");
            this.byId("viewMode").removeStyleClass("sapUiHidden");
        },

        onSaveUpdate: function () {
            const oModel = this.getOwnerComponent().getModel();
            
            const sFirstName = this.byId("inpFirstName").getValue();
            const sLastName = this.byId("inpLastName").getValue();
            const sEmail = this.byId("inpEmail").getValue();
            const sExperience = parseInt(this.byId("inpExperience").getValue()) || 0;
            const sDateOfBirth = this.byId("inpDateOfBirth").getDateValue();

            if (!sFirstName || !sLastName || !sEmail) {
                MessageToast.show("Please fill in all required fields");
                return;
            }

            const sPath = this.getView().getBindingContext().getPath();

            const oUpdatedEmployee = {
                firstName: sFirstName,
                lastName: sLastName,
                email: sEmail,
                experience: sExperience,
                dateOfBirth: sDateOfBirth
            };

            oModel.update(sPath, oUpdatedEmployee, {
                success: () => {
                    MessageToast.show("Employee updated successfully");
                    this.onCancelEditMode();
                },
                error: (oError) => {
                    MessageToast.show("Error updating employee");
                    console.error("Update failed:", oError);
                }
            });
        },

        onDeleteEmployee: function () {
            const oModel = this.getOwnerComponent().getModel();
            const sPath = this.getView().getBindingContext().getPath();
            const oRouter = UIComponent.getRouterFor(this);

            MessageBox.confirm("Are you sure you want to delete this employee?", {
                title: "Confirm Deletion",
                onClose: (oAction) => {
                    if (oAction === MessageBox.Action.OK) {
                        oModel.remove(sPath, {
                            success: () => {
                                MessageToast.show("Employee deleted successfully");
                                oRouter.navTo("RouteView", {}, true);
                            },
                            error: (oError) => {
                                MessageToast.show("Error deleting employee");
                                console.error("Delete failed:", oError);
                            }
                        });
                    }
                }
            });
        },

        onNavback: function () {
            const oRouter = UIComponent.getRouterFor(this);
            oRouter.navTo("RouteView", {}, true);
        }
    }); 


});
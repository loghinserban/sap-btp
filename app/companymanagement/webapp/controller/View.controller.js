sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/Button",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/UIComponent"
], (Controller, Button, MessageToast, JsonModel, Filter, FilterOperator, UIComponent) => {
    "use strict";
    return Controller.extend("companymanagement.controller.View", {
        onInit() {
            const oModel = this.getOwnerComponent().getModel();
            
            oModel.read("/Departments", {
                success: (oResult) => {
                    console.log("Departments loaded:", oResult);
                },
                error: (oError) => {
                    console.error("Failed to load departments:", oError);
                    MessageToast.show("Failed to load departments");
                }
            });
        },

        onItemPress: function (oEvent) {
            const oItem = oEvent.getParameter("listItem");
            const oCtx = oItem.getBindingContext();
            const sPath = oCtx.getPath();
            
            const sId = sPath.match(/guid'(.+?)'/)[1];
            this.getOwnerComponent().getRouter().navTo("RouteDetail", { param: sId });
        },

        onItemSearch: function (oEvent) {
            const sValue = oEvent.getParameter("value");
            const oList = this.byId("employeeList");
            const oBinding = oList.getBinding("items");
            
            const aFilters = [];
            if (sValue) {
                aFilters.push(new Filter("firstName", FilterOperator.Contains, sValue));
                aFilters.push(new Filter("lastName", FilterOperator.Contains, sValue));
                aFilters.push(new Filter("email", FilterOperator.Contains, sValue));
            }
            
            const oFilter = new Filter({
                filters: aFilters,
                and: false
            });
            
            oBinding.filter(aFilters.length > 0 ? oFilter : []);
        },

        onAddEmployee: function () {
            const oModel = this.getOwnerComponent().getModel();
            
            const sEmployeeName = this.byId("employeeName").getValue();
            const sEmail = this.byId("email").getValue();
            const sDepartmentId = this.byId("cbDepartment").getSelectedKey();
            const sDateOfBirth = this.byId("dateOfBirth").getDateValue();
            
            if (!sEmployeeName || !sEmail || !sDepartmentId) {
                MessageToast.show("Please fill in all required fields.");
                return;
            }

            const oEmployeeData = {
                firstName: sEmployeeName,
                email: sEmail,
                dateOfBirth: sDateOfBirth,
                department_ID: sDepartmentId
            };

            oModel.create("/Employees", oEmployeeData, {
                success: () => {
                    const oList = this.byId("employeeList");
                    const oBinding = oList.getBinding("items");
                    oBinding.refresh();
                    
                    this.byId("employeeName").setValue("");
                    this.byId("email").setValue("");
                    this.byId("cbDepartment").setSelectedKey("");
                    this.byId("dateOfBirth").setDateValue(null);
                    
                    MessageToast.show("Employee added successfully!");
                },
                error: (oError) => {
                    console.error("Create failed:", oError);
                    MessageToast.show("Error adding employee.");
                }
            });
        }
    });
});



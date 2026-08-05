sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/Button",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/routing/History",
    "sap/ui/core/UIComponent"
], (Controller, Button, MessageToast, JsonModel, Filter, FilterOperator, History, UIComponent) => {
    "use strict";
    return Controller.extend("companymanagement.controller.View", {
        onInit() {
            const oModel = this.getOwnerComponent().getModel();
            const oDepartmentsModel = new JsonModel();

            // oModel.read("/Departments", {
            //     success: function (oData) {
            //         oDepartmentsModel.setData(oData);
            //         this.getView().setModel(oDepartmentsModel, "departments");
            //     }.bind(this),
            //     error: function (oError) {
            //         MessageToast.show("Failed to load departments");
            //     }
            // });

            oModel.read("/Departments", {
                // urlParameters: {
                //     $expand: "department"
                // },
                success: function (oResult) {
                    console.log(oResult);
                },
                error: function (oError) {
                    console.log(oError);
                }

            })
        },


        onItemPress: function (oEvent) {
            const oItem = oEvent.getParameter("listItem");
            const oCtx = oItem.getBindingContext();
            const sPath = oCtx.getPath();
            
            const sId = sPath.match(/guid'(.+?)'/)[1]; // Extract the ID from the path
            this.getOwnerComponent().getRouter().navTo("employeeDetails", { employeeId: sId });
        },

        onAddEmployee: function () {
          const oModel = this.getOwnerComponent().getModel();
          
          const sEmployeeName = this.byId("employeeName").getValue();
          const sEmail = this.byId("email").getValue();
          const sDepartmentId = this.byId("cbDepartment").getSelectedKey();
          const sDateOfBirth = this.byId("dateOfBirth").getDateValue();
          
          if (!sEmployeeName || !sEmail || !sDepartmentId) {
            MessageToast.show("Please fill in all fields.");
            return;
          }

          const oEmployeeData = {
            firstName: sEmployeeName,
            email: sEmail,
            dateOfBirth: sDateOfBirth,
            department_ID: sDepartmentId
          };

          oModel.create("/Employees", oEmployeeData, {
            success: function () {
              oModel.refresh(); 
              this.byId("employeeName").setValue("");
              this.byId("email").setValue("");
              this.byId("cbDepartment").setSelectedKey("");
              this.byId("dateOfBirth").setDateValue(null);
              MessageToast.show("Employee added successfully!");
            }.bind(this),
            error: function () {    
              MessageToast.show("Error adding employee.");
            }
          });
        }
    });
});


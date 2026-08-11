sap.ui.define([
    "companymanagement/controller/BaseController",
    "sap/ui/core/library",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast"
], (BaseController, coreLibrary, Filter, FilterOperator, MessageToast) => {
    "use strict";

    const ValueState = coreLibrary.ValueState;

    const BASIC_SEARCH_FIELDS = ["firstName", "lastName", "email"];

    return BaseController.extend("companymanagement.controller.View", {

        onInit() {
            this._oDepartmentDialog = null;
        },

        //list report
        onBeforeRebindTable(oEvent) {
            const mBindingParams = oEvent.getParameter("bindingParams");

            mBindingParams.parameters = mBindingParams.parameters || {};
            mBindingParams.parameters.expand = "department";

            const sQuery = (this.byId("smartFilterBar").getBasicSearchValue() || "").trim();

            if (sQuery) {
                mBindingParams.filters.push(new Filter({
                    filters: BASIC_SEARCH_FIELDS.map(
                        (sField) => new Filter(sField, FilterOperator.Contains, sQuery)
                    ),
                    and: false
                }));
            }
        },

        onItemPress(oEvent) {
            const oItem = oEvent.getParameter("listItem");
            const oContext = oItem && oItem.getBindingContext();

            if (!oContext) {
                return;
            }
            oEvent.getSource().removeSelections(true);

            this.getRouter().navTo("RouteDetail", { param: oContext.getProperty("ID") });
        },

        onNavToSearch() {
            this.getRouter().navTo("RouteSearch");
        },

        //add employee
        onOpenAddEmployeeDialog() {
            return this.openEmployeeForm("add");
        },

        async onSeedData() {
            try {
                const oRes = await fetch("/odata/v4/catalog/seedDemoData", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ count: 25 })
                });
                if (!oRes.ok) { throw new Error(await oRes.text()); }
                const oData = await oRes.json();
                MessageToast.show(oData.value);
                this.byId("employeeSmartTable").rebindTable();
            } catch (e) {
                MessageToast.show("Seeding failed: " + e.message);
            }
        },

        onCloseEmployeeForm() {
            this.closeEmployeeForm();
        },

        onEmployeeFormConfirm() {
            const oPayload = this.collectEmployeeForm();

            if (!oPayload) {
                return;
            }

            const oBundle = this.getResourceBundle();

            this.getODataModel().create("/Employees", oPayload, {
                success: () => {
                    MessageToast.show(oBundle.getText("msgEmployeeAdded"));
                    this.byId("employeeSmartTable")?.rebindTable();
                    this.closeEmployeeForm();
                },
                error: (oError) => {
                    console.error("Create employee failed:", oError);
                    MessageToast.show(oBundle.getText("msgEmployeeAddError"));
                }
            });
        },
        //create department
        async onOpenDepartmentDialog() {
            this._oDepartmentDialog ??= await this.loadFragment({
                name: "companymanagement.view.DepartmentDialog"
            });
            this._oDepartmentDialog.open();
        },

        onCloseDepartmentDialog() {
            this._oDepartmentDialog?.close();
        },

        onAddDepartment() {
            const oBundle = this.getResourceBundle();
            const oNameInput = this.byId("departmentName");
            const sName = oNameInput.getValue().trim();

            if (!sName) {
                oNameInput.setValueState(ValueState.Error);
                MessageToast.show(oBundle.getText("msgFillRequiredFields"));
                return;
            }
            oNameInput.setValueState(ValueState.None);

            this.getODataModel().create("/Departments", {
                name: sName,
                description: this.byId("departmentDescription").getValue().trim()
            }, {
                success: () => {
                    MessageToast.show(oBundle.getText("msgDepartmentAdded"));
                    this.onCloseDepartmentDialog();
                },
                error: (oError) => {
                    console.error("Create department failed:", oError);
                    MessageToast.show(oBundle.getText("msgDepartmentAddError"));
                }
            });
        },

        onDepartmentDialogClosed() {
            const oNameInput = this.byId("departmentName");
            oNameInput.setValue("");
            oNameInput.setValueState(ValueState.None);
            this.byId("departmentDescription").setValue("");
        }
    });
});

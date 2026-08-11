sap.ui.define([
    "companymanagement/controller/BaseController",
    "sap/ui/core/library",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast"
], (BaseController, coreLibrary, Filter, FilterOperator, MessageToast) => {
    "use strict";

    const ValueState = coreLibrary.ValueState;

    // Fields the free-text search box matches against
    const BASIC_SEARCH_FIELDS = ["firstName", "lastName", "email"];

    return BaseController.extend("companymanagement.controller.View", {

        onInit() {
            this._oDepartmentDialog = null;
        },

        // ---------------------------------------------------------------
        // List report
        // ---------------------------------------------------------------

        /**
         * The Department column reads department/name, so the association has to be
         * expanded on every rebind - including the ones the SmartFilterBar triggers.
         *
         * The basic search value is not applied automatically either: SmartFilterBar
         * only exposes it, so it becomes an OR filter over the name/email fields,
         * AND-ed with whatever the field filters already produced.
         */
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

            this.getRouter().navTo("RouteDetail", { param: oContext.getProperty("ID") });
        },

        // ---------------------------------------------------------------
        // Add employee
        // ---------------------------------------------------------------

        onOpenAddEmployeeDialog() {
            return this.openEmployeeForm("add");
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

        // ---------------------------------------------------------------
        // Create department
        // ---------------------------------------------------------------

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

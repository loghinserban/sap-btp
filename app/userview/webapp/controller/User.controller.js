sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, Filter, FilterOperator) {
    "use strict";

    return Controller.extend("userview.controller.User", {
        onInit: function () { },

        onUserSearch: function (oEvent) {
            var sQuery = oEvent.getParameter("newValue") || oEvent.getParameter("query") || "";
            var oTable = this.byId("usersTable");
            var oBinding = oTable.getBinding("items");

            if (!oBinding) { return; }

            if (!sQuery) {
                oBinding.filter([]);
                return;
            }

            var aFilters = [
                new Filter("firstName", FilterOperator.Contains, sQuery),
                new Filter("lastName", FilterOperator.Contains, sQuery),
                new Filter("email", FilterOperator.Contains, sQuery)
            ];

            oBinding.filter(new Filter({ filters: aFilters, and: false }));
        },

        onUserPress: function (oEvent) {
            var oCtx = oEvent.getSource().getBindingContext();
            if (!oCtx) { return; }

            var sId = oCtx.getProperty("ID");
            this.getOwnerComponent().getRouter().navTo("RouteDetail", { id: sId });
        }
    });
});
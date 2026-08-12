sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("userview.controller.UserDetails", {
        onInit: function () {
            this.getOwnerComponent().getRouter()
                .getRoute("RouteDetail")
                .attachPatternMatched(this._onPatternMatched, this);
        },

        _onPatternMatched: function (oEvent) {
            const sId = oEvent.getParameter("arguments").id;
            this.getView().bindElement({
                path: "/Employees('" + sId + "')",
                parameters: {
                    expand: "department,skills($expand=skill),reviews"
                }
            });
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("RouteUser");
        }
    });
});
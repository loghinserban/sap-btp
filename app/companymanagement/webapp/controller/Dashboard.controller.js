sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/viz/ui5/format/ChartFormatter",
    "sap/viz/ui5/api/env/Format"
], function (Controller, UIComponent, JSONModel, MessageToast, ChartFormatter, Format) {
    "use strict";

    return Controller.extend("companymanagement.controller.Dashboard", {

        onInit: function () {
            this.getView().setModel(new JSONModel({ kpis: {}, topSkills: [], departments: [], risks: [] }), "dash");

            Format.numericFormatter(ChartFormatter.getInstance());
            this._setupDonut("skillsDonut", "skillsDonutPopover");
            this._setupDonut("departmentsDonut", "departmentsDonutPopover");

            UIComponent.getRouterFor(this).getRoute("RouteDashboard").attachPatternMatched(this._loadDashboard, this);
        },

        _setupDonut: function (sChartId, sPopoverId) {
            var oChart = this.byId(sChartId);

            oChart.setVizProperties({
                title: { visible: false },
                legend: { visible: true },
                plotArea: { dataLabel: { visible: true } }
            });
            this.byId(sPopoverId).connect(oChart.getVizUid());
        },

        _t: function (sKey, aArgs) { return this.getView().getModel("i18n").getResourceBundle().getText(sKey, aArgs); },

        _loadDashboard: async function () {
            var oPage = this.byId("dashboardPage");
            var oBinding = this.getOwnerComponent().getModel("v4").bindContext("/getDashboard(...)");

            oPage.setBusy(true);

            try {
                await oBinding.execute();
                this.getView().getModel("dash").setData(oBinding.getBoundContext().getObject());
            } catch (oError) {
                MessageToast.show(this._t("msgDashboardError"));
            }

            oPage.setBusy(false);
        },

        onRefresh: function () { this._loadDashboard(); },

        onNavBack: function () {
            UIComponent.getRouterFor(this).navTo("RouteView", {}, true);
        },

        formatExperts: function (iCount) { return this._t("dashExpertsCount", [iCount || 0]); },

        formatMonths: function (iMonths, iEmployees) {
            if (!iEmployees) {
                return this._t("neverUsed");
            }
            if (!iMonths) {
                return this._t("usedThisMonth");
            }
            return this._t("usedMonthsAgo", [iMonths]);
        }

    });
});

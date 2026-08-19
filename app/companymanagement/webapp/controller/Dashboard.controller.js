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
            this.getView().setModel(new JSONModel({
                kpis: {},
                topSkills: [],
                departments: [],
                risks: []
            }), "dash");

            Format.numericFormatter(ChartFormatter.getInstance());

            var oVizProperties = {
                title: { visible: false },
                legend: { visible: true },
                plotArea: { dataLabel: { visible: true } }
            };

            var oSkillsDonut = this.byId("skillsDonut");
            oSkillsDonut.setVizProperties(oVizProperties);
            this.byId("skillsDonutPopover").connect(oSkillsDonut.getVizUid());

            var oDepartmentsDonut = this.byId("departmentsDonut");
            oDepartmentsDonut.setVizProperties(oVizProperties);
            this.byId("departmentsDonutPopover").connect(oDepartmentsDonut.getVizUid());

            var oRouter = UIComponent.getRouterFor(this);
            oRouter.getRoute("RouteDashboard").attachPatternMatched(this._loadDashboard, this);
        },

        _loadDashboard: async function () {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            var oPage = this.byId("dashboardPage");

            oPage.setBusy(true);

            var oModel = this.getOwnerComponent().getModel("v4");
            var oBinding = oModel.bindContext("/getDashboard(...)");

            try {
                await oBinding.execute();
                var oData = oBinding.getBoundContext().getObject();

                this.getView().getModel("dash").setData({
                    kpis: oData.kpis || {},
                    topSkills: oData.topSkills || [],
                    departments: oData.departments || [],
                    risks: oData.risks || []
                });
            } catch (oError) {
                MessageToast.show(oBundle.getText("msgDashboardError"));
            }

            oPage.setBusy(false);
        },

        onRefresh: function () {
            this._loadDashboard();
        },

        onNavBack: function () {
            UIComponent.getRouterFor(this).navTo("RouteView", {}, true);
        },

        formatExperts: function (iCount) {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            return oBundle.getText("dashExpertsCount", [iCount || 0]);
        },

        formatMonths: function (iMonths, iEmployees) {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();

            if (!iEmployees) {
                return oBundle.getText("neverUsed");
            }
            if (!iMonths) {
                return oBundle.getText("usedThisMonth");
            }
            return oBundle.getText("usedMonthsAgo", [iMonths]);
        }

    });
});

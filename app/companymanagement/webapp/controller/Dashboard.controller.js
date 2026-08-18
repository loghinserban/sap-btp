sap.ui.define([
    "companymanagement/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/viz/ui5/format/ChartFormatter",
    "sap/viz/ui5/api/env/Format"
], (BaseController, JSONModel, MessageToast, ChartFormatter, Format) => {
    "use strict";

    const EMPTY_DASHBOARD = {
        kpis: {
            employees: 0,
            departments: 0,
            skills: 0,
            assignments: 0,
            avgSkillsPerEmployee: 0,
            avgRating: 0,
            employeesWithoutSkills: 0,
            unusedSkills: 0,
            singleExpertSkills: 0
        },
        topSkills: [],
        departments: [],
        risks: []
    };

    return BaseController.extend("companymanagement.controller.Dashboard", {

        onInit() {
            this.getView().setModel(new JSONModel(EMPTY_DASHBOARD), "dash");

            Format.numericFormatter(ChartFormatter.getInstance());
            this._setupDonut("skillsDonut", "skillsDonutPopover");
            this._setupDonut("departmentsDonut", "departmentsDonutPopover");

            this.getOwnerComponent().getRouter().getRoute("RouteDashboard")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        // titlul e deja in headerul panoului, asa ca il ascundem in grafic
        _setupDonut(sVizId, sPopoverId) {
            const oVizFrame = this.byId(sVizId);

            oVizFrame.setVizProperties({
                title: { visible: false },
                legend: { visible: true },
                plotArea: { dataLabel: { visible: true } }
            });

            this.byId(sPopoverId).connect(oVizFrame.getVizUid());
        },

        _onRouteMatched() {
            this._loadDashboard();
        },

        onRefresh() {
            this._loadDashboard();
        },

        onNavBack() {
            this.getRouter().navTo("RouteView", {}, true);
        },

        // o singura chemare, cifrele se calculeaza in serviciu
        async _loadDashboard() {
            const oPage = this.byId("dashboardPage");
            oPage.setBusy(true);

            try {
                // const oData = await this.callFunction("getDashboard");


                var oModel = this.getView().getModel("v4");
                 var oBinding = oModel.bindContext("/getDashboard(...)"); 
                  await oBinding.execute(); 
                  var oData = oBinding.getBoundContext().getObject();

                this.getView().getModel("dash").setData({
                    kpis: oData.kpis || EMPTY_DASHBOARD.kpis,
                    topSkills: oData.topSkills || [],
                    departments: oData.departments || [],
                    risks: oData.risks || []
                });
            } catch (oError) {
                console.error("Dashboard failed:", oError);
                MessageToast.show(this.getResourceBundle().getText("msgDashboardError"));
            } finally {
                oPage.setBusy(false);
            }
        },

        formatExperts(iCount) {
            return this.getResourceBundle().getText("dashExpertsCount", [iCount || 0]);
        },

        formatMonths(iMonths, iEmployees) {
            const oBundle = this.getResourceBundle();

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

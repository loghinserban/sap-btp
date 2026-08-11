sap.ui.define([
    "companymanagement/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast"
], (BaseController, JSONModel, Filter, FilterOperator, MessageToast) => {
    "use strict";

    const FRESHNESS_WEIGHT = {
        Success: 1,
        Warning: 0.7,
        None: 0.5,
        Error: 0.4
    };

    const FRESHNESS_ICON = {
        Success: "sap-icon://message-success",
        Warning: "sap-icon://message-warning",
        Error: "sap-icon://message-error",
        None: "sap-icon://question-mark"
    };

    const SEARCH_DELAY = 300;

    return BaseController.extend("companymanagement.controller.Search", {

        onInit() {
            this.getView().setModel(new JSONModel({
                results: [],
                busy: false,
                searched: false,
                hasPartial: false
            }), "search");
        },


        onFilterChange() {
            clearTimeout(this._iSearchTimer);
            this._iSearchTimer = setTimeout(this.onSearch.bind(this), SEARCH_DELAY);
        },

        onSearch() {
            clearTimeout(this._iSearchTimer);

            const oSearchModel = this.getView().getModel("search");
            const aWantedSkills = this._getWantedSkills();
            const sQuery = this.byId("searchQuery").getValue().trim();

            if (!aWantedSkills.length && !sQuery) {
                oSearchModel.setData({ results: [], busy: false, searched: false, hasPartial: false });
                return;
            }

            const iMinRating = parseInt(this.byId("searchMinRating").getSelectedKey(), 10);
            const aFilters = [];


            if (aWantedSkills.length) {
                aFilters.push(new Filter({
                    filters: aWantedSkills.map((oSkill) => new Filter("skill_ID", FilterOperator.EQ, oSkill.ID)),
                    and: false
                }));
            }

            if (iMinRating > 1) {
                aFilters.push(new Filter("rating", FilterOperator.GE, iMinRating));
            }

            oSearchModel.setProperty("/busy", true);

            this.getODataModel().read("/EmployeeSkills", {
                filters: aFilters,
                urlParameters: {
                    "$expand": "employee/department,skill"
                },
                success: (oData) => {
                    this._buildResults(oData.results, aWantedSkills);
                    oSearchModel.setProperty("/busy", false);
                    oSearchModel.setProperty("/searched", true);
                },
                error: (oError) => {
                    console.error("Search failed:", oError);
                    oSearchModel.setProperty("/results", []);
                    oSearchModel.setProperty("/hasPartial", false);
                    oSearchModel.setProperty("/busy", false);
                    oSearchModel.setProperty("/searched", true);
                    MessageToast.show(this.getResourceBundle().getText("msgSearchError"));
                }
            });
        },

        _getWantedSkills() {
            return this.byId("searchSkills").getSelectedItems().map((oItem) => ({
                ID: oItem.getKey(),
                name: oItem.getText()
            }));
        },

        _buildResults(aRows, aWantedSkills) {
            const oBundle = this.getResourceBundle();
            const iMaxMonths = parseInt(this.byId("searchFreshness").getSelectedKey(), 10);
            const sDepartmentId = this.byId("searchDepartment").getSelectedKey();
            const sQuery = this.byId("searchQuery").getValue().trim().toLowerCase();
            const iMinExperience = parseInt(this.byId("searchMinExperience").getValue(), 10);
            const iMinAge = parseInt(this.byId("searchMinAge").getValue(), 10);
            const iMaxAge = parseInt(this.byId("searchMaxAge").getValue(), 10);

            const mByEmployee = {};

            aRows.forEach((oRow) => {
                const oEmployee = oRow.employee;

                if (!oEmployee) {
                    return;
                }

                const iMonths = this.monthsSince(oRow.lastUsed);

                // Un skill fara lastUsed nu poate dovedi ca e new
                if (iMaxMonths && (iMonths === null || iMonths > iMaxMonths)) {
                    return;
                }

                if (sDepartmentId && oEmployee.department_ID !== sDepartmentId) {
                    return;
                }

                if (sQuery) {
                    const sHaystack = `${oEmployee.firstName} ${oEmployee.lastName} ${oEmployee.email}`.toLowerCase();
                    if (!sHaystack.includes(sQuery)) {
                        return;
                    }
                }

                if (!isNaN(iMinExperience) && (oEmployee.experience || 0) < iMinExperience) {
                    return;
                }

                const iAge = this.calculateAge(oEmployee.dateOfBirth);

                if (!isNaN(iMinAge) && (iAge === null || iAge < iMinAge)) {
                    return;
                }
                if (!isNaN(iMaxAge) && (iAge === null || iAge > iMaxAge)) {
                    return;
                }

                const oEntry = mByEmployee[oEmployee.ID] ??= {
                    ID: oEmployee.ID,
                    fullName: `${oEmployee.firstName} ${oEmployee.lastName}`,
                    email: oEmployee.email,
                    departmentName: oEmployee.department ? oEmployee.department.name : "",
                    experience: oEmployee.experience,
                    age: iAge,
                    skillIds: [],
                    skills: []
                };

                // Acelasi skill poate ajunge de doua ori pe un angajat, iar atunci
                // acoperirea calculata mai jos ar iesi gresit.
                if (oEntry.skillIds.includes(oRow.skill_ID)) {
                    return;
                }

                const sFreshness = this.formatFreshness(oRow.lastUsed);

                oEntry.skillIds.push(oRow.skill_ID);
                oEntry.skills.push({
                    label: `${oRow.skill ? oRow.skill.name : ""} · ${oRow.rating}/5 · ${this._formatAge(iMonths)}`,
                    freshness: sFreshness,
                    icon: FRESHNESS_ICON[sFreshness],
                    rating: oRow.rating,
                    weight: FRESHNESS_WEIGHT[sFreshness]
                });
            });

            const aResults = Object.values(mByEmployee);

            aResults.forEach((oEntry) => {
                oEntry.score = this._calculateScore(oEntry.skills);
                oEntry.worstFreshness = this._worstFreshness(oEntry.skills);
                oEntry.matched = oEntry.skills.length;

                if (aWantedSkills.length) {
                    // Un search care intoarce zero rezultate nu ajuta pe nimeni. Aratam si
                    // potrivirile partiale, dar spunem raspicat ce lipseste si le tinem sub
                    // cele complete
                    aWantedSkills
                        .filter((oSkill) => !oEntry.skillIds.includes(oSkill.ID))
                        .forEach((oSkill) => {
                            oEntry.skills.push({
                                label: oBundle.getText("skillMissing", [oSkill.name]),
                                freshness: "None",
                                icon: "sap-icon://less",
                                rating: 0,
                                weight: 0
                            });
                        });

                    oEntry.coverageText = oBundle.getText("coverage", [oEntry.matched, aWantedSkills.length]);
                } else {
                    oEntry.coverageText = oBundle.getText("coverageSkills", [oEntry.matched]);
                }
            });


            aResults.sort((oLeft, oRight) =>
                oRight.matched - oLeft.matched ||
                oRight.score - oLeft.score ||
                (oRight.experience || 0) - (oLeft.experience || 0)
            );

            this.getView().getModel("search").setProperty("/results", aResults);
            this.getView().getModel("search").setProperty(
                "/hasPartial",
                aWantedSkills.length > 1 && aResults.some((oEntry) => oEntry.matched < aWantedSkills.length)
            );
        },

        _formatAge(iMonths) {
            const oBundle = this.getResourceBundle();

            if (iMonths === null) {
                return oBundle.getText("neverUsed");
            }
            if (iMonths < 1) {
                return oBundle.getText("usedThisMonth");
            }
            if (iMonths < 12) {
                return oBundle.getText("usedMonthsAgo", [iMonths]);
            }

            return oBundle.getText("usedYearsAgo", [Math.floor(iMonths / 12)]);
        },

        _calculateScore(aSkills) {
            const fTotal = aSkills.reduce(
                (fSum, oSkill) => fSum + oSkill.rating * oSkill.weight,
                0
            );

            return Math.round((fTotal / aSkills.length / 5) * 100);
        },

        _worstFreshness(aSkills) {
            const aOrder = ["Success", "None", "Warning", "Error"];

            return aSkills.reduce(
                (sWorst, oSkill) =>
                    aOrder.indexOf(oSkill.freshness) > aOrder.indexOf(sWorst) ? oSkill.freshness : sWorst,
                "Success"
            );
        },

        onClearFilters() {
            this.byId("searchSkills").setSelectedKeys([]);
            this.byId("searchMinRating").setSelectedKey("1");
            this.byId("searchFreshness").setSelectedKey("0");
            this.byId("searchDepartment").setSelectedKey("");
            this.byId("searchMinExperience").setValue("");
            this.byId("searchMinAge").setValue("");
            this.byId("searchMaxAge").setValue("");
            this.byId("searchQuery").setValue("");

            this.getView().getModel("search").setData({
                results: [],
                busy: false,
                searched: false,
                hasPartial: false
            });
        },

        onResultPress(oEvent) {
            const oItem = oEvent.getParameter("listItem");
            const oContext = oItem && oItem.getBindingContext("search");

            if (!oContext) {
                return;
            }
            oEvent.getSource().removeSelections(true);

            this.getRouter().navTo("RouteDetail", { param: oContext.getProperty("ID") });
        },

        onNavBack() {
            this.getRouter().navTo("RouteView", {}, true);
        }
    });
});

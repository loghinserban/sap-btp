sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], function (Controller, UIComponent, Filter, FilterOperator, JSONModel, MessageToast) {
    "use strict";

    return Controller.extend("companymanagement.controller.Search", {

        onInit: function () {
            this.getView().setModel(new JSONModel(), "search");
            this.reset();
        },

        reset: function () {
            this.getView().getModel("search").setData({
                results: [],
                busy: false,
                searched: false,
                hasPartial: false
            });
        },

        text: function (key, args) { return this.getView().getModel("i18n").getResourceBundle().getText(key, args); },

        onFilterChange: function () {
            clearTimeout(this.timer);
            this.timer = setTimeout(this.onSearch.bind(this), 300);
        },

        onSearch: function () {
            clearTimeout(this.timer);

            var searchModel = this.getView().getModel("search");
            var items = this.byId("searchSkills").getSelectedItems();
            var wantedIds = [];
            var wantedNames = [];

            for (var i = 0; i < items.length; i++) {
                wantedIds.push(items[i].getKey());
                wantedNames.push(items[i].getText());
            }

            if (wantedIds.length === 0 && this.byId("searchQuery").getValue().trim() === "") {
                this.reset();
                return;
            }

            var filters = [];

            if (wantedIds.length > 0) {
                var skillFilters = [];

                for (var j = 0; j < wantedIds.length; j++) {
                    skillFilters.push(new Filter("skill_ID", FilterOperator.EQ, wantedIds[j]));
                }

                filters.push(new Filter({ filters: skillFilters, and: false }));
            }

            var minRating = parseInt(this.byId("searchMinRating").getSelectedKey(), 10);

            if (minRating > 1) {
                filters.push(new Filter("rating", FilterOperator.GE, minRating));
            }

            searchModel.setProperty("/busy", true);

            this.getOwnerComponent().getModel().read("/EmployeeSkills", {
                filters: filters,
                urlParameters: { "$expand": "employee/department,skill" },
                success: (data) => {
                    this.buildResults(data.results, wantedIds, wantedNames);
                    searchModel.setProperty("/busy", false);
                    searchModel.setProperty("/searched", true);
                },
                error: () => {
                    this.reset();
                    searchModel.setProperty("/searched", true);
                    MessageToast.show(this.text("msgSearchError"));
                }
            });
        },

        buildResults: function (rows, wantedIds, wantedNames) {
            var maxMonths = parseInt(this.byId("searchFreshness").getSelectedKey(), 10);
            var departmentId = this.byId("searchDepartment").getSelectedKey();
            var query = this.byId("searchQuery").getValue().trim().toLowerCase();
            var minExperience = parseInt(this.byId("searchMinExperience").getValue(), 10);
            var minAge = parseInt(this.byId("searchMinAge").getValue(), 10);
            var maxAge = parseInt(this.byId("searchMaxAge").getValue(), 10);

            var results = [];
            var byEmployee = {};

            for (var i = 0; i < rows.length; i++) {
                var row = rows[i];
                var employee = row.employee;

                if (!employee) {
                    continue;
                }

                var months = null;

                if (row.lastUsed) {
                    months = Math.floor((new Date() - new Date(row.lastUsed)) / (1000 * 60 * 60 * 24 * 30.44));
                }

                if (maxMonths > 0 && (months === null || months > maxMonths)) {
                    continue;
                }
                if (departmentId && employee.department_ID !== departmentId) {
                    continue;
                }
                if (query && (employee.firstName + " " + employee.lastName + " " + employee.email).toLowerCase().indexOf(query) < 0) {
                    continue;
                }
                if (!isNaN(minExperience) && (employee.experience || 0) < minExperience) {
                    continue;
                }

                var age = this.calculateAge(employee.dateOfBirth);

                if (!isNaN(minAge) && (age === null || age < minAge)) {
                    continue;
                }
                if (!isNaN(maxAge) && (age === null || age > maxAge)) {
                    continue;
                }

                var entry = byEmployee[employee.ID];

                if (!entry) {
                    entry = {
                        ID: employee.ID,
                        fullName: employee.firstName + " " + employee.lastName,
                        email: employee.email,
                        departmentName: employee.department ? employee.department.name : "",
                        experience: employee.experience,
                        age: age,
                        skillIds: [],
                        skills: [],
                        total: 0,
                        worstRank: 0,
                        worstFreshness: "Success"
                    };

                    byEmployee[employee.ID] = entry;
                    results.push(entry);
                }

                if (entry.skillIds.indexOf(row.skill_ID) >= 0) {
                    continue;
                }

                var state = "None";
                var icon = "sap-icon://question-mark";
                var weight = 0.5;
                var rank = 1;
                var when = this.text("neverUsed");

                if (months !== null) {
                    if (months < 1) {
                        when = this.text("usedThisMonth");
                    } else if (months < 12) {
                        when = this.text("usedMonthsAgo", [months]);
                    } else {
                        when = this.text("usedYearsAgo", [Math.floor(months / 12)]);
                    }

                    if (months <= 12) {
                        state = "Success";
                        icon = "sap-icon://message-success";
                        weight = 1;
                        rank = 0;
                    } else if (months <= 24) {
                        state = "Warning";
                        icon = "sap-icon://message-warning";
                        weight = 0.7;
                        rank = 2;
                    } else {
                        state = "Error";
                        icon = "sap-icon://message-error";
                        weight = 0.4;
                        rank = 3;
                    }
                }

                entry.skillIds.push(row.skill_ID);
                entry.skills.push({
                    label: (row.skill ? row.skill.name : "") + " · " + row.rating + "/5 · " + when,
                    freshness: state,
                    icon: icon,
                    rating: row.rating,
                    weight: weight
                });
                entry.total = entry.total + row.rating * weight;

                if (rank > entry.worstRank) {
                    entry.worstRank = rank;
                    entry.worstFreshness = state;
                }
            }

            var hasPartial = false;

            for (var k = 0; k < results.length; k++) {
                var result = results[k];

                result.matched = result.skills.length;
                result.score = Math.round(result.total / result.matched / 5 * 100);

                if (wantedIds.length === 0) {
                    result.coverageText = this.text("coverageSkills", [result.matched]);
                } else {
                    for (var m = 0; m < wantedIds.length; m++) {
                        if (result.skillIds.indexOf(wantedIds[m]) < 0) {
                            result.skills.push({
                                label: this.text("skillMissing", [wantedNames[m]]),
                                freshness: "None",
                                icon: "sap-icon://less",
                                rating: 0,
                                weight: 0
                            });
                        }
                    }

                    result.coverageText = this.text("coverage", [result.matched, wantedIds.length]);
                }

                if (wantedIds.length > 1 && result.matched < wantedIds.length) {
                    hasPartial = true;
                }
            }

            results.sort(function (a, b) {
                if (b.matched !== a.matched) {
                    return b.matched - a.matched;
                }
                if (b.score !== a.score) {
                    return b.score - a.score;
                }
                return (b.experience || 0) - (a.experience || 0);
            });

            this.getView().getModel("search").setProperty("/results", results);
            this.getView().getModel("search").setProperty("/hasPartial", hasPartial);
        },

        calculateAge: function (dateOfBirth) {
            if (!dateOfBirth) {
                return null;
            }

            var birth = new Date(dateOfBirth);
            var today = new Date();
            var age = today.getFullYear() - birth.getFullYear();
            var monthDiff = today.getMonth() - birth.getMonth();

            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                age = age - 1;
            }

            return age;
        },

        onClearFilters: function () {
            this.byId("searchSkills").setSelectedKeys([]);
            this.byId("searchMinRating").setSelectedKey("1");
            this.byId("searchFreshness").setSelectedKey("0");
            this.byId("searchDepartment").setSelectedKey("");
            this.byId("searchMinExperience").setValue("");
            this.byId("searchMinAge").setValue("");
            this.byId("searchMaxAge").setValue("");
            this.byId("searchQuery").setValue("");
            this.reset();
        },

        onResultPress: function (oEvent) {
            var context = oEvent.getParameter("listItem").getBindingContext("search");

            oEvent.getSource().removeSelections(true);
            UIComponent.getRouterFor(this).navTo("RouteDetail", { param: context.getProperty("ID") });
        },

        onNavBack: function () {
            UIComponent.getRouterFor(this).navTo("RouteView", {}, true);
        }

    });
});

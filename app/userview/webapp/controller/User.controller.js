sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (
    Controller,
    Fragment,
    JSONModel,
    Filter,
    FilterOperator,
    MessageBox,
    MessageToast
) {
    "use strict";

    return Controller.extend("userview.controller.User", {
        onInit: function () {
            this._sCurrentEmployeeId = this._resolveCurrentEmployeeId();

            var oViewModel = new JSONModel({
                currentUser: {
                    ID: this._sCurrentEmployeeId || "",
                    firstName: "",
                    lastName: "",
                    email: "",
                    experience: 0,
                    dateOfBirth: null,
                    department: { name: "" },
                    skills: [],
                    reviews: []
                }
            });
            this.getView().setModel(oViewModel, "view");

            setTimeout(function () {
                this._loadData();
            }.bind(this), 100);
        },

        _loadData: function () {
            var oModel = this.getOwnerComponent().getModel() || this.getView().getModel();

            if (!oModel) {
                MessageBox.error("OData model not initialized.");
                return;
            }

            oModel.read("/Employees", {
                success: function (oData) {
                    console.log("Employees loaded:", oData);
                },
                error: function (oErr) {
                    console.error("Load employees error:", oErr);
                }
            });

            if (this._sCurrentEmployeeId) {
                this._loadCurrentUserData();
            }
        },

        _loadCurrentUserData: function () {
            var oModel = this.getOwnerComponent().getModel() || this.getView().getModel();
            var sId = this._sCurrentEmployeeId;

            if (!oModel || !sId) return;

            oModel.read("/Employees('" + sId + "')", {
                urlParameters: {
                    "$expand": "department,skills($expand=skill),reviews"
                },
                success: function (oData) {
                    console.log("Current user loaded:", oData);

                    function parseDateSafe(value) {
                        if (value === null || value === undefined || value === "") {
                            return null;
                        }
                        if (typeof value === "string" && value.indexOf("/Date(") === 0) {
                            try {
                                var ms = parseInt(value.replace(/\/Date\((-?\d+)\)\//, "$1"), 10);
                                var d = new Date(ms);
                                return isNaN(d.getTime()) ? null : d;
                            } catch (e) {
                                return null;
                            }
                        }
                        if (typeof value === "string") {
                            var d2 = new Date(value);
                            return isNaN(d2.getTime()) ? null : d2;
                        }
                        if (value instanceof Date) {
                            return isNaN(value.getTime()) ? null : value;
                        }
                        return null;
                    }

                    if (oData.hasOwnProperty("dateOfBirth")) {
                        oData.dateOfBirth = parseDateSafe(oData.dateOfBirth);
                    }

                    var aSkills = (oData.skills && oData.skills.results) ? oData.skills.results : [];
                    aSkills = aSkills.map(function (item) {
                        var cloned = Object.assign({}, item);
                        cloned.lastUsed = parseDateSafe(cloned.lastUsed);
                        return cloned;
                    });

                    var aReviews = (oData.reviews && oData.reviews.results) ? oData.reviews.results.map(function (r) {
                        var rc = Object.assign({}, r);
                        if (rc.createdAt) { rc.createdAt = parseDateSafe(rc.createdAt); }
                        return rc;
                    }) : [];

                    var oVM = this.getView().getModel("view");
                    oVM.setProperty("/currentUser", oData);
                    oVM.setProperty("/currentUser/skills", aSkills);
                    oVM.setProperty("/currentUser/reviews", aReviews);
                }.bind(this),
                error: function (oErr) {
                    console.error("Load current user error:", oErr);
                }
            });
        },

        _resolveCurrentEmployeeId: function () {
            try {
                var oParams = new URLSearchParams(window.location.search);
                var sId = oParams.get("employeeId") || oParams.get("empId");
                if (sId) {
                    localStorage.setItem("currentEmployeeId", sId);
                    return sId;
                }
            } catch (e) { }

            try {
                var oCompData = this.getOwnerComponent().getComponentData();
                var oStartup = oCompData && oCompData.startupParameters;
                var sId = (oStartup && oStartup.employeeId && oStartup.employeeId[0]) ||
                    (oStartup && oStartup.empId && oStartup.empId[0]);
                if (sId) {
                    localStorage.setItem("currentEmployeeId", sId);
                    return sId;
                }
            } catch (e2) { }

            return localStorage.getItem("currentEmployeeId") || "";
        },

        onUserSearch: function (oEvent) {
            var sQuery = oEvent.getParameter("newValue") || oEvent.getParameter("query") || "";
            var oTable = this.byId("usersTable");
            var oBinding = oTable && oTable.getBinding("items");
            if (!oBinding) return;

            if (!sQuery) {
                oBinding.filter([]);
                return;
            }

            oBinding.filter(new Filter({
                filters: [
                    new Filter("firstName", FilterOperator.Contains, sQuery),
                    new Filter("lastName", FilterOperator.Contains, sQuery),
                    new Filter("email", FilterOperator.Contains, sQuery)
                ],
                and: false
            }));
        },

        onUserPress: function (oEvent) {
            var oCtx = oEvent.getSource().getBindingContext();
            if (!oCtx) return;
            var sId = oCtx.getProperty("ID");
            this.getOwnerComponent().getRouter().navTo("RouteDetail", { id: sId });
        },

        onOpenEditProfile: async function () {
            if (!this._oEditProfileDialog) {
                this._oEditProfileDialog = await Fragment.load({
                    id: this.getView().getId(),
                    name: "userview.view.fragments.EditProfileDialog",
                    controller: this
                });
                this.getView().addDependent(this._oEditProfileDialog);
            }
            this._oEditProfileDialog.open();
        },

        onCloseEditProfileDialog: function () {
            if (this._oEditProfileDialog) this._oEditProfileDialog.close();
        },

        onSaveProfile: function () {
            var oView = this.getView();
            var oModel = this.getOwnerComponent().getModel() || oView.getModel();

            var oFirstName = Fragment.byId(oView.getId(), "inpFirstName");
            var oLastName = Fragment.byId(oView.getId(), "inpLastName");
            var oEmail = Fragment.byId(oView.getId(), "inpEmail");
            var oExperience = Fragment.byId(oView.getId(), "inpExperience");
            var oDateOfBirth = Fragment.byId(oView.getId(), "dpDateOfBirth");

            var sFirstName = (oFirstName.getValue() || "").trim();
            var sLastName = (oLastName.getValue() || "").trim();
            var sEmail = (oEmail.getValue() || "").trim();
            var iExperience = parseInt(oExperience.getValue()) || 0;

            var oDOB = oDateOfBirth.getDateValue ? oDateOfBirth.getDateValue() : null;
            var sDateOfBirth = null;
            if (oDOB instanceof Date && !isNaN(oDOB)) {
                sDateOfBirth = this._formatDate(oDOB);
            } else {
                sDateOfBirth = oDateOfBirth.getValue ? oDateOfBirth.getValue() : null;
            }

            if (!sFirstName || !sLastName || !sEmail) {
                MessageBox.warning("Please fill in all required fields.");
                return;
            }

            var sEmployeeId = this._sCurrentEmployeeId;
            var oPayload = {
                firstName: sFirstName,
                lastName: sLastName,
                email: sEmail,
                experience: iExperience,
                dateOfBirth: sDateOfBirth || null
            };

            console.log("Sending payload:", oPayload);

            oModel.update("/Employees('" + sEmployeeId + "')", oPayload, {
                success: function () {
                    MessageToast.show("Profile updated successfully.");
                    this.onCloseEditProfileDialog();
                    this._loadCurrentUserData();
                }.bind(this),
                error: function (oErr) {
                    console.error("Update error:", oErr);
                    MessageBox.error("Failed to update profile.");
                }
            });
        },

        onOpenAddReview: async function () {
            if (!this._oAddReviewDialog) {
                this._oAddReviewDialog = await Fragment.load({
                    id: this.getView().getId(),
                    name: "userview.view.fragments.AddReviewDialog",
                    controller: this
                });
                this.getView().addDependent(this._oAddReviewDialog);
            }
            this._oAddReviewDialog.open();
        },

        onOpenEditSkills: async function () {
            if (!this._oEditSkillsDialog) {
                this._oEditSkillsDialog = await Fragment.load({
                    id: this.getView().getId(),
                    name: "userview.view.fragments.EditSkillsDialog",
                    controller: this
                });
                this.getView().addDependent(this._oEditSkillsDialog);
            }
            var oView = this.getView();
            try {
                var oCb = Fragment.byId(oView.getId(), "cbSkill");
                if (oCb && oCb.setSelectedKey) { oCb.setSelectedKey(""); }
                var oInp = Fragment.byId(oView.getId(), "inpNewSkill");
                if (oInp && oInp.setValue) { oInp.setValue(""); }
                var oRi = Fragment.byId(oView.getId(), "riSkillRating");
                if (oRi && oRi.setValue) { oRi.setValue(3); }
                var oDp = Fragment.byId(oView.getId(), "dpLastUsed");
                if (oDp && oDp.setDateValue) { oDp.setDateValue(null); } else if (oDp && oDp.setValue) { oDp.setValue(""); }
            } catch (e) {
                console.warn("Could not clear fragment controls yet:", e);
            }
            this._oEditSkillsDialog.open();
        },

        onOpenUploadCV: async function () {
            if (!this._oUploadCvDialog) {
                this._oUploadCvDialog = await Fragment.load({
                    id: this.getView().getId(),
                    name: "userview.view.fragments.UploadCVDialog",
                    controller: this
                });
                this.getView().addDependent(this._oUploadCvDialog);
            }
            this._oUploadCvDialog.open();
        },

        onCloseReviewDialog: function () {
            if (this._oAddReviewDialog) this._oAddReviewDialog.close();
        },

        onCloseSkillDialog: function () {
            if (this._oEditSkillsDialog) this._oEditSkillsDialog.close();
        },

        onCloseCvDialog: function () {
            if (this._oUploadCvDialog) this._oUploadCvDialog.close();
        },

        onSubmitReview: function () {
            var oView = this.getView();
            var oModel = this.getOwnerComponent().getModel() || oView.getModel();

            var oEmp = Fragment.byId(oView.getId(), "cbReviewEmployee");
            var oTitle = Fragment.byId(oView.getId(), "inpReviewTitle");
            var oContent = Fragment.byId(oView.getId(), "taReviewContent");
            var oStars = Fragment.byId(oView.getId(), "riReviewStars");

            var sEmployeeId = oEmp.getSelectedKey();
            var sTitle = (oTitle.getValue() || "").trim();
            var sContent = (oContent.getValue() || "").trim();
            var iStars = Math.round(oStars.getValue() || 0);

            if (!sEmployeeId || !sTitle || !sContent || iStars < 1) {
                MessageBox.warning("Please complete all review fields.");
                return;
            }

            oModel.create("/Reviews", {
                title: sTitle,
                content: sContent,
                stars: iStars,
                employee_ID: sEmployeeId
            }, {
                success: function () {
                    MessageToast.show("Recommendation submitted.");
                    this.onCloseReviewDialog();
                    oEmp.setSelectedKey("");
                    oTitle.setValue("");
                    oContent.setValue("");
                    oStars.setValue(5);
                    this._loadCurrentUserData();
                }.bind(this),
                error: function () {
                    MessageBox.error("Failed to submit recommendation.");
                }
            });
        },

        onSaveSkill: function () {
            var oView = this.getView();
            var oModel = this.getOwnerComponent().getModel() || oView.getModel();

            var oSkill = Fragment.byId(oView.getId(), "cbSkill");
            var oRating = Fragment.byId(oView.getId(), "riSkillRating");
            var oDate = Fragment.byId(oView.getId(), "dpLastUsed");

            var sSkillId = oSkill.getSelectedKey();
            var iRating = Math.round(oRating.getValue() || 0);

            var oDateVal = oDate.getDateValue ? oDate.getDateValue() : null;
            var sLastUsed = null;
            if (oDateVal instanceof Date && !isNaN(oDateVal)) {
                sLastUsed = this._formatDate(oDateVal);
            } else {
                sLastUsed = oDate.getValue ? oDate.getValue() : null;
            }

            var sEmployeeId = this._sCurrentEmployeeId;

            if (!sEmployeeId) {
                MessageBox.warning("Current employee ID is missing.");
                return;
            }
            if (!sSkillId || !sLastUsed || iRating < 1) {
                MessageBox.warning("Please select skill, rating and date.");
                return;
            }

            var sReadPath = "/EmployeeSkills?$filter=employee_ID eq '" + sEmployeeId + "' and skill_ID eq '" + sSkillId + "'";
            oModel.read(sReadPath, {
                success: function (oData) {
                    var aRows = (oData && oData.results) ? oData.results : [];

                    if (aRows.length > 0) {
                        oModel.update("/EmployeeSkills('" + aRows[0].ID + "')", {
                            rating: iRating,
                            lastUsed: sLastUsed
                        }, {
                            success: function () {
                                MessageToast.show("Skill updated.");
                                this.onCloseSkillDialog();
                                this._loadCurrentUserData();
                            }.bind(this),
                            error: function (oErr) {
                                console.error("Update EmployeeSkill error:", oErr);
                                MessageBox.error("Failed to update skill.");
                            }
                        });
                    } else {
                        oModel.create("/EmployeeSkills", {
                            employee_ID: sEmployeeId,
                            skill_ID: sSkillId,
                            rating: iRating,
                            lastUsed: sLastUsed
                        }, {
                            success: function () {
                                MessageToast.show("Skill added.");
                                this.onCloseSkillDialog();
                                this._loadCurrentUserData();
                            }.bind(this),
                            error: function (oErr) {
                                console.error("Create EmployeeSkill error:", oErr);
                                MessageBox.error("Failed to add skill.");
                            }
                        });
                    }
                }.bind(this),
                error: function (oErr) {
                    console.error("Read EmployeeSkills error:", oErr);
                    MessageBox.error("Failed to check existing skill.");
                }
            });
        },

        
        onAddOrUpdateSkill: function () {
            var oView = this.getView();
            var oModel = this.getOwnerComponent().getModel() || oView.getModel();

            var oSkill = Fragment.byId(oView.getId(), "cbSkill");
            var oNewSkill = Fragment.byId(oView.getId(), "inpNewSkill");
            var oRating = Fragment.byId(oView.getId(), "riSkillRating");
            var oDate = Fragment.byId(oView.getId(), "dpLastUsed");

            var sSelectedSkillId = oSkill ? oSkill.getSelectedKey() : "";
            var sNewSkillName = (oNewSkill && oNewSkill.getValue ? oNewSkill.getValue() : "").trim();
            var iRating = Math.round(oRating.getValue() || 0);

            var oDateVal = oDate && oDate.getDateValue ? oDate.getDateValue() : null;
            var sLastUsed = null;
            if (oDateVal instanceof Date && !isNaN(oDateVal)) {
                sLastUsed = this._formatDate(oDateVal);
            } else {
                sLastUsed = oDate && oDate.getValue ? oDate.getValue() : null;
            }

            var sEmployeeId = this._sCurrentEmployeeId;

            if (!sEmployeeId) {
                MessageBox.warning("Current employee ID is missing.");
                return;
            }

            if (!sSelectedSkillId && !sNewSkillName) {
                MessageBox.warning("Please select an existing skill or type a new skill name.");
                return;
            }

            if (iRating < 1 || !sLastUsed) {
                MessageBox.warning("Please provide a rating and last used date.");
                return;
            }

            var that = this;

            function continueWithSkillId(sSkillId) {
                that._createOrUpdateEmployeeSkill(oModel, sEmployeeId, sSkillId, iRating, sLastUsed, oDateVal);
            }

            if (sNewSkillName && !sSelectedSkillId) {
                console.log("Creating new Skill:", sNewSkillName);
                oModel.create("/Skills", { name: sNewSkillName }, {
                    success: function (oCreated) {
                        console.log("Created Skill result:", oCreated);
                        var sCreatedId = oCreated && (oCreated.ID || oCreated.id || oCreated.Id) || null;
                        if (!sCreatedId && oCreated && oCreated.hasOwnProperty("name")) {
                            var sEscaped = sNewSkillName.replace(/'/g, "''");
                            oModel.read("/Skills?$filter=name eq '" + sEscaped + "'", {
                                success: function (oData) {
                                    var a = (oData && oData.results) || [];
                                    if (a.length > 0) {
                                        continueWithSkillId(a[0].ID || a[0].id);
                                    } else {
                                        MessageBox.error("Could not determine created skill ID.");
                                    }
                                },
                                error: function (oErr) {
                                    console.error("Read-back created Skill failed:", oErr);
                                    MessageBox.error("Failed to verify created skill.");
                                }
                            });
                        } else {
                            continueWithSkillId(sCreatedId);
                        }
                    },
                    error: function (oErr) {
                        console.error("Create skill failed:", oErr);
                        MessageBox.error("Failed to create new skill.");
                    }
                });
            } else {
                continueWithSkillId(sSelectedSkillId);
            }
        },

       
        _createOrUpdateEmployeeSkill: function (oModel, sEmployeeId, sSkillId, iRating, sLastUsedString, oDateObj) {
    var that = this;
    var sReadPath = "/EmployeeSkills?$filter=employee_ID eq '" + sEmployeeId + "' and skill_ID eq '" + sSkillId + "'";
    console.log("Checking EmployeeSkills with read path:", sReadPath);

    oModel.read(sReadPath, {
        success: function (oData) {
            var aRows = (oData && oData.results) ? oData.results : [];

            var dateProp = "lastUsed";
            if (aRows.length > 0) {
                var sample = aRows[0];
                if (sample.hasOwnProperty("lastUsed")) dateProp = "lastUsed";
                else if (sample.hasOwnProperty("LastUsed")) dateProp = "LastUsed";
                else if (sample.hasOwnProperty("Lastused")) dateProp = "Lastused";
            }

            function buildPayload(includeKeys) {
                var p = { rating: iRating };
                p[dateProp] = (oDateObj instanceof Date && !isNaN(oDateObj)) ? oDateObj : sLastUsedString;
                if (includeKeys) {
                    p.employee_ID = sEmployeeId;
                    p.skill_ID = sSkillId;
                }
                return p;
            }

            var bOriginalUseBatch = true;
            if (typeof oModel.getUseBatch === "function") {
                bOriginalUseBatch = !!oModel.getUseBatch();
                try { oModel.setUseBatch(false); } catch (e) { console.warn("setUseBatch(false) failed:", e); }
            }

            function restoreBatch() {
                try {
                    if (typeof oModel.setUseBatch === "function") oModel.setUseBatch(!!bOriginalUseBatch);
                } catch (e) { console.warn("restoring useBatch failed:", e); }
            }

            if (aRows.length > 0) {
                var sEmpSkillId = aRows[0].ID;
                var updatePayload = buildPayload(false);
                console.log("Updating EmployeeSkill ID:", sEmpSkillId, "payload:", updatePayload);

                oModel.update("/EmployeeSkills('" + sEmpSkillId + "')", updatePayload, {
                    success: function (oResp) {
                        console.log("Update success response:", oResp);
                        MessageToast.show("Skill updated.");
                        restoreBatch();
                        that.onCloseSkillDialog();
                        that._loadCurrentUserData();
                    },
                    error: function (oErr) {
                        console.error("Update failed:", oErr);
                        try { console.error("Response text:", oErr && (oErr.responseText || oErr.response)); } catch (e) {}
                        restoreBatch();
                        MessageBox.error("Failed to update skill. See console Network/Logs for details.");
                    }
                });
            } else {
                var createPayload = buildPayload(true);
                console.log("Creating EmployeeSkill payload:", createPayload);

                oModel.create("/EmployeeSkills", createPayload, {
                    success: function (oResp) {
                        console.log("Create success response:", oResp);
                        MessageToast.show("Skill added.");
                        restoreBatch();
                        that.onCloseSkillDialog();
                        that._loadCurrentUserData();
                    },
                    error: function (oErr) {
                        console.error("Create failed:", oErr);
                        try { console.error("Response text:", oErr && (oErr.responseText || oErr.response)); } catch (e) {}
                        restoreBatch();
                        MessageBox.error("Failed to add skill. See console Network/Logs for details.");
                    }
                });
            }
        },
        error: function (oErr) {
            console.error("Read EmployeeSkills failed:", oErr);
            try { console.error("Response text:", oErr && (oErr.responseText || oErr.response)); } catch (e) {}
            MessageBox.error("Failed to check existing skill.");
        }
    });
},

        
        onDeleteSkill: function (oEvent) {
            var oBtn = oEvent.getSource();
            var aCustom = oBtn.getCustomData && oBtn.getCustomData();
            var sId = null;
            if (Array.isArray(aCustom) && aCustom.length > 0) {
                sId = aCustom[0].getValue();
            } else if (oBtn.data) {
                sId = oBtn.data("employeeSkillId");
            }

            if (!sId) {
                MessageBox.error("Could not determine EmployeeSkill id to delete.");
                return;
            }

            var oView = this.getView();
            var oModel = this.getOwnerComponent().getModel() || oView.getModel();
            var that = this;

            MessageBox.confirm("Delete this skill from your profile?", {
                onClose: function (sAction) {
                    if (sAction !== MessageBox.Action.OK) return;

                    oModel.remove("/EmployeeSkills('" + sId + "')", {
                        success: function () {
                            MessageToast.show("Skill removed.");
                            that._loadCurrentUserData();
                        },
                        error: function (oErr) {
                            console.error("Remove EmployeeSkill failed:", oErr);
                            MessageBox.error("Failed to remove skill.");
                        }
                    });
                }
            });
        },

        onUploadCv: function () {
            var oView = this.getView();
            var oUploader = Fragment.byId(oView.getId(), "fuCv");
            var oFile = oUploader && oUploader.oFileUpload && oUploader.oFileUpload.files && oUploader.oFileUpload.files[0];

            if (!oFile) {
                MessageBox.warning("Please choose a CV file.");
                return;
            }

            if (!this._sCurrentEmployeeId) {
                MessageBox.warning("Current employee ID is missing.");
                return;
            }

            var oProgress = Fragment.byId(oView.getId(), "piUploadProgress");
            var oBtnUpload = Fragment.byId(oView.getId(), "btnUploadCv");

            oProgress.setVisible(true);
            oProgress.setPercentValue(0);
            oBtnUpload.setEnabled(false);

            var oFormData = new FormData();
            oFormData.append("file", oFile);
            oFormData.append("employeeID", this._sCurrentEmployeeId);

            fetch("/cv/upload", {
                method: "POST",
                body: oFormData
            })
                .then(function (res) {
                    oProgress.setPercentValue(100);

                    if (!res.ok) {
                        throw new Error(res.statusText);
                    }
                    return res.json();
                })
                .then(function (data) {
                    MessageToast.show("CV uploaded successfully!");
                    oUploader.clear();
                    setTimeout(function () {
                        this.onCloseCvDialog();
                    }.bind(this), 500);
                }.bind(this))
                .catch(function (err) {
                    console.error("CV upload error:", err);
                    MessageBox.error("Failed to upload CV: " + err.message);
                })
                .finally(function () {
                    oProgress.setVisible(false);
                    oBtnUpload.setEnabled(true);
                });
        },

        onUploadCvComplete: function (oEvent) {
            var oUploader = oEvent.getSource();
            var iStatus = oEvent.getParameter("status");

            if (iStatus === 200 || iStatus === 201) {
                MessageToast.show("CV uploaded successfully!");
                oUploader.clear();
                this.onCloseCvDialog();
            } else {
                MessageBox.error("CV upload failed with status: " + iStatus);
            }
        },

        
        _formatDate: function (oDate) {
            if (!(oDate instanceof Date) || isNaN(oDate)) {
                return null;
            }
            var y = oDate.getFullYear();
            var m = (oDate.getMonth() + 1).toString().padStart(2, "0");
            var d = oDate.getDate().toString().padStart(2, "0");
            return y + "-" + m + "-" + d;
        }
    });
});
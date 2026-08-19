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

    // Fallback profile shown when the app is opened without ?employeeId=... in the URL.
    var DEFAULT_EMPLOYEE_ID = "003ae184-91ff-411e-a672-3b83bed81d27";

    // OData V2 delivers dates as "/Date(ms)/"; everything else may already be a Date or an ISO string.
    function parseODataDate(value) {
        if (value === null || value === undefined || value === "") {
            return null;
        }
        if (value instanceof Date) {
            return isNaN(value.getTime()) ? null : value;
        }
        if (typeof value === "string") {
            var d;
            if (value.indexOf("/Date(") === 0) {
                d = new Date(parseInt(value.replace(/\/Date\((-?\d+).*\)\//, "$1"), 10));
            } else {
                d = new Date(value);
            }
            return isNaN(d.getTime()) ? null : d;
        }
        return null;
    }

    return Controller.extend("userview.controller.User", {
        onInit: function () {
            this._resolveCurrentEmployeeId();

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

            // Holds the skills read out of an uploaded CV until the user confirms them.
            this.getView().setModel(new JSONModel({ hasResults: false, skills: [] }), "cv");

            var oModel = this._getModel();
            if (!oModel) {
                MessageBox.error("OData model not initialized.");
                return;
            }

            // createKey() and typed filters need the metadata, so wait for it instead of guessing a timeout.
            oModel.metadataLoaded().then(this._loadCurrentUserData.bind(this));
        },

        _getModel: function () {
            return this.getOwnerComponent().getModel() || this.getView().getModel();
        },

        // Builds a metadata-correct key predicate, e.g. /EmployeeSkills(guid'...').
        _entityPath: function (oModel, sEntitySet, sId) {
            try {
                return "/" + oModel.createKey(sEntitySet, { ID: sId });
            } catch (e) {
                return "/" + sEntitySet + "(guid'" + sId + "')";
            }
        },

        // Pulls the server-side reason out of a V2 error so the user sees more than "it failed".
        _extractError: function (oErr) {
            try {
                var sBody = oErr && (oErr.responseText || (oErr.response && oErr.response.body));
                if (sBody) {
                    var oMessage = JSON.parse(sBody).error.message;
                    return oMessage.value || oMessage;
                }
            } catch (e) { /* not a parsable OData error */ }
            return (oErr && (oErr.message || oErr.statusText)) || "Unknown error";
        },

        _loadCurrentUserData: function () {
            var oModel = this._getModel();
            var sId = this._sCurrentEmployeeId;

            if (!oModel || !sId) return;

            var key = oModel.createKey("/Employees", { ID : sId });
                
            oModel.read(key , {
                urlParameters: {
                    "$expand": "department,skills/skill,reviews"
                },
                success: function (oData) {
                    var aSkills = ((oData.skills && oData.skills.results) || []).map(function (item) {
                        var oSkill = Object.assign({}, item);
                        oSkill.lastUsed = parseODataDate(oSkill.lastUsed);
                        return oSkill;
                    });

                    var aReviews = ((oData.reviews && oData.reviews.results) || []).map(function (r) {
                        var oReview = Object.assign({}, r);
                        oReview.createdAt = parseODataDate(oReview.createdAt);
                        return oReview;
                    });

                    oData.dateOfBirth = parseODataDate(oData.dateOfBirth);

                    var oVM = this.getView().getModel("view");
                    oVM.setProperty("/currentUser", oData);
                    oVM.setProperty("/currentUser/skills", aSkills);
                    oVM.setProperty("/currentUser/reviews", aReviews);
                }.bind(this),
                error: function (oErr) {
                    console.error("Load current user error:", oErr);
                    MessageBox.error("Could not load your profile: " + this._extractError(oErr));
                }.bind(this)
            });
        },

        _resolveCurrentEmployeeId: async function () {
            // var sId;

            // try {
            //     var oParams = new URLSearchParams(window.location.search);
            //     sId = oParams.get("employeeId") || oParams.get("empId");
            // } catch (e) { /* no URL params available */ }

            // if (!sId) {

                try {
                    if (window.location.href.includes("applicationstudio")) {
                        this._sCurrentEmployeeId = DEFAULT_EMPLOYEE_ID;  
                    } 
                        else {
            
                        const userInfoService = await sap.ushell.Container.getServiceAsync("UserInfo");
                        console.log("User ID:", userInfoService.getId());
                        console.log("Full Name:", userInfoService.getFullName());
                        console.log("Email:", userInfoService.getEmail());
                        this._sCurrentEmployeeId = userInfoService.getId();
                    }

                } catch (e2) {
                    console.log("e2:", e2); /* not started from the launchpad */ }
            

            // if (sId) {
            //     localStorage.setItem("currentEmployeeId", sId);
            //     return sId;
            // }

            // return DEFAULT_EMPLOYEE_ID;
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

        _loadDialog: function (sPropertyName, sFragmentName) {
            if (this[sPropertyName]) {
                return Promise.resolve(this[sPropertyName]);
            }
            return Fragment.load({
                id: this.getView().getId(),
                name: sFragmentName,
                controller: this
            }).then(function (oDialog) {
                this[sPropertyName] = oDialog;
                this.getView().addDependent(oDialog);
                return oDialog;
            }.bind(this));
        },

        onOpenEditProfile: async function () {
            var oDialog = await this._loadDialog("_oEditProfileDialog", "userview.view.fragments.EditProfileDialog");
            oDialog.open();
        },

        onCloseEditProfileDialog: function () {
            if (this._oEditProfileDialog) this._oEditProfileDialog.close();
        },

        // The profile inputs are two-way bound, so a cancel has to restore the server state.
        onCancelEditProfile: function () {
            this.onCloseEditProfileDialog();
            this._loadCurrentUserData();
        },

        onSaveProfile: function () {
            var oView = this.getView();
            var oModel = this._getModel();

            var oFirstName = Fragment.byId(oView.getId(), "inpFirstName");
            var oLastName = Fragment.byId(oView.getId(), "inpLastName");
            var oEmail = Fragment.byId(oView.getId(), "inpEmail");
            var oExperience = Fragment.byId(oView.getId(), "inpExperience");
            var oDateOfBirth = Fragment.byId(oView.getId(), "dpDateOfBirth");

            var sFirstName = (oFirstName.getValue() || "").trim();
            var sLastName = (oLastName.getValue() || "").trim();
            var sEmail = (oEmail.getValue() || "").trim();
            var iExperience = parseInt(oExperience.getValue(), 10) || 0;

            if (!sFirstName || !sLastName || !sEmail) {
                MessageBox.warning("Please fill in all required fields.");
                return;
            }

            var oDOB = oDateOfBirth.getDateValue();
            // Typed-but-unparsable input must not silently clear the stored date of birth.
            if (!oDOB && (oDateOfBirth.getValue() || "").trim()) {
                MessageBox.warning("Please enter the date of birth as yyyy-MM-dd.");
                return;
            }

            if (!this._sCurrentEmployeeId) {
                MessageBox.warning("Current employee ID is missing.");
                return;
            }

            var oPayload = {
                firstName: sFirstName,
                lastName: sLastName,
                email: sEmail,
                experience: iExperience,
                dateOfBirth: this._formatDate(oDOB)
            };

            this._oEditProfileDialog.setBusy(true);
            oModel.update(this._entityPath(oModel, "Employees", this._sCurrentEmployeeId), oPayload, {
                success: function () {
                    this._oEditProfileDialog.setBusy(false);
                    MessageToast.show("Profile updated successfully.");
                    this.onCloseEditProfileDialog();
                    this._loadCurrentUserData();
                }.bind(this),
                error: function (oErr) {
                    this._oEditProfileDialog.setBusy(false);
                    console.error("Update profile error:", oErr);
                    MessageBox.error("Failed to update profile: " + this._extractError(oErr));
                }.bind(this)
            });
        },

        onOpenAddReview: async function () {
            var oDialog = await this._loadDialog("_oAddReviewDialog", "userview.view.fragments.AddReviewDialog");
            oDialog.open();
        },

        onOpenEditSkills: async function () {
            var oDialog = await this._loadDialog("_oEditSkillsDialog", "userview.view.fragments.EditSkillsDialog");
            this._resetSkillForm();
            oDialog.open();
        },

        onOpenUploadCV: async function () {
            var oDialog = await this._loadDialog("_oUploadCvDialog", "userview.view.fragments.UploadCVDialog");
            this._resetCvDialog();
            oDialog.open();
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
            var oModel = this._getModel();

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

            this._oAddReviewDialog.setBusy(true);
            oModel.create("/Reviews", {
                title: sTitle,
                content: sContent,
                stars: iStars,
                employee_ID: sEmployeeId
            }, {
                success: function () {
                    this._oAddReviewDialog.setBusy(false);
                    MessageToast.show("Recommendation submitted.");
                    this.onCloseReviewDialog();
                    oEmp.setSelectedKey("");
                    oTitle.setValue("");
                    oContent.setValue("");
                    oStars.setValue(5);
                    // Only relevant when the review was written about yourself, but cheap to keep in sync.
                    this._loadCurrentUserData();
                }.bind(this),
                error: function (oErr) {
                    this._oAddReviewDialog.setBusy(false);
                    console.error("Create review error:", oErr);
                    MessageBox.error("Failed to submit recommendation: " + this._extractError(oErr));
                }.bind(this)
            });
        },

        _resetSkillForm: function () {
            var sViewId = this.getView().getId();
            var oCb = Fragment.byId(sViewId, "cbSkill");
            var oInp = Fragment.byId(sViewId, "inpNewSkill");
            var oRi = Fragment.byId(sViewId, "riSkillRating");
            var oDp = Fragment.byId(sViewId, "dpLastUsed");

            if (oCb) oCb.setSelectedKey("");
            if (oInp) oInp.setValue("");
            if (oRi) oRi.setValue(3);
            if (oDp) oDp.setDateValue(null);
        },

        // Clicking an existing skill loads it into the form so it can be edited instead of retyped.
        onSelectEmployeeSkill: function (oEvent) {
            var oItem = oEvent.getParameter("listItem") || oEvent.getSource();
            var oCtx = oItem.getBindingContext("view");
            if (!oCtx) return;

            var oSkill = oCtx.getObject();
            var sViewId = this.getView().getId();
            var oCb = Fragment.byId(sViewId, "cbSkill");
            var oInp = Fragment.byId(sViewId, "inpNewSkill");
            var oRi = Fragment.byId(sViewId, "riSkillRating");
            var oDp = Fragment.byId(sViewId, "dpLastUsed");

            if (oCb) oCb.setSelectedKey(oSkill.skill_ID);
            if (oInp) oInp.setValue("");
            if (oRi) oRi.setValue(oSkill.rating || 0);
            if (oDp) oDp.setDateValue(oSkill.lastUsed || null);
        },

        onAddOrUpdateSkill: function () {
            var oView = this.getView();
            var oModel = this._getModel();

            var oSkill = Fragment.byId(oView.getId(), "cbSkill");
            var oNewSkill = Fragment.byId(oView.getId(), "inpNewSkill");
            var oRating = Fragment.byId(oView.getId(), "riSkillRating");
            var oDate = Fragment.byId(oView.getId(), "dpLastUsed");

            var sSelectedSkillId = oSkill ? oSkill.getSelectedKey() : "";
            var sNewSkillName = ((oNewSkill && oNewSkill.getValue()) || "").trim();
            var iRating = Math.round(oRating.getValue() || 0);
            // Send the calendar day as typed; a JS Date would be serialized as UTC and shift the day.
            var sLastUsed = this._formatDate(oDate && oDate.getDateValue());

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
            this._oEditSkillsDialog.setBusy(true);

            if (sSelectedSkillId) {
                this._createOrUpdateEmployeeSkill(oModel, sEmployeeId, sSelectedSkillId, iRating, sLastUsed);
                return;
            }

            // A typed name may already exist - reuse that skill rather than creating a duplicate.
            oModel.read("/Skills", {
                filters: [new Filter("name", FilterOperator.EQ, sNewSkillName)],
                success: function (oData) {
                    var aExisting = ((oData && oData.results) || []).filter(function (s) {
                        return (s.name || "").toLowerCase() === sNewSkillName.toLowerCase();
                    });

                    if (aExisting.length > 0) {
                        that._createOrUpdateEmployeeSkill(oModel, sEmployeeId, aExisting[0].ID, iRating, sLastUsed);
                        return;
                    }

                    oModel.create("/Skills", { name: sNewSkillName }, {
                        success: function (oCreated) {
                            var sCreatedId = oCreated && oCreated.ID;
                            if (!sCreatedId) {
                                that._oEditSkillsDialog.setBusy(false);
                                MessageBox.error("Could not determine the ID of the created skill.");
                                return;
                            }
                            that._createOrUpdateEmployeeSkill(oModel, sEmployeeId, sCreatedId, iRating, sLastUsed);
                        },
                        error: function (oErr) {
                            that._oEditSkillsDialog.setBusy(false);
                            console.error("Create skill failed:", oErr);
                            MessageBox.error("Failed to create new skill: " + that._extractError(oErr));
                        }
                    });
                },
                error: function (oErr) {
                    that._oEditSkillsDialog.setBusy(false);
                    console.error("Read Skills failed:", oErr);
                    MessageBox.error("Failed to look up the skill: " + that._extractError(oErr));
                }
            });
        },

        _createOrUpdateEmployeeSkill: function (oModel, sEmployeeId, sSkillId, iRating, sLastUsed) {
            var that = this;

            function onDone(sMessage) {
                that._oEditSkillsDialog.setBusy(false);
                MessageToast.show(sMessage);
                that.onCloseSkillDialog();
                that._loadCurrentUserData();
            }

            function onFailed(sMessage, oErr) {
                that._oEditSkillsDialog.setBusy(false);
                console.error(sMessage, oErr);
                MessageBox.error(sMessage + ": " + that._extractError(oErr));
            }

            // $filter must go through the filters option: a query string inside the path is
            // ignored by the V2 model, which would return the whole collection.
            oModel.read("/EmployeeSkills", {
                filters: [new Filter({
                    filters: [
                        new Filter("employee_ID", FilterOperator.EQ, sEmployeeId),
                        new Filter("skill_ID", FilterOperator.EQ, sSkillId)
                    ],
                    and: true
                })],
                success: function (oData) {
                    var aRows = ((oData && oData.results) || []).filter(function (row) {
                        return row.employee_ID === sEmployeeId && row.skill_ID === sSkillId;
                    });

                    if (aRows.length > 0) {
                        oModel.update(that._entityPath(oModel, "EmployeeSkills", aRows[0].ID), {
                            rating: iRating,
                            lastUsed: sLastUsed
                        }, {
                            success: function () { onDone("Skill updated."); },
                            error: function (oErr) { onFailed("Failed to update skill", oErr); }
                        });
                    } else {
                        oModel.create("/EmployeeSkills", {
                            employee_ID: sEmployeeId,
                            skill_ID: sSkillId,
                            rating: iRating,
                            lastUsed: sLastUsed
                        }, {
                            success: function () { onDone("Skill added."); },
                            error: function (oErr) { onFailed("Failed to add skill", oErr); }
                        });
                    }
                },
                error: function (oErr) { onFailed("Failed to check existing skill", oErr); }
            });
        },

        onDeleteSkill: function (oEvent) {
            var oBtn = oEvent.getSource();
            var sId = oBtn.data("employeeSkillId");

            if (!sId) {
                MessageBox.error("Could not determine which skill to delete.");
                return;
            }

            var oModel = this._getModel();
            var that = this;

            MessageBox.confirm("Delete this skill from your profile?", {
                onClose: function (sAction) {
                    if (sAction !== MessageBox.Action.OK) return;

                    oModel.remove(that._entityPath(oModel, "EmployeeSkills", sId), {
                        success: function () {
                            MessageToast.show("Skill removed.");
                            that._loadCurrentUserData();
                        },
                        error: function (oErr) {
                            console.error("Remove EmployeeSkill failed:", oErr);
                            MessageBox.error("Failed to remove skill: " + that._extractError(oErr));
                        }
                    });
                }
            });
        },

        // --- CV skill import ------------------------------------------------

        _resetCvDialog: function () {
            this._oSelectedCvFile = null;

            var oUploader = Fragment.byId(this.getView().getId(), "fuCv");
            if (oUploader) oUploader.clear();

            this.getView().getModel("cv").setData({ hasResults: false, skills: [] });
        },

        onCvFileChange: function (oEvent) {
            var aFiles = oEvent.getParameter("files");
            this._oSelectedCvFile = (aFiles && aFiles[0]) || null;
            // A new file invalidates whatever the previous one produced.
            this.getView().getModel("cv").setData({ hasResults: false, skills: [] });
        },

        onCvTypeMismatch: function (oEvent) {
            this._oSelectedCvFile = null;
            MessageBox.warning(
                "\"" + oEvent.getParameter("fileType") + "\" is not supported. " +
                "Please upload the CV as PDF or TXT."
            );
        },

        onCvFileSizeExceed: function () {
            this._oSelectedCvFile = null;
            MessageBox.warning("The CV must be 10MB or smaller.");
        },

        // The base64 payload is far too long for a URL parameter, so the actions are
        // called on the V4 endpoint, which takes them in the request body.
        _callAction: function (sAction, oPayload) {
            return fetch("/odata/v4/catalog/" + sAction, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(oPayload)
            }).then(function (oResponse) {
                return oResponse.json()
                    .catch(function () { return null; })
                    .then(function (oBody) {
                        if (!oResponse.ok) {
                            var sMessage = (oBody && oBody.error && oBody.error.message) ||
                                (oResponse.status + " " + oResponse.statusText);
                            throw new Error(sMessage);
                        }
                        // Collection-valued actions come back wrapped in "value".
                        return oBody && oBody.value !== undefined ? oBody.value : oBody;
                    });
            });
        },

        _readFileAsBase64: function (oFile) {
            return new Promise(function (resolve, reject) {
                var oReader = new FileReader();
                oReader.onload = function () {
                    var sResult = String(oReader.result || "");
                    // Strip the "data:<mime>;base64," prefix.
                    resolve(sResult.slice(sResult.indexOf(",") + 1));
                };
                oReader.onerror = function () {
                    reject(oReader.error || new Error("Could not read the file."));
                };
                oReader.readAsDataURL(oFile);
            });
        },

        onAnalyzeCv: async function () {
            var oView = this.getView();
            var oUploader = Fragment.byId(oView.getId(), "fuCv");
            var oFile = this._oSelectedCvFile ||
                (oUploader && oUploader.oFileUpload && oUploader.oFileUpload.files && oUploader.oFileUpload.files[0]);

            if (!oFile) {
                MessageBox.warning("Please choose a CV file.");
                return;
            }

            var oCvModel = oView.getModel("cv");
            this._oUploadCvDialog.setBusy(true);

            try {
                var sBase64 = await this._readFileAsBase64(oFile);
                var aSkills = await this._callAction("extractCvSkills", {
                    fileName: oFile.name,
                    contentBase64: sBase64
                });

                aSkills = (aSkills || []).map(function (oSkill) {
                    // Everything found is pre-ticked; the user unticks what does not fit.
                    return Object.assign({ selected: true }, oSkill);
                });

                oCvModel.setData({ hasResults: true, skills: aSkills });

                if (aSkills.length === 0) {
                    MessageBox.information("No skills could be read from this CV.");
                } else {
                    MessageToast.show(aSkills.length + " skill(s) found. Review them before adding.");
                }
            } catch (oErr) {
                console.error("CV skill extraction failed:", oErr);
                MessageBox.error("Could not read skills from the CV: " + oErr.message);
            } finally {
                this._oUploadCvDialog.setBusy(false);
            }
        },

        onApplyCvSkills: async function () {
            if (!this._sCurrentEmployeeId) {
                MessageBox.warning("Current employee ID is missing.");
                return;
            }

            var aSelected = (this.getView().getModel("cv").getProperty("/skills") || [])
                .filter(function (oSkill) { return oSkill.selected; })
                .map(function (oSkill) {
                    return {
                        skillID: oSkill.skillID || null,
                        name: oSkill.name,
                        rating: Math.round(oSkill.rating) || 3,
                        lastUsed: oSkill.lastUsed || null,
                        evidence: oSkill.evidence || ""
                    };
                });

            if (aSelected.length === 0) {
                MessageBox.warning("Please tick at least one skill to add.");
                return;
            }

            this._oUploadCvDialog.setBusy(true);

            try {
                var oResult = await this._callAction("applyCvSkills", {
                    employeeID: this._sCurrentEmployeeId,
                    skills: aSelected
                });

                MessageToast.show((oResult && oResult.message) || "Skills imported.");
                this._resetCvDialog();
                this.onCloseCvDialog();
                this._loadCurrentUserData();
            } catch (oErr) {
                console.error("Apply CV skills failed:", oErr);
                MessageBox.error("Could not add the skills: " + oErr.message);
            } finally {
                this._oUploadCvDialog.setBusy(false);
            }
        },

        // Formats a Date as the calendar day the user picked, without a UTC round trip.
        _formatDate: function (oDate) {
            if (!(oDate instanceof Date) || isNaN(oDate.getTime())) {
                return null;
            }
            var y = oDate.getFullYear();
            var m = (oDate.getMonth() + 1).toString().padStart(2, "0");
            var d = oDate.getDate().toString().padStart(2, "0");
            return y + "-" + m + "-" + d;
        }
    });
});

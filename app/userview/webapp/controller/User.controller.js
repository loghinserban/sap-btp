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
          var oVM = this.getView().getModel("view");
          oVM.setProperty("/currentUser", oData);
          oVM.setProperty("/currentUser/skills", (oData.skills && oData.skills.results) || []);
          oVM.setProperty("/currentUser/reviews", (oData.reviews && oData.reviews.results) || []);
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
      } catch (e) {}

      try {
        var oCompData = this.getOwnerComponent().getComponentData();
        var oStartup = oCompData && oCompData.startupParameters;
        var sId = (oStartup && oStartup.employeeId && oStartup.employeeId[0]) ||
                  (oStartup && oStartup.empId && oStartup.empId[0]);
        if (sId) {
          localStorage.setItem("currentEmployeeId", sId);
          return sId;
        }
      } catch (e2) {}

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

    onOpenEditProfile: function () {
      MessageToast.show("Edit Profile popup not implemented yet.");
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
      var sLastUsed = oDate.getValue();
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
              error: function () {
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
              error: function () {
                MessageBox.error("Failed to add skill.");
              }
            });
          }
        }.bind(this),
        error: function () {
          MessageBox.error("Failed to check existing skill.");
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

      var oFormData = new FormData();
      oFormData.append("file", oFile);
      oFormData.append("employeeID", this._sCurrentEmployeeId);

      fetch("/cv/upload", {
        method: "POST",
        body: oFormData
      })
        .then(function (res) {
          if (!res.ok) throw new Error("Upload failed");
          MessageToast.show("CV uploaded.");
          oUploader.clear();
          this.onCloseCvDialog();
        }.bind(this))
        .catch(function () {
          MessageBox.error("CV upload failed.");
        });
    }
  });
});
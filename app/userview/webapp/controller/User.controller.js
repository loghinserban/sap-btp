sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/Fragment",
  "sap/m/MessageBox",
  "sap/m/MessageToast",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function (Controller, Fragment, MessageBox, MessageToast, Filter, FilterOperator) {
  "use strict";

  return Controller.extend("userview.controller.User", {
    onInit: function () {
      this._sCurrentEmployeeId = "025a9e31-0281-4305-8cbf-5013415a8139"; 
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
      this._oAddReviewDialog && this._oAddReviewDialog.close();
    },

    onCloseSkillDialog: function () {
      this._oEditSkillsDialog && this._oEditSkillsDialog.close();
    },

    onCloseCvDialog: function () {
      this._oUploadCvDialog && this._oUploadCvDialog.close();
    },

    onSubmitReview: function () {
      var oView = this.getView();
      var oModel = oView.getModel();

      var sEmployeeId = Fragment.byId(oView.getId(), "cbReviewEmployee").getSelectedKey();
      var sTitle = Fragment.byId(oView.getId(), "inpReviewTitle").getValue().trim();
      var sContent = Fragment.byId(oView.getId(), "taReviewContent").getValue().trim();
      var iStars = Math.round(Fragment.byId(oView.getId(), "riReviewStars").getValue());

      if (!sEmployeeId || !sTitle || !sContent) {
        MessageBox.warning("Please complete all fields.");
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
        }.bind(this),
        error: function () {
          MessageBox.error("Failed to submit recommendation.");
        }
      });
    },

    onSaveSkill: function () {
      var oView = this.getView();
      var oModel = oView.getModel();

      var sSkillId = Fragment.byId(oView.getId(), "cbSkill").getSelectedKey();
      var iRating = Math.round(Fragment.byId(oView.getId(), "riSkillRating").getValue());
      var sLastUsed = Fragment.byId(oView.getId(), "dpLastUsed").getValue();

      if (!this._sCurrentEmployeeId) {
        MessageBox.warning("Current employee is not configured yet.");
        return;
      }
      if (!sSkillId || !sLastUsed) {
        MessageBox.warning("Please select skill and date.");
        return;
      }

      var sReadPath = "/EmployeeSkills?$filter=employee_ID eq '" + this._sCurrentEmployeeId + "' and skill_ID eq '" + sSkillId + "'";
      oModel.read(sReadPath, {
        success: function (oData) {
          var aRows = oData.results || [];

          if (aRows.length > 0) {
            oModel.update("/EmployeeSkills('" + aRows[0].ID + "')", {
              rating: iRating,
              lastUsed: sLastUsed
            }, {
              success: function () {
                MessageToast.show("Skill updated.");
                this.onCloseSkillDialog();
              }.bind(this),
              error: function () { MessageBox.error("Failed to update skill."); }
            });
          } else {
            oModel.create("/EmployeeSkills", {
              employee_ID: this._sCurrentEmployeeId,
              skill_ID: sSkillId,
              rating: iRating,
              lastUsed: sLastUsed
            }, {
              success: function () {
                MessageToast.show("Skill added.");
                this.onCloseSkillDialog();
              }.bind(this),
              error: function () { MessageBox.error("Failed to add skill."); }
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
      var oFile = oUploader && oUploader.oFileUpload && oUploader.oFileUpload.files[0];

      if (!oFile) {
        MessageBox.warning("Please choose a file.");
        return;
      }
      if (!this._sCurrentEmployeeId) {
        MessageBox.warning("Current employee is not configured yet.");
        return;
      }

      var oForm = new FormData();
      oForm.append("file", oFile);
      oForm.append("employeeID", this._sCurrentEmployeeId);

      fetch("/cv/upload", { method: "POST", body: oForm })
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
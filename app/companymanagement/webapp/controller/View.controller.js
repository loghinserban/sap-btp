sap.ui.define([
    "companymanagement/controller/BaseController",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], (BaseController, Filter, FilterOperator, JSONModel, MessageToast, MessageBox) => {
    "use strict";

    const BASIC_SEARCH_FIELDS = ["firstName", "lastName", "email"];

    return BaseController.extend("companymanagement.controller.View", {

        //list report
        onBeforeRebindTable(oEvent) {
            const mBindingParams = oEvent.getParameter("bindingParams");

            mBindingParams.parameters = mBindingParams.parameters || {};
            mBindingParams.parameters.expand = "department";

            const sQuery = (this.byId("smartFilterBar").getBasicSearchValue() || "").trim();

            if (sQuery) {
                mBindingParams.filters.push(new Filter({
                    filters: BASIC_SEARCH_FIELDS.map(
                        (sField) => new Filter(sField, FilterOperator.Contains, sQuery)
                    ),
                    and: false
                }));
            }
        },

        onItemPress(oEvent) {
            const oItem = oEvent.getParameter("listItem");
            const oContext = oItem && oItem.getBindingContext();

            if (!oContext) {
                return;
            }
            oEvent.getSource().removeSelections(true);

            this.getRouter().navTo("RouteDetail", { param: oContext.getProperty("ID") });
        },

        onNavToSearch() {
            this.getRouter().navTo("RouteSearch");
        },

        onNavToMasterData() {
            this.getRouter().navTo("RouteAdmin");
        },

        onNavToDashboard() {
            this.getRouter().navTo("RouteDashboard");
        },

        //add employee
        onOpenAddEmployeeDialog() {
            return this.openEmployeeForm("add");
        },

        async onSeedData() {
            try {
                const oData = await this.callAction("seedDemoData", { count: 25 });
                MessageToast.show(oData.value);
                this.byId("employeeSmartTable").rebindTable();
            } catch (e) {
                MessageToast.show("Seeding failed: " + e.message);
            }
        },

        onCloseEmployeeForm() {
            this.closeEmployeeForm();
        },

        onEmployeeFormConfirm() {
            const oPayload = this.collectEmployeeForm();

            if (!oPayload) {
                return;
            }

            this.getODataModel().create("/Employees", oPayload,
                this.crudCallbacks("msgEmployeeAdded", "msgEmployeeAddError", () => {
                    this.byId("employeeSmartTable")?.rebindTable();
                    this.closeEmployeeForm();
                })
            );
        },
        async onOpenUploadCvDialog() {
            this._oCvDialog ??= await this.loadFragment({
                name: "companymanagement.view.UploadCvDialog"
            });

            if (!this.getView().getModel("cv")) {
                this.getView().setModel(new JSONModel(), "cv");
            }
            this.getView().getModel("cv").setData({
                busy: false,
                profile: null,
                departmentID: ""
            });

            this._oCvFile = null;
            this.byId("cvFileUploader").clear();
            this._oCvDialog.open();
        },

        onCloseCvDialog() {
            this._oCvDialog?.close();
        },

        onCvFileSelected(oEvent) {
            this._oCvFile = oEvent.getParameter("files")?.[0] || null;
        },

        onCvTypeMismatch() {
            MessageToast.show(this.getResourceBundle().getText("msgCvNotPdf"));
        },

        onCvFileSizeExceed() {
            MessageToast.show(this.getResourceBundle().getText("msgCvTooLarge"));
        },

        _readAsBase64(oFile) {
            return new Promise((resolve, reject) => {
                const oReader = new FileReader();
                oReader.onload = () => resolve(String(oReader.result).split(",")[1]);
                oReader.onerror = () => reject(new Error("Could not read the file."));
                oReader.readAsDataURL(oFile);
            });
        },

        async onCvExtract() {
            const oBundle = this.getResourceBundle();
            const oCvModel = this.getView().getModel("cv");

            if (!this._oCvFile) {
                MessageToast.show(oBundle.getText("msgCvPickFile"));
                return;
            }

            oCvModel.setProperty("/busy", true);

            try {
                const sBase64 = await this._readAsBase64(this._oCvFile);

                const oProfile = await this.callAction("extractCv", {
                    fileName: this._oCvFile.name,
                    contentBase64: sBase64
                });

                oProfile.skills = (oProfile.skills || []).map((oSkill) => ({
                    ...oSkill,
                    selected: !!oSkill.skillID
                }));

                oCvModel.setProperty("/profile", oProfile);

                if (!oProfile.skills.length) {
                    MessageToast.show(oBundle.getText("msgCvNoSkills"));
                }
            } catch (e) {
                console.error("CV extraction failed:", e);
                MessageToast.show(oBundle.getText("msgCvExtractError", [e.message]));
            } finally {
                oCvModel.setProperty("/busy", false);
            }
        },

        _confirmNewSkills(aNames) {
            const oBundle = this.getResourceBundle();

            return new Promise((resolve) => {
                MessageBox.confirm(oBundle.getText("msgCvConfirmNewSkills", [aNames.join(", ")]), {
                    title: oBundle.getText("cvConfirmNewSkillsTitle"),
                    onClose: (sAction) => resolve(sAction === MessageBox.Action.OK)
                });
            });
        },

        async onCvCreateEmployee() {
            const oBundle = this.getResourceBundle();
            const oCvModel = this.getView().getModel("cv");
            const oData = oCvModel.getData();
            const oProfile = oData.profile;

            if (!oProfile) { return; }

            const aSelected = oProfile.skills.filter((oSkill) => oSkill.selected);

            const aSkills = aSelected.map(({ skillID, name, rating, lastUsed, evidence }) =>
                ({ skillID, name, rating, lastUsed, evidence }));

            // let the user see the list before it happens
            const aNewNames = aSelected
                .filter((oSkill) => !oSkill.skillID)
                .map((oSkill) => (oSkill.name || "").trim())
                .filter(Boolean);

            if (aNewNames.length && !(await this._confirmNewSkills(aNewNames))) {
                return;
            }

            oCvModel.setProperty("/busy", true);

            try {
                const oResult = await this.callAction("createEmployeeFromCv", {
                    profile: {
                        firstName: oProfile.firstName,
                        lastName: oProfile.lastName,
                        email: oProfile.email,
                        experience: Number(oProfile.experience) || 0,
                        skills: aSkills
                    },
                    departmentID: oData.departmentID || null
                });

                MessageToast.show(oResult.value);

                this.onCloseCvDialog();
                this.getODataModel().refresh();
                this.byId("employeeSmartTable")?.rebindTable();
            } catch (e) {
                console.error("Create from CV failed:", e);
                MessageToast.show(oBundle.getText("msgCvCreateError", [e.message]));
            } finally {
                oCvModel.setProperty("/busy", false);
            }
        },
    });
});

const cds = require("@sap/cds");
const v2Proxy = require("@sap/cds-odata-v2-adapter-proxy");
const xsenv = require("@sap/xsenv");
xsenv.loadEnv();
cds.on('bootstrap', (app) => {
    app.use(v2Proxy());
});
module.exports = cds.server;
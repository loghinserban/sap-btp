const cds = require("@sap/cds");

module.exports = (srv) => {
  srv.on("bootstrap", (app) => {
    app.post("/cv/upload", (req, res) => {
      
      res.status(200).json({ message: "Upload endpoint reached" });
    });
  });
};
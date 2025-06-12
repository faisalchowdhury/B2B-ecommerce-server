const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 3000;
const app = express();
app.use(cors());

app.get("/", (req, res) => {
  res.send("server working");
});

app.listen(port, () => {
  console.log("server running on ", port);
});

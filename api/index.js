const express = require("express");

const { minioClient } = require('./minio-init');
const app = express();
app.get("/", (req, res) => res.send("API placeholder - please restore your real index.js"));
const PORT = process.env.API_PORT || 3001;
app.listen(PORT, "0.0.0.0", () => console.log(`Placeholder API listening on ${PORT}`));


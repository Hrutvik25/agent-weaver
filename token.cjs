// token.js
const jwt = require("jsonwebtoken");

const token = jwt.sign(
  { agentId: "audience" },
  "changeme-audience",
  { expiresIn: "1h" }
);

console.log(token);
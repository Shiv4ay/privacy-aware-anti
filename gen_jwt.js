// gen_jwt.js
const jwt = require("jsonwebtoken");

const secret = process.env.JWT_SECRET || "jwtsecret123";

const payload = {
  sub: 1,
  username: "siba",
  role: "admin"
};

const options = {
  algorithm: "HS256",
  expiresIn: "7d"
};

const token = jwt.sign(payload, secret, options);

console.log("\nGenerated JWT:\n");
console.log(token);
console.log("\nUse this token in Authorization: Bearer <token>\n");

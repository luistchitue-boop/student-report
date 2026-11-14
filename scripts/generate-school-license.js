const { randomBytes } = require("node:crypto");

const licenseCode = `SCHOOL-${randomBytes(32).toString("hex").toUpperCase()}`;
console.log(licenseCode);

/* eslint-disable @typescript-eslint/no-require-imports */
const Module = require("module");
const path = require("path");

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolveServerOnly(
  request,
  parent,
  isMain,
  options,
) {
  if (request === "server-only") {
    return path.join(__dirname, "empty-server-only.cjs");
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

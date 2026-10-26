import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: [
    "@babel/parser",
    "@babel/traverse",
    "@vue/compiler-sfc",
  ],
};
export default config;

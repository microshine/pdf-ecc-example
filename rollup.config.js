import resolve from "@rollup/plugin-node-resolve";
import typescript from "rollup-plugin-typescript2";
import { terser } from "rollup-plugin-terser";
import virtual from "@rollup/plugin-virtual";
import pkg from "./package.json";

const banner = [];
//   "/*!",
//   " Copyright (c) ",
//   "*/",
//   "",
// ].join("\n");
const input = "src/index.ts";
const external = Object.keys(pkg.dependencies || {});

const virtualParams = {
  events: `const EventEmitter = globalThis.EventEmitter; export { EventEmitter };`,
  util: `const TextDecoder = globalThis.TextDecoder; const TextEncoder = globalThis.TextEncoder; export { TextDecoder, TextEncoder };`,
};

const outputPlugins = [];
const minimize = true;
if (minimize) {
  outputPlugins.push(terser());
}

export default [
  {
    input: "src/sign.ts",
    plugins: [
      virtual(virtualParams),
      resolve({
        mainFields: ["esnext", "module", "main"],
        preferBuiltins: true,
      }),
      typescript({
        check: true,
        tsconfigOverride: {
          compilerOptions: {
            module: "es2015",
          },
        },
      }),
    ],
    context: "globalThis",
    output: [
      {
        banner,
        file: "build/sign.js",
        format: "es",
        globals: {
          "events": "globalThis",
        },
        plugins: outputPlugins,
      },
    ],
  },
  {
    input: "src/verify.ts",
    plugins: [
      virtual(virtualParams),
      resolve({
        mainFields: ["esnext", "module", "main"],
        preferBuiltins: true,
      }),
      typescript({
        check: true,
        tsconfigOverride: {
          compilerOptions: {
            module: "es2015",
          },
        },
      }),
    ],
    context: "globalThis",
    output: [
      {
        banner,
        file: "build/verify.js",
        format: "es",
        plugins: outputPlugins,
      },
    ],
  },
];
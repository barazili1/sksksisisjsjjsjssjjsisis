import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import obfuscator from "vite-plugin-javascript-obfuscator";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      obfuscator({
        apply: "build",
        include: ["**/*.js"],
        exclude: [/node_modules/],
        options: {
          compact: true,
          controlFlowFlattening: true,
          controlFlowFlatteningThreshold: 0.9,
          deadCodeInjection: true,
          deadCodeInjectionThreshold: 0.5,
          stringArray: true,
          stringArrayThreshold: 1,
          stringArrayEncoding: ["rc4"],
          stringArrayIndexShift: true,
          stringArrayRotate: true,
          stringArrayShuffle: true,
          stringArrayWrappersCount: 3,
          stringArrayWrappersChainedCalls: true,
          stringArrayWrappersParametersMaxCount: 4,
          stringArrayWrappersType: "function",
          splitStrings: true,
          splitStringsChunkLength: 6,
          identifierNamesGenerator: "hexadecimal",
          selfDefending: true,
          disableConsoleOutput: true,
          debugProtection: true,
          debugProtectionInterval: 2000,
          simplify: true,
          renameGlobals: false,
          transformObjectKeys: true,
          numbersToExpressions: true,
        },
      }),
    ],
  },
});

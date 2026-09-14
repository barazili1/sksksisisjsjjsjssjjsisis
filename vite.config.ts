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
          controlFlowFlatteningThreshold: 0.4,
          deadCodeInjection: false,
          stringArray: true,
          stringArrayThreshold: 0.6,
          stringArrayEncoding: ["base64"],
          identifierNamesGenerator: "hexadecimal",
          selfDefending: false,
          disableConsoleOutput: false,
          simplify: true,
          renameGlobals: false,
        },
      }),
    ],
  },
});

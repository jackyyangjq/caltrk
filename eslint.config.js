// Only guards what the module split can break: undefined names (missing imports) and unused imports.
export default [
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022, sourceType: "module",
      globals: {
        window: "readonly", document: "readonly", localStorage: "readonly", location: "readonly", navigator: "readonly",
        fetch: "readonly", setTimeout: "readonly", clearTimeout: "readonly", setInterval: "readonly", alert: "readonly",
        confirm: "readonly", matchMedia: "readonly", URL: "readonly", Blob: "readonly", FileReader: "readonly", Image: "readonly",
        AbortController: "readonly", Promise: "readonly", ZXingWASM: "readonly", MediaRecorder: "readonly",
        AudioContext: "readonly", OfflineAudioContext: "readonly", btoa: "readonly", atob: "readonly", console: "readonly"
      }
    },
    rules: { "no-undef": "error", "no-unused-vars": ["warn", { vars: "local", args: "none", caughtErrors: "none" }] }
  }
];

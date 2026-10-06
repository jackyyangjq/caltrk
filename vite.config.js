import fs from "node:fs";
import { defineConfig } from "vite";

/* 运行时按相对路径动态加载的文件（条形码识别库、按需加载的数据），原样拷进 dist。
   源码目录本身也能直接当静态站点打开，所以这些文件留在仓库根目录、不放 public/。 */
const STATIC = ["vendor", "data", "apple-touch-icon.png"];

export default defineConfig({
  base: "./",
  publicDir: false,
  build: { outDir: "dist", emptyOutDir: true, target: "es2019" },
  plugins: [{
    name: "copy-static",
    apply: "build",
    closeBundle() {
      for (const p of STATIC) if (fs.existsSync(p)) fs.cpSync(p, "dist/" + p, { recursive: true });
    }
  }],
  test: { include: ["tests/unit/**/*.test.js"] }
});

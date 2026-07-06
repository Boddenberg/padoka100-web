import { spawn } from "node:child_process";

const npmCli = process.env.npm_execpath;
const cleanEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key, value]) => key && !key.startsWith("=") && value !== undefined)
);

const child = spawn(npmCli ? process.execPath : "npm", npmCli ? [npmCli, "run", "build"] : ["run", "build"], {
  stdio: "inherit",
  env: {
    ...cleanEnv,
    VITE_DEFAULT_API_ENV: "production",
    VITE_API_PROD_URL: "https://padoka100-production.up.railway.app",
    VITE_API_PROD_PROXY: "false"
  }
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});

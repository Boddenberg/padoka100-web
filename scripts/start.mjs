import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const executandoNoRailway = Boolean(
  process.env.RAILWAY_PROJECT_ID ||
    process.env.RAILWAY_SERVICE_ID ||
    process.env.RAILWAY_ENVIRONMENT_ID
);

if (executandoNoRailway) {
  await import("./serve-web.mjs");
} else {
  const expoCli = fileURLToPath(new URL("../node_modules/expo/bin/cli", import.meta.url));
  const processoExpo = spawn(
    process.execPath,
    [expoCli, "start", ...process.argv.slice(2)],
    { env: process.env, stdio: "inherit" }
  );

  for (const sinal of ["SIGINT", "SIGTERM"]) {
    process.on(sinal, () => processoExpo.kill(sinal));
  }

  processoExpo.on("error", (erro) => {
    console.error("Nao foi possivel iniciar o Expo.", erro);
    process.exitCode = 1;
  });

  processoExpo.on("exit", (codigo, sinal) => {
    if (sinal) {
      process.kill(process.pid, sinal);
      return;
    }
    process.exitCode = codigo ?? 1;
  });
}

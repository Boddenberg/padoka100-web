import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const buildGradlePath = join("node_modules", "@capacitor", "android", "capacitor", "build.gradle");
const source = readFileSync(buildGradlePath, "utf8");
const patched = source.replaceAll("JavaVersion.VERSION_21", "JavaVersion.VERSION_17");

if (patched === source) {
  console.log("Capacitor Android Java compatibility already patched or changed upstream.");
} else {
  writeFileSync(buildGradlePath, patched);
  console.log("Patched Capacitor Android Java compatibility to Java 17.");
}

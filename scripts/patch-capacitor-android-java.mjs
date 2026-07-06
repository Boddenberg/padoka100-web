import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const gradleFiles = [
  join("node_modules", "@capacitor", "android", "capacitor", "build.gradle"),
  join("android", "app", "capacitor.build.gradle")
];

let patchedCount = 0;

for (const gradleFile of gradleFiles) {
  if (!existsSync(gradleFile)) continue;

  const source = readFileSync(gradleFile, "utf8");
  const patched = source.replaceAll("JavaVersion.VERSION_21", "JavaVersion.VERSION_17");

  if (patched !== source) {
    writeFileSync(gradleFile, patched);
    patchedCount += 1;
  }
}

console.log(
  patchedCount > 0
    ? `Patched ${patchedCount} Capacitor Android Gradle file(s) to Java 17.`
    : "Capacitor Android Java compatibility already patched or changed upstream."
);

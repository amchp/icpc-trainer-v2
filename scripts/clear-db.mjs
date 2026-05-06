import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const databaseBasePath = resolve(process.cwd(), "apps/server/dev.db");
const databaseArtifacts = [databaseBasePath, `${databaseBasePath}-shm`, `${databaseBasePath}-wal`];

for (const artifactPath of databaseArtifacts) {
  if (!existsSync(artifactPath)) {
    continue;
  }

  rmSync(artifactPath, { force: true });
  console.log(`Removed ${artifactPath}`);
}

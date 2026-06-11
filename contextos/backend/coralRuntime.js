import { spawnSync } from "child_process";

export const coralCommand = process.env.CORAL_CMD || process.env.CORAL_PATH || "coral";

export function isCoralAvailable() {
  const probe = spawnSync(coralCommand, ["--version"], {
    shell: false,
    stdio: "ignore",
  });

  return !probe.error;
}

export const coralAvailable = isCoralAvailable();
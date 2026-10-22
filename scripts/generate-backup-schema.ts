import { writeFileSync, mkdirSync } from "node:fs";
import { z } from "zod";
import { backupSchema } from "../src/lib/backup";
mkdirSync("schemas", { recursive: true });
writeFileSync(
  "schemas/backup-v1.schema.json",
  JSON.stringify(
    z.toJSONSchema(backupSchema, { unrepresentable: "any" }),
    null,
    2,
  ) + "\n",
);

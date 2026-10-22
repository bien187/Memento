import { readFileSync, writeFileSync } from "node:fs";
import {
  ranks,
  branches,
  functions,
  functionTeam,
} from "../src/lib/domain/catalogs";
import {
  barracks,
  functionBarracks,
  barracksSource,
} from "../src/lib/domain/barracks";
import { insigniaForBranch } from "../src/lib/domain/insignia";
const quote = (s: string) => `'${s.replaceAll("'", "''")}'`;
const catalogSource =
  "https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md";
const sql = [
  "-- Generated from the app catalogs. User-supplied functions/locations; no user records.\n",
  `insert into public.military_ranks(id,name,position) values\n${ranks.map(([id, name], i) => `(${quote(id)},${quote(name)},${i})`).join(",\n")}\non conflict(id) do update set name=excluded.name,position=excluded.position;`,
  `insert into public.military_branches(id,name,insignia_url) values\n${branches.map(([id, name]) => `(${quote(id)},${quote(name)},${insigniaForBranch(id) ? quote(insigniaForBranch(id)!.path) : "null"})`).join(",\n")}\non conflict(id) do update set name=excluded.name,insignia_url=excluded.insignia_url;`,
  `insert into public.military_functions(id,name,team,source_url) values\n${functions.map(([id, name]) => `(${quote(id)},${quote(name)},${quote(functionTeam(id)!.id)},${quote(catalogSource)})`).join(",\n")}\non conflict(id) do update set name=excluded.name,team=excluded.team,source_url=excluded.source_url;`,
  `insert into public.military_barracks(id,name,canton,school,source_url) values\n${barracks.map((location) => `(${[location.id, location.name, location.canton, location.school, barracksSource].map(quote).join(",")})`).join(",\n")}\non conflict(id) do update set name=excluded.name,canton=excluded.canton,school=excluded.school,source_url=excluded.source_url;`,
  // Recreate only the static suggestions. Personal profile/period selections are untouched.
  "delete from public.military_function_barracks;",
  `insert into public.military_function_barracks(function_id,barracks_id,position) values\n${Object.entries(
    functionBarracks,
  )
    .flatMap(([id, locations]) =>
      locations.map(
        (location, position) => `(${quote(id)},${quote(location)},${position})`,
      ),
    )
    .join(
      ",\n",
    )}\non conflict(function_id,barracks_id) do update set position=excluded.position;`,
].join("\n\n");
writeFileSync("supabase/seed.sql", sql + "\n");
const migrationPath = "supabase/migrations/202610220003_military_catalog.sql";
const migration = readFileSync(migrationPath, "utf8").replace(
  /-- BEGIN GENERATED CATALOG[\s\S]*?-- END GENERATED CATALOG/,
  `-- BEGIN GENERATED CATALOG\n${sql}\n-- END GENERATED CATALOG`,
);
writeFileSync(migrationPath, migration);

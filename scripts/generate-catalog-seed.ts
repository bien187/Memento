import { writeFileSync } from "node:fs";
import { ranks, branches, functions } from "../src/lib/domain/catalogs";
const quote = (s: string) => `'${s.replaceAll("'", "''")}'`;
const sql = [
  "-- Curated catalogs, source URLs are stored on each row. No user records.\n",
  `insert into public.military_ranks(id,name,position) values\n${ranks.map(([id, name], i) => `(${quote(id)},${quote(name)},${i})`).join(",\n")}\non conflict(id) do update set name=excluded.name,position=excluded.position;`,
  `insert into public.military_branches(id,name) values\n${branches.map(([id, name]) => `(${quote(id)},${quote(name)})`).join(",\n")}\non conflict(id) do update set name=excluded.name;`,
  `insert into public.military_functions(id,name) values\n${functions.map(([id, name]) => `(${quote(id)},${quote(name)})`).join(",\n")}\non conflict(id) do update set name=excluded.name;`,
].join("\n\n");
writeFileSync("supabase/seed.sql", sql + "\n");

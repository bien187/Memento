import { branches } from "./catalogs";

export type BranchId = (typeof branches)[number][0];
export type ThemeMode = "light" | "dark";
export type ThemeTokens = {
  primary: string;
  primarySoft: string;
  onPrimary: string;
  secondary: string;
  secondarySoft: string;
  focus: string;
  tint: string;
};

// Accessible product colours, not official military colour specifications.
// References, mapping decisions and contrast requirements: docs/BRANCH_THEMES.md.
const palettes = {
  olive: {
    light: {
      primary: "#42513c",
      primarySoft: "#e6eadf",
      onPrimary: "#fffef7",
      secondary: "#72563f",
      secondarySoft: "#efe5d9",
      focus: "#4f683f",
      tint: "#eff1e9",
    },
    dark: {
      primary: "#b7c4a5",
      primarySoft: "#303d2a",
      onPrimary: "#1c2717",
      secondary: "#d8b28d",
      secondarySoft: "#3b3027",
      focus: "#c1cea6",
      tint: "#1c231c",
    },
  },
  sky: {
    light: {
      primary: "#365f7c",
      primarySoft: "#e2edf5",
      onPrimary: "#fffef7",
      secondary: "#625f83",
      secondarySoft: "#ece9f3",
      focus: "#365f7c",
      tint: "#edf2f5",
    },
    dark: {
      primary: "#a8cfea",
      primarySoft: "#263b4c",
      onPrimary: "#152c3c",
      secondary: "#c6c0e1",
      secondarySoft: "#353247",
      focus: "#a8cfea",
      tint: "#1c242a",
    },
  },
  sand: {
    light: {
      primary: "#6b593d",
      primarySoft: "#efe8dc",
      onPrimary: "#fffef7",
      secondary: "#6c6752",
      secondarySoft: "#eeebdf",
      focus: "#6b593d",
      tint: "#f1eee7",
    },
    dark: {
      primary: "#d8c5a3",
      primarySoft: "#3c3428",
      onPrimary: "#2f2618",
      secondary: "#cac6a8",
      secondarySoft: "#38372b",
      focus: "#d8c5a3",
      tint: "#25221d",
    },
  },
  red: {
    light: {
      primary: "#7b4744",
      primarySoft: "#f0e3df",
      onPrimary: "#fffef7",
      secondary: "#796337",
      secondarySoft: "#efeadc",
      focus: "#7b4744",
      tint: "#f3ede9",
    },
    dark: {
      primary: "#dfb1a9",
      primarySoft: "#412e2b",
      onPrimary: "#351b19",
      secondary: "#d6bf87",
      secondarySoft: "#3b3423",
      focus: "#dfb1a9",
      tint: "#271f1e",
    },
  },
  burgundy: {
    light: {
      primary: "#714b64",
      primarySoft: "#eee4ec",
      onPrimary: "#fffef7",
      secondary: "#695979",
      secondarySoft: "#ece7f1",
      focus: "#714b64",
      tint: "#f1edf0",
    },
    dark: {
      primary: "#d3b2ca",
      primarySoft: "#3c2c38",
      onPrimary: "#2d1c29",
      secondary: "#c3b5d5",
      secondarySoft: "#342e3e",
      focus: "#d3b2ca",
      tint: "#251f24",
    },
  },
  slate: {
    light: {
      primary: "#4e5d66",
      primarySoft: "#e6ebed",
      onPrimary: "#fffef7",
      secondary: "#67604b",
      secondarySoft: "#eeebdf",
      focus: "#4e5d66",
      tint: "#edf0f0",
    },
    dark: {
      primary: "#bdccd4",
      primarySoft: "#2d383f",
      onPrimary: "#202a30",
      secondary: "#d0c6a4",
      secondarySoft: "#38352a",
      focus: "#bdccd4",
      tint: "#1f2427",
    },
  },
  gold: {
    light: {
      primary: "#6d5c2c",
      primarySoft: "#eee9d9",
      onPrimary: "#fffef7",
      secondary: "#675b40",
      secondarySoft: "#eee8db",
      focus: "#6d5c2c",
      tint: "#f1efe5",
    },
    dark: {
      primary: "#d9c68e",
      primarySoft: "#3b3423",
      onPrimary: "#2d2615",
      secondary: "#cabf9b",
      secondarySoft: "#383226",
      focus: "#d9c68e",
      tint: "#25231b",
    },
  },
  blue: {
    light: {
      primary: "#3b577e",
      primarySoft: "#e5eaf4",
      onPrimary: "#fffef7",
      secondary: "#655a7a",
      secondarySoft: "#ece7f1",
      focus: "#3b577e",
      tint: "#edf0f5",
    },
    dark: {
      primary: "#b2c9ef",
      primarySoft: "#29364b",
      onPrimary: "#1d2b43",
      secondary: "#c7b9de",
      secondarySoft: "#352f41",
      focus: "#b2c9ef",
      tint: "#1e232c",
    },
  },
} satisfies Record<string, Record<ThemeMode, ThemeTokens>>;

type PaletteId = keyof typeof palettes;
const branchPalettes = {
  infanterie: "olive",
  panzer: "gold",
  artillerie: "red",
  luftwaffe: "sky",
  fliegerabwehr: "sky",
  genie: "slate",
  rettung: "sand",
  logistik: "burgundy",
  sanitaet: "blue",
  fuehrungsunterstuetzung: "slate",
  abc: "slate",
  militaerpolizei: "slate",
  spezialkraefte: "sand",
  nachrichtendienst: "slate",
  seelsorge: "slate",
  rotkreuzdienst: "blue",
  generalstab: "slate",
  justiz: "burgundy",
  territorial: "slate",
  sozialdienst: "slate",
  ppd: "slate",
  bereitschaft: "slate",
  militaermusik: "olive",
  sport: "slate",
  armeefuehrung: "slate",
} satisfies Record<BranchId, PaletteId>;

export type BranchTheme = {
  id: BranchId | "memento";
  name: string;
  palette: PaletteId;
  status: "provisional-design";
  tokens: Record<ThemeMode, ThemeTokens>;
};

export const branchThemes: readonly BranchTheme[] = branches.map(
  ([id, name]) => ({
    id,
    name,
    palette: branchPalettes[id],
    status: "provisional-design",
    tokens: palettes[branchPalettes[id]],
  }),
);

export const defaultBranchTheme: BranchTheme = {
  id: "memento",
  name: "Memento",
  palette: "olive",
  status: "provisional-design",
  tokens: palettes.olive,
};

export function getBranchTheme(
  branchId: string | null | undefined,
): BranchTheme {
  return (
    branchThemes.find((theme) => theme.id === branchId) ?? defaultBranchTheme
  );
}

const tokenVariables = [
  ["primary", "--accent"],
  ["primarySoft", "--accent-soft"],
  ["onPrimary", "--on-accent"],
  ["secondary", "--accent-secondary"],
  ["secondarySoft", "--accent-secondary-soft"],
  ["focus", "--focus"],
  ["tint", "--theme-tint"],
] as const satisfies readonly (readonly [keyof ThemeTokens, string])[];

// The small interface also permits deterministic tests without a browser DOM.
type ThemeTarget = {
  dataset: { theme?: string; branch?: string; themePalette?: string };
  style: { setProperty: (name: string, value: string) => void };
};
export function applyBranchTheme(
  target: ThemeTarget,
  branchId: string | null | undefined,
  mode: ThemeMode,
) {
  const theme = getBranchTheme(branchId);
  target.dataset.theme = mode;
  target.dataset.branch = theme.id === "memento" ? "" : theme.id;
  target.dataset.themePalette = theme.palette;
  for (const [key, variable] of tokenVariables)
    target.style.setProperty(variable, theme.tokens[mode][key]);
}

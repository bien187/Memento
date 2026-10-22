import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const message = (e: unknown) =>
  e instanceof Error
    ? e.message
    : e &&
        typeof e === "object" &&
        "message" in e &&
        typeof e.message === "string"
      ? e.message
      : "Ein unerwarteter Fehler ist aufgetreten.";
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

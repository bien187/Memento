import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ZodError } from "zod";
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const message = (e: unknown) => {
  if (e instanceof ZodError) {
    console.error("Memento validation failed", e.issues);
    return "Die Angaben konnten nicht gespeichert werden. Bitte prüfe die Eingaben und versuche es erneut.";
  }
  return e instanceof Error
    ? e.message
    : e &&
        typeof e === "object" &&
        "message" in e &&
        typeof e.message === "string"
      ? e.message
      : "Ein unerwarteter Fehler ist aufgetreten.";
};
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

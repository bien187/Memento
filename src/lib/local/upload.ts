import { supabase } from "../supabase/browser";
/** Authenticated, non-overwriting upload with actual transferred-byte progress. */
export async function uploadPrivateBlob(
  path: string,
  blob: Blob,
  onProgress: (percent: number) => void,
) {
  const { data, error } = await supabase().auth.getSession();
  if (error || !data.session)
    throw new Error("Für den Bildupload bitte erneut anmelden.");
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(
      "POST",
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/diary-media/${path.split("/").map(encodeURIComponent).join("/")}`,
    );
    request.setRequestHeader(
      "Authorization",
      `Bearer ${data.session!.access_token}`,
    );
    request.setRequestHeader(
      "apikey",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
    request.setRequestHeader("Content-Type", blob.type);
    request.setRequestHeader("x-upsert", "false");
    request.timeout = 120000;
    let last = -1;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.min(
          99,
          Math.round((event.loaded / event.total) * 100),
        );
        if (percent !== last) {
          last = percent;
          onProgress(percent);
        }
      }
    };
    request.onload = () => {
      if (
        (request.status >= 200 && request.status < 300) ||
        request.status === 409
      ) {
        onProgress(100);
        resolve();
      } else {
        let text = "Bildupload fehlgeschlagen.";
        try {
          text = JSON.parse(request.responseText).message ?? text;
        } catch {}
        reject(new Error(text));
      }
    };
    request.onerror = () =>
      reject(
        new Error(
          "Verbindung beim Bildupload unterbrochen. Das Bild bleibt lokal gesichert.",
        ),
      );
    request.ontimeout = request.onerror;
    request.onabort = request.onerror;
    request.send(blob);
  });
}

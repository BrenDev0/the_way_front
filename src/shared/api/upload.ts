// Presigned bucket URLs carry the address the API saw; a browser elsewhere may need another.
function publicUploadUrl(url: string) {
  const origin = process.env.NEXT_PUBLIC_UPLOAD_ORIGIN;
  if (!origin) return url;
  const target = new URL(url);
  const replacement = new URL(origin);
  target.protocol = replacement.protocol;
  target.host = replacement.host;
  return target.toString();
}

export function uploadToStorage(url: string, file: File, contentType: string, onProgress: (ratio: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", publicUploadUrl(url));
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        console.error(`[upload] storage responded ${xhr.status}`, xhr.responseText);
        reject(new Error("upload_failed"));
      }
    };
    xhr.onerror = () => {
      console.error("[upload] network error while uploading to storage");
      reject(new Error("upload_failed"));
    };
    xhr.send(file);
  });
}

// Utilities to compute SHA-256 hashes in the browser using the Web Crypto API.
// Used by the media backup (export) and restore (integrity validation) flows.

export const bufferToHex = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
};

export const sha256Hex = async (data: ArrayBuffer | Blob): Promise<string> => {
  const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return bufferToHex(digest);
};

// Derives a stable file extension for a binary, preferring the storage path
// extension and falling back to the content type.
export const inferExtension = (storagePath: string, contentType?: string | null): string => {
  const fromPath = storagePath.match(/\.([a-zA-Z0-9]+)(?:\?|$)/)?.[1];
  if (fromPath) return fromPath.toLowerCase();
  const fromType = contentType?.split("/")?.[1]?.split(";")?.[0];
  if (fromType) return fromType.toLowerCase().replace("jpeg", "jpg");
  return "bin";
};

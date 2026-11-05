type PhotoPreviewUrls = Pick<typeof URL, "createObjectURL" | "revokeObjectURL">;

/** Owns only browser-local preview URLs; it never uploads the selected image. */
export function createFieldPhotoPreview(urls: PhotoPreviewUrls = URL) {
  let current: string | null = null;
  const dispose = () => {
    if (current) urls.revokeObjectURL(current);
    current = null;
  };
  return {
    replace(file: Blob | null): string | null {
      dispose();
      if (!file) return null;
      try { current = urls.createObjectURL(file); } catch { current = null; }
      return current;
    },
    dispose,
  };
}

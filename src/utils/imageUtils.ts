/**
 * Image compression utility for Plant Care PWA.
 *
 * WHY COMPRESS?
 * Phone cameras produce photos of 5-10MB. Storing these directly in
 * IndexedDB would fill up browser storage quickly. We compress to
 * max 800px width and JPEG quality 0.8, reducing to ~50-100KB with
 * no visible quality loss for plant photos.
 *
 * HOW IT WORKS (Canvas API):
 * The browser's <canvas> element can draw images and export them
 * in different formats/sizes. We use it as a "photo editor":
 *
 *   1. Load the original photo into an Image element
 *   2. Create a canvas at the desired smaller size
 *   3. Draw the photo onto the canvas (browser handles the resizing)
 *   4. Export the canvas as a JPEG base64 string
 *
 * BASE64 ENCODING:
 * Base64 is a way to represent binary data (like an image) as a
 * text string. It looks like: "data:image/jpeg;base64,/9j/4AAQ..."
 * We store this string in IndexedDB and use it directly as the
 * `src` attribute of <img> tags. The downside is that base64 is
 * ~33% larger than the original binary, but for compressed photos
 * this is an acceptable trade-off for simplicity.
 */

interface CompressImageOptions {
  maxWidth: number;
  quality: number; // 0 to 1, where 1 is highest quality
}

const DEFAULT_OPTIONS: CompressImageOptions = {
  maxWidth: 800,
  quality: 0.8,
};

/**
 * Compress an image file to a smaller size and return as base64 string.
 *
 * @param file - The File object from an <input type="file"> element
 * @param options - Optional compression settings
 * @returns A base64-encoded JPEG data URL string
 *
 * @example
 * const input = document.querySelector('input[type="file"]');
 * const file = input.files[0];
 * const base64 = await compressImage(file);
 * // base64 = "data:image/jpeg;base64,/9j/4AAQ..."
 */
export function compressImage(
  file: File,
  options?: Partial<CompressImageOptions>,
): Promise<string> {
  const { maxWidth, quality } = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    // URL.createObjectURL creates a temporary URL pointing to the file
    // in memory. This is faster than FileReader.readAsDataURL because
    // it doesn't copy the entire file - it just creates a reference.
    const objectURL = URL.createObjectURL(file);

    const img = new Image();

    img.onload = (): void => {
      // Calculate new dimensions while maintaining aspect ratio.
      // If the image is already smaller than maxWidth, keep original size.
      // We never upscale (enlarge) images - that would look blurry.
      let { width, height } = img;

      if (width > maxWidth) {
        const ratio = maxWidth / width;
        width = maxWidth;
        height = Math.round(height * ratio);
      }

      // Create an offscreen canvas at the target dimensions.
      // The canvas is not added to the DOM - it only exists in memory.
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      // Get the 2D drawing context and draw the image, resized
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas 2D context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Export as JPEG base64. The second parameter is quality (0-1).
      // JPEG is ideal for photos (small file size, good quality).
      // PNG would be better for screenshots or graphics with sharp edges.
      const base64 = canvas.toDataURL('image/jpeg', quality);

      // Clean up: release the temporary object URL to free memory.
      // Without this, the browser keeps the file reference until
      // the page is closed, which can cause memory leaks.
      URL.revokeObjectURL(objectURL);

      resolve(base64);
    };

    img.onerror = (): void => {
      URL.revokeObjectURL(objectURL);
      reject(new Error('Failed to load image. The file may be corrupted or not a valid image.'));
    };

    // Setting src triggers the browser to load the image.
    // When done, it fires either 'load' or 'error'.
    img.src = objectURL;
  });
}

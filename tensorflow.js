
const EstablishedResults = (() => {
  const REGISTRY_URL = "/established-results/index.json";
  const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
  const MAX_SAMPLES = 100;

  let samples = [];
  let initialized = false;

  async function loadImage(source) {
    const image = new Image();
    image.src = source;

    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });

    return image;
  }

  async function hashImage(source) {
    const image = await loadImage(source);

    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;

    const ctx = canvas.getContext("2d", {
      willReadFrequently: true
    });

    ctx.drawImage(image, 0, 0, 32, 32);

    const pixels = ctx.getImageData(
      0, 0, 32, 32
    ).data;

    const gray = [];

    for (let i = 0; i < pixels.length; i += 4) {
      gray.push(
        0.299 * pixels[i] +
        0.587 * pixels[i + 1] +
        0.114 * pixels[i + 2]
      );
    }

    const values = [];

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        let sum = 0;

        for (let j = 0; j < 4; j++) {
          for (let i = 0; i < 4; i++) {
            const sampleX = x * 4 + i;
            const sampleY = y * 4 + j;

            sum += gray[sampleY * 32 + sampleX];
          }
        }

        values.push(sum / 16);
      }
    }

    const average =
      values.reduce((a, b) => a + b, 0) /
      values.length;

    return values.map(v => v >= average ? "1" : "0").join("");
  }

  function distance(a, b) {
    let result = 0;

    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) result++;
    }

    return result;
  }

  async function initialize() {
    if (initialized) return samples;

    const response = await fetch(
      REGISTRY_URL,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("Could not load Established Results registry.");
    }

    const registry = await response.json();

    if (
      registry.version !== 1 ||
      !Array.isArray(registry.samples) ||
      registry.samples.length > MAX_SAMPLES
    ) {
      throw new Error("Invalid Established Results registry.");
    }

    const loaded = [];

    for (const item of registry.samples) {
      if (
        !/^sample-[a-zA-Z0-9_-]+$/.test(item.id) ||
        typeof item.image !== "string" ||
        typeof item.result !== "string" ||
        item.image.startsWith("/") ||
        item.result.startsWith("/") ||
        item.image.includes("..") ||
        item.result.includes("..")
      ) {
        throw new Error("Invalid sample entry.");
      }

      const imageURL = new URL(
        item.image,
        new URL(
          "established-results/",
          window.location.origin + "/"
        )
      );

      const resultURL = new URL(
        item.result,
        new URL(
          "established-results/",
          window.location.origin + "/"
        )
      );

      if (
        imageURL.origin !== location.origin ||
        resultURL.origin !== location.origin
      ) {
        throw new Error("External sample URLs are not allowed.");
      }

      const imageResponse = await fetch(imageURL);

      if (!imageResponse.ok) continue;

      const blob = await imageResponse.blob();

      if (
        !["image/jpeg", "image/png", "image/webp"].includes(blob.type) ||
        blob.size > MAX_IMAGE_BYTES
      ) {
        continue;
      }

      const objectURL = URL.createObjectURL(blob);

      try {
        const hash = await hashImage(objectURL);
        loaded.push({
          id: item.id,
          hash,
          resultURL: resultURL.href
        });
      } finally {
        URL.revokeObjectURL(objectURL);
      }
    }

    samples = loaded;
    initialized = true;

    return samples;
  }

  async function match(file) {
    if (!(file instanceof File)) {
      throw new Error("Please select an image.");
    }

    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > MAX_IMAGE_BYTES
    ) {
      throw new Error("Unsupported image or image too large.");
    }

    await initialize();

    const imageURL = URL.createObjectURL(file);

    try {
      const hash = await hashImage(imageURL);

      const ranked = samples
        .map(sample => ({
          sample,
          distance: distance(hash, sample.hash)
        }))
        .sort((a, b) => a.distance - b.distance);

      if (!ranked.length) return null;

      const best = ranked[0];
      const second = ranked[1];

      // Strict matching: only accept a very close
      // reference-image match, not a skin-condition match.
      if (
        best.distance > 2 ||
        (second && second.distance - best.distance < 4)
      ) {
        return null;
      }

      const response = await fetch(best.sample.resultURL);

      if (!response.ok) return null;

      const result = await response.json();

      if (
        result.id !== best.sample.id ||
        typeof result.title !== "string" ||
        typeof result.explanation !== "string" ||
        typeof result.disclaimer !== "string"
      ) {
        return null;
      }

      return {
        type: "established-reference",
        sampleId: best.sample.id,
        result
      };
    } finally {
      URL.revokeObjectURL(imageURL);
    }
  }

  return {
    initialize,
    match
  };
})();

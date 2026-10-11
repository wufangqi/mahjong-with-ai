/** Chromium flags that bind Intel UHD via ANGLE/Vulkan (not SwiftShader). */
export const CHROME_UHD_GPU_ARGS = [
  '--ignore-gpu-blocklist',
  '--enable-webgl',
  '--disable-software-rasterizer',
  '--use-angle=vulkan',
  '--enable-features=Vulkan',
  '--disable-vulkan-surface',
  '--enable-precise-memory-info',
  '--disable-dev-shm-usage',
];

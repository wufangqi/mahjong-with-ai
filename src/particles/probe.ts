import type { GpuProbeInfo } from '../quality/types';

/** Detect WebGL2 + renderer string + whether GPU particle shaders are usable. */
export function probeGpu(gl?: WebGL2RenderingContext | null): GpuProbeInfo {
  if (!gl) {
    return { renderer: '', webgl2: false, gpuParticlesAvailable: false };
  }

  let renderer = '';
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  if (debug) {
    renderer = String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) ?? '');
  } else {
    renderer = String(gl.getParameter(gl.RENDERER) ?? '');
  }

  const gpuParticlesAvailable = canUseGpuParticles(gl);
  return { renderer, webgl2: true, gpuParticlesAvailable };
}

export function canUseGpuParticles(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  try {
    const vs = gl.createShader(gl.VERTEX_SHADER);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    if (!vs || !fs) return false;
    gl.shaderSource(
      vs,
      `attribute vec3 position; void main(){ gl_Position = vec4(position, 1.0); gl_PointSize = 1.0; }`,
    );
    gl.shaderSource(fs, `precision mediump float; void main(){ gl_FragColor = vec4(1.0); }`);
    gl.compileShader(vs);
    gl.compileShader(fs);
    const ok = gl.getShaderParameter(vs, gl.COMPILE_STATUS) && gl.getShaderParameter(fs, gl.COMPILE_STATUS);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return Boolean(ok);
  } catch {
    return false;
  }
}

/** Probe from an existing Three.js WebGLRenderer. */
export function probeFromRenderer(renderer: {
  getContext: () => WebGLRenderingContext | WebGL2RenderingContext;
}): GpuProbeInfo {
  const ctx = renderer.getContext();
  if (typeof WebGL2RenderingContext !== 'undefined' && ctx instanceof WebGL2RenderingContext) {
    return probeGpu(ctx);
  }
  return { renderer: '', webgl2: false, gpuParticlesAvailable: false };
}

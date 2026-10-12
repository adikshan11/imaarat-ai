const quiet = window.matchMedia('(prefers-reduced-transparency: reduce), (prefers-contrast: more), (forced-colors: active)')

const vertexSource = `#version 300 es
layout(location = 0) in vec2 corner;
void main() {
  gl_Position = vec4(corner, 0.0, 1.0);
}`

const fragmentSource = `#version 300 es
precision highp float;
uniform sampler2D photo;
uniform vec2 size;
uniform vec2 scale;
uniform vec2 origin;
uniform float sectionWidth;
uniform vec4 cover;
uniform float radius;
out vec4 color;

const vec3 forest = vec3(0.0235, 0.1647, 0.1255);
const vec3 index = vec3(1.466, 1.470, 1.475);
const vec2 light = vec2(-0.6, -0.8);
const float bevel = 28.0;
const float slab = 40.0;

float edge(vec2 p) {
  vec2 q = abs(p - size * 0.5) - size * 0.5 + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

vec3 backdrop(vec2 point) {
  float t = clamp(point.x / sectionWidth, 0.0, 1.0);
  float shade = t < 0.5 ? mix(1.0, 0.85, t * 2.0) : mix(0.85, 0.1, t * 2.0 - 1.0);
  return mix(texture(photo, (point - cover.xy) / cover.zw, 1.5).rgb, forest, shade);
}

float shift(float rise, float n) {
  float tilt = asin(rise);
  return (slab + bevel * sqrt(1.0 - rise * rise)) * tan(tilt - asin(rise / n));
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, size.y * scale.y - gl_FragCoord.y) / scale;
  float d = edge(p);
  vec2 normal = normalize(vec2(edge(p + vec2(0.5, 0.0)) - edge(p - vec2(0.5, 0.0)), edge(p + vec2(0.0, 0.5)) - edge(p - vec2(0.0, 0.5))) + 1e-5);
  float rise = min(1.0 - clamp(-d / bevel, 0.0, 1.0), 0.999);
  vec2 point = origin + p;
  vec3 seen = vec3(
    backdrop(point - normal * shift(rise, index.r)).r,
    backdrop(point - normal * shift(rise, index.g)).g,
    backdrop(point - normal * shift(rise, index.b)).b
  );
  float rim = pow(rise, 6.0) * (0.12 + 0.4 * max(dot(normal, normalize(light)), 0.0));
  float alpha = clamp(0.5 - d, 0.0, 1.0);
  color = vec4((mix(seen, forest, 0.4) + rim) * alpha, alpha);
}`

function compile(gl: WebGL2RenderingContext) {
  const linked = gl.createProgram()
  if (!linked) return null
  for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]] as const) {
    const shader = gl.createShader(type)
    if (!shader) return null
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    gl.attachShader(linked, shader)
  }
  gl.linkProgram(linked)
  return gl.getProgramParameter(linked, gl.LINK_STATUS) ? linked : null
}

function lens(panel: HTMLElement) {
  const section = panel.closest('section')
  const photo = section?.querySelector('img')
  const canvas = panel.querySelector('canvas')
  const gl = canvas?.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true })
  const linked = gl && compile(gl)
  if (!section || !photo || !canvas || !gl || !linked) return
  gl.useProgram(linked)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  const uniform = (name: string) => gl.getUniformLocation(linked, name)
  let frame = 0
  let ready = false
  const draw = () => {
    frame = 0
    if (!ready) return
    const box = panel.getBoundingClientRect()
    const area = section.getBoundingClientRect()
    const ratio = Math.min(devicePixelRatio, 2)
    const fit = Math.max(area.width / photo.naturalWidth, area.height / photo.naturalHeight)
    const [x, y] = getComputedStyle(photo).objectPosition.split(' ').map((value) => parseFloat(value) / 100)
    canvas.width = Math.round(box.width * ratio)
    canvas.height = Math.round(box.height * ratio)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.uniform2f(uniform('size'), box.width, box.height)
    gl.uniform2f(uniform('scale'), canvas.width / box.width, canvas.height / box.height)
    gl.uniform2f(uniform('origin'), box.left - area.left, box.top - area.top)
    gl.uniform1f(uniform('sectionWidth'), area.width)
    gl.uniform4f(uniform('cover'), (area.width - photo.naturalWidth * fit) * x, (area.height - photo.naturalHeight * fit) * y, photo.naturalWidth * fit, photo.naturalHeight * fit)
    gl.uniform1f(uniform('radius'), parseFloat(getComputedStyle(panel).borderTopLeftRadius))
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    panel.toggleAttribute('data-lens', gl.getError() === gl.NO_ERROR)
  }
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(draw)
  }
  const upload = () => {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, photo)
    gl.generateMipmap(gl.TEXTURE_2D)
    ready = true
    schedule()
  }
  canvas.addEventListener('webglcontextlost', () => panel.removeAttribute('data-lens'))
  photo.addEventListener('load', upload)
  if (photo.complete && photo.naturalWidth) upload()
  const observer = new ResizeObserver(schedule)
  observer.observe(section)
  observer.observe(panel)
}

const start = () => {
  for (const panel of document.querySelectorAll<HTMLElement>('[data-glass]')) lens(panel)
}
if (!quiet.matches) {
  if ('requestIdleCallback' in window) requestIdleCallback(start)
  else setTimeout(start)
}

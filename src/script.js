import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const scene = new THREE.Scene();

const plane = new THREE.PlaneGeometry(5, 5, 300, 300);

const uniforms = {
    uTime: { value: 0 },
    incline: { value: 1.0 },
};

const material = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: `
        varying vec2 vUv;
        varying float vNoise;
        uniform float uTime;
        uniform float incline;

        vec4 permute(vec4 x) {
            return mod(((x*34.0)+1.0)*x, 289.0);
        }
        vec4 taylorInvSqrt(vec4 r) {
            return 1.79284291400159 - 0.85373472095314 * r;
        }
        float snoise(vec3 v){ 
            const vec2    C = vec2(1.0/6.0, 1.0/3.0);
            const vec4    D = vec4(0.0, 0.5, 1.0, 2.0);

            vec3 i    = floor(v + dot(v, C.yyy) );
            vec3 x0 =     v - i + dot(i, C.xxx);

            vec3 g = step(x0.yzx, x0.xyz);
            vec3 l = 1.0 - g;
            vec3 i1 = min( g.xyz, l.zxy );
            vec3 i2 = max( g.xyz, l.zxy );

            vec3 x1 = x0 - i1 + 1.0 * C.xxx;
            vec3 x2 = x0 - i2 + 2.0 * C.xxx;
            vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

            i = mod(i, 289.0); 
            vec4 p = permute( permute( permute( 
                                 i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                             + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
                             + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

            float n_ = 1.0/7.0; 
            vec3    ns = n_ * D.wyz - D.xzx;

            vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

            vec4 x_ = floor(j * ns.z);
            vec4 y_ = floor(j - 7.0 * x_);

            vec4 x = x_ * ns.x + ns.yyyy;
            vec4 y = y_ * ns.x + ns.yyyy;
            vec4 h = 1.0 - abs(x) - abs(y);

            vec4 b0 = vec4(x.xy, y.xy);
            vec4 b1 = vec4(x.zw, y.zw);

            vec4 s0 = floor(b0)*2.0 + 1.0;
            vec4 s1 = floor(b1)*2.0 + 1.0;
            vec4 sh = -step(h, vec4(0.0));

            vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
            vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

            vec3 p0 = vec3(a0.xy, h.x);
            vec3 p1 = vec3(a0.zw, h.y);
            vec3 p2 = vec3(a1.xy, h.z);
            vec3 p3 = vec3(a1.zw, h.w);

            vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
            p0 *= norm.x;
            p1 *= norm.y;
            p2 *= norm.z;
            p3 *= norm.w;

            vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
            m = m * m;
            return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }

        void main() {
            vUv = uv;
            vec3 pos = position;

            float totalNoise = 0.0;
            float scale = 1.0;

            // Loop with varying noise parameters for richer animation
            for (int i = 0; i < 5; i++) {
                float noiseFlow = 0.00000005 + float(i) * 0.03;
                float noiseSpeed = 0.0000001 + float(i) * 0.03;
                float noiseSeed = 1.0 + float(i) * 2.0;
                vec2 noiseFreq = vec2(0.1, 0.2);

                vec2 noiseCoord = vUv * vec2(10.0 * scale, 4.0 * scale);

                float noise = snoise(vec3(
                    noiseCoord.x * noiseFreq.x + uTime * noiseFlow,
                    noiseCoord.y * noiseFreq.y,
                    uTime * noiseSpeed * noiseSeed
                ));

                noise = max(0.0, noise); // keep noise positive for good blending
                totalNoise += noise * 0.4;

                scale *= 1.5;
            }

            // Base tilt of the plane in Z
            float tilt = -0.9 * vUv.y;
            pos.z += tilt;

            // Add animated noise displacement
            pos.z += totalNoise;

            // Add incline offset based on UV Y coordinate
            float offset = incline * mix(-0.25, 0.25, vUv.y);
            pos.z += offset;

            // Pass total noise to fragment shader for coloring
            vNoise = totalNoise;

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    fragmentShader: `
        varying float vNoise;

        void main() {
            vec3 colors[5];
            colors[0] = vec3(1.000, 0.788, 0.910);
            colors[1] = vec3(0.788, 0.910, 1.000);
            colors[2] = vec3(0.824, 0.651, 1.000);
            colors[3] = vec3(0.984, 0.769, 1.000);
            colors[4] = vec3(0.769, 0.914, 1.000);

            // Clamp noise between 0 and 1, then scale to 0..4
            float t = clamp(vNoise, 0.0, 1.0) * 4.0;

            int idx = int(floor(t));
            float frac = fract(t);

            // Interpolate smoothly between the two colors
            vec3 color = mix(colors[idx], colors[min(idx + 1, 4)], frac);

            gl_FragColor = vec4(color, 1.0);
        }
    `,
    side: THREE.DoubleSide,
    wireframe: false,
});

const planeMesh = new THREE.Mesh(plane, material);
scene.add(planeMesh);

const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    200
);
camera.position.z = 5;

const canvas = document.querySelector("canvas.threejs");
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function renderloop() {
    uniforms.uTime.value = clock.getElapsedTime() * 0.1;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(renderloop);
}

renderloop();
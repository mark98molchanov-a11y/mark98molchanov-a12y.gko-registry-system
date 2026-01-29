class NodeEffects {
  constructor() {
    this.activeNodes = new Map();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.initThreeJS();
  }
  initThreeJS() {
    this.renderer = new THREE.WebGLRenderer({ alpha: true });
    this.renderer.setSize(1, 1);
    this.renderer.domElement.style.position = 'fixed';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.pointerEvents = 'none';
    this.renderer.domElement.style.zIndex = '9999';
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    this.camera.position.z = 5;

    this.animate();
  }
  animate() {
    requestAnimationFrame(() => this.animate());
    
    // Обновляем только активные эффекты
    this.activeNodes.forEach(effect => {
      effect.uniforms.time.value += 0.01;
    });
    
    this.renderer.render(this.scene, this.camera);
  }
  addEffect(element, type) {
    if (this.activeNodes.has(element)) return;

    const rect = element.getBoundingClientRect();
    const effect = {
      type,
      mesh: this.createEffectMesh(type),
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color() }
      }
    };
    switch(type) {
      case 'absent269':
        effect.uniforms.color.value.setHex(0xff4444);
        break;
      case 'forAll':
        effect.uniforms.color.value.setHex(0x4CAF50);
        break;
      case 'subordinate':
        effect.uniforms.color.value.setHex(0x191970);
        break;
case 'power269':
    effect.uniforms.color.value.setHex(0x9E9E9E);
    break;
    }

    effect.mesh.position.set(
      (rect.left + rect.width/2) / 50 - window.innerWidth/100,
      -(rect.top + rect.height/2) / 50 + window.innerHeight/100,
      0
    );
    this.scene.add(effect.mesh);
    this.activeNodes.set(element, effect);
  }
  removeEffect(element) {
    if (!this.activeNodes.has(element)) return;
    
    const effect = this.activeNodes.get(element);
    this.scene.remove(effect.mesh);
    this.activeNodes.delete(element);
  }
  createEffectMesh(type) {
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color;
        varying vec2 vUv;
        
        void main() {
          float pulse = sin(time * 3.0) * 0.1 + 0.9;
          float dist = distance(vUv, vec2(0.5));
          float glow = smoothstep(0.5, 0.2, dist) * pulse;
          
          gl_FragColor = vec4(color * glow, glow * 0.3);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending
    });
    return new THREE.Mesh(geometry, material);
  }
}


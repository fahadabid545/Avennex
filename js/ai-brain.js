(function () {
  var container = document.getElementById('brain-canvas-wrap');
  if (!container) return;

  var scene, camera, renderer, controls;
  var nodeMesh, lineMesh;
  var nodes = [];
  var edges = [];
  var nodeCount = window.innerWidth < 768 ? 50 : 100;
  var clock = new THREE.Clock();
  var pulseQueue = [];
  var pulseInterval = 2000;
  var lastPulse = 0;
  var autoRotate = true;
  var interactTimer = null;
  var initialized = false;

  var accentR = 0.231, accentG = 0.51, accentB = 0.965;

  function init() {
    if (initialized) return;
    initialized = true;

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 18);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.8;

    controls.addEventListener('start', function () {
      autoRotate = false;
      controls.autoRotate = false;
      clearTimeout(interactTimer);
    });

    controls.addEventListener('end', function () {
      interactTimer = setTimeout(function () {
        autoRotate = true;
        controls.autoRotate = true;
      }, 3000);
    });

    buildBrain();
    animate();

    window.addEventListener('resize', onResize);
  }

  function buildBrain() {
    var geo = new THREE.SphereGeometry(0.35, 12, 8);
    var mat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
    nodeMesh = new THREE.InstancedMesh(geo, mat, nodeCount);
    nodeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    var dummy = new THREE.Object3D();
    var colors = new Float32Array(nodeCount * 3);

    for (var i = 0; i < nodeCount; i++) {
      var theta = Math.random() * Math.PI * 2;
      var phi = Math.acos(2 * Math.random() - 1);
      var r = 4 + Math.random() * 3;

      var x = r * Math.sin(phi) * Math.cos(theta);
      var y = r * Math.sin(phi) * Math.sin(theta);
      var z = r * Math.cos(phi);

      var scale = 0.3 + Math.random() * 0.2;

      nodes.push({
        pos: new THREE.Vector3(x, y, z),
        baseScale: scale,
        brightness: 0,
        phase: Math.random() * Math.PI * 2
      });

      dummy.position.set(x, y, z);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      nodeMesh.setMatrixAt(i, dummy.matrix);

      colors[i * 3] = accentR * 0.4;
      colors[i * 3 + 1] = accentG * 0.4;
      colors[i * 3 + 2] = accentB * 0.4;
    }

    nodeMesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    scene.add(nodeMesh);

    var maxDist = 4.5;
    var linePositions = [];
    var lineColors = [];

    for (var i = 0; i < nodeCount; i++) {
      for (var j = i + 1; j < nodeCount; j++) {
        var d = nodes[i].pos.distanceTo(nodes[j].pos);
        if (d < maxDist) {
          edges.push({ a: i, b: j, dist: d, brightness: 0 });
          linePositions.push(
            nodes[i].pos.x, nodes[i].pos.y, nodes[i].pos.z,
            nodes[j].pos.x, nodes[j].pos.y, nodes[j].pos.z
          );
          var alpha = 0.12;
          lineColors.push(
            accentR * alpha, accentG * alpha, accentB * alpha,
            accentR * alpha, accentG * alpha, accentB * alpha
          );
        }
      }
    }

    var lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    lineGeo.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));

    var lineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false
    });

    lineMesh = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lineMesh);
  }

  function triggerPulse() {
    var startNode = Math.floor(Math.random() * nodeCount);
    nodes[startNode].brightness = 1;

    for (var i = 0; i < edges.length; i++) {
      var e = edges[i];
      if (e.a === startNode || e.b === startNode) {
        var target = e.a === startNode ? e.b : e.a;
        pulseQueue.push({ node: target, time: clock.getElapsedTime() + 0.15, strength: 0.7 });
        e.brightness = 1;
      }
    }
  }

  function updatePulses(time) {
    for (var i = pulseQueue.length - 1; i >= 0; i--) {
      if (time >= pulseQueue[i].time) {
        var idx = pulseQueue[i].node;
        nodes[idx].brightness = Math.max(nodes[idx].brightness, pulseQueue[i].strength);

        if (pulseQueue[i].strength > 0.2) {
          for (var j = 0; j < edges.length; j++) {
            var e = edges[j];
            if (e.a === idx || e.b === idx) {
              var next = e.a === idx ? e.b : e.a;
              pulseQueue.push({ node: next, time: time + 0.12, strength: pulseQueue[i].strength * 0.5 });
              e.brightness = Math.max(e.brightness, pulseQueue[i].strength);
            }
          }
        }
        pulseQueue.splice(i, 1);
      }
    }
  }

  function animate() {
    requestAnimationFrame(animate);

    var time = clock.getElapsedTime();
    var dt = clock.getDelta();

    if (time - lastPulse > pulseInterval / 1000) {
      lastPulse = time;
      triggerPulse();
    }

    updatePulses(time);

    var dummy = new THREE.Object3D();
    var colors = nodeMesh.instanceColor.array;

    for (var i = 0; i < nodeCount; i++) {
      var n = nodes[i];
      n.brightness *= 0.92;
      var glow = 0.4 + n.brightness * 0.6 + Math.sin(time * 0.8 + n.phase) * 0.08;
      var s = n.baseScale * (1 + n.brightness * 0.3);

      dummy.position.copy(n.pos);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      nodeMesh.setMatrixAt(i, dummy.matrix);

      colors[i * 3] = accentR * glow;
      colors[i * 3 + 1] = accentG * glow;
      colors[i * 3 + 2] = accentB * glow;
    }

    nodeMesh.instanceMatrix.needsUpdate = true;
    nodeMesh.instanceColor.needsUpdate = true;

    var lColors = lineMesh.geometry.attributes.color.array;
    for (var i = 0; i < edges.length; i++) {
      var e = edges[i];
      e.brightness *= 0.9;
      var alpha = 0.12 + e.brightness * 0.6;
      var ci = i * 6;
      lColors[ci] = accentR * alpha;
      lColors[ci + 1] = accentG * alpha;
      lColors[ci + 2] = accentB * alpha;
      lColors[ci + 3] = accentR * alpha;
      lColors[ci + 4] = accentG * alpha;
      lColors[ci + 5] = accentB * alpha;
    }
    lineMesh.geometry.attributes.color.needsUpdate = true;

    controls.update();
    renderer.render(scene, camera);
  }

  function onResize() {
    if (!renderer) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }

  var observer = new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting) {
      init();
      observer.disconnect();
    }
  }, { threshold: 0.1 });

  observer.observe(container);
})();

// 強制鎖定為單一黑色
const THEME_COLOR = '#000000';

// ==========================================
// 系統 1：2D 畫布與「筆畫路徑」系統
// ==========================================
const canvas = document.getElementById('canvas2d');
const ctx = canvas.getContext('2d');

let isDrawing = false;
let paths = [];
let currentPath = null;

let currentMode = 'brush';
const sizeSlider = document.getElementById('sizeSlider');
const sizeDisplay = document.getElementById('sizeDisplay');

sizeSlider.addEventListener('input', function() { sizeDisplay.innerText = this.value + ' px'; });

document.getElementById('tool-brush').addEventListener('click', function() {
    currentMode = 'brush';
    this.classList.add('active');
    document.getElementById('tool-eraser').classList.remove('active');
    canvas.style.cursor = 'crosshair';
});

document.getElementById('tool-eraser').addEventListener('click', function() {
    currentMode = 'eraser';
    this.classList.add('active');
    document.getElementById('tool-brush').classList.remove('active');
    canvas.style.cursor = 'cell';
});

canvas.addEventListener('mousedown', (e) => {
    if (currentMode === 'brush') {
        isDrawing = true;
        currentPath = {
            color: THEME_COLOR,
            size: parseInt(sizeSlider.value),
            points: [{ x: e.offsetX, y: e.offsetY }]
        };
    } else if (currentMode === 'eraser') {
        erasePathAt(e.offsetX, e.offsetY);
        isDrawing = true;
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    if (currentMode === 'brush' && currentPath) {
        const lastPoint = currentPath.points[currentPath.points.length - 1];
        const dx = e.offsetX - lastPoint.x;
        const dy = e.offsetY - lastPoint.y;
        if (Math.hypot(dx, dy) > 2) {
            currentPath.points.push({ x: e.offsetX, y: e.offsetY });
            redraw2D();
        }
    } else if (currentMode === 'eraser') {
        erasePathAt(e.offsetX, e.offsetY);
    }
});

window.addEventListener('mouseup', () => {
    if (isDrawing && currentMode === 'brush' && currentPath && currentPath.points.length > 1) {
        paths.push(currentPath);
    }
    isDrawing = false;
    currentPath = null;
    redraw2D();
});

function erasePathAt(x, y) {
    const eraseRadius = parseInt(sizeSlider.value);
    paths = paths.filter(path => {
        const isHit = path.points.some(p => {
            const dx = p.x - x;
            const dy = p.y - y;
            return (dx * dx + dy * dy) < (eraseRadius * eraseRadius);
        });
        return !isHit;
    });
    redraw2D();
}

function redraw2D() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    paths.forEach(path => drawSinglePath(path));
    if (isDrawing && currentMode === 'brush' && currentPath) {
        drawSinglePath(currentPath);
    }
}

function drawSinglePath(path) {
    if (path.points.length < 2) return;
    ctx.strokeStyle = path.color;
    ctx.lineWidth = path.size;

    ctx.beginPath();
    ctx.moveTo(path.points[0].x, path.points[0].y);
    for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
    }
    ctx.stroke();
}

document.getElementById('undoBtn').addEventListener('click', () => {
    paths.pop(); redraw2D();
});
document.getElementById('clearBtn').addEventListener('click', () => {
    paths = []; redraw2D();
});


// ==========================================
// 系統 2：邊界框計算與 SVG 生成 (裁切功能)
// ==========================================
let currentSVGString = "";
let drawingBBox = null;

function getBoundingBox() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasPoints = false;

    paths.forEach(path => {
        const offset = path.size / 2;
        path.points.forEach(p => {
            hasPoints = true;
            if (p.x - offset < minX) minX = p.x - offset;
            if (p.y - offset < minY) minY = p.y - offset;
            if (p.x + offset > maxX) maxX = p.x + offset;
            if (p.y + offset > maxY) maxY = p.y + offset;
        });
    });

    if (!hasPoints) return { x: 0, y: 0, w: 500, h: 500, cx: 250, cy: 250 };

    const padding = 20;
    return {
        x: Math.max(0, minX - padding),
        y: Math.max(0, minY - padding),
        w: (maxX - minX) + padding * 2,
        h: (maxY - minY) + padding * 2,
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2
    };
}

const CANVAS_SIZE = 500; // 與 #canvas2d 尺寸一致，用於筆畫比例計算

function generateSVG() {
    drawingBBox = getBoundingBox();
    const { x: bx, y: by, w: bw, h: bh } = drawingBBox;
    // 使用固定 viewBox 0 0 100 100，讓裁切後筆畫粗細一致，且 gallery 預覽比例一致
    const scaleX = bw > 0 ? 100 / bw : 1;
    const scaleY = bh > 0 ? 100 / bh : 1;
    // 筆畫依「相對畫布」比例縮放，避免小裁切區時 10px 看起來像 30px
    const strokeScale = Math.min(bw, bh) / CANVAS_SIZE;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">`;
    paths.forEach(path => {
        if(path.points.length < 2) return;
        const x0 = ((path.points[0].x - bx) * scaleX);
        const y0 = ((path.points[0].y - by) * scaleY);
        let d = `M ${x0} ${y0} `;
        for(let i = 1; i < path.points.length; i++) {
            const px = ((path.points[i].x - bx) * scaleX);
            const py = ((path.points[i].y - by) * scaleY);
            d += `L ${px} ${py} `;
        }
        const scaledStroke = Math.max(0.5, path.size * strokeScale);
        svg += `<path d="${d}" stroke="${path.color}" stroke-width="${scaledStroke}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    });
    svg += `</svg>`;
    return svg;
}

document.getElementById('goToPreviewBtn').addEventListener('click', () => {
    if(paths.length === 0) {
        alert('請先在畫板上畫點東西喔！');
        return;
    }
    currentSVGString = generateSVG();
    document.getElementById('preview2d-container').innerHTML = currentSVGString;

    switchSection('section-preview', '步驟 2：確認 2D 向量草圖');
});


// ==========================================
// 系統 3：Three.js 3D 平頂浮雕轉換系統
// ==========================================
let scene, camera, renderer, modelGroup;
let is3DInitialized = false;

function init3D() {
    if(is3DInitialized) return;
    const container = document.getElementById('container3d');
    const containerWidth = container.clientWidth || 500;
    const containerHeight = container.clientHeight || 500;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, containerWidth / containerHeight, 1, 2000);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerWidth, containerHeight);
    container.appendChild(renderer.domElement);

    const light1 = new THREE.DirectionalLight(0xffffff, 0.8);
    light1.position.set(1, 1, 2);
    scene.add(light1);

    const light2 = new THREE.AmbientLight(0x606060);
    scene.add(light2);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    modelGroup = new THREE.Group();
    scene.add(modelGroup);

    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
    is3DInitialized = true;
}

function build3DModel() {
    init3D();

    while(modelGroup.children.length > 0) {
        modelGroup.remove(modelGroup.children[0]);
    }

    const maxSize = Math.max(drawingBBox.w, drawingBBox.h);
    camera.position.set(0, -maxSize * 0.6, maxSize * 1.0);

    const plateThickness = 10;
    const platePadding = 40;
    const strokeHeight = 15;

    // 建立 3D 列印底板
    const plateGeo = new THREE.BoxGeometry(drawingBBox.w + platePadding, drawingBBox.h + platePadding, plateThickness);
    const plateMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const plateMesh = new THREE.Mesh(plateGeo, plateMat);
    plateMesh.position.set(0, 0, -plateThickness / 2);
    modelGroup.add(plateMesh);

    paths.forEach(path => {
        const validPoints = [];
        path.points.forEach(p => {
            if (validPoints.length === 0) {
                validPoints.push(p);
            } else {
                const last = validPoints[validPoints.length - 1];
                if (Math.hypot(p.x - last.x, p.y - last.y) >= 1) {
                    validPoints.push(p);
                }
            }
        });

        if(validPoints.length < 2) return;

        const material = new THREE.MeshLambertMaterial({ color: path.color });
        const width = path.size;
        const height = strokeHeight;

        const cylGeo = new THREE.CylinderGeometry(width/2, width/2, height, 16);
        cylGeo.rotateX(Math.PI / 2);
        const baseBoxGeo = new THREE.BoxGeometry(1, width, height);

        const pts = validPoints.map(p => ({
            x: p.x - drawingBBox.cx,
            y: -(p.y - drawingBBox.cy)
        }));

        for(let i = 0; i < pts.length; i++) {
            const cylMesh = new THREE.Mesh(cylGeo, material);
            cylMesh.position.set(pts[i].x, pts[i].y, height/2);
            modelGroup.add(cylMesh);

            if(i < pts.length - 1) {
                const p1 = pts[i];
                const p2 = pts[i+1];
                const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);

                const boxMesh = new THREE.Mesh(baseBoxGeo, material);
                boxMesh.scale.set(len, 1, 1);
                boxMesh.position.set((p1.x + p2.x)/2, (p1.y + p2.y)/2, height/2);
                boxMesh.rotation.z = ang;
                modelGroup.add(boxMesh);
            }
        }
    });

    modelGroup.scale.set(0.2, 0.2, 0.2);
    modelGroup.updateMatrixWorld(true);
}


// ==========================================
// 系統 4：介面切換與匯出下載邏輯
// ==========================================

function switchSection(showId, titleText) {
    document.getElementById('section-2d').classList.add('hidden');
    document.getElementById('section-preview').classList.add('hidden');
    document.getElementById('section-3d').classList.add('hidden');

    document.getElementById(showId).classList.remove('hidden');
    document.getElementById('step-title').innerText = titleText;
}

document.getElementById('backToDrawBtn').addEventListener('click', () => {
    switchSection('section-2d', '步驟 1：在畫板上創作');
});

document.getElementById('convertTo3dBtn').addEventListener('click', () => {
    switchSection('section-3d', '步驟 3：預覽並匯出 3D 模型');
    build3DModel();
});

document.getElementById('backToPreviewBtn').addEventListener('click', () => {
    switchSection('section-preview', '步驟 2：確認 2D 向量草圖');
});

function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
}

document.getElementById('downloadSVGBtn').addEventListener('click', () => {
    downloadFile(currentSVGString, 'my_design.svg', 'image/svg+xml');
});

document.getElementById('downloadSTLBtn').addEventListener('click', () => {
    const exporter = new THREE.STLExporter();
    scene.updateMatrixWorld(true);
    const stlString = exporter.parse(modelGroup);
    downloadFile(stlString, 'my_design.stl', 'text/plain');
});

function generateGCodeFromPaths(paths, drawingBBox, options = {}) {
    const {
        targetSizeMM = 80,      // 希望作品最大邊長約多少 mm
        numLayers = 5,          // 列印層數
        layerThickness = 0.2    // 每層層高 (mm)
    } = options;

    if (!drawingBBox) {
        return '';
    }

    const designMax = Math.max(drawingBBox.w, drawingBBox.h) || 1;
    const scale = targetSizeMM / designMax; // 畫布座標 → 列印座標的縮放比例

    let gcode = "; G-code generated by Drawsth3D\n";
    gcode += "G21 ; 設定單位為毫米(mm)\n";
    gcode += "G90 ; 使用絕對座標\n";
    gcode += "G28 ; 原點復位\n";

    for (let layer = 1; layer <= numLayers; layer++) {
        let currentZ = (layer * layerThickness).toFixed(2);
        gcode += `\n; === 準備列印第 ${layer} 層 (Z=${currentZ}mm) ===\n`;
        gcode += `G1 Z${(parseFloat(currentZ) + 2.0).toFixed(2)} F5000 ; 稍微抬起噴頭移動\n`;

        paths.forEach((path, index) => {
            if (path.points.length < 2) return;
            gcode += `; -- 繪製筆畫 ${index + 1} --\n`;

            const startX = ((path.points[0].x - drawingBBox.x) * scale).toFixed(2);
            const startY = ((drawingBBox.y + drawingBBox.h - path.points[0].y) * scale).toFixed(2);

            gcode += `G1 X${startX} Y${startY} F5000\n`;
            gcode += `G1 Z${currentZ} F1000 ; 放下噴頭\n`;

            path.points.forEach(p => {
                const x = ((p.x - drawingBBox.x) * scale).toFixed(2);
                const y = ((drawingBBox.y + drawingBBox.h - p.y) * scale).toFixed(2);
                gcode += `G1 X${x} Y${y} E0.05 F1500\n`;
            });
            gcode += `G1 Z${(parseFloat(currentZ) + 2.0).toFixed(2)} F5000 ; 抬起噴頭\n\n`;
        });
    }

    gcode += "M104 S0 ; 關閉擠出機加熱\n";
    gcode += "M140 S0 ; 關閉熱床\n";
    gcode += "M84 ; 關閉步進馬達\n";

    return gcode;
}

document.getElementById('downloadGcodeBtn').addEventListener('click', () => {
    if (!drawingBBox) {
        drawingBBox = getBoundingBox();
    }
    const gcode = generateGCodeFromPaths(paths, drawingBBox);
    if (!gcode) {
        alert('目前無法產生 G-code，請確認作品是否正確產生邊界。');
        return;
    }
    downloadFile(gcode, 'my_design.gcode', 'text/plain');
});

document.getElementById('uploadServerBtn').addEventListener('click', () => {
    if (paths.length === 0) {
        alert('目前沒有任何作品可以上傳，請先在畫板上創作。');
        return;
    }

    const exporter = new THREE.STLExporter();
    scene.updateMatrixWorld(true);
    const stlString = exporter.parse(modelGroup);

    // 確保有最新的 SVG 與邊界盒資訊
    if (!currentSVGString || !currentSVGString.trim()) {
        currentSVGString = generateSVG();
    }
    if (!drawingBBox) {
        drawingBBox = getBoundingBox();
    }

    const designNameInput = document.getElementById('designNameInput');
    const designName = (designNameInput && designNameInput.value) ? designNameInput.value.trim() : '';

    const formData = new URLSearchParams();
    formData.append('stlData', stlString);
    formData.append('svgData', currentSVGString);
    formData.append('pathsData', JSON.stringify({ paths, drawingBBox }));
    formData.append('designName', designName);

    fetch('save_model.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
    })
    .then(response => response.text())
    .then(result => {
        const msgEl = document.getElementById('uploadSuccessMessage');
        if (msgEl) msgEl.textContent = result || '您的設計已儲存到伺服器。';
        const modalEl = document.getElementById('uploadSuccessModal');
        if (modalEl && typeof bootstrap !== 'undefined') {
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        } else {
            alert('上傳成功！' + (result ? '\n' + result : ''));
        }
    })
    .catch(err => {
        alert('上傳失敗，請確定你的 XAMPP 伺服器有開啟！');
    });
});

// 強制鎖定為單一黑色
const THEME_COLOR = '#000000';

// API 基底網址（與目前頁面同目錄），確保從 XAMPP 或任意路徑開啟都能正確請求 PHP
function apiUrl(path) {
    var base = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '') + '/';
    return base + path.replace(/^\//, '');
}

// ==========================================
// 系統 1：2D 畫布與「筆畫路徑」系統
// ==========================================
const canvas = document.getElementById('canvas2d');
const ctx = canvas.getContext('2d');

let isDrawing = false;
let paths = [];
let currentPath = null;
let undoStack = [];
let redoStack = [];

let currentMode = 'brush';
const sizeSlider = document.getElementById('sizeSlider');
const sizeDisplay = document.getElementById('sizeDisplay');

sizeSlider.addEventListener('input', function() { sizeDisplay.innerText = this.value + 'px'; });

// 介面提示元素
const drawMessageEl = document.getElementById('drawMessage');
const exportMessageEl = document.getElementById('exportMessage');

function showDrawMessage(message, isError = false) {
    if (!drawMessageEl) return;
    drawMessageEl.textContent = message;
    drawMessageEl.classList.toggle('is-error', !!isError);
}

function showExportMessage(message, isError = false) {
    if (!exportMessageEl) return;
    exportMessageEl.textContent = message;
    exportMessageEl.classList.toggle('is-error', !!isError);
}

// 一開始給第一次使用者的簡短引導
showDrawMessage('用手指或滑鼠在畫布上畫線，完成後點右下角「下一步：預覽 2D」。');

// Undo / Redo 狀態管理
function clonePaths() {
    return JSON.parse(JSON.stringify(paths));
}

function pushUndoState() {
    undoStack.push(clonePaths());
    if (undoStack.length > 50) {
        undoStack.shift();
    }
    // 只要有新動作就清空重做堆疊
    redoStack = [];
}

// 依照實際顯示尺寸，把螢幕座標換算成畫布內部座標（解決縮放後位置錯位）
function getCanvasPosFromClientPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

// 取得滑鼠事件座標
function getCanvasPosFromMouseEvent(event) {
    return getCanvasPosFromClientPoint(event.clientX, event.clientY);
}

// 取得觸控事件在畫布上的座標（支援 iPhone / iPad）
function getCanvasPosFromTouchEvent(event) {
    const touch = event.touches[0] || event.changedTouches[0];
    if (!touch) return null;
    return getCanvasPosFromClientPoint(touch.clientX, touch.clientY);
}

// 若瀏覽器支援 Pointer Events，優先使用（對真實手機與 Chrome 模擬都較一致）
const USE_POINTER = window.PointerEvent !== undefined;
if (USE_POINTER) {
    // 確保在支援 pointer 的環境中，畫布本身禁止預設觸控捲動
    canvas.style.touchAction = 'none';
}

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

function endDrawing() {
    if (isDrawing && currentMode === 'brush' && currentPath && currentPath.points.length > 1) {
        // mousedown / touchstart 時已經 pushUndoState()
        paths.push(currentPath);
        showDrawMessage('已記錄一筆筆畫，還可以繼續畫，或點「下一步：預覽 2D」。', false);
    }
    isDrawing = false;
    currentPath = null;
    redraw2D();
}

if (USE_POINTER) {
    // Pointer Events 版本（優先用這個）
    canvas.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const pos = getCanvasPosFromClientPoint(e.clientX, e.clientY);
        if (!pos) return;
        e.preventDefault();
        if (currentMode === 'brush') {
            pushUndoState();
            isDrawing = true;
            currentPath = {
                color: THEME_COLOR,
                size: parseInt(sizeSlider.value),
                points: [{ x: pos.x, y: pos.y }]
            };
        } else if (currentMode === 'eraser') {
            pushUndoState();
            erasePathAt(pos.x, pos.y);
            isDrawing = true;
        }
    });

    canvas.addEventListener('pointermove', (e) => {
        if (!isDrawing) return;
        const pos = getCanvasPosFromClientPoint(e.clientX, e.clientY);
        if (!pos) return;
        e.preventDefault();
        if (currentMode === 'brush' && currentPath) {
            const lastPoint = currentPath.points[currentPath.points.length - 1];
            const dx = pos.x - lastPoint.x;
            const dy = pos.y - lastPoint.y;
            if (Math.hypot(dx, dy) > 2) {
                currentPath.points.push({ x: pos.x, y: pos.y });
                redraw2D();
            }
        } else if (currentMode === 'eraser') {
            erasePathAt(pos.x, pos.y);
        }
    });

    canvas.addEventListener('pointerup', (e) => {
        e.preventDefault();
        endDrawing();
    });

    canvas.addEventListener('pointercancel', (e) => {
        e.preventDefault();
        endDrawing();
    });
} else {
    // 備援：舊版只支援 mouse + touch 的瀏覽器
    canvas.addEventListener('mousedown', (e) => {
        const pos = getCanvasPosFromMouseEvent(e);
        if (!pos) return;
        if (currentMode === 'brush') {
            pushUndoState();
            isDrawing = true;
            currentPath = {
                color: THEME_COLOR,
                size: parseInt(sizeSlider.value),
                points: [{ x: pos.x, y: pos.y }]
            };
        } else if (currentMode === 'eraser') {
            pushUndoState();
            erasePathAt(pos.x, pos.y);
            isDrawing = true;
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        const pos = getCanvasPosFromMouseEvent(e);
        if (!pos) return;
        if (!isDrawing) return;
        if (currentMode === 'brush' && currentPath) {
            const lastPoint = currentPath.points[currentPath.points.length - 1];
            const dx = pos.x - lastPoint.x;
            const dy = pos.y - lastPoint.y;
            if (Math.hypot(dx, dy) > 2) {
                currentPath.points.push({ x: pos.x, y: pos.y });
                redraw2D();
            }
        } else if (currentMode === 'eraser') {
            erasePathAt(pos.x, pos.y);
        }
    });

    window.addEventListener('mouseup', endDrawing);

    // 觸控支援：在手機 / 平板上也可以畫畫
    canvas.addEventListener('touchstart', (e) => {
        const pos = getCanvasPosFromTouchEvent(e);
        if (!pos) return;
        e.preventDefault();
        if (currentMode === 'brush') {
            pushUndoState();
            isDrawing = true;
            currentPath = {
                color: THEME_COLOR,
                size: parseInt(sizeSlider.value),
                points: [{ x: pos.x, y: pos.y }]
            };
        } else if (currentMode === 'eraser') {
            pushUndoState();
            erasePathAt(pos.x, pos.y);
            isDrawing = true;
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (!isDrawing) return;
        const pos = getCanvasPosFromTouchEvent(e);
        if (!pos) return;
        e.preventDefault();
        if (currentMode === 'brush' && currentPath) {
            const lastPoint = currentPath.points[currentPath.points.length - 1];
            const dx = pos.x - lastPoint.x;
            const dy = pos.y - lastPoint.y;
            if (Math.hypot(dx, dy) > 2) {
                currentPath.points.push({ x: pos.x, y: pos.y });
                redraw2D();
            }
        } else if (currentMode === 'eraser') {
            erasePathAt(pos.x, pos.y);
        }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        endDrawing();
    }, { passive: false });

    canvas.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        endDrawing();
    }, { passive: false });
}

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
    if (undoStack.length === 0) return;
    redoStack.push(clonePaths());
    const prev = undoStack.pop();
    paths = prev || [];
    redraw2D();
});

document.getElementById('redoBtn').addEventListener('click', () => {
    if (redoStack.length === 0) return;
    undoStack.push(clonePaths());
    const next = redoStack.pop();
    paths = next || [];
    redraw2D();
});

document.getElementById('clearBtn').addEventListener('click', () => {
    if (paths.length === 0) return;
    pushUndoState();
    paths = [];
    redraw2D();
    showDrawMessage('畫布已清除，可以重新開始創作。', false);
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

    if (!hasPoints) return { x: 0, y: 0, w: 600, h: 600, cx: 300, cy: 300 };

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

const CANVAS_SIZE = 600; // 與 #canvas2d 尺寸一致，用於筆畫比例計算

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
        showDrawMessage('請先在畫布上畫點東西，再點「下一步：預覽 2D」。', true);
        return;
    }
    currentSVGString = generateSVG();
    document.getElementById('preview2d-container').innerHTML = currentSVGString;
    switchSection('section-preview');
});


// ==========================================
// 系統 3：Three.js 3D 平頂浮雕轉換系統
// ==========================================
let scene, camera, renderer, modelGroup;
let is3DInitialized = false;

function init3D() {
    if(is3DInitialized) return;
    const container = document.getElementById('container3d');
    var containerWidth = container.clientWidth || 500;
    var containerHeight = container.clientHeight || 500;
    if (containerWidth < 10 || containerHeight < 10) {
        containerWidth = 520;
        containerHeight = 420;
    }
    var aspect = containerWidth / containerHeight;
    if (!Number.isFinite(aspect) || aspect <= 0) aspect = 520 / 420;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, aspect, 1, 2000);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerWidth, containerHeight);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const light1 = new THREE.DirectionalLight(0xffffff, 1.0);
    light1.position.set(1, 1, 2);
    scene.add(light1);

    const light2 = new THREE.AmbientLight(0x808080);
    scene.add(light2);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
    backLight.position.set(-1, -0.5, 1.5);
    scene.add(backLight);

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

function resize3DIfNeeded() {
    if (!renderer || !is3DInitialized) return;
    const container = document.getElementById('container3d');
    var w = container.clientWidth || 520;
    var h = container.clientHeight || 420;
    if (w < 10 || h < 10) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}

function build3DModel() {
    init3D();

    while(modelGroup.children.length > 0) {
        modelGroup.remove(modelGroup.children[0]);
    }

    const maxSize = Math.max(drawingBBox.w, drawingBBox.h);
    // 稍微俯視的 45 度角，讓立體感更明顯
    camera.position.set(maxSize * 0.6, -maxSize * 0.6, maxSize * 0.9);
    camera.lookAt(0, 0, 0);

    const plateThickness = 10;
    const platePadding = 40;
    const strokeHeight = 15;

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

function switchSection(showId) {
    const sections = ['section-2d', 'section-preview', 'section-3d'];
    sections.forEach(id => {
        const el = document.getElementById(id);
        el.classList.add('hidden');
        el.classList.remove('transition-in');
    });

    const target = document.getElementById(showId);
    target.classList.remove('hidden');
    target.classList.add('transition-in');

    document.querySelectorAll('.step-indicator .step').forEach(step => {
        step.classList.toggle('active', step.getAttribute('data-step') === showId);
    });
}

document.getElementById('backToDrawBtn').addEventListener('click', () => {
    switchSection('section-2d');
});

document.getElementById('convertTo3dBtn').addEventListener('click', () => {
    switchSection('section-3d');
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            build3DModel();
            resize3DIfNeeded();
        });
    });
});

document.getElementById('backToPreviewBtn').addEventListener('click', () => {
    switchSection('section-preview');
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
        showExportMessage('目前無法產生 G-code，請確認作品是否有內容且邊界已正確產生。', true);
        return;
    }
    downloadFile(gcode, 'my_design.gcode', 'text/plain');
    showExportMessage('已產生並下載 G-code。', false);
});

document.getElementById('uploadServerBtn').addEventListener('click', () => {
    if (paths.length === 0) {
        showExportMessage('目前沒有任何作品可以上傳，請先在畫板上創作。', true);
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

    fetch(apiUrl('server/save_model.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
    })
    .then(response => response.text())
    .then(result => {
        const msgEl = document.getElementById('uploadSuccessMessage');
        if (msgEl) msgEl.textContent = result || '您的設計已儲存到伺服器。';
        showExportMessage('作品已成功上傳到伺服器。', false);
        const modalEl = document.getElementById('uploadSuccessModal');
        if (modalEl) {
            modalEl.classList.add('is-open');
            modalEl.setAttribute('aria-hidden', 'false');
        }
    })
    .catch(err => {
        showExportMessage('上傳失敗，請確定你的 XAMPP 伺服器有開啟！', true);
    });
});

document.getElementById('closeUploadModal').addEventListener('click', () => {
    const modal = document.getElementById('uploadSuccessModal');
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
});

document.getElementById('uploadSuccessModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        e.currentTarget.classList.remove('is-open');
        e.currentTarget.setAttribute('aria-hidden', 'true');
    }
});

// upload.js — 上傳圖片 → 2D 輪廓 → 3D 模型

function apiUrl(path) {
    var base = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '') + '/';
    return base + path.replace(/^\//, '');
}

var paths = [];
var drawingBBox = null;
var currentSVGString = '';
var scene, camera, renderer, modelGroup;
var is3DInitialized = false;
// 由圖片轉成的像素高度圖（黑=1, 白=0）
var pixelMap = null;
// true = 平滑路徑浮雕（向量擠出），false = 實心像素浮雕
var useSmoothPathRelief = false;

// ---------- 上傳與預覽 ----------
var fileInput = document.getElementById('fileInput');
var cameraInput = document.getElementById('cameraInput');
var imagePreviewArea = document.getElementById('imagePreviewArea');
var imagePreview = document.getElementById('imagePreview');
var convertBtnRow = document.getElementById('convertBtnRow');

var sourceImage = null;
var sourceCanvas = null;

function handleImageSelect(file) {
    if (!file || !file.type.startsWith('image/')) return;
    var reader = new FileReader();
    reader.onload = function(e) {
        var img = new Image();
        img.onload = function() {
            sourceImage = img;
            imagePreview.src = e.target.result;
            imagePreviewArea.classList.remove('hidden');
            convertBtnRow.classList.remove('hidden');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

fileInput.addEventListener('change', function() {
    if (this.files && this.files[0]) handleImageSelect(this.files[0]);
});

cameraInput.addEventListener('change', function() {
    if (this.files && this.files[0]) handleImageSelect(this.files[0]);
});

// ---------- 解析 SVG path d 字串 → 點陣列 ----------
function parseSvgPathD(d) {
    var points = [];
    if (!d || typeof d !== 'string') return points;
    var tokens = d.replace(/([MLHVCSQTAZ])/gi, ' $1 ').replace(/,/g, ' ').replace(/\s+/g, ' ').trim().split(' ');
    var i = 0;
    var x = 0, y = 0;
    var lastCmd = '';

    while (i < tokens.length) {
        var cmd = tokens[i];
        if (/^[MLHVCSQTAZ]$/i.test(cmd)) {
            lastCmd = cmd;
            i++;
        }

        if (lastCmd === 'M' || lastCmd === 'L') {
            if (i + 1 < tokens.length && !isNaN(parseFloat(tokens[i])) && !isNaN(parseFloat(tokens[i + 1]))) {
                x = parseFloat(tokens[i]);
                y = parseFloat(tokens[i + 1]);
                points.push({ x: x, y: y });
                i += 2;
            }
        } else if (lastCmd === 'H' && i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
            x = parseFloat(tokens[i]);
            points.push({ x: x, y: y });
            i++;
        } else if (lastCmd === 'V' && i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
            y = parseFloat(tokens[i]);
            points.push({ x: x, y: y });
            i++;
        } else if (lastCmd === 'Z') {
            i++;
            if (points.length > 0) {
                var first = points[0];
                points.push({ x: first.x, y: first.y });
            }
        } else {
            i++;
        }
    }
    return points;
}

// ---------- 從 tracedata 或 SVG 字串取得 paths ----------
function pathsFromSvgString(svgStr, strokeSize) {
    paths = [];
    strokeSize = strokeSize || 2;
    var allPoints = [];
    var doc = new DOMParser().parseFromString(svgStr, 'image/svg+xml');
    var pathEls = doc.querySelectorAll('path');
    pathEls.forEach(function(el) {
        var d = el.getAttribute('d');
        if (!d) return;
        var pts = parseSvgPathD(d);
        if (pts.length >= 2) {
            paths.push({ color: '#000000', size: strokeSize, points: pts });
            pts.forEach(function(p) { allPoints.push(p); });
        }
    });
    if (allPoints.length > 0) updateDrawingBBox(allPoints);
}

function updateDrawingBBox(allPoints) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    allPoints.forEach(function(p) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    });
    var pad = 10;
    drawingBBox = {
        x: Math.max(0, minX - pad),
        y: Math.max(0, minY - pad),
        w: (maxX - minX) + pad * 2,
        h: (maxY - minY) + pad * 2,
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2
    };
}

function tracedataToPaths(tracedata, strokeSize) {
    paths = [];
    strokeSize = strokeSize || 2;

    if (!tracedata) return paths;
    var allPoints = [];

    if (tracedata.layers && Array.isArray(tracedata.layers)) {
        tracedata.layers.forEach(function(layer) {
            if (!layer.paths) return;
            layer.paths.forEach(function(pathObj) {
                var d = pathObj.d || pathObj;
                if (typeof d !== 'string') return;
                var pts = parseSvgPathD(d);
                if (pts.length >= 2) {
                    paths.push({ color: '#000000', size: strokeSize, points: pts });
                    pts.forEach(function(p) { allPoints.push(p); });
                }
            });
        });
    }
    updateDrawingBBox(allPoints);
    return paths;
}

// ---------- 簡單的折線平滑（Chaikin 演算法） ----------
function smoothPolyline(points, iterations) {
    iterations = iterations || 2;
    if (!points || points.length < 3) return points;

    var pts = points.slice();
    var closed = (pts[0].x === pts[pts.length - 1].x && pts[0].y === pts[pts.length - 1].y);

    for (var k = 0; k < iterations; k++) {
        var newPts = [];
        var len = pts.length;
        var start = 0;
        var end = len - 1;
        if (closed) {
            end = len;
        } else {
            newPts.push({ x: pts[0].x, y: pts[0].y });
            start = 1;
        }

        for (var i = start; i < end - 1; i++) {
            var p0 = pts[i];
            var p1 = pts[(i + 1) % len];
            var Q = { x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y };
            var R = { x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y };
            newPts.push(Q);
            newPts.push(R);
        }

        if (!closed) {
            newPts.push({ x: pts[len - 1].x, y: pts[len - 1].y });
        } else {
            newPts.push({ x: newPts[0].x, y: newPts[0].y });
        }
        pts = newPts;
    }
    return pts;
}

// 射線法判斷點是否在多邊形內部（用於洞洞偵測）
function pointInPolygon(pt, poly) {
    if (!poly || poly.length < 3) return false;
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        var xi = poly[i].x, yi = poly[i].y;
        var xj = poly[j].x, yj = poly[j].y;
        var intersect = ((yi > pt.y) !== (yj > pt.y)) &&
            (pt.x < (xj - xi) * (pt.y - yi) / ((yj - yi) || 1e-9) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// ---------- 轉換圖片為 2D 輪廓 ----------
document.getElementById('convertTo2dBtn').addEventListener('click', function() {
    if (!sourceImage) {
        alert('請先上傳或拍攝一張圖片');
        return;
    }

    var maxSize = 400;
    var w = sourceImage.width;
    var h = sourceImage.height;
    if (w > maxSize || h > maxSize) {
        var s = maxSize / Math.max(w, h);
        w = Math.round(w * s);
        h = Math.round(h * s);
    }

    if (!sourceCanvas) sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = w;
    sourceCanvas.height = h;
    var ctx = sourceCanvas.getContext('2d');
    ctx.drawImage(sourceImage, 0, 0, w, h);
    var imgData = ctx.getImageData(0, 0, w, h);
    // 產生一份較高解析度（例如 160×160 左右）的黑白像素高度圖，讓曲線邊緣更平滑
    buildPixelMapFromImageData(imgData, 160);

    try {
        var tracedata = ImageTracer.imagedataToTracedata(imgData, {
            ltres: 1,
            qtres: 1,
            pathomit: 4
        });
        tracedataToPaths(tracedata, 2);

        if (paths.length === 0) {
            var svgStr = ImageTracer.imagedataToSVG(imgData, { scale: 1 });
            pathsFromSvgString(svgStr, 2);
        }
        if (paths.length === 0) {
            tracedata = ImageTracer.imagedataToTracedata(imgData, { ltres: 2, qtres: 2 });
            tracedataToPaths(tracedata, 3);
        }
        if (paths.length === 0) {
            var svgStr2 = ImageTracer.imagedataToSVG(imgData, 'posterized1');
            pathsFromSvgString(svgStr2, 3);
        }

        if (paths.length === 0) {
            alert('無法從此圖片萃取輪廓，請試試線條較清楚的圖片。');
            return;
        }

        // 2D 預覽改用像素高度圖，畫面會跟 3D 實際生成內容一致
        currentSVGString = generateSVGFromPixelMap() || generateSVGFromPaths();
        document.getElementById('preview2d-container').innerHTML = currentSVGString;
        switchSection('section-preview');
    } catch (e) {
        alert('轉換失敗：' + (e.message || e));
    }
});

function generateSVGFromPaths() {
    if (!drawingBBox || paths.length === 0) return '';
    var bx = drawingBBox.x, by = drawingBBox.y, bw = drawingBBox.w, bh = drawingBBox.h;
    var scaleX = bw > 0 ? 100 / bw : 1;
    var scaleY = bh > 0 ? 100 / bh : 1;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">';
    paths.forEach(function(path) {
        if (!path.points || path.points.length < 2) return;
        var p0 = path.points[0];
        var d = 'M ' + ((p0.x - bx) * scaleX) + ' ' + ((p0.y - by) * scaleY);
        for (var i = 1; i < path.points.length; i++) {
            var p = path.points[i];
            d += ' L ' + ((p.x - bx) * scaleX) + ' ' + ((p.y - by) * scaleY);
        }
        // 實心預覽：改成填滿路徑，而不是只有線條
        svg += '<path d="' + d + '" fill="' + (path.color || '#000') + '" stroke="none"/>';
    });
    svg += '</svg>';
    return svg;
}

// ---------- 將圖片轉成簡化的黑白像素高度圖 ----------
function buildPixelMapFromImageData(imgData, maxResolution) {
    // 提高預設解析度，讓曲線更細緻
    maxResolution = maxResolution || 160;
    if (!imgData || !imgData.width || !imgData.height) {
        pixelMap = null;
        return;
    }

    var srcW = imgData.width;
    var srcH = imgData.height;

    // 依長邊縮放到 maxResolution，以保留大致比例又不會太重
    var scale = maxResolution / Math.max(srcW, srcH);
    var dstW = Math.max(1, Math.round(srcW * scale));
    var dstH = Math.max(1, Math.round(srcH * scale));

    var pixels = new Array(dstH);
    for (var y = 0; y < dstH; y++) {
        pixels[y] = new Array(dstW);

        // 對應到原圖中的一小塊區域，做「區塊平均」，當成簡單的模糊去鋸齒
        var srcY0 = Math.floor(y * srcH / dstH);
        var srcY1 = Math.floor((y + 1) * srcH / dstH);
        if (srcY1 < srcY0) srcY1 = srcY0;

        for (var x = 0; x < dstW; x++) {
            var srcX0 = Math.floor(x * srcW / dstW);
            var srcX1 = Math.floor((x + 1) * srcW / dstW);
            if (srcX1 < srcX0) srcX1 = srcX0;

            var sumGray = 0;
            var count = 0;

            for (var sy = srcY0; sy <= srcY1; sy++) {
                for (var sx = srcX0; sx <= srcX1; sx++) {
                    var idx = (sy * srcW + sx) * 4;
                    var r = imgData.data[idx];
                    var g = imgData.data[idx + 1];
                    var b = imgData.data[idx + 2];
                    var a = imgData.data[idx + 3];
                    var gray = 0.299 * r + 0.587 * g + 0.114 * b;
                    // 幾乎透明就當作白色背景
                    if (a < 10) gray = 255;
                    sumGray += gray;
                    count++;
                }
            }

            var avgGray = count > 0 ? (sumGray / count) : 255;
            // 平均灰度低於門檻就當成「黑」像素，邊緣會比單點取樣更平滑
            pixels[y][x] = avgGray < 128 ? 1 : 0;
        }
    }

    pixelMap = {
        width: dstW,
        height: dstH,
        pixels: pixels
    };
}

// ---------- 依像素高度圖產生 2D SVG 預覽（黑=實心方塊） ----------
function generateSVGFromPixelMap() {
    if (!pixelMap || !pixelMap.width || !pixelMap.height || !pixelMap.pixels) return '';
    var w = pixelMap.width;
    var h = pixelMap.height;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="100%">';
    svg += '<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="#ffffff"/>';
    for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
            if (!pixelMap.pixels[y][x]) continue;
            svg += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="#000000"/>';
        }
    }
    svg += '</svg>';
    return svg;
}

// ---------- 步驟切換 ----------
function switchSection(showId) {
    ['section-upload', 'section-preview', 'section-3d'].forEach(function(id) {
        var el = document.getElementById(id);
        el.classList.add('hidden');
        el.classList.remove('transition-in');
    });
    var target = document.getElementById(showId);
    target.classList.remove('hidden');
    target.classList.add('transition-in');
    document.querySelectorAll('.step-indicator .step').forEach(function(step) {
        step.classList.toggle('active', step.getAttribute('data-step') === showId);
    });
}

document.getElementById('backToUploadBtn').addEventListener('click', function() {
    switchSection('section-upload');
});

document.getElementById('modePixel').addEventListener('click', function() {
    useSmoothPathRelief = false;
    document.getElementById('modePixel').classList.add('active');
    document.getElementById('modeSmooth').classList.remove('active');
});
document.getElementById('modeSmooth').addEventListener('click', function() {
    useSmoothPathRelief = true;
    document.getElementById('modeSmooth').classList.add('active');
    document.getElementById('modePixel').classList.remove('active');
});

document.getElementById('goTo3dBtn').addEventListener('click', function() {
    switchSection('section-3d');
    requestAnimationFrame(function() {
        requestAnimationFrame(function() {
            build3DModel();
            resize3DIfNeeded();
        });
    });
});

document.getElementById('backToPreviewBtn').addEventListener('click', function() {
    switchSection('section-preview');
});

// ---------- 3D 系統 ----------
function init3D() {
    if (is3DInitialized) return;
    var container = document.getElementById('container3d');
    var cw = container.clientWidth || 520;
    var ch = container.clientHeight || 420;
    if (cw < 10 || ch < 10) { cw = 520; ch = 420; }
    var aspect = Number.isFinite(cw / ch) && cw / ch > 0 ? cw / ch : 520 / 420;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, aspect, 1, 2000);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(cw, ch);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    scene.add(new THREE.DirectionalLight(0xffffff, 0.8));
    scene.add(new THREE.AmbientLight(0x606060));
    var controls = new THREE.OrbitControls(camera, renderer.domElement);
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
    var container = document.getElementById('container3d');
    var w = container.clientWidth || 520;
    var h = container.clientHeight || 420;
    if (w < 10 || h < 10) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}

function build3DModel() {
    init3D();

    while (modelGroup.children.length > 0) {
        modelGroup.remove(modelGroup.children[0]);
    }

    var plateThickness = 2;
    // 平滑模式用比較高的浮雕高度，讓立體效果更明顯
    var reliefHeight = useSmoothPathRelief ? 8 : 4;
    var platePadding = 4;
    var worldW, worldH;

    if (useSmoothPathRelief && drawingBBox && paths && paths.length > 0) {
        // ---------- 平滑路徑浮雕：用向量路徑擠出，邊緣完全平滑 ----------
        worldW = drawingBBox.w;
        worldH = drawingBBox.h;
        var maxSize = Math.max(worldW, worldH);
        camera.position.set(0, -maxSize * 1.2, maxSize * 1.5);

        var plateGeo = new THREE.BoxGeometry(worldW + platePadding, worldH + platePadding, plateThickness);
        // 平滑模式：底板用淺灰色，浮雕用亮色，對比清楚
        var plateMat = new THREE.MeshLambertMaterial({ color: 0xdddddd });
        var plateMesh = new THREE.Mesh(plateGeo, plateMat);
        plateMesh.position.set(0, 0, -plateThickness / 2);
        modelGroup.add(plateMesh);

        var cx = drawingBBox.cx;
        var cy = drawingBBox.cy;

        // 先將所有路徑整理成多邊形資訊（包含 bbox / 面積 / 代表點）
        var polyInfos = [];
        var worldArea = worldW * worldH;

        paths.forEach(function(path) {
            var validPoints = [];
            (path.points || []).forEach(function(p) {
                if (validPoints.length === 0) {
                    validPoints.push(p);
                } else {
                    var last = validPoints[validPoints.length - 1];
                    if (Math.hypot(p.x - last.x, p.y - last.y) >= 0.5) validPoints.push(p);
                }
            });
            if (validPoints.length < 3) return;

            var pts = validPoints.map(function(p) {
                return { x: p.x - cx, y: -(p.y - cy) };
            });
            var first = pts[0];
            var last = pts[pts.length - 1];
            if (Math.hypot(last.x - first.x, last.y - first.y) > 0.1) {
                pts.push({ x: first.x, y: first.y });
            }

            // 使用 Chaikin 平滑多邊線，讓邊緣更順
            pts = smoothPolyline(pts, 2);

            // 計算這條路徑覆蓋的範圍
            var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            pts.forEach(function(p) {
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
            });
            var spanX = maxX - minX;
            var spanY = maxY - minY;
            if (spanX <= 0 || spanY <= 0) return;

            // 幾乎等於全圖的大外框：略過
            if (spanX > worldW * 0.9 && spanY > worldH * 0.9) return;

            // 非常小的雜訊：略過
            var bboxArea = spanX * spanY;
            if (worldArea > 0 && bboxArea / worldArea < 0.005) return;

            // 計算多邊形面積與質心（用 shoelace）
            var area = 0;
            var cxSum = 0;
            var cySum = 0;
            for (var i = 0; i < pts.length - 1; i++) {
                var p0 = pts[i];
                var p1 = pts[i + 1];
                var cross = p0.x * p1.y - p1.x * p0.y;
                area += cross;
                cxSum += (p0.x + p1.x) * cross;
                cySum += (p0.y + p1.y) * cross;
            }
            area = area / 2;
            var absArea = Math.abs(area);
            if (absArea < 1e-3) return;
            var centroid = {
                x: cxSum / (6 * area || 1e-9),
                y: cySum / (6 * area || 1e-9)
            };
            // 正面積 = 逆時針，負面積 = 順時針（用於洞的繞序判斷）
            var isCCW = area > 0;

            polyInfos.push({
                pts: pts,
                minX: minX,
                maxX: maxX,
                minY: minY,
                maxY: maxY,
                area: absArea,
                centroid: centroid,
                parentIndex: -1,
                isCCW: isCCW
            });
        });

        if (polyInfos.length === 0) {
            // 沒有可用路徑就只顯示底板
        } else {
            // 依面積由大到小排序，方便後面找「外圈包住內圈」
            polyInfos.sort(function(a, b) { return b.area - a.area; });

            // 為較小的路徑尋找其外層輪廓，作為 hole
            for (var i = 0; i < polyInfos.length; i++) {
                var outer = polyInfos[i];
                for (var j = i + 1; j < polyInfos.length; j++) {
                    var inner = polyInfos[j];
                    if (inner.parentIndex !== -1) continue;

                    // 先用 bbox 粗判斷
                    if (inner.minX < outer.minX || inner.maxX > outer.maxX ||
                        inner.minY < outer.minY || inner.maxY > outer.maxY) {
                        continue;
                    }
                    // 再用點在多邊形內判斷
                    if (pointInPolygon(inner.centroid, outer.pts)) {
                        inner.parentIndex = i;
                    }
                }
            }

            // 建立 Shape + holes 並擠出
            for (var iOuter = 0; iOuter < polyInfos.length; iOuter++) {
                if (polyInfos[iOuter].parentIndex !== -1) continue; // 只處理外圈
                var info = polyInfos[iOuter];
                var shape = new THREE.Shape();
                shape.moveTo(info.pts[0].x, info.pts[0].y);
                for (var k = 1; k < info.pts.length; k++) {
                    shape.lineTo(info.pts[k].x, info.pts[k].y);
                }

                // 將屬於此外圈的所有路徑加成洞（洞必須與外圈「反向繞序」才能正確挖空）
                var outerCCW = polyInfos[iOuter].isCCW;
                for (var jHole = 0; jHole < polyInfos.length; jHole++) {
                    if (polyInfos[jHole].parentIndex === iOuter) {
                        var holePts = polyInfos[jHole].pts;
                        var holeCCW = polyInfos[jHole].isCCW;
                        if (holeCCW === outerCCW) {
                            holePts = holePts.slice().reverse();
                        }
                        var holePath = new THREE.Path();
                        holePath.moveTo(holePts[0].x, holePts[0].y);
                        for (var h = 1; h < holePts.length; h++) {
                            holePath.lineTo(holePts[h].x, holePts[h].y);
                        }
                        shape.holes.push(holePath);
                    }
                }

                var extrudeSettings = {
                    depth: reliefHeight,
                    bevelEnabled: true,
                    bevelThickness: 0.6,
                    bevelSize: 0.6,
                    bevelSegments: 2
                };
                var geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                var material = new THREE.MeshLambertMaterial({ color: 0x0077ff });
                var mesh = new THREE.Mesh(geometry, material);
                mesh.position.z = 0;
                modelGroup.add(mesh);
            }
        }
    } else {
        // ---------- 實心像素浮雕：一格一格小立方體 ----------
        if (!pixelMap || !pixelMap.width || !pixelMap.height || !pixelMap.pixels) {
            if (!drawingBBox) return;
        }
        var gap = 0;
        if (pixelMap && pixelMap.width && pixelMap.height) {
            worldW = pixelMap.width;
            worldH = pixelMap.height;
        } else {
            worldW = drawingBBox.w;
            worldH = drawingBBox.h;
        }

        var maxSize = Math.max(worldW, worldH);
        camera.position.set(0, -maxSize * 1.2, maxSize * 1.5);

        var plateGeo = new THREE.BoxGeometry(worldW + platePadding, worldH + platePadding, plateThickness);
        var plateMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
        var plateMesh = new THREE.Mesh(plateGeo, plateMat);
        plateMesh.position.set(0, 0, -plateThickness / 2);
        modelGroup.add(plateMesh);

        if (pixelMap && pixelMap.width && pixelMap.height && pixelMap.pixels) {
            var w = pixelMap.width;
            var h = pixelMap.height;
            var cubeSize = 1 - gap;
            var halfW = w / 2;
            var halfH = h / 2;
            var cubeGeo = new THREE.BoxGeometry(cubeSize, cubeSize, reliefHeight);
            var cubeMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
            for (var y = 0; y < h; y++) {
                for (var x = 0; x < w; x++) {
                    if (!pixelMap.pixels[y][x]) continue;
                    var mesh = new THREE.Mesh(cubeGeo, cubeMat);
                    mesh.position.set((x - halfW + 0.5), -(y - halfH + 0.5), reliefHeight / 2);
                    modelGroup.add(mesh);
                }
            }
        }
    }

    modelGroup.scale.set(0.5, 0.5, 0.5);
    modelGroup.updateMatrixWorld(true);
}

// ---------- 下載與上傳 ----------
function downloadFile(content, fileName, mimeType) {
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
}

document.getElementById('downloadSVGBtn').addEventListener('click', function() {
    downloadFile(currentSVGString, 'my_design.svg', 'image/svg+xml');
});

document.getElementById('downloadSTLBtn').addEventListener('click', function() {
    var exporter = new THREE.STLExporter();
    scene.updateMatrixWorld(true);
    downloadFile(exporter.parse(modelGroup), 'my_design.stl', 'text/plain');
});

function generateGCodeFromPaths(paths, drawingBBox, opts) {
    opts = opts || {};
    var targetSizeMM = opts.targetSizeMM || 80;
    var numLayers = opts.numLayers || 5;
    var layerThickness = opts.layerThickness || 0.2;
    if (!drawingBBox) return '';
    var designMax = Math.max(drawingBBox.w, drawingBBox.h) || 1;
    var scale = targetSizeMM / designMax;

    var g = '; G-code generated by Drawsth3D\nG21\nG90\nG28\n';
    for (var layer = 1; layer <= numLayers; layer++) {
        var z = (layer * layerThickness).toFixed(2);
        g += '\n; Layer ' + layer + '\nG1 Z' + (parseFloat(z) + 2).toFixed(2) + ' F5000\n';
        paths.forEach(function(path, idx) {
            if (!path.points || path.points.length < 2) return;
            var p0 = path.points[0];
            var x0 = ((p0.x - drawingBBox.x) * scale).toFixed(2);
            var y0 = ((drawingBBox.y + drawingBBox.h - p0.y) * scale).toFixed(2);
            g += 'G1 X' + x0 + ' Y' + y0 + ' F5000\nG1 Z' + z + ' F1000\n';
            path.points.forEach(function(p) {
                var x = ((p.x - drawingBBox.x) * scale).toFixed(2);
                var y = ((drawingBBox.y + drawingBBox.h - p.y) * scale).toFixed(2);
                g += 'G1 X' + x + ' Y' + y + ' E0.05 F1500\n';
            });
            g += 'G1 Z' + (parseFloat(z) + 2).toFixed(2) + ' F5000\n';
        });
    }
    g += 'M104 S0\nM140 S0\nM84\n';
    return g;
}

document.getElementById('downloadGcodeBtn').addEventListener('click', function() {
    var gcode = generateGCodeFromPaths(paths, drawingBBox);
    if (!gcode) { alert('無法產生 G-code'); return; }
    downloadFile(gcode, 'my_design.gcode', 'text/plain');
});

document.getElementById('uploadServerBtn').addEventListener('click', function() {
    if (!modelGroup || !drawingBBox) {
        alert('請先完成 3D 模型生成');
        return;
    }
    var exporter = new THREE.STLExporter();
    scene.updateMatrixWorld(true);
    var stlString = exporter.parse(modelGroup);

    var designName = (document.getElementById('designNameInput').value || '').trim();
    var formData = new URLSearchParams();
    formData.append('stlData', stlString);
    formData.append('svgData', currentSVGString || '');
    formData.append('pathsData', JSON.stringify({ paths: paths, drawingBBox: drawingBBox }));
    formData.append('designName', designName);

    fetch(apiUrl('save_model.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
    })
    .then(function(r) { return r.text(); })
    .then(function(result) {
        document.getElementById('uploadSuccessMessage').textContent = result || '您的設計已儲存到伺服器。';
        document.getElementById('uploadSuccessModal').classList.add('is-open');
    })
    .catch(function(err) {
        alert('上傳失敗，請確認 XAMPP 伺服器有開啟！');
    });
});

document.getElementById('closeUploadModal').addEventListener('click', function() {
    document.getElementById('uploadSuccessModal').classList.remove('is-open');
});
document.getElementById('uploadSuccessModal').addEventListener('click', function(e) {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('is-open');
});

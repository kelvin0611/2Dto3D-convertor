# Snek.3D: Computer Vision-Driven 2D-to-3D Modeling Pipeline

**Domain:** Computer Vision, Computational Geometry, 3D Web Graphics  
**Tech Stack:** JavaScript, Three.js, Python, OpenCV, HTML5 Canvas  

## 📌 Project Overview
Snek.3D is an interactive web application that bridges the gap between 2D sketching and 3D printing. By leveraging Computer Vision algorithms and web-based 3D rendering, the tool automatically translates user-drawn sketches and uploaded 2D raster images into 3D printable meshes (STL/G-code). 

This project demonstrates the practical application of image processing, contour hierarchy analysis, and procedural 3D geometry generation.



---

## 🚀 Core Features & Methodologies

### 1. Interactive 2D Vectorization (Drawing Mode)
- **Dynamic Bounding Box Tracking:** Continuously calculates the spatial limits of user-drawn polyline paths to normalize coordinates.
- **Stroke-to-Geometry Conversion:** Translates raw 2D coordinate arrays into procedural 3D tubes using `THREE.CylinderGeometry` (for joints) and `THREE.BoxGeometry` (for segments) to simulate continuous extruded filament.

### 2. Raster-to-3D Pipeline (Upload Mode)
Converts standard 2D images (PNG/JPG) into 3D reliefs using two distinct computational approaches:

* **Solid Pixel Relief (Voxel Approach):** * Downscales images and applies grayscale thresholding to generate a binary `pixelMap`.
    * Maps each valid pixel to a physical 3D coordinate space, generating a robust, voxel-like 3D mesh.
* **Smooth Path Relief (Vector Approach):** * Traces binary image data to extract vector paths.
    * Utilizes geometric nesting (point-in-polygon calculations) to detect outer boundaries and inner negative spaces (holes).
    * Extrudes the shapes using `THREE.ExtrudeGeometry` with customized beveling for a polished aesthetic.

---

## 👁️ Computer Vision Backend (OpenCV Integration)
To overcome the limitations of client-side JavaScript tracing, a robust Python/OpenCV backend was designed to handle complex morphological analysis and contour detection.

### The CV Pipeline:
1.  **Image Pre-processing:** Uploaded images are ingested and converted to grayscale (`cv2.cvtColor`).
2.  **Binary Thresholding:** Adaptive or global thresholding (`cv2.threshold` with `cv2.THRESH_BINARY_INV`) isolates the foreground subject from the background.
3.  **Hierarchical Contour Detection:** * Utilizes `cv2.findContours` with the `cv2.RETR_CCOMP` flag.
    * This specific retrieval mode organizes contours into a two-level hierarchy: external boundaries (Shape) and internal boundaries (Holes).
4.  **Polygon Approximation:** Applies the Douglas-Peucker algorithm (`cv2.approxPolyDP`) to reduce vertex count while preserving the geometric integrity of the shape, optimizing it for 3D rendering.
5.  **Data Serialization:** Packages the external contours and their corresponding hierarchical children into a lightweight JSON structure for the front-end to extrude.

```python
# Core CV Logic Snippet
import cv2
import json

def extract_shapes(image_path):
    # 1. Load image and preprocess
    img = cv2.imread(image_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # 2. Binary Thresholding (Black lines on white bg -> White lines on black bg)
    _, thresh = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY_INV)
    
    # 3. Find Contours with 2-level hierarchy (Outer vs. Holes)
    contours, hierarchy = cv2.findContours(thresh, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    
    shapes = []
    
    if hierarchy is not None:
        # hierarchy returns an array of shape (1, N, 4) containing [Next, Prev, First_Child, Parent]
        hierarchy = hierarchy[0] 
        
        for i, contour in enumerate(contours):
            parent_idx = hierarchy[i][3]
            
            # 4. If Parent is -1, this is an outer boundary (a main shape)
            if parent_idx == -1:
                outer_points = contour.squeeze().tolist()
                
                # Handle edge case where contour has only 1 point
                if len(contour) == 1:
                    outer_points = [outer_points]
                
                holes = []
                # 5. Look for the first child (hole) of this outer contour
                child_idx = hierarchy[i][2] 
                
                # Loop through all children of this parent
                while child_idx != -1:
                    hole_points = contours[child_idx].squeeze().tolist()
                    if len(contours[child_idx]) == 1:
                        hole_points = [hole_points]
                        
                    holes.append(hole_points)
                    
                    # Move to the next child at the same hierarchy level
                    child_idx = hierarchy[child_idx][0]
                
                # 6. Append the paired outer shape and its internal holes
                shapes.append({
                    "outer": outer_points,
                    "holes": holes
                })
                
    # 7. Package into final JSON structure
    structured_json_data = {"shapes": shapes}
    
    return json.dumps(structured_json_data)
```

## 🛠️ System Architecture

### Frontend (Client-Side)
- **Canvas API:** Captures user strokes and handles offscreen image downscaling.
- **Three.js:** Parses vector arrays into `THREE.Shape` and `THREE.Path` objects, executing boolean-like hole punching before mathematical extrusion.
- **Export Modules:** Parses the Three.js `modelGroup` into standard STL format and generates rudimentary multi-layer G-code for immediate printer testing.

### Backend (Server-Side)
- **REST API:** Handles `multipart/form-data` or Base64 image payloads.
- **OpenCV Engine:** Processes the raw pixel data into structured mathematical vectors (outer paths + holes).

---

## 🔮 Future Work
- **Advanced Morphology:** Implement OpenCV morphological transformations (dilation/erosion) to automatically close small gaps in hand-drawn sketches before contour detection.
- **Adaptive Slicing:** Upgrade the G-code generator from fixed-extrusion layers to an adaptive slicing algorithm that calculates perimeter and infill based on the actual 3D mesh volume.

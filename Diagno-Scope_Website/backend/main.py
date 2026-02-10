from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict
import cv2
import numpy as np
import base64
import io
import uuid
import pydicom

from ultralytics import YOLO
from PIL import Image

# ================= APP =================
app = FastAPI(title="Fracture Detection API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= STORAGE =================
# In-memory storage for job results
results_db: Dict[str, dict] = {}

# ================= MODEL =================
from tumor_logic import TumorAnalyzer
from blood import DRAnalyzer

# ================= MODEL =================
model = YOLO("fracture_yolov8.pt")
print("⏳ Loading Tumor Engine...")
tumor_engine = TumorAnalyzer("brain_tumor_classifier.pt")
print("⏳ Loading DR Engine...")
dr_engine = DRAnalyzer("best_modeldensenet121.pth")



# ================= HELPERS =================
def img_to_base64(img):
    _, buffer = cv2.imencode(".png", cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
    return base64.b64encode(buffer).decode("utf-8")

def process_image_file(file_content: bytes, filename: str) -> np.ndarray:
    try:
        if filename.lower().endswith(".dcm"):
            # DICOM processing
            dicom_data = pydicom.dcmread(io.BytesIO(file_content))
            img = dicom_data.pixel_array
            
            # Normalize to 8-bit if needed
            if img.max() > 255:
                img = cv2.normalize(img, None, 0, 255, cv2.NORM_MINMAX)
            img = img.astype(np.uint8)
            
            # Convert to RGB (DICOM is usually single channel grayscale)
            if len(img.shape) == 2:
                img = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
            return img
        else:
            # Standard Image (JPG, PNG, etc.)
            return np.array(Image.open(io.BytesIO(file_content)).convert("RGB"))
            
    except Exception as e:
        print(f"Error processing file {filename}: {e}")
        return None

# ================= FILTERS =================
def apply_filters(img):
    # A: Brightness & Contrast
    A = cv2.normalize(img, None, 0, 255, cv2.NORM_MINMAX)

    # B: CLAHE
    gray = cv2.cvtColor(A, cv2.COLOR_RGB2GRAY)
    clahe = cv2.createCLAHE(2.0, (8,8))
    B = cv2.cvtColor(clahe.apply(gray), cv2.COLOR_GRAY2RGB)

    # D: Jet Colormap
    D = cv2.applyColorMap(B[:,:,0], cv2.COLORMAP_JET)

    # F: Retinex
    def retinex(img):
        sigmas = [15, 80, 250]
        r = np.zeros_like(img, dtype=np.float32)
        for s in sigmas:
            r += np.log1p(img) - np.log1p(cv2.GaussianBlur(img, (0,0), s))
        return cv2.normalize(r, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)

    F = cv2.cvtColor(retinex(B[:,:,0]), cv2.COLOR_GRAY2RGB)

    return {
        "original": img,
        "brightness": A,
        "clahe": B,
        "jet_colormap": D,
        "retinex": F
    }

# ================= SMART DETECTION LOGIC =================
def apply_bone_mask(img):
    """
    Masks out background to focus on the bone area.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    _, mask = cv2.threshold(gray, 20, 255, cv2.THRESH_BINARY)
    # Morphological cleanup
    kernel = np.ones((5,5), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    masked_img = cv2.bitwise_and(img, img, mask=mask)
    return masked_img

def run_yolo(img):
    """
    Runs YOLO and returns:
    - annotated_image (numpy)
    - max_confidence (float)
    """
    results = model(img, conf=0.15) # Lower conf thresh to detect deeper fractures
    annotated = results[0].plot()
    
    # Get max confidence
    if len(results[0].boxes) > 0:
        max_conf = float(results[0].boxes.conf.max().item())
    else:
        max_conf = 0.0
        
    return annotated, max_conf



def smart_analyze_fracture(img):
    """
    Applies logic:
    1. Bone Masking
    2. Filter Variations (CLAHE, Sharpen, Brightness)
    3. Run Inference on ALL + Raw Image
    4. Select BEST result based on Confidence
    """
    variants = {}
    
    # Variant 1: Raw Model (Standard YOLO)
    variants['Raw Model (Standard)'] = img
    
    # 1. Base Image with Bone Mask
    img_masked = apply_bone_mask(img)
    
    # Variant 2: Original Masked
    variants['Masked (Background Removed)'] = img_masked
    
    # Variant 3: CLAHE (Contrast Limited Adaptive Histogram Equalization)
    gray = cv2.cvtColor(img_masked, cv2.COLOR_RGB2GRAY)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
    img_clahe = cv2.cvtColor(clahe.apply(gray), cv2.COLOR_GRAY2RGB)
    variants['CLAHE (Enhanced Contrast)'] = img_clahe
    
    # Variant 4: Sharpening
    kernel = np.array([[0, -1, 0], [-1, 5,-1], [0, -1, 0]])
    img_sharp = cv2.filter2D(img_masked, -1, kernel)
    variants['Sharpened'] = img_sharp
    
    # Variant 5: Brightness Boost
    img_bright = cv2.convertScaleAbs(img_masked, alpha=1.2, beta=10)
    variants['Brightness Boost'] = img_bright

    # Run Inference on all variants
    best_variant = None
    best_conf = -1.0
    best_img = None
    
    results_meta = {}

    for name, var_img in variants.items():
        res_img, conf = run_yolo(var_img)
        # Store for debugging if needed
        results_meta[name] = conf
        
        # Edge Density Bonus (Prefer sharper images if confidence is close)
        # Only apply bonus if a detection was actually made
        combined_score = conf
        if conf > 0:
            edges = cv2.Canny(var_img, 100, 200)
            edge_density = np.count_nonzero(edges) / edges.size
            # Small bonus (0-5%) based on edge density to prefer clearer images
            combined_score += (edge_density * 0.05) 

        if combined_score > best_conf:
            best_conf = combined_score
            best_variant = name
            best_img = res_img

    # Fallback if nothing detected
    if best_img is None:
        best_img, _ = run_yolo(img)
        best_variant = "Raw Model (Standard)"
        best_conf = 0.0

    return best_img, best_variant, best_conf

    
@app.post("/analyze")
async def analyze(
    analysis_type: str = Form(...),
    files: List[UploadFile] = File(...)
):
    job_id = str(uuid.uuid4())
    responses = []

    for file in files:
        img_bytes = await file.read()
        img = process_image_file(img_bytes, file.filename)
        
        if img is None:
            responses.append({
                "filename": file.filename,
                "error": "Could not process image"
            })
            continue

        if analysis_type == "normal":
            yolo_img, conf = run_yolo(img)
            responses.append({
                "filename": file.filename,
                "detections_image": img_to_base64(yolo_img),
                "confidence": round(conf * 100, 1)
            })

        elif analysis_type == "tumor":
            # Advanced Tumor Logic
            result = tumor_engine.analyze(img)
            
            responses.append({
                "filename": file.filename,
                "detections_image": result['segmented_base64'], # Primary view (Segmentation)
                "confidence": result['confidence'],
                "method_used": f"Tumor AI: {result['prediction']}",
                "smart_mode": True,
                "tumor_details": result # Pass full rich data to frontend
            })

        elif analysis_type == "dr":
            # Diabetic Retinopathy Logic
            result = dr_engine.analyze(img)
            
            if "error" in result:
                 responses.append({
                    "filename": file.filename,
                    "error": result["error"]
                 })
            else:
                responses.append({
                    "filename": file.filename,
                    "detections_image": result.get('lesion_base64') or result.get('original_base64'),
                    "confidence": result.get('confidence'),
                    "method_used": f"DR AI: {result.get('prediction')}",
                    "smart_mode": True,
                    "dr_details": result # Pass rich data to frontend
                })

        elif analysis_type == "advanced":
            filtered = apply_filters(img)
            outputs = {}
            for name, im in filtered.items():
                res_img, _ = run_yolo(im)
                outputs[name] = img_to_base64(res_img)

            responses.append({
                "filename": file.filename,
                "outputs": outputs
            })
            
        elif analysis_type == "smart":
            # AUTO-FILTER SELECTION
            best_img, method_name, conf_score = smart_analyze_fracture(img)
            
            responses.append({
                "filename": file.filename,
                "detections_image": img_to_base64(best_img),
                "confidence": round(conf_score * 100, 1), # Might go > 100 with bonus, cap it?
                "method_used": method_name,
                "smart_mode": True
            })

    # Store result
    results_db[job_id] = {
        "status": "completed",
        "analysis_type": analysis_type,
        "results": responses
    }

    return {
        "job_id": job_id,
        "message": "Analysis complete. Use GET /result/{job_id} to fetch results."
    }

@app.get("/result/{job_id}")
async def get_result(job_id: str):
    if job_id not in results_db:
        raise HTTPException(status_code=404, detail="Job ID not found")
    
    return results_db[job_id]

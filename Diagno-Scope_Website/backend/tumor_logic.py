import torch
import torch.nn as nn
import cv2
import numpy as np
from ultralytics import YOLO
from pytorch_grad_cam import EigenCAM
from pytorch_grad_cam.utils.image import show_cam_on_image
from PIL import Image
import base64

# ==========================================
# 🛠️ HELPER: IMAGE TO BASE64
# ==========================================
def img_to_base64(img):
    if isinstance(img, Image.Image):
        # Convert PIL to BGR NumPy/Opencv format for encoding
        img_np = np.array(img)
        # PIL is RGB, opencv defaults to BGR for encoding usually,
        # but let's just encode the RGB to PNG. 
        # Actually cv2.imencode expects BGR.
        img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
        _, buffer = cv2.imencode(".png", img_bgr)
    else:
        # Assuming numpy array in RGB (from passed input)
        img_bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
        _, buffer = cv2.imencode(".png", img_bgr)
    return base64.b64encode(buffer).decode("utf-8")

# ==========================================
# 🛠️ HELPER: YOLO WRAPPER
# ==========================================
class YOLOWrapper(nn.Module):
    def __init__(self, model):
        super(YOLOWrapper, self).__init__()
        self.model = model
    
    def forward(self, x):
        if not x.requires_grad:
            x.requires_grad = True
        result = self.model(x)
        if isinstance(result, tuple):
            return result[0]
        return result

# ==========================================
# 🧠 CORE ENGINE: TUMOR DETECTION
# ==========================================
class TumorAnalyzer:
    def __init__(self, model_path):
        print(f"⏳ Loading Tumor Model from: {model_path}")
        # Use task='classify' based on previous successful config, 
        # adapting user's code to ensure it works.
        self.model = YOLO(model_path, task='classify')
        self.pytorch_model = self.model.model
        
        for param in self.pytorch_model.parameters():
            param.requires_grad = True
            
        self.wrapper = YOLOWrapper(self.pytorch_model)
        self.target_layers = [self.pytorch_model.model[-2]]

    def analyze(self, img_input):
        """
        Runs analysis with strict handling for 'No Tumor' cases.
        Input: img_input (NumPy Array, RGB)
        """
        # 1. Preprocess
        # img_input is already valid BGR/RGB array from API. Resizing.
        img_resized = cv2.resize(img_input, (224, 224))
        rgb_img = img_resized.copy() # Already RGB likely if from API
        img_float = np.float32(rgb_img) / 255

        # 2. Predict
        results = self.model(img_resized, verbose=False)
        
        # Extract Diagnosis
        diagnosis = "Normal"
        confidence = 0.0

        if results[0].probs is not None:
            top_id = results[0].probs.top1
            confidence = results[0].probs.top1conf.item()
            diagnosis = results[0].names[top_id]
        elif results[0].boxes is not None and len(results[0].boxes) > 0:
            best_box = sorted(results[0].boxes, key=lambda x: x.conf[0], reverse=True)[0]
            top_id = int(best_box.cls[0])
            confidence = float(best_box.conf[0])
            diagnosis = results[0].names[top_id]

        # 3. STRICT GATEKEEPER
        clean_diag = diagnosis.lower().replace(" ", "").replace("_", "")
        # Condition: Must NOT say 'no' or 'normal', and confidence must be > 50%
        is_tumor = "no" not in clean_diag and "normal" not in clean_diag and confidence > 0.50

        if not is_tumor:
            # RETURN CLEAN RESULTS IMMEDIATELY
            return self._generate_clean_outputs(diagnosis, confidence, img_float, rgb_img)
        
        # 4. TUMOR DETECTED: RUN ADVANCED LOGIC
        try:
            # A. Generate EigenCAM
            cam = EigenCAM(model=self.wrapper, target_layers=self.target_layers)
            tensor = torch.from_numpy(img_float.transpose(2, 0, 1)).unsqueeze(0).float()
            device = next(self.pytorch_model.parameters()).device
            tensor = tensor.to(device)
            
            grayscale_cam = cam(input_tensor=tensor, targets=None)[0, :, :]
            heatmap_overlay = show_cam_on_image(img_float, grayscale_cam, use_rgb=True)
            heatmap_pil = Image.fromarray(heatmap_overlay)

            # B. Segmentation & Metrics
            seg_img, size_px, coverage, cropped_tumor = self._calculate_metrics(grayscale_cam, img_resized)
            
            seg_pil = Image.fromarray(seg_img) # seg_img is RGB from calculate_metrics?
            
            crop_pil = None
            if cropped_tumor is not None and cropped_tumor.size > 0:
                crop_pil = Image.fromarray(cropped_tumor)
            else:
                crop_pil = self._create_text_image("Region Too Small")

            return {
                "prediction": diagnosis,
                "confidence": round(confidence * 100, 2),
                "tumor_found": True,
                "tumor_size_pixels": size_px,
                "brain_coverage_percent": round(coverage, 2),
                "heatmap_base64": img_to_base64(heatmap_pil),
                "segmented_base64": img_to_base64(seg_pil),
                "cropped_base64": img_to_base64(crop_pil)
            }

        except Exception as e:
            print(f"⚠️ Tumor Engine Error: {e}")
            return self._generate_clean_outputs(diagnosis, confidence, img_float, rgb_img)

    def _generate_clean_outputs(self, diagnosis, confidence, img_float, rgb_img):
        """Helper to forcefully return blank/clean images"""
        # Create a calm blue placeholder for heatmap (Using float image)
        heatmap_pil = self._create_clean_overlay(img_float, "No Anomalies Detected")
        
        # Segmentation should just be the original image (no red marks)
        seg_pil = Image.fromarray(rgb_img)
        
        # Crop should say "Normal"
        crop_pil = self._create_text_image("Scan Normal")
        
        return {
            "prediction": diagnosis,
            "confidence": round(confidence * 100, 2),
            "tumor_found": False,
            "tumor_size_pixels": 0,
            "brain_coverage_percent": 0.0,
            "heatmap_base64": img_to_base64(heatmap_pil),
            "segmented_base64": img_to_base64(seg_pil),
            "cropped_base64": img_to_base64(crop_pil)
        }

    def _calculate_metrics(self, grayscale_cam, original_img):
        # 1. Skull Stripping
        gray = cv2.cvtColor(original_img, cv2.COLOR_RGB2GRAY)
        _, brain_mask = cv2.threshold(gray, 10, 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(brain_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        clean_brain_mask = np.zeros_like(brain_mask)
        if contours:
            largest = max(contours, key=cv2.contourArea)
            cv2.drawContours(clean_brain_mask, [largest], -1, 255, -1)
            
        # 2. Mask Heatmap
        heatmap_uint8 = (grayscale_cam * 255).astype(np.uint8)
        heatmap_blur = cv2.GaussianBlur(heatmap_uint8, (5, 5), 0)
        heatmap_masked = cv2.bitwise_and(heatmap_blur, heatmap_blur, mask=clean_brain_mask)

        # 3. Thresholding
        _, tumor_mask = cv2.threshold(heatmap_masked, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        kernel = np.ones((5,5), np.uint8)
        tumor_mask = cv2.morphologyEx(tumor_mask, cv2.MORPH_OPEN, kernel, iterations=2)

        # 4. Find Contours
        contours, _ = cv2.findContours(tumor_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        final_mask = np.zeros_like(tumor_mask)
        largest_contour = None
        
        if contours:
            largest_contour = max(contours, key=cv2.contourArea)
            if cv2.contourArea(largest_contour) > 50:
                cv2.drawContours(final_mask, [largest_contour], -1, 255, -1)
            else:
                largest_contour = None

        # 5. Metrics
        tumor_px = np.count_nonzero(final_mask)
        brain_px = np.count_nonzero(clean_brain_mask)
        coverage = (tumor_px / brain_px * 100) if brain_px > 0 else 0

        # 6. Draw Visuals
        seg_img = original_img.copy()
        if largest_contour is not None:
            cv2.drawContours(seg_img, [largest_contour], -1, (0, 255, 0), 2)
            overlay = seg_img.copy()
            cv2.drawContours(overlay, [largest_contour], -1, (0, 0, 255), -1)
            cv2.addWeighted(overlay, 0.4, seg_img, 0.6, 0, seg_img)

        # 7. Crop
        crop = None
        if largest_contour is not None:
            x, y, w, h = cv2.boundingRect(largest_contour)
            p = 10
            h_img, w_img = original_img.shape[:2]
            crop = original_img[max(0, y-p):min(h_img, y+h+p), max(0, x-p):min(w_img, x+w+p)]

        return seg_img, tumor_px, coverage, crop

    def _create_clean_overlay(self, img_array_float, text):
        # img_array_float expected 0-1
        overlay = img_array_float.copy()
        # Add slight blue tint
        overlay[:, :, 0] = np.clip(overlay[:, :, 0] + 0.1, 0, 1) 
        overlay = (overlay * 255).astype(np.uint8)
        cv2.putText(overlay, text, (20, 112), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        return Image.fromarray(overlay)

    def _create_text_image(self, text):
        img = np.zeros((224, 224, 3), dtype=np.uint8)
        cv2.putText(img, text, (40, 112), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 1)
        return Image.fromarray(img)
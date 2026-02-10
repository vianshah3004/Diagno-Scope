
import torch
import torch.nn as nn
import numpy as np
import cv2
import base64
from PIL import Image
from torchvision import transforms
from torchvision.models import densenet121

# Try to import scikit-image, handle gracefully if missing
try:
    from skimage.filters import frangi
except ImportError:
    frangi = None
    print("Warning: skimage not found. Vessel detection will be disabled.")

class DRAnalyzer:
    def __init__(self, model_path="best_modeldensenet121.pth"):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.num_classes = 5
        self.class_names = ["No DR", "Mild DR", "Moderate DR", "Severe DR", "Proliferative DR"]
        self.no_dr_conf_gate = 0.85
        self.model_path = model_path
        
        self.transform = transforms.Compose([
            transforms.Resize((224,224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485,0.456,0.406],[0.229,0.224,0.225])
        ])
        
        self._load_model()

    def _load_model(self):
        print(f"Loading DR Model from {self.model_path}...")
        try:
            self.model = densenet121(weights=None)
            self.model.classifier = nn.Sequential(
                nn.Dropout(0.5),
                nn.Linear(self.model.classifier.in_features, self.num_classes)
            )
            
            # Load weights
            # map_location=self.device ensures it loads on CPU if CUDA not available
            state = torch.load(self.model_path, map_location=self.device)
            state = state["state_dict"] if isinstance(state, dict) and "state_dict" in state else state
            # Remove 'module.' prefix if present
            state = {k.replace("module.", ""): v for k, v in state.items()}
            
            self.model.load_state_dict(state, strict=False) # strict=False to be safe with partial matches if any
            self.model.to(self.device)
            self.model.eval()
            print("✓ DenseNet121 loaded successfully")
        except Exception as e:
            print(f"Error loading DR model: {e}")
            self.model = None

    def _img_to_base64(self, img_rgb):
        # Convert RGB to BGR for OpenCV encoding
        img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
        _, buffer = cv2.imencode(".png", img_bgr)
        return base64.b64encode(buffer).decode("utf-8")

    def analyze(self, img_array):
        """
        img_array: RGB numpy array (H, W, 3)
        Returns dict with results
        """
        if self.model is None:
            return {"error": "Model not loaded"}
        
        # 1. Prediction
        pil_img = Image.fromarray(img_array)
        input_tensor = self.transform(pil_img).unsqueeze(0).to(self.device)
        
        with torch.no_grad():
            logits = self.model(input_tensor)
            probs = torch.softmax(logits, dim=1)[0]
            
        pred_idx = probs.argmax().item()
        confidence = probs[pred_idx].item()
        prediction_label = self.class_names[pred_idx]
        
        print(f"DR Prediction: {prediction_label} ({confidence:.2f})")
        
        # 2. Image Processing (Vessels & Lesions)
        # Assuming img_array is RGB
        orig = img_array.copy()
        
        # Extract Green Channel for processing
        if len(orig.shape) == 3:
            green = orig[:,:,1]
        else:
            green = orig # Fallback if grayscale
            
        # --- Vessel Extraction ---
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced = clahe.apply(green)
        
        # Frangi vesselness
        if frangi is not None:
             vessels_float = frangi(enhanced / 255.0, sigmas=range(1, 4))
             # Normalize to 0-255 for better visibility
             vessels_norm = cv2.normalize(vessels_float, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
             # Dynamic thresholding or fixed low threshold on normalized image
             _, vessels_mask = cv2.threshold(vessels_norm, 30, 255, cv2.THRESH_BINARY)
        else:
             # Fallback: simple thresholding if skimage missing
             _, vessels_mask = cv2.threshold(enhanced, 20, 255, cv2.THRESH_BINARY)
        
        # Create a visualizable vessel image (white vessels on black)
        vessels_vis = cv2.merge([vessels_mask, vessels_mask, vessels_mask])
        
        # --- Logic Gate: No DR ---
        is_clean = False
        if pred_idx == 0 and confidence >= self.no_dr_conf_gate:
            is_clean = True
            
        lesion_overlay = orig.copy()
        affected_percent = 0.0
        
        severity_insight = ""

        # Draw Vessels on Overlay (Green)
        # We do this for both Clean and DR cases to show "retinopathy" (retinal structure)
        lesion_overlay[vessels_mask > 0] = [0, 255, 0]

        if not is_clean:
            # --- Lesion Detection ---
            # Blur for noise reduction
            gray_blur = cv2.GaussianBlur(green, (5,5), 0)
            
            # Exudates (Bright) - Top 5% brightness
            _, exudates = cv2.threshold(gray_blur, np.percentile(gray_blur, 95), 255, cv2.THRESH_BINARY)
            
            # Hemorrhages (Dark) - Bottom 10% brightness
            _, hemorrhages = cv2.threshold(gray_blur, np.percentile(gray_blur, 10), 255, cv2.THRESH_BINARY_INV)
            
            # Combine
            lesion_mask = cv2.bitwise_or(exudates, hemorrhages)
            
            # Cleanup
            kernel = np.ones((5,5), np.uint8)
            lesion_mask = cv2.morphologyEx(lesion_mask, cv2.MORPH_OPEN, kernel)
            
            # Overlay (Blue lesions: [255, 0, 0] in RGB is Red. Following user preference for Red visualization)
            lesion_overlay[lesion_mask > 0] = [255, 0, 0] 
            
            # Calculate metrics
            affected_pixels = np.count_nonzero(lesion_mask)
            total_pixels = lesion_mask.size
            affected_percent = (affected_pixels / total_pixels) * 100
            
            # Severity Insight
            if affected_percent < 1:
                severity_insight = "Early / Mild involvement"
            elif affected_percent < 5:
                severity_insight = "Moderate involvement"
            else:
                severity_insight = "Severe involvement – urgent referral"
        else:
            # Clean case - Text overlay for Lesion Map
            cv2.putText(lesion_overlay, "Healthy Retina", (50, 100), cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 255, 0), 3)
            severity_insight = "No Diabetic Retinopathy Detected"

        # 3. Base64 Encoding
        orig_b64 = self._img_to_base64(orig)
        vessel_b64 = self._img_to_base64(vessels_vis)
        lesion_b64 = self._img_to_base64(lesion_overlay)
        
        return {
            "prediction": prediction_label,
            "confidence": round(confidence * 100, 2),
            "affected_percent": round(affected_percent, 2),
            "original_base64": orig_b64,
            "vessel_base64": vessel_b64,
            "lesion_base64": lesion_b64,
            "is_no_dr": is_clean,
            "severity_insight": severity_insight
        }
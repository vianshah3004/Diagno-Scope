
import torch
import torch.nn as nn
import numpy as np
import cv2
import os
from torchvision import transforms
from torchvision.models import densenet121
from PIL import Image
from skimage.filters import frangi

class RetinopathyEngine:
    def __init__(self, model_path):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.classes = ["No DR", "Mild DR", "Moderate DR", "Severe DR", "Proliferative DR"]
        self.model = None
        
        # Load Model
        self._load_model(model_path)

    def _load_model(self, path):
        print(f"[Engine] Loading DR model from {path}...")
        
        # Define Architecture
        self.model = densenet121(weights=None)
        self.model.classifier = nn.Sequential(
            nn.Dropout(0.5),
            nn.Linear(self.model.classifier.in_features, 5)
        )
        
        # Load Weights
        if os.path.exists(path):
            state = torch.load(path, map_location=self.device)
            # Handle dictionary keys mismatch (remove 'module.' or get 'state_dict')
            state = state["state_dict"] if isinstance(state, dict) and "state_dict" in state else state
            state = {k.replace("module.", ""): v for k, v in state.items()}
            
            self.model.load_state_dict(state, strict=True)
            self.model.to(self.device)
            self.model.eval()
            print("[Engine] Model loaded successfully.")
        else:
            print(f"[Error] Model file not found at {path}")
            # We don't raise error here to prevent app crash, but analysis will fail later

    def preprocess(self, image_input):
        transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])
        
        if isinstance(image_input, str):
            pil_img = Image.open(image_input).convert("RGB")
        elif isinstance(image_input, np.ndarray):
            pil_img = Image.fromarray(image_input)
        else:
            # Assume PIL Image
            pil_img = image_input
            
        return transform(pil_img).unsqueeze(0).to(self.device)

    def analyze(self, image_input):
        """
        Standardized return format for UI:
        - risk_score (0-100)
        - severity_label (str)
        - suggestion (str)
        - images (dict of PIL Images)
        - metrics (dict)
        """
        if self.model is None:
            return {"error": "Model not loaded"}

        # 1. AI Prediction
        input_tensor = self.preprocess(image_input)
        with torch.no_grad():
            logits = self.model(input_tensor)
            probs = torch.softmax(logits, dim=1)[0]
        
        pred_idx = probs.argmax().item()
        conf = probs[pred_idx].item()
        diagnosis = self.classes[pred_idx]

        # 2. Image Processing (Vessels & Lesions)
        if isinstance(image_input, str):
            orig = cv2.imread(image_input)
            orig = cv2.cvtColor(orig, cv2.COLOR_BGR2RGB)
        elif isinstance(image_input, np.ndarray):
             # Expecting RGB if coming from api logic, or BGR? 
             # api_dr.py sends RGB. 
             orig = image_input.copy()
        
        # Green Channel for processing
        if len(orig.shape) == 3:
            green = orig[:,:,1]
        else:
            green = orig

        # Vessel Extraction (Frangi)
        clahe = cv2.createCLAHE(2.0, (8,8))
        enhanced = clahe.apply(green)
        vessels = frangi(enhanced / 255.0)
        vessels = (vessels > 0.04).astype(np.uint8) * 255
        vessels_rgb = cv2.cvtColor(vessels, cv2.COLOR_GRAY2RGB)

        # 3. Logic Gate & Visualization
        insight = ""
        suggestion = ""
        risk_score = 0
        severity_label = "Normal"
        
        # Lesion Analysis (Always run for visualization, but interpret based on classification)
        gray = cv2.GaussianBlur(green, (5,5), 0)
        _, exudates = cv2.threshold(gray, np.percentile(gray, 95), 255, cv2.THRESH_BINARY)
        _, hemorrhages = cv2.threshold(gray, np.percentile(gray, 10), 255, cv2.THRESH_BINARY_INV)
        
        lesion_mask = cv2.bitwise_or(exudates, hemorrhages)
        kernel = np.ones((5,5), np.uint8)
        lesion_mask = cv2.morphologyEx(lesion_mask, cv2.MORPH_OPEN, kernel)
        
        # Calculate Affected Area
        affected = (np.sum(lesion_mask > 0) / lesion_mask.size) * 100
        
        # Overlay
        overlay = orig.copy()
        # Create a red overlay for lesions
        overlay[lesion_mask > 0] = [255, 0, 0]

        # Logic for Risk & Insight
        if pred_idx == 0: # No DR
             # Even if model says No DR, we respect it, but maybe show small risk if lesions found?
             # For strictness, if Model says No DR, we set risk low.
             risk_score = (1 - conf) * 20 # Low risk based on uncertainty
             severity_label = "Healthy"
             suggestion = "No signs of Diabetic Retinopathy detected. Annual screening recommended."
             final_composite = np.hstack((orig, vessels_rgb))
        else:
            # Model detected DR
            # Base risk on 'affected' area and model confidence
            risk_score = min(affected * 20, 100)
            if risk_score < 20: risk_score = 20 # Minimum risk if DR is detected
            
            # Adjust severity label based on Model Class
            severity_label = diagnosis # e.g., "Mild DR"
            
            if "Mild" in diagnosis:
                suggestion = f"Mild abnormalities detected ({affected:.1f}% area). Monitor blood sugar and schedule follow-up in 6-12 months."
            elif "Moderate" in diagnosis:
                suggestion = f"Moderate DR signs with {affected:.1f}% retinal impact. Consult ophthalmologist for comprehensive exam."
            elif "Severe" in diagnosis or "Proliferative" in diagnosis:
                suggestion = f"CRITICAL: Severe/Proliferative DR detected ({affected:.1f}% coverage). Urgent ophthalmology referral required."
                risk_score = max(risk_score, 80) # Force high risk
            
            final_composite = np.hstack((orig, vessels_rgb, overlay))

        # Prepare Return Dict
        return {
            "diagnosis": diagnosis,
            "confidence": conf,
            "risk_score": float(risk_score),
            "severity_label": severity_label,
            "suggestion": suggestion,
            "metrics": {
                "affected_area": f"{affected:.2f}%",
                "vessel_density": f"{np.mean(vessels > 0)*100:.1f}%"
            },
            "images": {
                "original": Image.fromarray(orig),
                "vessels": Image.fromarray(vessels_rgb),
                "lesions": Image.fromarray(overlay), # Lesion map on top of original
                "composite": Image.fromarray(final_composite) if final_composite.shape[1] < 2000 else Image.fromarray(final_composite) # Placeholder check
            }
        }

    def analyze_batch(self, image_paths):
        """
        Processes multiple images and returns the one with highest risk.
        Useful for multi-angle analysis.
        """
        if isinstance(image_paths, str):
            image_paths = [image_paths]
            
        results = []
        for path in image_paths:
            try:
                res = self.analyze(path)
                res['_source_path'] = path 
                results.append(res)
            except Exception as e:
                print(f"Skipping {path}: {e}")
        
        if not results:
             return {"error": "Batch analysis failed."}
            
        # Aggregation Logic: Max Risk, then Max Confidence
        best_result = max(results, key=lambda x: (x.get('risk_score', 0), x.get('confidence', 0)))
        
        # Add batch metadata
        count = len(results)
        best_result['batch_summary'] = f"Analyzed {count} views. Displaying most critical finding."
        
        return best_result

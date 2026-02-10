from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageTemplate, Frame, KeepTogether
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from datetime import datetime
import os
import cv2
import tempfile
from PIL import Image as PILImage

class ReportGenerator:
    def __init__(self, output_path="report.pdf"):
        self.filename = output_path
        self.styles = getSampleStyleSheet()
        self._create_custom_styles()

    def _create_custom_styles(self):
        self.custom_styles = {
            'Title': ParagraphStyle(
                'Title',
                parent=self.styles['Title'],
                fontName='Helvetica-Bold',
                fontSize=24,
                textColor=colors.HexColor('#1e40af'),  # Deep Blue
                spaceAfter=20
            ),
            'Heading1': ParagraphStyle(
                'Heading1',
                parent=self.styles['Heading1'],
                fontName='Helvetica-Bold',
                fontSize=16,
                textColor=colors.HexColor('#0f172a'),
                spaceBefore=15,
                spaceAfter=10,
                borderPadding=5,
                borderColor=colors.HexColor('#e2e8f0'),
                borderWidth=0,
                borderBottomWidth=1
            ),
            'Heading2': ParagraphStyle(
                'Heading2',
                parent=self.styles['Heading2'],
                fontName='Helvetica-Bold',
                fontSize=12,
                textColor=colors.HexColor('#334155'),
                spaceBefore=10,
                spaceAfter=5
            ),
            'BodyText': ParagraphStyle(
                'BodyText',
                parent=self.styles['Normal'],
                fontName='Helvetica',
                fontSize=11,
                leading=16,
                alignment=TA_JUSTIFY,
                textColor=colors.HexColor('#334155')
            ),
            'Disclaimer': ParagraphStyle(
                'Disclaimer',
                parent=self.styles['Normal'],
                fontName='Helvetica-Oblique',
                fontSize=8,
                textColor=colors.HexColor('#94a3b8'),
                alignment=TA_CENTER
            )
        }

    def generate_report(self, patient_data, analysis_data, report_title="Automated Screening Report", modality="MRI - Brain"):
        doc = SimpleDocTemplate(
            self.filename,
            pagesize=A4,
            rightMargin=50, leftMargin=50,
            topMargin=50, bottomMargin=50
        )

        elements = []

        # 1. Header with Logo (simulated text logo) -> Professional Header
        elements.append(Paragraph("DIAGNO-SCOPE", self.custom_styles['Title']))
        elements.append(Paragraph(report_title, 
                                  ParagraphStyle('Subtitle', parent=self.styles['Normal'], fontSize=12, textColor=colors.gray, alignment=TA_CENTER)))
        elements.append(Spacer(1, 20))

        # 2. Patient Info Table (Customized: Only Case Number)
        # Using 'name' as Case Number based on UI mapping
        data = [
            ["Case Number", patient_data.get('name', 'N/A'), "Scan Date", datetime.now().strftime("%Y-%m-%d")],
            ["Ref. Physician", patient_data.get('doctor', 'N/A'), "Modality", modality]
        ]
        
        t = Table(data, colWidths=[1.2*inch, 2.5*inch, 1.2*inch, 1.8*inch])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f1f5f9')),
            ('BACKGROUND', (2, 0), (2, -1), colors.HexColor('#f1f5f9')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1e293b')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1'))
        ]))
        elements.append(t)
        elements.append(Spacer(1, 20))

        # 3. Clinical Findings
        elements.append(Paragraph("Clinical Analysis", self.custom_styles['Heading1']))
        
        diag = analysis_data.get('diagnosis', 'N/A')
        conf = analysis_data.get('confidence', 0) * 100 if analysis_data.get('confidence') else 0
        metrics = analysis_data.get('metrics', {})

        # Status Badge Logic
        status_color = colors.red if "no" not in str(diag).lower() and "normal" not in str(diag).lower() else colors.green
        status_text = f"<b>DIAGNOSIS:</b> <font color={status_color}>{str(diag).upper()} (Confidence: {conf:.1f}%)</font>"
        
        elements.append(Paragraph(status_text, self.custom_styles['BodyText']))
        elements.append(Spacer(1, 10))
        
        # Dynamic Findings Text
        findings_text = f"The AI model has analyzed the provided {modality} scan. "
        
        if 'size' in metrics and 'coverage' in metrics:
            findings_text += (
                f"Automated segmentation indicates a lesion area of approximately <b>{metrics['size']} pixels</b> "
                f"covering roughly <b>{metrics['coverage']:.2f}%</b> of the visible tissue. "
            )
        elif 'area' in metrics and 'severity' in metrics:
             findings_text += (
                f"Fracture analysis indicates a damage area of <b>{metrics['area']} units</b> "
                f"with a severity classification of <b>{metrics['severity']}</b>. "
            )
        else:
            # Generic fallback
            metric_str = ", ".join([f"{k}: {v}" for k, v in metrics.items()])
            findings_text += f"Key metrics identified: {metric_str}. "

        findings_text += "Attention mapping highlights regions of interest correlating with the primary diagnosis."
        
        elements.append(Paragraph(findings_text, self.custom_styles['BodyText']))
        elements.append(Spacer(1, 20))

        # 4. Visual Evidence (Images)
        elements.append(Paragraph("Visual Evidence", self.custom_styles['Heading1']))
        
        # Helper to convert PIL to path
        def get_img_flowable(pil_img, label):
            if pil_img is None:
                return Paragraph("No Image", self.styles['Normal'])

             # Create temp file
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                try:
                    pil_img.save(tmp.name)
                    path = tmp.name
                except Exception:
                    return Paragraph("Error loading image", self.styles['Normal'])
            
            img = Image(path, width=3*inch, height=2.2*inch)
            return [img, Paragraph(label, ParagraphStyle('Caption', parent=self.styles['Normal'], fontSize=9, alignment=TA_CENTER))]

        images = analysis_data.get('images', {})
        
        # Grid layout for images
        col1 = get_img_flowable(images.get('original'), "Original Scan")
        col2 = get_img_flowable(images.get('heatmap'), "AI Attention Map")
        col3 = get_img_flowable(images.get('segmentation'), "Segmentation Mask")
        col4 = get_img_flowable(images.get('crop'), "Tumor Zoom")
        
        data = [
            [col1, col2],
            [col3, col4]
        ]
        
        t_imgs = Table(data, colWidths=[3.2*inch, 3.2*inch])
        t_imgs.setStyle(TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('TOPPADDING', (0,0), (-1,-1), 10)
        ]))
        elements.append(t_imgs)
        
        # 5. Footer / Disclaimer
        elements.append(Spacer(1, 50))
        disclaimer = (
            "DISCLAIMER: This report is generated by an AI automated system (Diagno-Scope v1.0). "
            "It is intended for screening assistance only and does NOT constitute a final medical diagnosis. "
            "All findings must be verified by a certified radiologist."
        )
        elements.append(Paragraph("End of Report", ParagraphStyle('End', parent=self.styles['Normal'], alignment=TA_CENTER)))
        elements.append(Spacer(1, 10))
        elements.append(Paragraph(disclaimer, self.custom_styles['Disclaimer']))

        # Build
        doc.build(elements)
        return self.filename

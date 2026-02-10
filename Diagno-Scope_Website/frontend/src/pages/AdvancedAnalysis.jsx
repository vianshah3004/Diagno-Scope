import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Sliders, Image as ImageIcon, Sparkles, Check, X } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { saveCaseToFirestore } from '../utils/uploadService';
import './AdvancedAnalysis.css';

// Using the same blue/glassmorphic aesthetic as the rest of the app
const AdvancedAnalysis = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const diseaseType = location.state?.diseaseType || 'Fracture';

    // Image source passed from Detect page or placeholder
    const [imageSrc, setImageSrc] = useState(null);
    const [fileBlob, setFileBlob] = useState(null); // To store the actual file/blob for API
    const [fileName, setFileName] = useState("No file selected");
    const [showFilters, setShowFilters] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Store API results: { brightness: "base64...", clahe: "base64...", ... }
    const [apiResults, setApiResults] = useState({});

    // Filters requested by user
    const FILTERS = [
        { id: 'original', label: 'ORIGINAL' },
        { id: 'brightness', label: 'BRIGHTNESS' },
        { id: 'clahe', label: 'CLAHE' },
        { id: 'jet_colormap', label: 'JET_COLORMAP' },
        { id: 'retinex', label: 'RETINEX' }
    ];


    // State for Tumor Details
    const [tumorDetails, setTumorDetails] = useState(null);
    // State for DR Details
    const [drDetails, setDrDetails] = useState(null);

    // Smart Detection & Validation State
    const [smartResult, setSmartResult] = useState(null);
    const [smartConfidence, setSmartConfidence] = useState(null);
    const [accepted, setAccepted] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [currentDocId, setCurrentDocId] = useState(null);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            setImageSrc(url);
            setFileBlob(file);
            setFileName(file.name);
            setShowFilters(false);

            setApiResults({});
            setSmartResult(null);
            setAccepted(null);
            setCurrentDocId(null);
        }
    };

    const handleAnalyze = async () => {
        if (!fileBlob) {
            alert("Please select an image first.");
            return;
        }

        setIsLoading(true);
        setShowFilters(false);

        try {
            const formData = new FormData();
            formData.append('analysis_type', 'advanced');
            formData.append('files', fileBlob, fileName);

            // 1. Send to Backend
            const response = await fetch('http://127.0.0.1:8000/analyze', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error("Backend Error");

            const data = await response.json();
            const jobId = data.job_id;

            // 2. Fetch Result
            const resultRes = await fetch(`http://127.0.0.1:8000/result/${jobId}`);
            const resultData = await resultRes.json();

            // Structure: resultData.results[0].outputs = { brightness: "...", ... }
            if (resultData.results && resultData.results.length > 0) {
                const outputs = resultData.results[0].outputs;
                setApiResults(outputs || {});
            }

            setShowFilters(true);
        } catch (error) {
            console.error(error);
            alert("Could not connect to AI Engine. Using local preview mode.");
            setShowFilters(true); // Fallback to showing CSS version if any, or just fail gracefully
        } finally {
            setIsLoading(false);
        }
    };

    const handleSmartAnalysis = async (manualFile = null, manualFileName = null) => {
        const fileToUse = manualFile || fileBlob;
        const nameToUse = manualFileName || fileName;

        if (!fileToUse) {
            alert("Please select an image first.");
            return;
        }
        setIsLoading(true);
        setTumorDetails(null); // Reset
        setDrDetails(null); // Reset
        setSmartResult(null);

        try {
            const formData = new FormData();
            let analysisType = 'smart';
            if (diseaseType === 'Tumor') analysisType = 'tumor';
            if (diseaseType === 'Diabetic Retinopathy Scan') analysisType = 'dr';

            formData.append('analysis_type', analysisType);
            formData.append('files', fileToUse, nameToUse);

            // DETERMINE PORT based on Disease Type
            let port = 8000;
            if (diseaseType === 'Tumor') port = 8001;
            if (diseaseType === 'Diabetic Retinopathy Scan') port = 8002;

            const response = await fetch(`http://127.0.0.1:${port}/analyze`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error("Backend Error");

            const data = await response.json();
            const resultRes = await fetch(`http://127.0.0.1:${port}/result/${data.job_id}`);
            const resultData = await resultRes.json();

            if (resultData.results && resultData.results.length > 0) {
                const res = resultData.results[0];
                setSmartResult(`data:image/png;base64,${res.detections_image}`);
                setSmartConfidence(res.confidence);

                // Capture Tumor Details if present
                if (res.tumor_details) {
                    setTumorDetails(res.tumor_details);
                }
                // Capture DR Details if present
                if (res.dr_details) {
                    setDrDetails(res.dr_details);
                }
            }
        } catch (error) {
            console.error(error);
            alert("Smart Detection Failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // Initialize from Navigation State
    useEffect(() => {
        if (location.state) {
            if (location.state.image) setImageSrc(location.state.image);
            if (location.state.fileName) setFileName(location.state.fileName);

            if (location.state.fileData) {
                setFileBlob(location.state.fileData);

                // Auto-run analysis if it's a Tumor or DR case and we have the file
                if (diseaseType === 'Tumor' || diseaseType === 'Diabetic Retinopathy Scan') {
                    // Slight delay to ensure UI renders first
                    setTimeout(() => {
                        handleSmartAnalysis(location.state.fileData, location.state.fileName);
                    }, 500);
                }
            }
        }
    }, [location.state, diseaseType]);

    // ... (validation logic) ...

    // RENDER LOGIC UPDATE
    // If tumorDetails exists, show specialized Tumor Dashboard instead of generic Grid
    if (tumorDetails) {
        return (
            <div className="advanced-page page-transition container">
                {/* Header & Controls Reuse */}
                <div className="advanced-header">
                    <div>
                        <h1 className="advanced-title"><span style={{ color: 'var(--primary)' }}>NeuroScan AI</span></h1>
                        <p className="advanced-subtitle">Brain Tumor Analysis</p>
                    </div>
                    <button className="btn-outline" onClick={() => navigate('/detect', { state: { formData: location.state?.formData } })}><ArrowLeft size={16} /> Back</button>
                </div>

                <div className="control-bar glass-panel">
                    <div className="control-group"><span className="file-status">{fileName}</span></div>
                    <div className="control-group right">
                        <button className="btn-outline small" onClick={handleSmartAnalysis} disabled={isLoading} style={{ marginLeft: '10px', borderColor: 'var(--primary)', color: 'var(--primary)' }}>
                            <Sparkles size={16} style={{ marginRight: '5px' }} /> Re-Run Analysis
                        </button>
                    </div>
                </div>

                {/* Tumor Results */}
                <div className="tumor-dashboard" style={{ marginTop: '20px' }}>
                    {/* Metrics Banner */}
                    <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.9rem', color: '#888' }}>Diagnosis</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: tumorDetails.tumor_found ? '#ff4d4d' : '#00ff88' }}>{tumorDetails.prediction}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.9rem', color: '#888' }}>Confidence</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>{tumorDetails.confidence}%</div>
                        </div>
                        {tumorDetails.tumor_found && (
                            <>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.9rem', color: '#888' }}>Size (px)</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{tumorDetails.tumor_size_pixels}</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.9rem', color: '#888' }}>Coverage</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{tumorDetails.brain_coverage_percent}%</div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Image Grid */}
                    <div className="analysis-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                        {/* 1. Original / Segmentation */}
                        <div className="filter-card glass-panel">
                            <div className="filter-header">Segmentation Analysis</div>
                            <div className="filter-image-container">
                                <img src={`data:image/png;base64,${tumorDetails.segmented_base64}`} className="filter-img" />
                            </div>
                        </div>

                        {/* 2. Heatmap */}
                        <div className="filter-card glass-panel">
                            <div className="filter-header">AI Heatmap</div>
                            <div className="filter-image-container">
                                <img src={`data:image/png;base64,${tumorDetails.heatmap_base64}`} className="filter-img" />
                            </div>
                        </div>

                        {/* 3. Crop */}
                        <div className="filter-card glass-panel">
                            <div className="filter-header">Focused Region</div>
                            <div className="filter-image-container">
                                <img src={`data:image/png;base64,${tumorDetails.cropped_base64}`} className="filter-img" style={{ objectFit: 'contain' }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // RENDER LOGIC: DR DASHBOARD
    if (drDetails) {
        return (
            <div className="advanced-page page-transition container">
                <div className="advanced-header">
                    <div>
                        <h1 className="advanced-title"><span style={{ color: 'var(--primary)' }}>NeuroScan AI</span></h1>
                        <p className="advanced-subtitle">Retinopathy Analysis</p>
                    </div>
                    <button className="btn-outline" onClick={() => navigate('/detect', { state: { formData: location.state?.formData } })}><ArrowLeft size={16} /> Back</button>
                </div>

                <div className="control-bar glass-panel">
                    <div className="control-group"><span className="file-status">{fileName}</span></div>
                    <div className="control-group right">
                        <button className="btn-outline small" onClick={() => handleSmartAnalysis()} disabled={isLoading} style={{ marginLeft: '10px', borderColor: 'var(--primary)', color: 'var(--primary)' }}>
                            <Sparkles size={16} style={{ marginRight: '5px' }} /> Re-Run Analysis
                        </button>
                    </div>
                </div>

                <div className="tumor-dashboard" style={{ marginTop: '20px' }}>
                    {/* Metrics Banner */}
                    <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.9rem', color: '#888' }}>Diagnosis</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: drDetails.is_no_dr ? '#00ff88' : '#ff4d4d' }}>{drDetails.prediction}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.9rem', color: '#888' }}>Confidence</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>{drDetails.confidence}%</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.9rem', color: '#888' }}>Affected Area</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{drDetails.affected_percent}%</div>
                        </div>
                    </div>

                    {/* Severity Insight Banner */}
                    <div className="glass-panel" style={{ padding: '15px', marginBottom: '20px', textAlign: 'center', background: 'rgba(255, 77, 77, 0.1)', border: '1px solid rgba(255, 77, 77, 0.3)' }}>
                        <span style={{ color: '#aaa', marginRight: '10px', fontWeight: 'bold' }}>CLINICAL INSIGHT:</span>
                        <span style={{ color: '#fff', fontSize: '1.1rem' }}>{drDetails.severity_insight}</span>
                    </div>

                    {/* Image Grid */}
                    <div className="analysis-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                        <div className="filter-card glass-panel">
                            <div className="filter-header">Original</div>
                            <div className="filter-image-container">
                                <img src={`data:image/png;base64,${drDetails.original_base64}`} className="filter-img" />
                            </div>
                        </div>
                        <div className="filter-card glass-panel">
                            <div className="filter-header">Retinal Vessels</div>
                            <div className="filter-image-container">
                                <img src={`data:image/png;base64,${drDetails.vessel_base64}`} className="filter-img" />
                            </div>
                        </div>
                        <div className="filter-card glass-panel">
                            <div className="filter-header">Lesion Analysis</div>
                            <div className="filter-image-container">
                                <img src={`data:image/png;base64,${drDetails.lesion_base64}`} className="filter-img" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Default Return (Fracture Mode)
    return (
        <div className="advanced-page page-transition container">
            {/* ... existing generic JSX ... */}
            {/* We will splice this correctly in the file using context */}
            <div className="advanced-header">
                <div>
                    <h1 className="advanced-title">
                        <span style={{ color: 'var(--primary)' }}>
                            {diseaseType === 'Tumor' ? 'NeuroScan AI' : 'Fracture Detection AI'}
                        </span>
                    </h1>
                    {/* ... rest of original render ... */}
                    <p className="advanced-subtitle">
                        {diseaseType === 'Tumor' ? 'Brain Tumor Analysis' :
                            diseaseType === 'Diabetic Retinopathy Scan' ? 'Retinopathy Analysis' :
                                'Advanced Analysis'}
                    </p>
                </div>
                <button className="btn-outline" onClick={() => navigate('/detect', { state: { formData: location.state?.formData } })}>
                    <ArrowLeft size={16} /> Back to Detect
                </button>
            </div>

            {/* Main Control Bar */}
            <div className="control-bar glass-panel">
                <div className="control-group">
                    <span className="file-status" style={{ marginLeft: 0 }}>{fileName}</span>
                </div>

                <div className="control-group right">
                    {(diseaseType !== 'Tumor' && diseaseType !== 'Diabetic Retinopathy Scan') && (
                        <button className="btn-primary small" onClick={handleAnalyze} disabled={isLoading}>
                            {isLoading ? "Processing..." : "Analyze"}
                        </button>
                    )}
                    <button className="btn-outline small" onClick={() => handleSmartAnalysis()} disabled={isLoading} style={{ marginLeft: '10px', borderColor: 'var(--primary)', color: 'var(--primary)' }}>
                        <Sparkles size={16} style={{ marginRight: '5px' }} /> Smart Auto Detection
                    </button>
                </div>
            </div>



            {/* Smart Detection Result Section */}
            {smartResult && (
                <div className="glass-panel" style={{ marginBottom: '20px', padding: '20px', border: '1px solid var(--primary)' }}>
                    <div className="filter-header" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Sparkles size={20} /> Smart AI Detection Result {smartConfidence && `(${smartConfidence}% Confidence)`}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '15px' }}>
                        <img src={smartResult} alt="Smart Detection" style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} />
                    </div>
                </div>
            )}

            <div className="analysis-grid">
                {showFilters && FILTERS.map((filter) => {
                    // Decide which image to show: API result or Fallback
                    // API keys match ids: 'brightness', 'clahe', 'jet_colormap', 'retinex'
                    // 'original' might pass through or be just imageSrc
                    let displaySrc = imageSrc;
                    let customStyle = {};

                    if (filter.id !== 'original') {
                        if (apiResults[filter.id]) {
                            // Use API result
                            displaySrc = `data:image/png;base64,${apiResults[filter.id]}`;
                        } else {
                            // Fallback to CSS simulation if API failed or not returned
                            customStyle = {
                                filter:
                                    filter.id === 'brightness' ? 'brightness(1.5)' :
                                        filter.id === 'clahe' ? 'contrast(1.5) grayscale(100%)' :
                                            filter.id === 'retinex' ? 'brightness(1.2) contrast(1.1) saturate(1.2)' :
                                                filter.id === 'jet_colormap' ? 'hue-rotate(180deg) invert(1)' :
                                                    'none'
                            }
                        }
                    }

                    return (
                        <div key={filter.id} className="filter-card glass-panel">
                            <div className="filter-header">{filter.label}</div>
                            <div className="filter-image-container">
                                {displaySrc ? (
                                    <img
                                        src={displaySrc}
                                        alt={filter.label}
                                        className="filter-img"
                                        style={customStyle}
                                    />
                                ) : (
                                    <div className="placeholder-box">
                                        <ImageIcon size={48} color="var(--text-muted)" />
                                        <p>No Image</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>


            {/* Validation Section */}
            {
                (showFilters || smartResult) && (
                    <div className="glass-panel" style={{ marginTop: '30px', padding: '20px' }}>
                        <div className="section-label" style={{ marginBottom: '15px', color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Physician Validation</div>
                        <div style={{ display: 'flex', gap: '15px' }}>
                            <button
                                className={`btn-outline ${accepted === true ? 'active-accept' : ''}`}
                                style={{
                                    borderColor: accepted === true ? '#00ff88' : 'var(--border-color)',
                                    color: accepted === true ? '#00ff88' : 'var(--text-secondary)',
                                    flex: 1,
                                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                                    opacity: isSaving ? 0.7 : 1
                                }}
                                onClick={() => !isSaving && handleValidation(true)}
                                disabled={isSaving}
                            >
                                <Check size={18} /> {isSaving && accepted === true ? "Saving..." : "Accept Results"}
                            </button>
                            <button
                                className={`btn-outline ${accepted === false ? 'active-reject' : ''}`}
                                style={{
                                    borderColor: accepted === false ? '#ff4d4d' : 'var(--border-color)',
                                    color: accepted === false ? '#ff4d4d' : 'var(--text-secondary)',
                                    flex: 1,
                                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                                    opacity: isSaving ? 0.7 : 1
                                }}
                                onClick={() => !isSaving && handleValidation(false)}
                                disabled={isSaving}
                            >
                                <X size={18} /> {isSaving && accepted === false ? "Saving..." : "Reject Results"}
                            </button>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default AdvancedAnalysis;

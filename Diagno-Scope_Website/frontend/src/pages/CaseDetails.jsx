
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getScans } from '../utils/storage';
import { saveCaseToFirestore } from '../utils/uploadService';
import { Upload, FileText, Image as ImageIcon, ArrowLeft, Calendar, File } from 'lucide-react';
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import './CaseDetails.css';

const CaseDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    const [caseData, setCaseData] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [files, setFiles] = useState([]);


    useEffect(() => {
        const fetchCase = async () => {
            // 1. Try Local Storage first (for speed/legacy)
            const allScans = getScans();
            const localFound = allScans.find(s => s.id == id);

            if (localFound) {
                setCaseData({
                    ...localFound,
                    image_urls: localFound.image_urls || []
                });
                return;
            }

            // 2. If not local, try Firestore
            try {
                const docRef = doc(db, "cases", id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setCaseData({
                        id: docSnap.id,
                        patient: data.case_id || data.name || 'Unknown',
                        date: data.created_at?.toDate ? data.created_at.toDate().toLocaleDateString() : (data.date || 'Recent'),
                        status: (data.accepted !== undefined && data.accepted !== null) ? 'Completed' : 'Pending',
                        image_urls: data.Image_urls || [], // Note: capitalization from uploadService
                        ...data
                    });
                } else {
                    console.error("No such document in Firestore!");
                }
            } catch (error) {
                console.error("Error fetching case details:", error);
            }
        };

        fetchCase();
    }, [id]);

    const handleFileSelect = (e) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
        }
    };

    const handleUpload = async () => {
        if (files.length === 0) return;

        setUploading(true);
        try {
            // Unified Save: Uploads AND Updates Firestore
            // We pass {} as metadata so we don't overwrite existing fields unless necessary
            const uploadedUrls = await saveCaseToFirestore(String(id), {}, files);

            if (uploadedUrls && uploadedUrls.length > 0) {
                alert("Files uploaded to Cloudinary and linked in Firestore successfully!");

                // 3. Update Local State to show the new images immediately
                setCaseData(prev => ({
                    ...prev,
                    image_urls: [...(prev.image_urls || []), ...uploadedUrls]
                }));
                setFiles([]);
            } else {
                alert("Upload completed but no URLs returned. (Check permissions/network)");
            }

        } catch (error) {
            console.error("Upload failed", error);
            alert("Upload failed. Check console for details.");
        } finally {
            setUploading(false);
        }
    };

    if (!caseData) return <div className="container" style={{ paddingTop: 100 }}>Loading or Case Not Found...</div>;

    return (
        <div className="case-details-page container page-transition">
            <button className="btn-text" onClick={() => navigate('/dashboard')} style={{ marginBottom: 20 }}>
                <ArrowLeft size={16} style={{ marginRight: 6 }} /> Back to Dashboard
            </button>

            <div className="glass-panel case-content-wrapper">
                <header className="case-header-detailed">
                    <div className="header-left">
                        <h1 className="case-id-title">{caseData.patient || `Case #${caseData.id}`}</h1>
                        <div className="case-meta-row">
                            <span className="meta-pill"><Calendar size={14} /> {caseData.date}</span>
                            <span className={`status-pill status-${caseData.status?.toLowerCase() || 'pending'}`}>
                                {caseData.status}
                            </span>
                        </div>
                    </div>
                </header>

                <div className="case-section">
                    <h3 className="section-title">Diagnostic Scans</h3>
                    <div className="gallery-grid">
                        {/* Existing or New Cloudinary Images */}
                        {caseData.image_urls && caseData.image_urls.map((url, idx) => (
                            <div key={idx} className="gallery-item">
                                {url.includes('/raw/') || url.endsWith('.dcm') ? (
                                    <div className="dicom-placeholder">
                                        <FileText size={32} />
                                        <span className="dicom-label">DICOM FILE</span>
                                    </div>
                                ) : (
                                    <img
                                        src={url}
                                        alt={`Scan ${idx}`}
                                        className="gallery-img"
                                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
                                    />
                                )}
                                <div className="img-fallback" style={{ display: 'none' }}>
                                    <ImageIcon size={24} />
                                    <span>Image Error</span>
                                </div>
                            </div>
                        ))}
                        {(!caseData.image_urls || caseData.image_urls.length === 0) && (
                            <div className="empty-state">
                                <div className="empty-icon"><ImageIcon size={40} /></div>
                                <p>No scans uploaded for this case yet.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="case-divider"></div>

                <div className="case-section upload-section-refined">
                    <h4 className="section-title center-text">Upload Additional Scans</h4>
                    <p className="text-muted center-text small-text">Supported formats: JPG, PNG, DICOM (.dcm)</p>

                    <input
                        type="file"
                        multiple
                        accept=".jpg,.jpeg,.png,.dcm"
                        onChange={handleFileSelect}
                        id="case-file-upload"
                        style={{ display: 'none' }}
                    />

                    {!files.length ? (
                        <label htmlFor="case-file-upload" className="btn-secondary upload-btn-refined">
                            <Upload size={16} /> Select Files
                        </label>
                    ) : (
                        <div className="file-selected-area">
                            <span className="file-count-badge">{files.length} ready to upload</span>
                            <button
                                className="btn-primary upload-confirm-btn"
                                onClick={handleUpload}
                                disabled={uploading}
                            >
                                {uploading ? 'Uploading...' : 'Upload Now'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CaseDetails;

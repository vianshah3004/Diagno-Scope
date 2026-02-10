import React from 'react';
import { Target, Shield, Cpu, Activity, ArrowRight, Link, Users } from 'lucide-react';
import './About.css';

const About = () => {
    return (
        <div className="about-page page-transition container">
            <div className="about-header">
                <h1 className="about-title">About Diagnoscope</h1>
                <p className="about-subtitle">
                    Diagnoscope is a web-based medical imaging analysis platform designed to support clinicians and diagnostic professionals in efficiently analyzing radiological images and managing diagnostic cases. Built using a modern React architecture and powered by secure cloud infrastructure, Diagnoscope provides an intuitive workflow from case creation to AI-assisted analysis and reporting.
                </p>
            </div>

            <section className="about-grid">
                {/* CARD 1: Case Management (Split from Para 2) */}
                <div className="about-card glass-panel">
                    <div className="icon-box blue">
                        <Target size={32} />
                    </div>
                    <h3>Case Management</h3>
                    <p>
                        The platform enables users to create and manage diagnostic cases, upload medical images, and view detailed analysis results through a structured Detect interface.
                    </p>
                </div>

                {/* CARD 2: AI Analysis (Split from Para 2) */}
                <div className="about-card glass-panel">
                    <div className="icon-box purple">
                        <Cpu size={32} />
                    </div>
                    <h3>AI-Assisted Analysis</h3>
                    <p>
                        AI-assisted predictions are presented alongside visual explainability features, confidence scores, and differential diagnosis indicators to support clinical interpretation while maintaining transparency.
                    </p>
                </div>

                {/* CARD 3: Dashboard (Split from Para 3) */}
                <div className="about-card glass-panel">
                    <div className="icon-box orange">
                        <Activity size={32} />
                    </div>
                    <h3>Centralized Dashboard</h3>
                    <p>
                        Diagnoscope includes a centralized Dashboard that provides an overview of processed cases, system activity, and usage insights.
                    </p>
                </div>

                {/* CARD 4: Security (Split from Para 3) */}
                <div className="about-card glass-panel">
                    <div className="icon-box green">
                        <Shield size={32} />
                    </div>
                    <h3>Secure Infrastructure</h3>
                    <p>
                        All diagnostic data, case metadata, and reports are securely stored using Firebase Firestore, ensuring reliable data management, scalability, and controlled access.
                    </p>
                </div>

                {/* CARD 5: Seamless Integration */}
                <div className="about-card glass-panel">
                    <div className="icon-box cyan">
                        <Link size={32} />
                    </div>
                    <h3>Seamless Integration</h3>
                    <p>
                        Designed for interoperability, our system integrates smoothly with existing hospital information systems (HIS) and PACS, ensuring a unified workflow that minimizes disruption and maximizes efficiency.
                    </p>
                </div>

                {/* CARD 6: Real-time Collaboration */}
                <div className="about-card glass-panel">
                    <div className="icon-box red">
                        <Users size={32} />
                    </div>
                    <h3>Real-time Collaboration</h3>
                    <p>
                        Facilitate instant second opinions and multidisciplinary team discussions with real-time case sharing and annotated reporting tools, breaking down silos in complex diagnostic cases.
                    </p>
                </div>
            </section>

            <section className="mission-section">
                <div className="mission-content">
                    <h2>Our Approach</h2>
                    <p>
                        Designed with a privacy-first and role-aware approach, Diagnoscope focuses on assisting healthcare workflows without replacing clinical judgment. The platform is suitable for use in hospitals, diagnostic centers, and research environments, offering a balance of automation, clarity, and operational efficiency through a clean and responsive web interface.
                    </p>
                    {/* <button className="btn-primary">Join Our Journey <ArrowRight size={18} style={{ marginLeft: '8px' }} /></button> */}
                </div>
            </section>
        </div>
    );
};

export default About;

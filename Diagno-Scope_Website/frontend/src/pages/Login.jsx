import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Import Auth Context
import { ArrowRight, Lock, User, Building, CheckCircle, AlertCircle } from 'lucide-react';
import './Auth.css';

const Login = () => {
    const navigate = useNavigate();
    const { checkDoctorExists, createPassword, loginDoctor, loading, currentUser } = useAuth();

    // Redirect if already logged in
    React.useEffect(() => {
        if (currentUser) {
            navigate('/dashboard');
        }
    }, [currentUser, navigate]);

    // Steps: 1 = Check Identity, 2 = Create Password, 3 = Login
    const [step, setStep] = useState(1);

    // Data State
    const [doctorName, setDoctorName] = useState('');
    const [hospitalName, setHospitalName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [docId, setDocId] = useState(null); // To track which doctor is found

    const [error, setError] = useState('');

    // --- HANDLERS ---

    // Step 1: Check Doctor Exists
    const handleIdentityCheck = async (e) => {
        e.preventDefault();
        setError('');

        if (!doctorName || !hospitalName) {
            setError("Please fill in all fields.");
            return;
        }

        const doc = await checkDoctorExists(doctorName, hospitalName);

        if (!doc) {
            setError("Doctor not registered with this hospital.");
            return;
        }

        setDocId(doc.id);

        if (!doc.password_set) {
            // Case 2: Found but no password -> Signup Flow
            setStep(2);
        } else {
            // Case 3: Found and has password -> Login Flow
            setStep(3);
        }
    };

    // Step 2: Create Password (First-Time)
    const handleCreatePassword = async (e) => {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        await createPassword(docId, password);
        navigate('/dashboard'); // Success -> Dashboard
    };

    // Step 3: Normal Login
    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        const result = await loginDoctor(docId, password);

        if (result.success) {
            navigate('/dashboard');
        } else {
            setError(result.error);
        }
    };

    return (
        <div className="auth-page">
            <div className="bg-glow"></div>

            <div className="auth-container page-transition">
                <div className="auth-header">
                    {step === 1 && (
                        <>
                            <h2 className="auth-title">Doctor Portal</h2>
                            <p className="auth-subtitle">Verify your identity to proceed</p>
                        </>
                    )}
                    {step === 2 && (
                        <>
                            <h2 className="auth-title">Setup Account</h2>
                            <p className="auth-subtitle">Create a secure password for your first login</p>
                        </>
                    )}
                    {step === 3 && (
                        <>
                            <h2 className="auth-title">Welcome Back</h2>
                            <p className="auth-subtitle">Enter your password to access dashboard</p>
                        </>
                    )}
                </div>

                {error && (
                    <div className="error-banner">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                {/* --- STEP 1: IDENTITY --- */}
                {step === 1 && (
                    <form className="auth-form" onSubmit={handleIdentityCheck}>
                        <div className="form-group">
                            <label className="form-label">Doctor Name</label>
                            <div className="input-with-icon">
                                <User size={18} className="field-icon" />
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g. Dr. A"
                                    value={doctorName}
                                    onChange={(e) => setDoctorName(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Hospital Name</label>
                            <div className="input-with-icon">
                                <Building size={18} className="field-icon" />
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g. Hospital A"
                                    value={hospitalName}
                                    onChange={(e) => setHospitalName(e.target.value)}
                                />
                            </div>
                        </div>

                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Verifying...' : 'Continue'}
                            {!loading && <ArrowRight size={18} style={{ marginLeft: '8px' }} />}
                        </button>
                    </form>
                )}

                {/* --- STEP 2: CREATE PASSWORD --- */}
                {step === 2 && (
                    <form className="auth-form" onSubmit={handleCreatePassword}>
                        <div className="form-group">
                            <label className="form-label">Create New Password</label>
                            <div className="input-with-icon">
                                <Lock size={18} className="field-icon" />
                                <input
                                    type="password"
                                    className="form-input"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Confirm Password</label>
                            <div className="input-with-icon">
                                <Lock size={18} className="field-icon" />
                                <input
                                    type="password"
                                    className="form-input"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Password'}
                        </button>
                    </form>
                )}

                {/* --- STEP 3: LOGIN --- */}
                {step === 3 && (
                    <form className="auth-form" onSubmit={handleLogin}>
                        <div className="user-summary">
                            <div className="avatar-circle">{doctorName.charAt(0)}</div>
                            <div className="user-details">
                                <span className="u-name">{doctorName}</span>
                                <span className="u-hosp">{hospitalName}</span>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <div className="input-with-icon">
                                <Lock size={18} className="field-icon" />
                                <input
                                    type="password"
                                    className="form-input"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Logging in...' : 'Login'}
                        </button>
                    </form>
                )}

                <div className="auth-footer">
                    <p>Protected by Diagno Scope Secure Access</p>
                </div>
            </div>
        </div>
    );
};

export default Login;

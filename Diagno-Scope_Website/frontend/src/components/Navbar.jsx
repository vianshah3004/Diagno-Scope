import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Scan, Menu, X, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);

    // Safely access auth context to prevent crashes
    const authContext = useAuth();
    const currentUser = authContext?.currentUser;
    const logout = authContext?.logout;

    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = () => {
        if (logout) logout();
        setIsOpen(false);
        navigate('/');
    };

    const toggleMenu = () => setIsOpen(!isOpen);
    const isActive = (path) => location.pathname === path;

    return (
        <nav className="navbar">
            <div className="container nav-container">
                <Link to="/" className="logo">
                    <div className="icon-wrapper">
                        <Scan className="logo-icon" size={28} />
                    </div>
                    <span className="logo-text">Diagno Scope</span>
                </Link>

                {/* Desktop Menu */}
                <div className="nav-links desktop">
                    <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>Home</Link>
                    <Link to="/dashboard" className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}>Dashboard</Link>
                    <Link to="/detect" className={`nav-link ${isActive('/detect') ? 'active' : ''}`}>Detect</Link>
                    <Link to="/about" className={`nav-link ${isActive('/about') ? 'active' : ''}`}>About Us</Link>
                    <Link to="/settings" className={`nav-link ${isActive('/settings') ? 'active' : ''}`}>Settings</Link>
                </div>

                <div className="nav-actions desktop">
                    {currentUser ? (
                        <>
                            <div className="user-badge">
                                <UserIcon size={16} />
                                <span>{currentUser.doctor_name}</span>
                            </div>
                            <button onClick={handleLogout} className="btn-text logout-btn">
                                <LogOut size={18} />
                            </button>
                        </>
                    ) : (
                        <Link to="/login" className="btn-primary small">Doctor Login</Link>
                    )}
                </div>

                {/* Mobile Toggle */}
                <button className="mobile-toggle" onClick={toggleMenu}>
                    {isOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Mobile Menu */}
            {isOpen && (
                <div className="mobile-menu">
                    <Link to="/" onClick={toggleMenu} className="mobile-link">Home</Link>
                    <Link to="/dashboard" onClick={toggleMenu} className="mobile-link">Dashboard</Link>
                    <Link to="/detect" onClick={toggleMenu} className="mobile-link">Detect</Link>
                    <Link to="/about" onClick={toggleMenu} className="mobile-link">About Us</Link>
                    <Link to="/settings" onClick={toggleMenu} className="mobile-link">Settings</Link>
                    <div className="mobile-actions">
                        {currentUser ? (
                            <button onClick={handleLogout} className="btn-primary full-width">Logout</button>
                        ) : (
                            <Link to="/login" onClick={toggleMenu} className="btn-primary">Doctor Login</Link>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Navbar;

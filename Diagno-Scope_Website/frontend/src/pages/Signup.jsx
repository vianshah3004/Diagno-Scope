import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Signup = () => {
    const navigate = useNavigate();

    useEffect(() => {
        // The "Signup" flow is now integrated into the Login flow 
        // as "First Time Login".
        navigate('/login');
    }, [navigate]);

    return null;
};

export default Signup;

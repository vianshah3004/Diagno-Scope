import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const VoiceContext = createContext({
    registerHandler: () => { },
    unregisterHandler: () => { },
    handleGlobalCommand: () => { }
});

export const useVoice = () => useContext(VoiceContext);

export const VoiceProvider = ({ children }) => {
    // We use a ref for the handler to always access the latest version without triggering re-renders
    const pageHandlerRef = useRef(null);

    // We also store global state if needed, but for now just command routing
    const registerHandler = useCallback((handler) => {
        pageHandlerRef.current = handler;
        console.log("Voice Handler Registered");
    }, []);

    const unregisterHandler = useCallback(() => {
        pageHandlerRef.current = null;
        console.log("Voice Handler Unregistered");
    }, []);

    const handleGlobalCommand = useCallback((action, value) => {
        console.log("Global Command Received:", action, value);

        // 1. Handle Global Navigation here if not handled by page?
        // Actually navigation is best handled by the component that knows the router, 
        // but the assistant itself emits 'NAVIGATE'.
        // We can pass it to the page handler, or handle generic stuff here.

        if (pageHandlerRef.current) {
            pageHandlerRef.current(action, value);
        }
    }, []);

    return (
        <VoiceContext.Provider value={{ registerHandler, unregisterHandler, handleGlobalCommand }}>
            {children}
        </VoiceContext.Provider>
    );
};

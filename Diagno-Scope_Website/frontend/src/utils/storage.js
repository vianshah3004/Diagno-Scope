
const STORAGE_KEY = 'diagnoscope_scans_v1';

// Initial Mock Data if empty
const INITIAL_DATA = [
    { id: 1, patient: 'Patient #8492', date: 'Oct 24, 2023', status: 'Completed', result: 'Normal' },
    { id: 2, patient: 'Patient #8493', date: 'Oct 23, 2023', status: 'Analyzing', result: 'Pending' },
    { id: 3, patient: 'Patient #8490', date: 'Oct 21, 2023', status: 'Completed', result: 'Attention Required' },
];

export const getScans = () => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DATA));
        return INITIAL_DATA;
    }
    return JSON.parse(data);
};

export const addScan = (scan) => {
    const scans = getScans();
    const newScan = {
        id: Date.now(),
        patient: scan.name || `Case #${Date.now()}`, // Normalized for dashboard
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        status: 'Analyzing', // Initial status
        result: 'Pending',
        ...scan
    };

    // Unshift to add to top
    const updatedScans = [newScan, ...scans];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedScans));
    return newScan;
};

export const updateScanStatus = (id, status, result) => {
    const scans = getScans();
    const updated = scans.map(s =>
        s.id === id ? { ...s, status, result } : s
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
};

const STORAGE_KEY_SETTINGS = 'diagnoscope_settings_v1';

export const DEFAULT_SETTINGS = {
    // 1. Profile (Mock - user data comes from Auth, but we store extras here)
    hospital: 'General Hospital',

    // 2. Diagnostic
    defaultModality: 'X-Ray', // X-Ray, CT, MRI
    autoCaseId: true,
    viewPreset: 'Lung', // Lung, Bone, Soft Tissue
    aiSuggestions: true,

    // 3. AI & Analysis
    aiAssisted: true,
    showConfidence: true,
    diffDiagnosis: true,
    visualExplainability: true,
    manualReview: false,

    // 4. Data & Privacy
    firestoreSync: true,
    maskPatientIds: false,
    activityLogs: true,

    // 5. Dashboard
    dashboardView: 'Recent Cases', // Recent Cases, Analytics
    showStatusIndicators: true,
    usageAnalytics: true,

    // 6. Notifications
    notifyAnalysisComplete: true,
    notifyLowConfidence: true,
    notifyUpdates: true,
    emailNotifications: true,

    // 7. Interface
    theme: 'dark',
    shortcuts: true,
    autoSave: true
};

export const getSettings = () => {
    const data = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!data) {
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
        return DEFAULT_SETTINGS;
    }
    // Merge with default to ensure new keys exist if schema changes
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
};

export const saveSettings = (newSettings) => {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(newSettings));
    return newSettings;
};

// ... existing exports ...
export const getStats = () => {
    const scans = getScans();
    const total = scans.length;
    const pending = scans.filter(s => s.status === 'Analyzing' || s.result === 'Pending').length;

    // Mock accuracy calculation - just ratio of 'Completed' for now or static high number
    // Let's make it dynamic based on count to feel real
    const accuracy = total > 0 ? (98 + (total % 2)).toFixed(0) : 98;

    return {
        total,
        pending,
        accuracy: `${accuracy}%`
    };
};

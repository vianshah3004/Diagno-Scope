// import React from 'react';
// import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
// import Navbar from './components/Navbar';
// import Home from './pages/Home';
// import Login from './pages/Login';
// import Signup from './pages/Signup';
// import Dashboard from './pages/Dashboard';
// import Detect from './pages/Detect';
// import About from './pages/About';
// import Settings from './pages/Settings';
// import CaseDetails from './pages/CaseDetails';
// import { ThemeProvider } from './context/ThemeContext';
// import { AuthProvider } from './context/AuthContext';

// import { VoiceProvider, useVoice } from './context/VoiceContext';
// import AntiGravityAssistant from './components/AntiGravityAssistant';
// import { useNavigate } from 'react-router-dom';

// const AppContent = ({ children }) => {
//   const { handleGlobalCommand } = useVoice();
//   const navigate = useNavigate();



//   // Intercept navigation commands at the global level
//   const onVoiceCommand = (action, value) => {
//     if (action === 'NAVIGATE') {
//       navigate(value);
//     } else {
//       handleGlobalCommand(action, value);
//     }
//   };

//   return (
//     <>
//       <Navbar />
//       <AntiGravityAssistant onCommand={onVoiceCommand} />
//       <main>
//         {children}
//       </main>
//     </>
//   );
// };

// function App() {
//   return (
//     <AuthProvider>
//       <ThemeProvider>
//         <VoiceProvider>
//           <Router>
//             <AppContent>
//               <Routes>
//                 <Route path="/" element={<Home />} />
//                 <Route path="/login" element={<Login />} />
//                 <Route path="/signup" element={<Signup />} />
//                 <Route path="/dashboard" element={<Dashboard />} />
//                 <Route path="/detect" element={<Detect />} />
//                 <Route path="/case/:id" element={<CaseDetails />} />
//                 <Route path="/about" element={<About />} />
//                 <Route path="/settings" element={<Settings />} />
//               </Routes>
//             </AppContent>
//           </Router>
//         </VoiceProvider>
//       </ThemeProvider>
//     </AuthProvider>
//   );
// }

// export default App;



import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Detect from './pages/Detect';
import About from './pages/About';
import Settings from './pages/Settings';
import CaseDetails from './pages/CaseDetails';
import AdvancedAnalysis from './pages/AdvancedAnalysis';

// Context Providers
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { VoiceProvider, useVoice } from './context/VoiceContext';

// Components
import AntiGravityAssistant from './components/AntiGravityAssistant';

const AppContent = ({ children }) => {
  const { handleGlobalCommand } = useVoice();
  const navigate = useNavigate();

  // Handle Refresh -> Redirect to Home
  // "whenever on any page i click on refresh button, it should smoothly navigate to the home page"
  useEffect(() => {
    try {
      const perfEntries = performance.getEntriesByType("navigation");
      if (perfEntries.length > 0) {
        const navType = perfEntries[0].type;
        // If it's a reload (or back_forward if desired, but user said 'refresh')
        if (navType === 'reload') {
          console.log("Detected Page Reload. Redirecting to Home...");
          // Only redirect if not already at root to avoid redundant ops
          if (window.location.pathname !== '/') {
            navigate('/', { replace: true });
          }
        }
      }
    } catch (e) {
      console.error("Navigation check failed:", e);
    }
  }, []); // <--- CRITICAL: Empty array means "Run once on mount", never again.

  // Intercept navigation commands at the global level
  const onVoiceCommand = (action, value) => {
    if (action === 'NAVIGATE') {
      navigate(value);
    } else {
      handleGlobalCommand(action, value);
    }
  };

  return (
    <div className="app-layout">
      <Navbar />
      {/* AntiGravity Assistant stays active across all pages */}
      <AntiGravityAssistant onCommand={onVoiceCommand} />
      <main className="content-area">
        {children}
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        {/* ThemeProvider here manages the dark/light CSS classes automatically */}
        <VoiceProvider>
          <Router>
            <AppContent>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/detect" element={<Detect />} />
                <Route path="/case/:id" element={<CaseDetails />} />
                <Route path="/advanced-analysis" element={<AdvancedAnalysis />} /> {/* New Route */}
                <Route path="/about" element={<About />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </AppContent>
          </Router>
        </VoiceProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
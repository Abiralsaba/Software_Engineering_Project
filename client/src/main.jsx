import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/hind-siliguri/400.css';
import '@fontsource/hind-siliguri/600.css';
import { AuthProvider } from './context/AuthContext.jsx';
import App from './App.jsx';
import './styles/react-workflow.css';
import './styles/low-risk-pages.css';
import './styles/batch-one-pages.css';
import './styles/service-pages.css';
import 'virtual:legacy-ministry.css';
import './styles/ministry-bridge.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

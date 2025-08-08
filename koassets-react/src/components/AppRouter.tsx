import React from 'react';
import { Route, Routes } from 'react-router-dom';

// We'll import the main app content as a separate component
import MainApp from './MainApp';

const AppRouter: React.FC = () => {
    return (
        <Routes>
            <Route path="/" element={<MainApp />} />
            <Route path="/index.html" element={<MainApp />} />
        </Routes>
    );
};

export default AppRouter; 
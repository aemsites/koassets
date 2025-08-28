import { Provider } from '@react-spectrum/provider';
import { theme } from '@react-spectrum/theme-default';
import { ToastContainer } from '@react-spectrum/toast';
import React from 'react';
import AppRouter from './components/AppRouter';

const App: React.FC = (): React.JSX.Element => {
    return (
        <Provider theme={theme}>
            <AppRouter />
            <ToastContainer />
        </Provider>
    );
};


export default App;

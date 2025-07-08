import React from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { StatusBar } from 'expo-status-bar';
import { store, persistor } from '../src/store';
import { AppNavigator } from '../src/navigation/AppNavigator';
import { ToastProvider } from '../src/components/common/ToastProvider';

export default function RootLayout() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ToastProvider>
          <StatusBar style="auto" />
          <AppNavigator />
        </ToastProvider>
      </PersistGate>
    </Provider>
  );
}

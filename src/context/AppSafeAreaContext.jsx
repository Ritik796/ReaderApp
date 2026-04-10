import React, {createContext, useContext, useMemo} from 'react';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

const AppSafeAreaContext = createContext(null);

function AppSafeAreaProvider({children}) {
  const insets = useSafeAreaInsets();

  const value = useMemo(
    () => ({
      insets,
      top: insets.top,
      right: insets.right,
      bottom: insets.bottom,
      left: insets.left,
    }),
    [insets],
  );

  return (
    <AppSafeAreaContext.Provider value={value}>
      {children}
    </AppSafeAreaContext.Provider>
  );
}

function useAppSafeArea() {
  const context = useContext(AppSafeAreaContext);

  if (!context) {
    throw new Error('useAppSafeArea must be used inside AppSafeAreaProvider');
  }

  return context;
}

export {AppSafeAreaProvider, useAppSafeArea};

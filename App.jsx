import React from 'react';
import {StatusBar} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import LauncherScreen    from './src/screens/LauncherScreen';
import LoginScreen       from './src/screens/LoginScreen';
import MapScreen         from './src/screens/MapScreen';
import QRScannerScreen   from './src/screens/QRScannerScreen';
import WasteEntryScreen  from './src/screens/WasteEntryScreen';
import appTheme from './src/theme/appTheme';
import {AppSafeAreaProvider} from './src/context/AppSafeAreaContext';
import {LoaderProvider} from './src/context/LoaderContext';
import {ToastProvider} from './src/context/ToastContext';
import {GestureHandlerRootView} from 'react-native-gesture-handler';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <AppSafeAreaProvider>
          <LoaderProvider>
            <ToastProvider>
              <StatusBar
                barStyle="dark-content"
                backgroundColor={appTheme.colors.safeAreaBackground}
              />
              <NavigationContainer>
                <Stack.Navigator
                  initialRouteName="Launcher"
                  screenOptions={{headerShown: false, animation: 'none'}}>
                  <Stack.Screen name="Launcher"   component={LauncherScreen} />
                  <Stack.Screen name="Login"      component={LoginScreen} />
                  <Stack.Screen name="Map"        component={MapScreen} />
                  <Stack.Screen name="QRScanner"  component={QRScannerScreen} />
                  <Stack.Screen name="WasteEntry" component={WasteEntryScreen} />
                </Stack.Navigator>
              </NavigationContainer>
            </ToastProvider>
          </LoaderProvider>
        </AppSafeAreaProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

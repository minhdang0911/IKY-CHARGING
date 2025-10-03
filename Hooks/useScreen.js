import { useState } from 'react';

// Custom hook để quản lý màn hình
const useScreen = (initialScreen = 'Login') => {
  const [currentScreen, setCurrentScreen] = useState(initialScreen);
  const [screenData, setScreenData] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Hàm navigate đến màn hình khác
  const navigateToScreen = (screenName, data = null) => {
    setCurrentScreen(screenName);
    setScreenData(data);
  };

  // Hàm quay lại màn hình trước
  const goBack = () => {
    if (isLoggedIn) {
      setCurrentScreen('Information'); // Về tab Information nếu đã login
    } else {
      setCurrentScreen('Login');
    }
    setScreenData(null);
  };

  // Hàm login
  const login = (userData = null) => {
    setIsLoggedIn(true);
    setCurrentScreen('Monitoring'); // Mặc định về tab Information sau khi login
    setScreenData(userData);
  };

   const restoreSession = (screenName = 'Monitoring', data = null) => {
    setIsLoggedIn(true);              // tuỳ m, có thể bỏ nếu ko dùng flag
    setCurrentScreen(screenName);
    setScreenData(data);
  };

  // Hàm logout
  const logout = () => {
    setIsLoggedIn(false);
    setCurrentScreen('Login');
    setScreenData(null);
  };

  const changeInfo = () => {
    setCurrentScreen('changeInfo');
  };

  const forgotStep2 = () => {
    setCurrentScreen('forgotStep2');
  };

  const forgotStep3 = () => {
    setCurrentScreen('forgotStep3');
  };

  const companyInfo = () =>{
      setCurrentScreen('companyInfo');
  }

  const changepassword = () =>{
    setCurrentScreen('changePasssword')
  }

  const devicesInfo = () =>{
    setCurrentScreen('devicesInfo')
  }
  
  const phoneUser = () =>{
    setCurrentScreen('phoneUser')
  }

  const historyExtend = () =>{
    setCurrentScreen('historyExtend')
  }
  const addDevices = () =>{
    setCurrentScreen('addDevices')
  }

  const notification = () =>{
    setCurrentScreen('notification')
  }

  const extend= () =>{
    setCurrentScreen('extend')
  }
  const orderDetail = () =>{
    setCurrentScreen('orderDetail')
  }

  const paymentConfirm = () =>{
    setCurrentScreen('paymentConfirm')
  }

   const activeDevices = () =>{
    setCurrentScreen('activeDevices')
  }

  const chargingSession = () =>{
    setCurrentScreen('chargingSession')
  }


  return {
    currentScreen,
    screenData,
    isLoggedIn,
    navigateToScreen,
    goBack,
    login,
    logout,
    changeInfo,
    forgotStep2,
    forgotStep3,
    companyInfo,
    changepassword,
    devicesInfo,
    phoneUser,
    historyExtend,
    addDevices,
    notification,
    extend,
    orderDetail,
    paymentConfirm,
    activeDevices,
    restoreSession,
    chargingSession,
    // Các hàm shortcut cho từng màn hình
    goToLogin: () => navigateToScreen('Login'),
    goToForgotPassword: () => navigateToScreen('ForgotPassword'),
    goToRegister: () => navigateToScreen('Register'),
    goToMonitoring: () => navigateToScreen('Monitoring'),
    goToJourney: () => navigateToScreen('Journey'),
    goToDevice: () => navigateToScreen('Device'),
    goToInformation: () => navigateToScreen('Information'),
  };
};

export default useScreen;
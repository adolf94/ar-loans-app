import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import { redirect, RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { use, useEffect, useState } from 'react';
import { defaultUserInfo, UserInfoContext } from './components/useUserInfo';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { BackdropLoaderProvider } from './components/BackdropLoader';
import LoginPrompt from './components/login/LoginPrompt';
import { getTokenViaRefreshToken } from './services/api';
import {jwtDecode} from 'jwt-decode'

const queryClient = new QueryClient({
  defaultOptions: {
    queries:{
      staleTime: 60*15*1000,
      gcTime: 60*15*1000
    }
  }
});

function App() {
  const [userInfo,setUserInfo] = useState(defaultUserInfo)
  const [init,setInit] = useState(false)
  const hasRole = (roleAny : string[])=>{
    return userInfo.role.some(e=>roleAny.indexOf(e) > -1)
  }

  useEffect(()=>{
    const token = localStorage.getItem("id_token");

    if (!token) {
      setInit(true)
      return
    
    }

    try {
      const decoded = jwtDecode<any>(token);
      
      // Check if token is expired
      const currentTime = Date.now() / 1000;
      if (decoded.exp < currentTime) {
        localStorage.removeItem("id_token");
        setInit(true)
      }

      setInit(true)
      setUserInfo(decoded);
    } catch (error) {
      console.error("Invalid token", error);
      localStorage.removeItem("id_token");
      setInit(true)
      return null;
    }
  },[])
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BackdropLoaderProvider>
          <GoogleOAuthProvider clientId={window.webConfig.clientId}>
            <UserInfoContext.Provider value={{userInfo,setUserInfo}}>
              {init && <RouterProvider router={router} context={{auth: {user : userInfo, hasRole}}} />}
              <LoginPrompt />
            </UserInfoContext.Provider>
          </GoogleOAuthProvider>
        </BackdropLoaderProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;

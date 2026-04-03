import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { defaultUserInfo, UserInfoContext } from './components/useUserInfo';
import { BackdropLoaderProvider, useBackdropLoader } from './components/BackdropLoader';
import LoginPrompt from './components/login/LoginPrompt';
import { jwtDecode } from 'jwt-decode'
import { ConfirmProvider } from 'material-ui-confirm';
import { syncUser } from './services/apiService';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 15 * 1000,
      gcTime: 60 * 15 * 1000
    }
  }
});

import { AuthProvider, useAuth } from '@adolf94/ar-auth-client';

const authConfig = {
  authority: window.webConfig.authority,
  clientId: window.webConfig.clientId,
  redirectUri: window.webConfig.redirectUri || window.location.origin,
  scope: window.webConfig.scope || 'openid profile email',
};

function AppContent({ userInfo, setUserInfo, init }: any) {
  const { user, isAuthenticated, isLoading, hasScope, login } = useAuth();

  const hasRole = (roleAny: string[]) => {
    return roleAny.some(e => hasScope(e))
  }

  const setLoading = useBackdropLoader();

  // Capture link_state once during component initialization
  const [capturedLinkState] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const ls = params.get('link_state');
    console.log("Captured link_state on mount:", ls);
    return ls;
  });

  useEffect(() => {
    if (capturedLinkState && !isLoading) {
      console.log("Triggering magic login for:", capturedLinkState);
      setLoading(true);

      // Clean the URL if it hasn't been cleaned yet
      if (window.location.search.includes('link_state')) {
        window.history.replaceState({}, '', window.location.pathname);
      }

      login({ state: capturedLinkState, useRedirect: true })
        .catch((err) => console.log("Universal login cancelled or failed", err))
        .finally(() => setLoading(false));
    }
  }, [capturedLinkState, isLoading, login, setLoading]);

  useEffect(() => {
    const performSync = async () => {
      if (!isLoading && isAuthenticated && user) {
        try {
          // Set initial OIDC state
          setUserInfo({
            ...user,
            role: user.scopes.length > 0 ? user.scopes : (user.roles || []),
            isAuthenticated: true
          });

          // Perform backend sync to get internal User object (with correct ID)
          const urlParams = new URLSearchParams(window.location.search);
          const state = urlParams.get('state') || undefined;

          const dbUser = await syncUser(state);

          setUserInfo((prev: any) => ({
            ...prev,
            ...dbUser,
            userId: dbUser.id, // Map database ID to userId
            role: dbUser.role ? [dbUser.role] : prev.role, // Use DB role if available
            isAuthenticated: true
          }));
        } catch (error) {
          console.error("Backend user sync failed", error);
        }
      } else if (!isLoading && !isAuthenticated) {
        setUserInfo(defaultUserInfo);
      }
    };
    performSync();
  }, [user, isAuthenticated, isLoading, setUserInfo]);

  useEffect(() => {
    router.update({
      context: {
        auth: { user: userInfo, hasRole }
      }
    } as any)
  }, [userInfo, hasRole]);

  return (
    <UserInfoContext.Provider value={{ userInfo, setUserInfo, hasRole }}>
      <ConfirmProvider defaultOptions={{
        confirmationButtonProps: { variant: 'contained' },
        cancellationButtonProps: { variant: 'outlined' },
      }}>
        {init && !isLoading && <RouterProvider router={router} context={{ auth: { user: userInfo, hasRole } }} />}
        <LoginPrompt />
      </ConfirmProvider>
    </UserInfoContext.Provider>
  );
}

function App() {
  const [userInfo, setUserInfo] = useState(defaultUserInfo)
  const [init, setInit] = useState(false)


  useEffect(() => {
    const token = localStorage.getItem("id_token");

    if (!token) {
      setInit(true)
      return
    }

    try {
      const decoded = jwtDecode<any>(token);
      const currentTime = Date.now() / 1000;
      if (decoded.exp < currentTime) {
        localStorage.removeItem("id_token");
      }
      setInit(true)
      setUserInfo(decoded);
    } catch (error) {
      console.error("Invalid token", error);
      localStorage.removeItem("id_token");
      setInit(true)
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BackdropLoaderProvider>
          <AuthProvider config={authConfig}>
            <AppContent userInfo={userInfo} setUserInfo={setUserInfo} init={init} />
          </AuthProvider>
        </BackdropLoaderProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;

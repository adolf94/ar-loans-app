import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { defaultUserInfo, UserInfoContext } from './components/useUserInfo';
import { BackdropLoaderProvider } from './components/BackdropLoader';
import LoginPrompt from './components/login/LoginPrompt';
import { ToastProvider, useToast, ConfirmProvider } from './components/ui';
import { jwtDecode } from 'jwt-decode'
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
  const { user, isAuthenticated, isLoading, hasScope, loginState } = useAuth();
  const toast = useToast();

  const hasRole = (roleAny: string[]) => {
    return roleAny.some(e => hasScope(e))
  }

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

          // Perform backend sync using recovered state (loginState) or manual session recovery
          const magicState = loginState || sessionStorage.getItem("magic_link_state");
          const dbUser = await syncUser(magicState || undefined);

          // If a state was provided, it means it was a magic link flow
          if (magicState) {
            toast("Account linked successfully");
            sessionStorage.removeItem("magic_link_state");
          }

          setUserInfo((prev: any) => ({
            ...prev,
            ...dbUser,
            userId: dbUser.id, // Map database ID to userId
            role: dbUser.role ? [dbUser.role] : prev.role, // Use DB role if available
            isAuthenticated: true
          }));
        } catch (error) {
          console.error("Backend user sync failed", error);
          if (loginState) {
            toast("Failed to link account", "error");
          }
        }
      } else if (!isLoading && !isAuthenticated) {
        setUserInfo(defaultUserInfo);
      }
    };
    performSync();
  }, [user, isAuthenticated, isLoading, setUserInfo, loginState]);

  useEffect(() => {
    router.update({
      context: {
        auth: { user: userInfo, hasRole }
      }
    } as any)
  }, [userInfo, hasRole]);

  return (
    <UserInfoContext.Provider value={{ userInfo, setUserInfo, hasRole }}>
      {init && !isLoading && <RouterProvider router={router} context={{ auth: { user: userInfo, hasRole } }} />}
      <LoginPrompt />
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
      <ToastProvider>
        <ConfirmProvider>
          <BackdropLoaderProvider>
            <AuthProvider config={authConfig}>
              <AppContent userInfo={userInfo} setUserInfo={setUserInfo} init={init} />
            </AuthProvider>
          </BackdropLoaderProvider>
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;

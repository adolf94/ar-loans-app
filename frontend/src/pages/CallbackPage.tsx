import React, { useEffect } from 'react';
import { useAuth } from '@adolf94/ar-auth-client';
import { useNavigate } from '@tanstack/react-router';
import useUserInfo from '../components/useUserInfo';
import { Spinner } from '../components/ui';

const CallbackPage: React.FC = () => {
    const { isAuthenticated, isLoading } = useAuth();
    const { userInfo } = useUserInfo();
    const navigate = useNavigate();

    useEffect(() => {
        // If we are in a popup, the AuthProvider's signinPopupCallback
        // will handle closing the window. This page just shows the processing state.
        if (window.opener) {
            return;
        }

        // If authenticated and the backend sync (in App.tsx) has finished
        if (!isLoading && isAuthenticated && userInfo.isAuthenticated) {
            const config = window.webConfig;
            const userRoles = userInfo.role || [];

            if (userRoles.includes(config.adminRole)) {
                navigate({ to: "/admin", replace: true });
            } else if (userRoles.includes(config.guarantorRole)) {
                navigate({ to: "/guarantor", replace: true });
            } else {
                navigate({ to: "/client", replace: true });
            }
        }
    }, [isAuthenticated, isLoading, userInfo.isAuthenticated, userInfo.role, navigate]);

    // Handle error state (e.g. login failed or cancelled)
    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            const timeout = setTimeout(() => {
                if (!isAuthenticated) {
                    navigate({ to: "/", replace: true });
                }
            }, 5000);
            return () => clearTimeout(timeout);
        }
    }, [isLoading, isAuthenticated, navigate]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
            <Spinner size={44} />
            <p className="text-sm text-silverdim tracking-wide">Processing login...</p>
        </div>
    );
};

export default CallbackPage;

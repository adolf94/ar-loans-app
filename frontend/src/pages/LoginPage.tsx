import React, { useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { getUserManager, useAuth } from '@adolf94/ar-auth-client';
import { Spinner } from '../components/ui';

const LoginPage: React.FC = () => {
    const { user, isAuthenticated, isLoading } = useAuth();
    const navigate = useNavigate();
    const attempted = useRef(false);

    useEffect(() => {
        if (isLoading) return;

        if (isAuthenticated && user) {
            const config = window.webConfig;
            const roles = user.scopes?.length ? user.scopes : (user.roles || []);

            if (roles.includes(config.adminRole)) {
                navigate({ to: "/admin" });
            } else if (roles.includes(config.guarantorRole)) {
                navigate({ to: "/guarantor" });
            } else {
                navigate({ to: "/client" });
            }
            return;
        }

        // No local login UI: hand the browser straight to the identity server.
        // One attempt per page load to avoid loops when auth fails.
        if (!attempted.current) {
            attempted.current = true;
            getUserManager().signinRedirect()
                .catch((err) => console.error('Login redirect failed:', err));
        }
    }, [isAuthenticated, isLoading, user, navigate]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
            <Spinner size={44} />
            <p className="text-sm text-silverdim tracking-wide">Redirecting to sign in...</p>
        </div>
    );
};

export default LoginPage;

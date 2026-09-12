import React, { useEffect, useState } from 'react';
import { useAuth } from '@adolf94/ar-auth-client';
import { Spinner } from '../components/ui';

const MagicLinkPage: React.FC = () => {
    const { login, isLoading: authLoading } = useAuth();
    const [initiated, setInitiated] = useState(false);

    const params = new URLSearchParams(window.location.search);
    const linkState = params.get('link_state');

    useEffect(() => {
        setInitiated(false);
    }, [linkState]);

    useEffect(() => {
        if (linkState && !authLoading && !initiated) {
            setInitiated(true);
            console.log("MagicLinkPage: Initiating redirect for state:", linkState);

            // Persist the state manually to ensure it survives redirects
            if (linkState) sessionStorage.setItem("magic_link_state", linkState);

            // Immediate redirect to OIDC provider
            // We use useRedirect: true to ensure a full page transition
            login({ state: linkState, useRedirect: true })
                .catch((err) => {
                    console.error("Magic login redirection failed:", err);
                    setInitiated(false);
                });
        }
    }, [authLoading, initiated, login, linkState]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
            <Spinner size={44} />
            <p className="text-sm text-silverdim tracking-wide">logging you in....</p>
        </div>
    );
};

export default MagicLinkPage;

import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@adolf94/ar-auth-client';
import { Button, Paper, Spinner } from '../ui';

const GoogleGlyph = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#DB4437" d="M12 11v3.6h5.1c-.5 2.4-2.5 3.9-5.1 3.6-2.9-.3-5-2.7-5-5.6s2.1-5.3 5-5.6c1.5-.2 3 .3 4.1 1.3l2.7-2.7C17.1.4 13.4-.4 13.9.2 9.6.9 6.4 4.6 6.4 9s3.2 8.1 7.5 8.7c4.9.7 9-2.7 9-7.7 0-.4 0-.7-.1-1H12z" transform="translate(2.5 -1)" />
    </svg>
);

const TelegramGlyph = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#0088cc" aria-hidden="true">
        <path d="M21.9 3.4 2.7 10.8c-1.3.5-1.3 1.3-.2 1.6l4.9 1.5 1.9 5.8c.2.7.4.9 1 .9.4 0 .6-.2 1-.5l2.4-2.3 4.9 3.6c.9.5 1.5.2 1.8-.8l3.2-15.1c.3-1.3-.5-1.9-1.9-2.1zM8.5 13.6l10.2-6.4c.5-.3 1-.1.6.2l-8.7 7.9-.3 3.1-1.8-5.2z" />
    </svg>
);

interface LoginProps {
    onLogin: (data: any, user: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
    const { login, user, isAuthenticated, accessToken } = useAuth();
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const handleLogin = async () => {
        setIsLoggingIn(true);
        try {
            await login();
        } catch (err) {
            console.error("Login failed:", err);
        } finally {
            setIsLoggingIn(false);
        }
    };

    // Fallback sync if needed, though App.tsx handles it
    useEffect(() => {
        if (isAuthenticated && user && accessToken) {
            onLogin({ access_token: accessToken }, user);
        }
    }, [isAuthenticated, user, accessToken, onLogin]);

    return (
        <div className="w-full max-w-sm dev">
            <Paper className="p-7 sm:p-8 text-center shadow-[0_20px_50px_rgba(0,0,0,.5)]">
                <div className="flex items-center justify-center gap-2.5">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#b97a15" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2" /></svg>
                    <span className="text-ink font-bold tracking-[0.28em] text-xl">LENDFLOW</span>
                </div>

                <p className="mt-5 font-semibold text-ink">Institutional grade micro-lending</p>
                <p className="mt-2 text-sm text-inksoft leading-relaxed">
                    Manage portfolios, read the room with AI, and keep the ledger clean — one platform, one light.
                </p>

                <Button
                    size="lg"
                    fullWidth
                    className="mt-6"
                    onClick={handleLogin}
                    loading={isLoggingIn}
                >
                    <span className="inline-flex items-center -space-x-1.5 mr-1">
                        <span className="w-6 h-6 rounded-full bg-paper border border-ink/20 grid place-items-center"><GoogleGlyph /></span>
                        <span className="w-6 h-6 rounded-full bg-paper border border-ink/20 grid place-items-center relative z-10"><TelegramGlyph /></span>
                        <span className="w-6 h-6 rounded-full bg-paper border border-ink/20 grid place-items-center text-inksoft"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2a7 7 0 0 1 7 7v3a7 7 0 0 1-14 0V9a7 7 0 0 1 7-7z" /><path d="M12 9v3a2 2 0 1 0 2 2" /><path d="M19 9h2M3 9h2" /></svg></span>
                    </span>
                    Sign in
                </Button>

                <div className="mt-5 flex items-center justify-center gap-1.5 text-inksoft">
                    <Sparkles size={14} />
                    <span className="text-xs font-semibold">Powered by Gemini 3 Flash</span>
                </div>
            </Paper>
        </div>
    );
};

export default Login;

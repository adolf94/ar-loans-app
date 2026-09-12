import React, { useEffect } from 'react';
import Login from '../components/login/Login';
import { useNavigate } from '@tanstack/react-router';
import { jwtDecode } from 'jwt-decode';

interface LoginPageProps {
    onLogin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ }) => {
    const navigate = useNavigate()

    const handlePostLogin = (token: string, user: any) => {
        const config = window.webConfig
        const userRoles = user.scopes && user.scopes.length > 0 ? user.scopes : (Array.isArray(user.role) ? user.role : [user.role || 'user']);

        if (userRoles.includes(config.adminRole)) {
            return navigate({ to: "/admin" })
        }
        if (userRoles.includes(config.guarantorRole)) {
            return navigate({ to: "/guarantor" })
        }
        return navigate({ to: "/client" })
    }

    useEffect(() => {
        const token = localStorage.getItem("id_token");
        const refreshToken = localStorage.getItem("refresh_token");

        // Only auto-login if both tokens exist
        if (refreshToken && token) {
            try {
                handlePostLogin(token, jwtDecode<any>(token));
            } catch (e) {
                console.error("Failed to decode token on mount", e);
                localStorage.removeItem("id_token");
                localStorage.removeItem("refresh_token");
            }
        }
    }, [])


    return (
        <div className="min-h-screen flex items-center justify-center px-6 py-12">
            <Login onLogin={handlePostLogin} />
        </div>
    );
};

export default LoginPage;

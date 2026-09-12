import React, { useEffect, useState } from 'react';
import { Shield, User as UserIcon, Briefcase, ChevronDown, Settings, LogOut } from 'lucide-react';
import type { UserRole } from '../@types/types';
import { useNavigate, useLocation } from '@tanstack/react-router';
import useUserInfo from './useUserInfo';
import { useAuth } from '@adolf94/ar-auth-client';
import { Avatar, Menu } from './ui';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const [role, setRole] = useState<UserRole>("Client");
    const navigate = useNavigate();
    const location = useLocation();
    const { userInfo, hasRole, setUserInfo } = useUserInfo()
    const { logout } = useAuth();
    const isSpecialPage = location.pathname === '/' || location.pathname === '/m' || location.pathname === '/callback';

    useEffect(() => {
        if (location.href.toLowerCase().startsWith("/admin")) setRole("Admin")
        if (location.href.toLowerCase().startsWith("/client")) setRole("Client")
        if (location.href.toLowerCase().startsWith("/guarantor")) setRole("Guarantor")
    }, [location])


    const handleRoleSelect = (role: UserRole) => {
        switch (role) {
            case 'Admin': navigate({ to: '/admin' }); break;
            case 'Client': navigate({ to: '/client' }); break;
            case 'Guarantor': navigate({ to: '/guarantor' }); break;
        }
    };

    const getRoleIcon = (r: UserRole) => {
        switch (r) {
            case 'Admin': return <Shield size={15} />;
            case 'Client': return <UserIcon size={15} />;
            case 'Guarantor': return <Briefcase size={15} />;
        }
    };

    const handleLogout = () => {
        logout();
        sessionStorage.removeItem("access_token")
        localStorage.removeItem("id_token")
        localStorage.removeItem("refresh_token")
        setUserInfo({
            userName: "",
            userId: "",
            isAuthenticated: false,
            role: [],
            name: ""
        });
        navigate({ to: "/" })
    }

    if (isSpecialPage) return <>{children}</>;

    return (
        <div className="min-h-screen">
            <header className="sticky top-0 z-30 backdrop-blur bg-bay/85 border-b border-line">
                <div className="max-w-7xl mx-auto px-5 sm:px-8 py-3 flex items-center gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffb224" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2" /></svg>
                        <span className="text-paper font-bold tracking-[0.28em]">LENDFLOW</span>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <Menu
                            align="right"
                            trigger={
                                <button className="flex items-center gap-2 text-sm font-medium px-3 py-1.5 border border-linestrong rounded-md text-silver hover:border-amberdeep hover:text-amber transition-colors" aria-label="Switch role">
                                    {getRoleIcon(role)}
                                    <span className="hidden sm:inline">{role}</span>
                                    <ChevronDown size={14} />
                                </button>
                            }
                            items={[
                                ...(hasRole([window.webConfig.adminRole]) ? [{ label: 'Admin', onClick: () => handleRoleSelect('Admin') }] : []),
                                { label: 'Borrower', onClick: () => handleRoleSelect('Client') },
                                ...(hasRole([window.webConfig.guarantorRole]) ? [{ label: 'Guarantor', onClick: () => handleRoleSelect('Guarantor') }] : []),
                            ]}
                        />
                        <Menu
                            align="right"
                            trigger={
                                <button className="flex items-center gap-1.5 p-1 rounded-md hover:bg-tray/70 transition-colors" aria-label="Account menu">
                                    <Avatar name={userInfo.name || 'U'} className="w-8 h-8" />
                                    <ChevronDown size={14} className="text-silverdim" />
                                </button>
                            }
                            items={[
                                { label: 'Account', onClick: () => window.open(window.webConfig.authority, "_blank") },
                                { label: 'Logout', onClick: handleLogout, divider: true },
                            ]}
                        />
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-5 sm:px-8 py-7 relative z-10">
                {children}
            </main>
        </div>
    );
};

export default Layout;

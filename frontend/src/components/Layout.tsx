import React, { useEffect } from 'react';
import {
    AppBar,
    Toolbar,
    Typography,
    Box,
    Container,
    IconButton,
    Menu,
    MenuItem,
    Avatar,
    Chip
} from '@mui/material';
import { Shield, User as UserIcon, Briefcase, ChevronDown } from 'lucide-react';
import { ArrowDropDown } from "@mui/icons-material"
import type { UserRole } from '../@types/types';
import { useNavigate, useLocation } from '@tanstack/react-router';
import useUserInfo from './useUserInfo';
import { useAuth } from '@adolf94/ar-auth-client';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const [userEl, setUserEl] = React.useState<null | HTMLElement>(null);
    const [role, setRole] = React.useState<UserRole>("Client");
    const navigate = useNavigate();
    const location = useLocation();
    const { userInfo, hasRole, setUserInfo } = useUserInfo()
    const { logout } = useAuth();
    const isLoginPage = location.pathname === '/';

    const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
        setUserEl(event.currentTarget);
    };

    const handleCloseMenu = () => {
        setAnchorEl(null);
    };

    useEffect(() => {
        if (location.href.toLowerCase().startsWith("/admin")) setRole("Admin")
        if (location.href.toLowerCase().startsWith("/client")) setRole("Client")
        if (location.href.toLowerCase().startsWith("/guarantor")) setRole("Guarantor")
    }, [location])


    const handleRoleSelect = (role: UserRole) => {
        handleCloseMenu();

        switch (role) {
            case 'Admin': navigate({ to: '/admin' }); break;
            case 'Client': navigate({ to: '/client' }); break;
            case 'Guarantor': navigate({ to: '/guarantor' }); break;
        }
    };

    const getRoleIcon = (role: UserRole) => {
        switch (role) {
            case 'Admin': return <Shield size={18} />;
            case 'Client': return <UserIcon size={18} />;
            case 'Guarantor': return <Briefcase size={18} />;
        }
    };

    const handleLogout = () => {
        setUserEl(null)
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


    const getRoleColor = (role: UserRole) => {
        switch (role) {
            case 'Admin': return 'primary';
            case 'Client': return 'info';
            case 'Guarantor': return 'secondary';
        }
    };

    if (isLoginPage) return <>{children}</>;

    return (
        <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: 'background.default' }}>
            <AppBar position="sticky" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', color: 'text.primary' }}>
                <Container maxWidth="xl">
                    <Toolbar disableGutters>
                        <Typography
                            variant="h5"
                            noWrap
                            component="div"
                            sx={{
                                flexGrow: 1,
                                fontWeight: 800,
                                letterSpacing: '-0.5px',
                                background: 'linear-gradient(45deg, #2563eb 30%, #7c3aed 90%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            LendFlow
                        </Typography>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Chip
                                label={role}
                                color={getRoleColor(role)}
                                icon={getRoleIcon(role) as React.ReactElement}
                                size="small"
                                variant="outlined"
                                onClick={handleOpenMenu}
                                deleteIcon={<ArrowDropDown />}
                                onDelete={handleOpenMenu}
                                sx={{ fontWeight: 600 }}
                            />
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <IconButton sx={{ p: 0 }} onClick={handleOpenUserMenu}>
                                    <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32, fontSize: '0.875rem' }}>
                                        {userInfo.name ? userInfo.name.charAt(0) : 'U'}
                                    </Avatar>
                                    <ChevronDown size={16} style={{ marginLeft: 4 }} />
                                </IconButton>
                                <Menu
                                    anchorEl={anchorEl}
                                    open={Boolean(anchorEl)}

                                    onClose={handleCloseMenu}
                                    PaperProps={{
                                        sx: { mt: 1, minWidth: 180, borderRadius: 2 }
                                    }}
                                >
                                    {hasRole([window.webConfig.adminRole]) && <MenuItem onClick={() => handleRoleSelect('Admin')}>
                                        <Shield size={16} style={{ marginRight: 8 }} /> Admin
                                    </MenuItem>}

                                    <MenuItem onClick={() => handleRoleSelect('Client')}>
                                        <UserIcon size={16} style={{ marginRight: 8 }} /> Borrower
                                    </MenuItem>
                                    {hasRole([window.webConfig.guarantorRole]) && <MenuItem onClick={() => handleRoleSelect('Guarantor')}>
                                        <Briefcase size={16} style={{ marginRight: 8 }} /> Guarantor
                                    </MenuItem>}
                                </Menu>
                                <Menu
                                    anchorEl={userEl}
                                    open={Boolean(userEl)}
                                    onClose={() => setUserEl(null)}>
                                    <MenuItem onClick={() => handleLogout()}>
                                        Logout
                                    </MenuItem>

                                </Menu>
                            </Box>
                        </Box>
                    </Toolbar>
                </Container>
            </AppBar>

            <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
                {children}
            </Container>
        </Box>
    );
};

export default Layout;

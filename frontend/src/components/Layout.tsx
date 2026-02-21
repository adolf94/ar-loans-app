import React from 'react';
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
import type { UserRole, User } from '../@types/types';
import { useNavigate, useLocation } from '@tanstack/react-router';

interface LayoutProps {
    children: React.ReactNode;
    currentUser: User;
    onRoleChange: (role: UserRole) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentUser, onRoleChange }) => {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const navigate = useNavigate();
    const location = useLocation();
    const isLoginPage = location.pathname === '/';

    const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleCloseMenu = () => {
        setAnchorEl(null);
    };

    const handleRoleSelect = (role: UserRole) => {
        onRoleChange(role);
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
                                label={currentUser.role}
                                color={getRoleColor(currentUser.role)}
                                icon={getRoleIcon(currentUser.role) as React.ReactElement}
                                size="small"
                                variant="outlined"
                                sx={{ fontWeight: 600 }}
                            />

                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <IconButton onClick={handleOpenMenu} sx={{ p: 0 }}>
                                    <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32, fontSize: '0.875rem' }}>
                                        {currentUser.name.charAt(0)}
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
                                    <MenuItem onClick={() => handleRoleSelect('Admin')}>
                                        <Shield size={16} style={{ marginRight: 8 }} /> Admin Perspective
                                    </MenuItem>
                                    <MenuItem onClick={() => handleRoleSelect('Client')}>
                                        <UserIcon size={16} style={{ marginRight: 8 }} /> Borrower Perspective
                                    </MenuItem>
                                    <MenuItem onClick={() => handleRoleSelect('Guarantor')}>
                                        <Briefcase size={16} style={{ marginRight: 8 }} /> Guarantor Perspective
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

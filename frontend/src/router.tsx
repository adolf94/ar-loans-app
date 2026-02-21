import {
    createRootRoute,
    createRoute,
    createRouter,
    Outlet,
    redirect
} from '@tanstack/react-router';
import AdminDashboard from './pages/AdminDashboard';
import ClientDashboard from './pages/ClientDashboard';
import GuarantorDashboard from './pages/GuarantorDashboard';
import LoginPage from './pages/LoginPage';
import Layout from './components/Layout';
import { mockUsers } from './mockData';
import { useState } from 'react';
import type { UserRole, User } from './@types/types';
import { getTokenViaRefreshToken } from './services/api';

// Root component that handles state and layout wrapper
const Root = () => {
    const [currentUser, setCurrentUser] = useState<User>(mockUsers[0]);

    const handleRoleChange = (role: UserRole) => {
        const userWithRole = mockUsers.find(u => u.role === role) || mockUsers[0];
        setCurrentUser({ ...userWithRole, role });
    };


    

    return (
        <Layout currentUser={currentUser} onRoleChange={handleRoleChange}>
            <Outlet />
        </Layout>
    );
};

// Define the root route
const rootRoute = createRootRoute({
    component: Root,

});

// Define individual routes
const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <LoginPage onLogin={() => { router.navigate({ to: '/admin' }); }} />,
});

const adminRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/admin',
    beforeLoad: (ctx)=>{
        if(!ctx.context.auth.hasRole(["COOP_ADMIN"])){
            throw redirect({to:"/client"})
        }
    },
    component: AdminDashboard,
});

const clientRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/client',
    component: ClientDashboard,
});

const guarantorRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/guarantor',
    beforeLoad: (ctx)=>{
        if(!ctx.context.auth.hasRole(["COOP_GUARANTOR"])){
            throw redirect({to:"/client"})
        }
    },
    component: GuarantorDashboard,
});

// Create the router instance
const routeTree = rootRoute.addChildren([indexRoute, adminRoute, clientRoute, guarantorRoute]);

export const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router;
    }
}

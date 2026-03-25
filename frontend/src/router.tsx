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
import ClientStatementPage from './pages/ClientStatementPage';

// Root component that handles state and layout wrapper
const Root = () => {


    return (
        <Layout>
            <Outlet />
        </Layout>
    );
};

// Define the root route
const rootRoute = createRootRoute({
    component: Root,
    context: () => ({} as {
        auth: {
            user: any;
            hasRole: (roles: string[]) => boolean;
        }
    })
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
    beforeLoad: (ctx) => {
        if (!ctx.context.auth.hasRole([window.webConfig.adminRole])) {
            throw redirect({ to: "/client" })
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
    beforeLoad: (ctx) => {
        if (!ctx.context.auth.hasRole([window.webConfig.guarantorRole])) {
            throw redirect({ to: "/client" })
        }
    },
    component: GuarantorDashboard,
});

const clientStatementRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/client-statement/$clientId',
    component: ClientStatementPage,
});

// Create the router instance
const routeTree = rootRoute.addChildren([
    indexRoute,
    adminRoute,
    clientRoute,
    guarantorRoute,
    clientStatementRoute
]);

export const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router;
    }
}

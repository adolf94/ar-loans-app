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
import CallbackPage from './pages/CallbackPage';
import MagicLinkPage from './pages/MagicLinkPage';
import NewLoanPage from './pages/NewLoanPage';
import NewPaymentPage from './pages/NewPaymentPage';
import NewEntryPage from './pages/NewEntryPage';
import IngestPage from './pages/IngestPage';

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
    component: () => <LoginPage />,
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

const callbackRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/callback',
    component: CallbackPage,
});

const magicRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/m',
    component: MagicLinkPage,
});

const ingestionSearch = (search: Record<string, unknown>) => ({
    ingestion_id: typeof search.ingestion_id === 'string' ? search.ingestion_id : undefined,
});

const adminGuard = (ctx: { context: { auth: { hasRole: (roles: string[]) => boolean } } }) => {
    if (!ctx.context.auth.hasRole([window.webConfig.adminRole])) {
        throw redirect({ to: "/client" })
    }
};

const newLoanRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/loans/new',
    beforeLoad: adminGuard,
    validateSearch: ingestionSearch,
    component: NewLoanPage,
});

const newPaymentRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/payments/new',
    beforeLoad: adminGuard,
    validateSearch: ingestionSearch,
    component: NewPaymentPage,
});

const newEntryRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/entries/new',
    beforeLoad: adminGuard,
    validateSearch: ingestionSearch,
    component: NewEntryPage,
});

const ingestRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/finance/ingest',
    beforeLoad: adminGuard,
    validateSearch: ingestionSearch,
    component: IngestPage,
});

// Create the router instance
const routeTree = rootRoute.addChildren([
    indexRoute,
    adminRoute,
    clientRoute,
    guarantorRoute,
    callbackRoute,
    magicRoute,
    newLoanRoute,
    newPaymentRoute,
    newEntryRoute,
    ingestRoute,
    clientStatementRoute
]);

export const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router;
    }
}

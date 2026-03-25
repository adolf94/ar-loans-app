export { };

declare global {
    interface Window {
        webConfig: {
            apiUrl: string;
            authUrl: string;
            authority: string;
            clientId: string;
            apiClientId: string;
            scope: string;
            redirectUri: string;
            adminRole: string;
            guarantorRole: string;
            defaultLoanTemplate: string;
            allowAccountCreation?: boolean;
        };
    }
    const webConfig: {
        apiUrl: string;
        authUrl: string;
        authority: string;
        clientId: string;
        scope: string;
        redirectUri: string;
        adminRole: string;
        guarantorRole: string;
        defaultLoanTemplate: string;
        allowAccountCreation?: boolean;
    };
}

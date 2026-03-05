export { };

declare global {
    interface Window {
        webConfig: {
            apiUrl: string;
            authUrl: string;
            adminRole: string;
            guarantorRole: string;
        defaultLoanTemplate:string;
        };
    }
    const webConfig: {
        apiUrl: string;
        authUrl: string;
        adminRole: string;
        guarantorRole: string;
        defaultLoanTemplate:string;
    };
}

export { };

declare global {
    interface Window {
        webConfig: {
            apiUrl: string;
            authUrl: string;
        };
    }
    const webConfig: {
        apiUrl: string;
        authUrl: string;
    };
}

webConfig = {
    apiUrl: "http://localhost:7239/api",
    authUrl: "https://auth.adolfrey.com/api/",
    authority: "https://auth.adolfrey.com/api",
    clientId: "ar-loans-app",
    apiClientId: "ar-loans-api",
    scope: "openid profile email api://ar-loans-api/admin api://ar-loans-api/guarantor",
    "redirectUri": "https://localhost:5173/callback",
    "adminRole": "api://ar-loans-api/admin",
    "guarantorRole": "api://ar-loans-api/guarantor",
    defaultLoanTemplate: "019cf9a0-ded3-73ae-bb7d-c14d9d24560e",
    allowAccountCreation: true,
    enableFinanceIntegration: true
}
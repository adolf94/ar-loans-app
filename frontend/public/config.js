webConfig = {
    apiUrl: "http://localhost:7239/api",
    authUrl: "http://localhost:7239/api/",
    authority: "https://auth.adolfrey.com/api",
    clientId: "ar-loans-app",
    apiClientId: "ar-loans-api",
    scope: "openid profile email api://ar-loans-api/admin api://ar-loans-api/guarantor",
    "redirectUri": "https://localhost:5173",
    "adminRole": "api://ar-loans-api/admin",
    "guarantorRole": "api://ar-loans-api/guarantor",
    defaultLoanTemplate: "019cbbab-e1dd-7e68-b501-f2962425d11d",
    allowAccountCreation: true
}
import React, { useContext } from "react";


export const defaultUserInfo = {
    userName: "",
    userId: "",
    isAuthenticated: false,
    role: [] as string[],
    scopes: [] as string[],
    name: "",
    picture: "",
    profile: ""
}
export const UserInfoContext = React.createContext({
    userInfo: defaultUserInfo,
    setUserInfo: (data: any) => { },
    hasRole: (data: string[]): boolean => false
})


const useUserInfo = () => {
    const { userInfo, setUserInfo, hasRole } = useContext(UserInfoContext)


    return { userInfo, setUserInfo , hasRole }

}
export default useUserInfo
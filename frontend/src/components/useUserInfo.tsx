import React, { useContext } from "react";


export const defaultUserInfo = {
    userName: "",
    userId: "",
    isAuthenticated: false,
    role: [] as string[],
    scopes: [] as string[],
    name: ""
}
export const UserInfoContext = React.createContext({
    userInfo: defaultUserInfo,
    setUserInfo: (data) => { },
    hasRole : (data : string[])=>true
})


const useUserInfo = () => {
    const { userInfo, setUserInfo, hasRole } = useContext(UserInfoContext)


    return { userInfo, setUserInfo , hasRole }

}
export default useUserInfo
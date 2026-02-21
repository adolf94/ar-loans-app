import { Backdrop, CircularProgress } from "@mui/material"
import React, { useContext, useState } from "react"

const BackdropLoaderContext = React.createContext<[boolean, any]>([false, ()=>{}] )

const BackdropLoader = ()=>{



    return <Backdrop
    open
    sx={(theme) => ({ color: '#fff', zIndex: theme.zIndex.drawer + 1 })}
    >
        <CircularProgress color="inherit" />
    </Backdrop>
}
export var setBackdropLoading = (a)=>{}

export const BackdropLoaderProvider = ({children})=>{
    const [loading,setLoading] = useState(false)
    setBackdropLoading = setLoading

    
    
    return <BackdropLoaderContext.Provider value={[loading,setLoading]}>
            {!loading?null:
                <Backdrop
                    open
                    sx={(theme) => ({ color: '#fff', zIndex: theme.zIndex.drawer + 1 })}
                >
                    <CircularProgress color="inherit" />
                </Backdrop>
            }
            {children}
        </BackdropLoaderContext.Provider>
}

export const useBackdropLoader = ()=>{
    const ctx = useContext(BackdropLoaderContext)
    return ctx[1]
}
export default BackdropLoader
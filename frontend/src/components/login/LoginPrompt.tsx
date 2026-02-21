import { useCallback, useState } from "react";
import Login from "./Login";
import { Modal } from "@mui/material";
import { setBackdropLoading, useBackdropLoader } from "../BackdropLoader";


export var showLogin = ()=>{
    return new Promise((resolve)=>resolve(""))
}


const LoginPrompt = ()=>{
    const [show,setShow] = useState(false)
    const [promise, setPromise] = useState<{ resolve: (token: string | null) => void } | null>(null);
    const setLoading = useBackdropLoader()

    const promptLogin = useCallback((): Promise<string | null> => {
        setShow(true);
        // Retain previous credentials for quick testing, but clear password
        // Create and return the Promise that will be awaited by the interceptor
        return new Promise((resolve) => {
            setPromise({ resolve });
        });
    }, []);
    showLogin = promptLogin

    const onComplete = (data: any)=>{
        setShow(false)
        setBackdropLoading(false)
        promise!.resolve(data.access_token)
    }


    return <Modal open={show} sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'}}>
        <Login onLogin={onComplete}/>
    </Modal>
    
}

export default LoginPrompt
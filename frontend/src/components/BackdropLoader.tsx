import React, { useContext, useState } from "react"
import { Spinner } from "./ui"

const BackdropLoaderContext = React.createContext<[boolean, any]>([false, () => {}])

export var setBackdropLoading = (a: boolean) => {}

export const BackdropLoaderProvider = ({ children }: { children: React.ReactNode }) => {
    const [loading, setLoading] = useState(false)
    setBackdropLoading = setLoading

    return <BackdropLoaderContext.Provider value={[loading, setLoading]}>
        {loading && (
            <div className="fixed inset-0 z-[70] bg-bay/85 backdrop-blur-sm grid place-items-center">
                <Spinner size={36} />
            </div>
        )}
        {children}
    </BackdropLoaderContext.Provider>
}

export const useBackdropLoader = () => {
    const ctx = useContext(BackdropLoaderContext)
    return ctx[1]
}

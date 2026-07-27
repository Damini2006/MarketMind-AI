import { createContext, useState } from "react";


// Create Context
const AuthContext = createContext();


export function AuthProvider({children}){


    const [user,setUser] = useState(null);



    // Login Function
    const login = (userData)=>{

        setUser(userData);

        localStorage.setItem(
            "user",
            JSON.stringify(userData)
        );

    };



    // Logout Function
    const logout = ()=>{

        setUser(null);

        localStorage.removeItem("user");

    };



    const value = {

        user,

        login,

        logout,

        isAuthenticated: !!user

    };



    return(

        <AuthContext.Provider value={value}>

            {children}

        </AuthContext.Provider>

    );

}


export default AuthContext;
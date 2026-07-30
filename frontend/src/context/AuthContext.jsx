import {
  createContext,
  useState,
} from "react";


const AuthContext = createContext();


export function AuthProvider({
  children,
}) {


  const [user, setUser] = useState(() => {

    const savedUser =
      localStorage.getItem("user");

    if(savedUser){

      try {
        return JSON.parse(savedUser);
      }

      catch(error){

        console.error(
          "Error loading user:",
          error
        );

        localStorage.removeItem("user");

        return null;
      }

    }

    return null;

  });



  const [token, setToken] = useState(() => {

    return localStorage.getItem("token") || null;

  });



  // Login
  // Receives response from FastAPI
  const login = (authData) => {


    const userData =
      authData.user;


    const accessToken =
      authData.token;


    setUser(userData);

    setToken(accessToken);



    localStorage.setItem(
      "user",
      JSON.stringify(userData)
    );


    localStorage.setItem(
      "token",
      accessToken
    );

  };



  // Logout
  const logout = () => {


    setUser(null);

    setToken(null);


    localStorage.removeItem(
      "user"
    );


    localStorage.removeItem(
      "token"
    );

  };



  const value = {

    user,

    token,

    login,

    logout,

    isAuthenticated:
      !!user && !!token,

  };



  return (

    <AuthContext.Provider
      value={value}
    >

      {children}

    </AuthContext.Provider>

  );

}


export default AuthContext;
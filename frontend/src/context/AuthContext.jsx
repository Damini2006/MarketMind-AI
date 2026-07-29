import {
  createContext,
  useEffect,
  useState,
} from "react";

const AuthContext = createContext();

export function AuthProvider({
  children,
}) {
  const [user, setUser] =
    useState(null);

  const [token, setToken] =
    useState(null);

  // Load saved authentication
  // data when application starts
  useEffect(() => {
    const savedUser =
      localStorage.getItem("user");

    const savedToken =
      localStorage.getItem("token");

    if (
      savedUser &&
      savedToken
    ) {
      try {
        setUser(
          JSON.parse(savedUser)
        );

        setToken(savedToken);

      } catch (error) {
        console.error(
          "Error loading authentication data:",
          error
        );

        localStorage.removeItem(
          "user"
        );

        localStorage.removeItem(
          "token"
        );
      }
    }
  }, []);

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
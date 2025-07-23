import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
    isLoggedIn: boolean;
    login: (usr: string, pwd: string) => Promise<boolean>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        const checkUserSession = async () => {
            try {
                const response = await fetch('http://103.219.1.138:4430/api/method/frappe.auth.get_logged_user', {
                    method: 'GET',
                    credentials: 'include',
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.message && data.message !== 'Guest') {
                        setIsLoggedIn(true);
                    }
                }
            } catch (error) {
                console.error('Session check failed:', error);
            }
        };

        checkUserSession();
    }, []);

    const login = async (usr: string, pwd: string) => {
        try {
            const response = await fetch('http://103.219.1.138:4430/api/method/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ usr, pwd }),
                credentials: 'include',
            });

            if (response.ok) {
                setIsLoggedIn(true);
                return true;
            } else {
                setIsLoggedIn(false);
                return false;
            }
        } catch (error) {
            console.error('Login failed:', error);
            setIsLoggedIn(false);
            return false;
        }
    };

    const logout = async () => {
        try {
            await fetch('http://103.219.1.138:4430/api/method/logout', {
                method: 'POST',
                credentials: 'include',
            });
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            setIsLoggedIn(false);
        }
    };

    const auth = { isLoggedIn, login, logout };

    return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuthContext must be used within an AuthProvider');
    }
    return context;
};

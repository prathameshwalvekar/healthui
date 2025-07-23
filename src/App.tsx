import React from 'react';
import Sales from './Components/Sales';
import Login from './Components/Login';
import { useAuthContext } from './Components/AuthContext';

const App: React.FC = () => {
  const { isLoggedIn, logout } = useAuthContext();

  return (
    <div>
      {isLoggedIn ? (
        <>
          <button onClick={logout}>Logout</button>
          <Sales />
        </>
      ) : (
        <Login />
      )}
    </div>
  );
};

export default App;
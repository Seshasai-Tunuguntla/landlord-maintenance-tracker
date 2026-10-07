import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { AuthContext } from './useAuth';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // The login cookie is invisible to page code, so ask the server who (if anyone) is logged in.
  useEffect(() => {
    localStorage.removeItem('token'); // left over from before the cookie switch
    api
      .me()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const data = await api.login({ email, password });
    setUser(data.user);
  }

  async function register(name, email, password, role) {
    const data = await api.register({ name, email, password, role });
    setUser(data.user);
  }

  async function logout() {
    await api.logout().catch(() => {});
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

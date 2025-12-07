
import React, { useState } from 'react';
import { UserData } from '../App';
import { useLanguage } from './LanguageContext';

interface LoginScreenProps {
  onLoginSuccess: (username: string, role: 'ADMIN' | 'USER' | 'SUPERVISOR' | 'LEADER' | 'LOGISTICIAN') => void;
  users: UserData[];
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, users }) => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const { t } = useLanguage();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedInputUsername = username.trim().toUpperCase();
    
    // Find user in the passed users prop
    const foundUser = users.find(u => u.username.toUpperCase() === normalizedInputUsername);

    if (foundUser && foundUser.password === password) {
      setError('');
      // Use the username from the record to preserve casing, or just the input
      onLoginSuccess(foundUser.username, foundUser.role);
    } else {
      setError(t('login_error'));
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-4">
      <div className="w-full p-6 sm:p-8 space-y-6 sm:space-y-8 bg-gray-800 rounded-xl shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-teal-400 mb-2">
            {t('login_title')}
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            {t('login_subtitle')}
          </p>
        </div>
        <form className="mt-6 sm:mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="username" className="sr-only">{t('username')}</label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                autoFocus
                className={`appearance-none rounded-none rounded-t-md relative block w-full px-3 py-3 border placeholder-gray-500 text-white bg-gray-700 focus:outline-none focus:ring-teal-500 focus:border-teal-500 focus:z-10 text-base sm:text-sm ${error ? 'border-red-500' : 'border-gray-600'}`}
                placeholder={t('username')}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError('');
                }}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">{t('password')}</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className={`appearance-none rounded-none rounded-b-md relative block w-full px-3 py-3 border placeholder-gray-500 text-white bg-gray-700 focus:outline-none focus:ring-teal-500 focus:border-teal-500 focus:z-10 text-base sm:text-sm ${error ? 'border-red-500' : 'border-gray-600'}`}
                placeholder={t('password')}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-teal-500 transition-colors duration-200"
            >
              {t('login_btn')}
            </button>
          </div>
        </form>
      </div>
      
      {/* Footer Credit */}
      <div className="mt-8 text-center text-xs text-gray-500 opacity-60">
          <p>{t('created_by')}</p>
          <p className="mt-1">© {new Date().getFullYear()}</p>
      </div>
    </div>
  );
};

export default LoginScreen;

import React from 'react';
import { Button } from '@/components/ui/button';

const Login = () => {
  const handleLogin = () => {
    window.location.href = '/api/linkedin/auth';
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <Button onClick={handleLogin}>Sign In with LinkedIn</Button>
    </div>
  );
};

export default Login;

import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Stack,
} from '@mui/material';
import { GitHub, Security } from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(`GitHub OAuth error: ${errorParam}`);
      return;
    }

    if (code) {
      handleOAuthCallback(code, state);
    }
  }, [searchParams]);

  const handleOAuthCallback = async (code: string, state: string | null) => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('/api/auth/callback', {
        code,
        state,
      });

      if (response.data.success) {
        login(response.data.token);
      } else {
        setError('Authentication failed. Please try again.');
      }
    } catch (error: any) {
      console.error('OAuth callback error:', error);
      setError(
        error.response?.data?.error || 
        'Authentication failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubLogin = () => {
    setLoading(true);
    setError(null);
    
    // Redirect to GitHub OAuth
    window.location.href = '/api/auth/github';
  };

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'background.default',
        }}
      >
        <Card sx={{ p: 4, maxWidth: 400, width: '100%', textAlign: 'center' }}>
          <CardContent>
            <CircularProgress size={40} sx={{ mb: 2 }} />
            <Typography variant="h6">
              Connecting to GitHub...
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Please wait while we authenticate your account.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.02) 1px, transparent 0)',
        backgroundSize: '20px 20px',
      }}
    >
      <Container maxWidth="sm">
        <Card
          sx={{
            p: 4,
            backgroundColor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 3,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          }}
        >
          <CardContent sx={{ textAlign: 'center' }}>
            {/* Logo and Brand */}
            <Box sx={{ mb: 4 }}>
              <Security
                sx={{
                  fontSize: 64,
                  color: 'primary.main',
                  mb: 2,
                }}
              />
              <Typography
                variant="h3"
                component="h1"
                sx={{ fontWeight: 700, mb: 1 }}
              >
                Asfalis Security
              </Typography>
              <Typography
                variant="h6"
                color="text.secondary"
                sx={{ fontWeight: 400 }}
              >
                Automated Security Scanning for GitHub Repositories
              </Typography>
            </Box>

            {/* Features List */}
            <Box sx={{ mb: 4, textAlign: 'left' }}>
              <Typography variant="h6" sx={{ mb: 2, textAlign: 'center' }}>
                Why Choose Asfalis?
              </Typography>
              <Stack spacing={2}>
                {[
                  'Real-time security scanning on every push',
                  'Integration with popular security tools',
                  'Comprehensive vulnerability detection',
                  'Clean, intuitive dashboard',
                  'GitHub webhook automation',
                ].map((feature, index) => (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: 'primary.main',
                      }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {feature}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>

            {/* Error Display */}
            {error && (
              <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
                {error}
              </Alert>
            )}

            {/* Login Button */}
            <Button
              variant="contained"
              size="large"
              startIcon={<GitHub />}
              onClick={handleGitHubLogin}
              disabled={loading}
              sx={{
                py: 1.5,
                px: 4,
                fontSize: '1.1rem',
                fontWeight: 600,
                borderRadius: 2,
                textTransform: 'none',
                width: '100%',
                backgroundColor: '#24292e',
                '&:hover': {
                  backgroundColor: '#1c1f23',
                },
              }}
            >
              Continue with GitHub
            </Button>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 3, display: 'block', lineHeight: 1.5 }}
            >
              By continuing, you agree to grant Asfalis access to your GitHub repositories
              for security scanning purposes. We only read your code to perform security analysis.
            </Typography>
          </CardContent>
        </Card>

        {/* Footer */}
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Typography variant="body2" color="text.secondary">
            Made with ❤️ by the Asfalis Security Team
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default Login;

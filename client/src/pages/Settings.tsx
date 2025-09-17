import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  Button,
  Alert,
  Divider,
  Avatar,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
} from '@mui/material';
import {
  Person,
  Notifications,
  Security,
  GitHub,
  Email,
  Save,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const Settings: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [settings, setSettings] = useState({
    emailNotifications: user?.settings?.emailNotifications ?? true,
    scanOnPush: user?.settings?.scanOnPush ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSettingsChange = (setting: keyof typeof settings) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setSettings(prev => ({
      ...prev,
      [setting]: event.target.checked,
    }));
  };

  const handleSaveSettings = async () => {
    try {
      setLoading(true);
      setMessage(null);

      await axios.put('/api/auth/settings', settings);
      
      updateUser({ settings });
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error: any) {
      console.error('Failed to save settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          Settings
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your account preferences and security scanning configuration
        </Typography>
      </Box>

      {/* Message Alert */}
      {message && (
        <Alert 
          severity={message.type} 
          sx={{ mb: 3 }}
          onClose={() => setMessage(null)}
        >
          {message.text}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Profile Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Person sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Profile Information</Typography>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Avatar
                  src={user?.avatarUrl}
                  alt={user?.username}
                  sx={{ width: 80, height: 80, mr: 3 }}
                >
                  {user?.username?.charAt(0).toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    {user?.username}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {user?.email}
                  </Typography>
                  <Chip
                    icon={<GitHub />}
                    label={`GitHub ID: ${user?.githubId}`}
                    size="small"
                    variant="outlined"
                  />
                </Box>
              </Box>

              <Button
                variant="outlined"
                startIcon={<GitHub />}
                onClick={() => window.open(`https://github.com/${user?.username}`, '_blank')}
                fullWidth
              >
                View GitHub Profile
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Notification Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Notifications sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Notification Settings</Typography>
              </Box>
              
              <List>
                <ListItem>
                  <ListItemIcon>
                    <Email />
                  </ListItemIcon>
                  <ListItemText
                    primary="Email Notifications"
                    secondary="Receive email alerts for security scan results and important updates"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.emailNotifications}
                        onChange={handleSettingsChange('emailNotifications')}
                        color="primary"
                      />
                    }
                    label=""
                  />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemIcon>
                    <Security />
                  </ListItemIcon>
                  <ListItemText
                    primary="Automatic Scanning"
                    secondary="Automatically trigger security scans when code is pushed to monitored branches"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.scanOnPush}
                        onChange={handleSettingsChange('scanOnPush')}
                        color="primary"
                      />
                    }
                    label=""
                  />
                </ListItem>
              </List>

              <Box sx={{ mt: 3 }}>
                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={handleSaveSettings}
                  disabled={loading}
                  fullWidth
                >
                  {loading ? 'Saving...' : 'Save Settings'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Security Information */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Security sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Security & Privacy</Typography>
              </Box>
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 2, backgroundColor: 'background.paper', borderRadius: 1 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                      Data Access
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Asfalis Security only accesses your repository code for security scanning purposes. 
                      We do not store your source code permanently.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Permissions:</strong> Repository access, webhook management, user profile
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 2, backgroundColor: 'background.paper', borderRadius: 1 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                      Data Retention
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Scan results and metadata are stored to provide historical analysis and trends. 
                      Raw code is processed in memory and not persisted.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Retention:</strong> Scan results (90 days), Account data (until deletion)
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              <Alert severity="info" sx={{ mt: 3 }}>
                <Typography variant="body2">
                  To revoke access or delete your account, you can remove the Asfalis application 
                  from your GitHub settings or contact us at support@asfalis.com
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        {/* Application Info */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                About Asfalis Security Scanner
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Version 1.0.0 - Built with modern security scanning tools and best practices.
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Chip label="React + TypeScript" variant="outlined" />
                <Chip label="Node.js + Express" variant="outlined" />
                <Chip label="MongoDB" variant="outlined" />
                <Chip label="Semgrep Integration" variant="outlined" />
                <Chip label="GitHub API" variant="outlined" />
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Made with ❤️ by the Asfalis Security Team
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Settings;

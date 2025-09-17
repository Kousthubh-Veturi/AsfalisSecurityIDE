import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Divider,
} from '@mui/material';
import {
  Repository,
  GitHub,
  PlayArrow,
  Stop,
  Settings as SettingsIcon,
  Branch,
  Visibility,
  Security,
  Lock,
  Public,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface GitHubRepo {
  githubId: number;
  name: string;
  fullName: string;
  description?: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  language?: string;
  updatedAt: string;
  isMonitored: boolean;
  monitoredBranches: Array<{
    name: string;
    enabled: boolean;
    lastScannedCommit?: string;
  }>;
  scanSettings?: {
    enabledRules: string[];
    severityThreshold: string;
    excludePatterns: string[];
  };
}

interface Branch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

const Repositories: React.FC = () => {
  const navigate = useNavigate();
  const [repositories, setRepositories] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [scanSettings, setScanSettings] = useState({
    severityThreshold: 'medium',
    enabledRules: ['security', 'best-practices'],
    excludePatterns: ['node_modules/**', '*.test.js', '*.spec.js'],
  });

  useEffect(() => {
    loadRepositories();
  }, []);

  const loadRepositories = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get('/api/repositories');
      setRepositories(response.data);
    } catch (error: any) {
      console.error('Failed to load repositories:', error);
      setError('Failed to load repositories. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadBranches = async (repoId: number) => {
    try {
      const response = await axios.get(`/api/repositories/${repoId}/branches`);
      setAvailableBranches(response.data);
    } catch (error: any) {
      console.error('Failed to load branches:', error);
      setError('Failed to load branches for this repository.');
    }
  };

  const handleSetupMonitoring = async (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    setSelectedBranches(repo.monitoredBranches.map(b => b.name));
    if (repo.scanSettings) {
      setScanSettings(repo.scanSettings);
    }
    await loadBranches(repo.githubId);
    setSetupDialogOpen(true);
  };

  const handleStartMonitoring = async () => {
    if (!selectedRepo || selectedBranches.length === 0) return;

    try {
      await axios.post(`/api/repositories/${selectedRepo.githubId}/monitor`, {
        branches: selectedBranches,
        scanSettings,
      });
      
      setSetupDialogOpen(false);
      await loadRepositories(); // Refresh the list
    } catch (error: any) {
      console.error('Failed to start monitoring:', error);
      setError('Failed to start monitoring. Please try again.');
    }
  };

  const handleStopMonitoring = async (repo: GitHubRepo) => {
    try {
      await axios.delete(`/api/repositories/${repo.githubId}/monitor`);
      await loadRepositories(); // Refresh the list
    } catch (error: any) {
      console.error('Failed to stop monitoring:', error);
      setError('Failed to stop monitoring. Please try again.');
    }
  };

  const handleTriggerScan = async (repo: GitHubRepo) => {
    if (!repo.monitoredBranches.length) return;

    try {
      const branch = repo.monitoredBranches[0].name; // Use first monitored branch
      const response = await axios.post('/api/scans/trigger', {
        repositoryId: repo.githubId,
        branch,
      });
      
      if (response.data.success) {
        navigate(`/scan/${response.data.scanId}`);
      }
    } catch (error: any) {
      console.error('Failed to trigger scan:', error);
      setError('Failed to trigger scan. Please try again.');
    }
  };

  if (loading) {
    return (
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading repositories...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          Repositories
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your GitHub repositories and configure security monitoring
        </Typography>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Repository Grid */}
      <Grid container spacing={3}>
        {repositories.length === 0 ? (
          <Grid item xs={12}>
            <Alert severity="info">
              No repositories found. Make sure you have repositories in your GitHub account
              and that Asfalis has permission to access them.
            </Alert>
          </Grid>
        ) : (
          repositories.map((repo) => (
            <Grid item xs={12} sm={6} lg={4} key={repo.githubId}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  border: repo.isMonitored ? 2 : 1,
                  borderColor: repo.isMonitored ? 'primary.main' : 'divider',
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  {/* Repository Header */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                    <Repository sx={{ mr: 1, mt: 0.5, color: 'text.secondary' }} />
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="h6" noWrap>
                        {repo.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {repo.fullName}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                      {repo.private ? (
                        <Lock sx={{ fontSize: 16, color: 'text.secondary' }} />
                      ) : (
                        <Public sx={{ fontSize: 16, color: 'text.secondary' }} />
                      )}
                      <Chip
                        label={repo.isMonitored ? 'Monitored' : 'Available'}
                        color={repo.isMonitored ? 'primary' : 'default'}
                        size="small"
                      />
                    </Box>
                  </Box>

                  {/* Repository Description */}
                  {repo.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mb: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {repo.description}
                    </Typography>
                  )}

                  {/* Repository Details */}
                  <Box sx={{ mb: 2 }}>
                    {repo.language && (
                      <Chip
                        label={repo.language}
                        size="small"
                        variant="outlined"
                        sx={{ mr: 1, mb: 1 }}
                      />
                    )}
                    <Chip
                      label={`Default: ${repo.defaultBranch}`}
                      size="small"
                      variant="outlined"
                      icon={<Branch />}
                      sx={{ mr: 1, mb: 1 }}
                    />
                  </Box>

                  {/* Monitored Branches */}
                  {repo.isMonitored && repo.monitoredBranches.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        Monitored branches:
                      </Typography>
                      <Box sx={{ mt: 0.5 }}>
                        {repo.monitoredBranches.map((branch) => (
                          <Chip
                            key={branch.name}
                            label={branch.name}
                            size="small"
                            color="primary"
                            variant={branch.enabled ? 'filled' : 'outlined'}
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </CardContent>

                {/* Action Buttons */}
                <Box sx={{ p: 2, pt: 0 }}>
                  {repo.isMonitored ? (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<PlayArrow />}
                        onClick={() => handleTriggerScan(repo)}
                        sx={{ flexGrow: 1 }}
                      >
                        Scan Now
                      </Button>
                      <IconButton
                        onClick={() => handleSetupMonitoring(repo)}
                        size="small"
                      >
                        <SettingsIcon />
                      </IconButton>
                      <IconButton
                        onClick={() => handleStopMonitoring(repo)}
                        size="small"
                        color="error"
                      >
                        <Stop />
                      </IconButton>
                    </Box>
                  ) : (
                    <Button
                      variant="outlined"
                      startIcon={<Security />}
                      onClick={() => handleSetupMonitoring(repo)}
                      fullWidth
                    >
                      Start Monitoring
                    </Button>
                  )}
                </Box>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      {/* Setup Monitoring Dialog */}
      <Dialog
        open={setupDialogOpen}
        onClose={() => setSetupDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Configure Security Monitoring
          {selectedRepo && (
            <Typography variant="subtitle2" color="text.secondary">
              {selectedRepo.fullName}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* Branch Selection */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Select Branches to Monitor
              </Typography>
              <FormGroup>
                {availableBranches.map((branch) => (
                  <FormControlLabel
                    key={branch.name}
                    control={
                      <Checkbox
                        checked={selectedBranches.includes(branch.name)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBranches([...selectedBranches, branch.name]);
                          } else {
                            setSelectedBranches(
                              selectedBranches.filter(b => b !== branch.name)
                            );
                          }
                        }}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography>{branch.name}</Typography>
                        {branch.protected && (
                          <Chip label="Protected" size="small" color="secondary" />
                        )}
                      </Box>
                    }
                  />
                ))}
              </FormGroup>
            </Grid>

            {/* Scan Settings */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Scan Configuration
              </Typography>
              
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Severity Threshold</InputLabel>
                <Select
                  value={scanSettings.severityThreshold}
                  label="Severity Threshold"
                  onChange={(e) => setScanSettings({
                    ...scanSettings,
                    severityThreshold: e.target.value
                  })}
                >
                  <MenuItem value="low">Low and above</MenuItem>
                  <MenuItem value="medium">Medium and above</MenuItem>
                  <MenuItem value="high">High and above</MenuItem>
                  <MenuItem value="critical">Critical only</MenuItem>
                </Select>
              </FormControl>

              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Enabled Rule Categories
              </Typography>
              <FormGroup>
                {['security', 'best-practices', 'performance', 'style'].map((rule) => (
                  <FormControlLabel
                    key={rule}
                    control={
                      <Checkbox
                        checked={scanSettings.enabledRules.includes(rule)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setScanSettings({
                              ...scanSettings,
                              enabledRules: [...scanSettings.enabledRules, rule]
                            });
                          } else {
                            setScanSettings({
                              ...scanSettings,
                              enabledRules: scanSettings.enabledRules.filter(r => r !== rule)
                            });
                          }
                        }}
                      />
                    }
                    label={rule.charAt(0).toUpperCase() + rule.slice(1).replace('-', ' ')}
                  />
                ))}
              </FormGroup>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSetupDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleStartMonitoring}
            disabled={selectedBranches.length === 0}
          >
            {selectedRepo?.isMonitored ? 'Update Monitoring' : 'Start Monitoring'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Repositories;

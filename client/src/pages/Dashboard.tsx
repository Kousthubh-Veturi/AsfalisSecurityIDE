import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  IconButton,
  Button,
  Alert,
  CircularProgress,
  LinearProgress,
} from '@mui/material';
import {
  Security,
  Warning,
  Error,
  CheckCircle,
  Info,
  TrendingUp,
  Repository,
  Schedule,
  Visibility,
  PlayArrow,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface DashboardStats {
  scanStats: {
    total: number;
    completed: number;
    failed: number;
    successRate: number;
  };
  vulnerabilityStats: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  recentScans: Array<{
    id: string;
    repository: string;
    branch: string;
    status: string;
    totalIssues: number;
    createdAt: string;
    completedAt?: string;
    duration?: number;
  }>;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get('/api/scans/stats/dashboard');
      setStats(response.data);
    } catch (error: any) {
      console.error('Failed to load dashboard data:', error);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'error';
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'running': return 'info';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  const formatDuration = (duration: number | undefined) => {
    if (!duration) return 'N/A';
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  if (loading) {
    return (
      <Box sx={{ mt: 4 }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading dashboard...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" action={
        <Button color="inherit" size="small" onClick={loadDashboardData}>
          Retry
        </Button>
      }>
        {error}
      </Alert>
    );
  }

  if (!stats) {
    return (
      <Alert severity="info">
        No data available. Start by adding some repositories to monitor.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          Security Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Overview of your security scanning activity and findings
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Scan Statistics */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingUp sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Scan Statistics</Typography>
              </Box>
              
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h3" color="primary.main">
                      {stats.scanStats.total}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Scans
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h3" color="success.main">
                      {stats.scanStats.successRate}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Success Rate
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="success.main">
                      {stats.scanStats.completed}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Completed
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="error.main">
                      {stats.scanStats.failed}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Failed
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Vulnerability Statistics */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Security sx={{ mr: 1, color: 'warning.main' }} />
                <Typography variant="h6">Vulnerabilities Found</Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="h3" color="warning.main" align="center">
                  {stats.vulnerabilityStats.total}
                </Typography>
                <Typography variant="body2" color="text.secondary" align="center">
                  Total Issues (Last 30 days)
                </Typography>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h5" color="error.main">
                      {stats.vulnerabilityStats.critical}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Critical
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h5" color="error.main">
                      {stats.vulnerabilityStats.high}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      High
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h5" color="warning.main">
                      {stats.vulnerabilityStats.medium}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Medium
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h5" color="info.main">
                      {stats.vulnerabilityStats.low}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Low
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Scans */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Schedule sx={{ mr: 1, color: 'info.main' }} />
                  <Typography variant="h6">Recent Scans</Typography>
                </Box>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/repositories')}
                  startIcon={<Repository />}
                >
                  Manage Repositories
                </Button>
              </Box>
              
              {stats.recentScans.length === 0 ? (
                <Alert severity="info" sx={{ mt: 2 }}>
                  No recent scans found. Add repositories to start monitoring.
                </Alert>
              ) : (
                <List>
                  {stats.recentScans.map((scan, index) => (
                    <ListItem
                      key={scan.id}
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 2,
                        mb: 1,
                        '&:hover': {
                          backgroundColor: 'action.hover',
                        },
                      }}
                      secondaryAction={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={scan.status}
                            color={getStatusColor(scan.status) as any}
                            size="small"
                          />
                          <IconButton
                            edge="end"
                            onClick={() => navigate(`/scan/${scan.id}`)}
                            size="small"
                          >
                            <Visibility />
                          </IconButton>
                        </Box>
                      }
                    >
                      <ListItemIcon>
                        <Repository />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle1" component="span">
                              {scan.repository}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" component="span">
                              ({scan.branch})
                            </Typography>
                            {scan.totalIssues > 0 && (
                              <Chip
                                label={`${scan.totalIssues} issues`}
                                color={scan.totalIssues > 5 ? 'error' : 'warning'}
                                size="small"
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {new Date(scan.createdAt).toLocaleString()} • 
                            Duration: {formatDuration(scan.duration)}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  startIcon={<Repository />}
                  onClick={() => navigate('/repositories')}
                >
                  Add Repository
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<PlayArrow />}
                  onClick={() => navigate('/repositories')}
                >
                  Trigger Manual Scan
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;

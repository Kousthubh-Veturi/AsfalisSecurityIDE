import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Alert,
  CircularProgress,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Divider,
} from '@mui/material';
import {
  ExpandMore,
  Security,
  Error,
  Warning,
  Info,
  CheckCircle,
  Code,
  BugReport,
  Schedule,
  Repository,
} from '@mui/icons-material';
import axios from 'axios';

interface ScanResult {
  ruleId: string;
  severity: string;
  message: string;
  file: string;
  line: number;
  column: number;
  codeSnippet?: string;
  suggestion?: string;
  category: string;
}

interface Scan {
  _id: string;
  repository: {
    name: string;
    fullName: string;
    githubId: number;
  };
  branch: string;
  commitHash: string;
  triggerType: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  results: ScanResult[];
  summary: {
    totalIssues: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    filesScanned: number;
    linesOfCode: number;
  };
  errorMessage?: string;
}

const ScanResults: React.FC = () => {
  const { scanId } = useParams<{ scanId: string }>();
  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [filteredResults, setFilteredResults] = useState<ScanResult[]>([]);

  useEffect(() => {
    if (scanId) {
      loadScanResults();
    }
  }, [scanId]);

  useEffect(() => {
    if (scan?.results) {
      applyFilters();
    }
  }, [scan, severityFilter, categoryFilter]);

  const loadScanResults = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`/api/scans/${scanId}`);
      setScan(response.data);
    } catch (error: any) {
      console.error('Failed to load scan results:', error);
      setError('Failed to load scan results. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    if (!scan?.results) return;

    let filtered = scan.results;

    if (severityFilter !== 'all') {
      filtered = filtered.filter(result => result.severity === severityFilter);
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(result => result.category === categoryFilter);
    }

    setFilteredResults(filtered);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return <Error sx={{ color: 'error.main' }} />;
      case 'high': return <Error sx={{ color: 'error.main' }} />;
      case 'medium': return <Warning sx={{ color: 'warning.main' }} />;
      case 'low': return <Info sx={{ color: 'info.main' }} />;
      default: return <Info sx={{ color: 'info.main' }} />;
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

  const formatDuration = (duration: number | undefined) => {
    if (!duration) return 'N/A';
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const getCategories = () => {
    if (!scan?.results) return [];
    const categories = [...new Set(scan.results.map(r => r.category))];
    return categories.sort();
  };

  if (loading) {
    return (
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading scan results...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" action={
        <Button color="inherit" size="small" onClick={loadScanResults}>
          Retry
        </Button>
      }>
        {error}
      </Alert>
    );
  }

  if (!scan) {
    return (
      <Alert severity="info">
        Scan not found.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          Scan Results
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Chip
            icon={<Repository />}
            label={scan.repository.name}
            variant="outlined"
          />
          <Chip
            label={scan.branch}
            variant="outlined"
          />
          <Chip
            label={scan.status}
            color={scan.status === 'completed' ? 'success' : scan.status === 'failed' ? 'error' : 'info'}
          />
        </Box>
      </Box>

      {/* Scan Overview */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Security sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Scan Summary</Typography>
              </Box>
              <Typography variant="h3" color="primary.main" align="center">
                {scan.summary.totalIssues}
              </Typography>
              <Typography variant="body2" color="text.secondary" align="center">
                Total Issues Found
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Code sx={{ mr: 1, color: 'info.main' }} />
                <Typography variant="h6">Code Analysis</Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="info.main">
                  {scan.summary.filesScanned}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Files Scanned
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {scan.summary.linesOfCode.toLocaleString()} lines of code
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Schedule sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="h6">Timing</Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="success.main">
                  {formatDuration(scan.duration)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Scan Duration
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {scan.completedAt ? new Date(scan.completedAt).toLocaleString() : 'In Progress'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Severity Breakdown */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Severity Breakdown</Typography>
          <Grid container spacing={2}>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="error.main">
                  {scan.summary.criticalCount}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Critical
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="error.main">
                  {scan.summary.highCount}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  High
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="warning.main">
                  {scan.summary.mediumCount}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Medium
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="info.main">
                  {scan.summary.lowCount}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Low
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Filter Results</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Severity</InputLabel>
                <Select
                  value={severityFilter}
                  label="Severity"
                  onChange={(e) => setSeverityFilter(e.target.value)}
                >
                  <MenuItem value="all">All Severities</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Category</InputLabel>
                <Select
                  value={categoryFilter}
                  label="Category"
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <MenuItem value="all">All Categories</MenuItem>
                  {getCategories().map((category) => (
                    <MenuItem key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Issues Found ({filteredResults.length})
          </Typography>
          
          {filteredResults.length === 0 ? (
            <Alert severity="success" icon={<CheckCircle />}>
              {scan.summary.totalIssues === 0 
                ? 'No security issues found! Your code looks clean.'
                : 'No issues match the current filters.'
              }
            </Alert>
          ) : (
            <List>
              {filteredResults.map((result, index) => (
                <Accordion key={index}>
                  <AccordionSummary
                    expandIcon={<ExpandMore />}
                    sx={{
                      '& .MuiAccordionSummary-content': {
                        alignItems: 'center',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                      {getSeverityIcon(result.severity)}
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {result.message}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {result.file}:{result.line}:{result.column} • {result.ruleId}
                        </Typography>
                      </Box>
                      <Chip
                        label={result.severity}
                        color={getSeverityColor(result.severity) as any}
                        size="small"
                      />
                      <Chip
                        label={result.category}
                        variant="outlined"
                        size="small"
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={8}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                          Location
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 2 }}>
                          <strong>{result.file}</strong> at line {result.line}, column {result.column}
                        </Typography>
                        
                        {result.codeSnippet && (
                          <>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                              Code Snippet
                            </Typography>
                            <Paper
                              sx={{
                                p: 2,
                                backgroundColor: 'grey.900',
                                border: 1,
                                borderColor: 'divider',
                                fontFamily: 'monospace',
                                fontSize: '0.875rem',
                                overflow: 'auto',
                                mb: 2,
                              }}
                            >
                              <pre style={{ margin: 0 }}>{result.codeSnippet}</pre>
                            </Paper>
                          </>
                        )}
                        
                        {result.suggestion && (
                          <>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                              Suggested Fix
                            </Typography>
                            <Alert severity="info">
                              {result.suggestion}
                            </Alert>
                          </>
                        )}
                      </Grid>
                      
                      <Grid item xs={12} md={4}>
                        <Box sx={{ p: 2, backgroundColor: 'background.paper', borderRadius: 1 }}>
                          <Typography variant="subtitle2" sx={{ mb: 2 }}>
                            Issue Details
                          </Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              Rule ID:
                            </Typography>
                            <Typography variant="caption">
                              {result.ruleId}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              Severity:
                            </Typography>
                            <Typography variant="caption">
                              {result.severity}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="caption" color="text.secondary">
                              Category:
                            </Typography>
                            <Typography variant="caption">
                              {result.category}
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ScanResults;

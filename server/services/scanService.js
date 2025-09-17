const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const simpleGit = require('simple-git');
const Scan = require('../models/Scan');
const axios = require('axios');

const execAsync = util.promisify(exec);

class SecurityScanService {
  constructor() {
    this.tempDir = path.join(__dirname, '../temp');
    this.ensureTempDir();
  }

  /**
   * Ensure temporary directory exists
   */
  async ensureTempDir() {
    try {
      await fs.ensureDir(this.tempDir);
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
  }

  /**
   * Trigger a security scan
   */
  async triggerScan({ repository, branch, commitHash, triggerType = 'manual' }) {
    // Create scan record
    const scan = new Scan({
      repository: repository._id,
      branch,
      commitHash,
      triggerType,
      status: 'pending',
      startedAt: new Date()
    });

    await scan.save();
    console.log(`Created scan ${scan._id} for ${repository.fullName}:${branch}@${commitHash}`);

    // Start scan in background (don't await)
    this.performScan(scan, repository).catch(error => {
      console.error(`Scan ${scan._id} failed:`, error);
      this.updateScanStatus(scan._id, 'failed', error.message);
    });

    return scan;
  }

  /**
   * Perform the actual security scan
   */
  async performScan(scan, repository) {
    try {
      console.log(`Starting scan ${scan._id} for ${repository.fullName}`);
      
      // Update status to running
      await this.updateScanStatus(scan._id, 'running');
      
      // Create temporary directory for this scan
      const scanDir = path.join(this.tempDir, scan._id.toString());
      await fs.ensureDir(scanDir);

      // Clone repository
      const repoPath = await this.cloneRepository(repository, scan.branch, scan.commitHash, scanDir);
      
      // Perform security scans
      const results = await this.runSecurityScans(repoPath, repository.scanSettings);
      
      // Process and save results
      await this.processScanResults(scan._id, results);
      
      // Clean up
      await fs.remove(scanDir);
      
      console.log(`Scan ${scan._id} completed successfully`);
      
    } catch (error) {
      console.error(`Scan ${scan._id} error:`, error);
      await this.updateScanStatus(scan._id, 'failed', error.message);
    }
  }

  /**
   * Clone repository to temporary directory
   */
  async cloneRepository(repository, branch, commitHash, scanDir) {
    try {
      const repoPath = path.join(scanDir, 'repo');
      
      // Get access token for cloning (requires populated owner)
      const user = await require('../models/User').findById(repository.owner);
      if (!user || !user.accessToken) {
        throw new Error('Unable to access repository: missing authentication');
      }

      const cloneUrl = `https://${user.accessToken}@github.com/${repository.fullName}.git`;
      
      console.log(`Cloning ${repository.fullName}:${branch} to ${repoPath}`);
      
      const git = simpleGit();
      await git.clone(cloneUrl, repoPath, ['--single-branch', '--branch', branch]);
      
      // Checkout specific commit if provided
      if (commitHash && commitHash !== 'HEAD') {
        const repoGit = simpleGit(repoPath);
        await repoGit.checkout(commitHash);
      }
      
      return repoPath;
    } catch (error) {
      console.error('Repository clone error:', error);
      throw new Error(`Failed to clone repository: ${error.message}`);
    }
  }

  /**
   * Run security scans using available tools
   */
  async runSecurityScans(repoPath, scanSettings) {
    const results = {
      semgrep: [],
      custom: [],
      linesOfCode: 0,
      filesScanned: 0
    };

    try {
      // Count lines of code
      results.linesOfCode = await this.countLinesOfCode(repoPath);
      results.filesScanned = await this.countFiles(repoPath);

      // Run Semgrep if available
      try {
        const semgrepResults = await this.runSemgrep(repoPath, scanSettings);
        results.semgrep = semgrepResults;
      } catch (error) {
        console.warn('Semgrep scan failed, continuing with custom scanner:', error.message);
      }

      // Run custom security pattern scanner
      const customResults = await this.runCustomScanner(repoPath, scanSettings);
      results.custom = customResults;

      return results;
    } catch (error) {
      console.error('Security scan error:', error);
      throw error;
    }
  }

  /**
   * Run Semgrep security scanner
   */
  async runSemgrep(repoPath, scanSettings) {
    try {
      // Check if semgrep is installed
      await execAsync('semgrep --version');
      
      const configFlags = this.getSemgrepConfig(scanSettings);
      const excludeFlags = this.getSemgrepExcludes(scanSettings);
      
      const command = `semgrep --json ${configFlags} ${excludeFlags} ${repoPath}`;
      console.log('Running Semgrep:', command);
      
      const { stdout, stderr } = await execAsync(command, { 
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: 300000 // 5 minute timeout
      });

      if (stderr && !stderr.includes('WARNING')) {
        console.warn('Semgrep warnings:', stderr);
      }

      const semgrepOutput = JSON.parse(stdout);
      return this.parseSemgrepResults(semgrepOutput.results || []);
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Semgrep not installed');
      }
      console.error('Semgrep execution error:', error);
      throw error;
    }
  }

  /**
   * Run custom security pattern scanner (based on extracted VSCode patterns)
   */
  async runCustomScanner(repoPath, scanSettings) {
    const results = [];
    const filePatterns = [
      '**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx',
      '**/*.py', '**/*.java', '**/*.c', '**/*.cpp'
    ];

    try {
      const glob = require('glob');
      const globAsync = util.promisify(glob);

      for (const pattern of filePatterns) {
        const files = await globAsync(pattern, { 
          cwd: repoPath,
          ignore: scanSettings?.excludePatterns || ['node_modules/**', 'vendor/**', '.git/**']
        });

        for (const file of files) {
          const filePath = path.join(repoPath, file);
          try {
            const content = await fs.readFile(filePath, 'utf8');
            const fileResults = this.scanFileContent(content, file);
            results.push(...fileResults);
          } catch (error) {
            console.warn(`Failed to read file ${file}:`, error.message);
          }
        }
      }

      return results;
    } catch (error) {
      console.error('Custom scanner error:', error);
      return results;
    }
  }

  /**
   * Scan file content for security issues using patterns from VSCode extension
   */
  scanFileContent(content, filePath) {
    const results = [];
    const lines = content.split('\n');

    // Security patterns based on extracted logic
    const patterns = [
      {
        pattern: /eval\s*\(/gi,
        severity: 'critical',
        message: 'Code injection vulnerability: eval() usage detected',
        category: 'injection',
        ruleId: 'custom-eval-usage'
      },
      {
        pattern: /innerHTML\s*=/gi,
        severity: 'high',
        message: 'XSS vulnerability: innerHTML usage without sanitization',
        category: 'xss',
        ruleId: 'custom-innerhtml-usage'
      },
      {
        pattern: /http:\/\/[^\s"']+/gi,
        severity: 'medium',
        message: 'Insecure HTTP connection detected',
        category: 'crypto',
        ruleId: 'custom-insecure-http'
      },
      {
        pattern: /password\s*=\s*['"]/gi,
        severity: 'high',
        message: 'Potential hardcoded password',
        category: 'auth',
        ruleId: 'custom-hardcoded-password'
      },
      {
        pattern: /(SELECT|INSERT|UPDATE|DELETE).*?(\+.*?['"]|`.*?\$\{)/gi,
        severity: 'critical',
        message: 'SQL injection vulnerability: string concatenation in SQL query',
        category: 'injection',
        ruleId: 'custom-sql-injection'
      }
    ];

    patterns.forEach(({ pattern, severity, message, category, ruleId }) => {
      lines.forEach((line, lineIndex) => {
        let match;
        pattern.lastIndex = 0; // Reset regex lastIndex
        while ((match = pattern.exec(line)) !== null) {
          results.push({
            ruleId,
            severity,
            message,
            file: filePath,
            line: lineIndex + 1,
            column: match.index + 1,
            codeSnippet: line.trim(),
            category,
            suggestion: this.getSuggestion(ruleId)
          });
        }
      });
    });

    return results;
  }

  /**
   * Get suggestion for a specific rule
   */
  getSuggestion(ruleId) {
    const suggestions = {
      'custom-eval-usage': 'Use JSON.parse() for parsing data or consider safer alternatives to eval()',
      'custom-innerhtml-usage': 'Use textContent instead of innerHTML, or sanitize input with DOMPurify',
      'custom-insecure-http': 'Use HTTPS instead of HTTP for all external connections',
      'custom-hardcoded-password': 'Use environment variables or secure configuration for passwords',
      'custom-sql-injection': 'Use parameterized queries or prepared statements instead of string concatenation'
    };
    
    return suggestions[ruleId] || 'Review this code for security implications';
  }

  /**
   * Process and save scan results
   */
  async processScanResults(scanId, rawResults) {
    try {
      const allResults = [
        ...(rawResults.semgrep || []),
        ...(rawResults.custom || [])
      ];

      // Calculate summary
      const summary = {
        totalIssues: allResults.length,
        criticalCount: allResults.filter(r => r.severity === 'critical').length,
        highCount: allResults.filter(r => r.severity === 'high').length,
        mediumCount: allResults.filter(r => r.severity === 'medium').length,
        lowCount: allResults.filter(r => r.severity === 'low').length,
        filesScanned: rawResults.filesScanned || 0,
        linesOfCode: rawResults.linesOfCode || 0
      };

      // Update scan with results
      await Scan.findByIdAndUpdate(scanId, {
        status: 'completed',
        completedAt: new Date(),
        duration: Date.now() - (await Scan.findById(scanId)).startedAt.getTime(),
        results: allResults,
        summary: summary,
        scannerVersion: '1.0.0'
      });

      console.log(`Scan ${scanId} results processed: ${summary.totalIssues} issues found`);
    } catch (error) {
      console.error('Error processing scan results:', error);
      throw error;
    }
  }

  /**
   * Update scan status
   */
  async updateScanStatus(scanId, status, errorMessage = null) {
    try {
      const update = { status };
      
      if (status === 'completed') {
        update.completedAt = new Date();
      } else if (status === 'failed') {
        update.errorMessage = errorMessage;
        update.completedAt = new Date();
      }

      await Scan.findByIdAndUpdate(scanId, update);
    } catch (error) {
      console.error('Error updating scan status:', error);
    }
  }

  /**
   * Helper methods
   */
  getSemgrepConfig(scanSettings) {
    const configs = ['--config=auto'];
    if (scanSettings?.enabledRules?.includes('security')) {
      configs.push('--config=security');
    }
    return configs.join(' ');
  }

  getSemgrepExcludes(scanSettings) {
    const excludePatterns = scanSettings?.excludePatterns || [];
    return excludePatterns.map(pattern => `--exclude="${pattern}"`).join(' ');
  }

  parseSemgrepResults(results) {
    return results.map(result => ({
      ruleId: result.check_id,
      severity: this.mapSemgrepSeverity(result.extra?.severity || 'INFO'),
      message: result.extra?.message || result.message,
      file: result.path,
      line: result.start?.line || 1,
      column: result.start?.col || 1,
      codeSnippet: result.extra?.lines,
      category: this.categorizeRule(result.check_id),
      suggestion: result.extra?.fix || 'Review this code for security implications'
    }));
  }

  mapSemgrepSeverity(severity) {
    const severityMap = {
      'ERROR': 'high',
      'WARNING': 'medium',
      'INFO': 'low'
    };
    return severityMap[severity] || 'medium';
  }

  categorizeRule(ruleId) {
    if (ruleId.includes('injection') || ruleId.includes('sql')) return 'injection';
    if (ruleId.includes('xss') || ruleId.includes('dom')) return 'xss';
    if (ruleId.includes('crypto') || ruleId.includes('hash')) return 'crypto';
    if (ruleId.includes('auth') || ruleId.includes('password')) return 'auth';
    if (ruleId.includes('config') || ruleId.includes('secret')) return 'config';
    return 'other';
  }

  async countLinesOfCode(repoPath) {
    try {
      const { stdout } = await execAsync(`find "${repoPath}" -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.java" | grep -v node_modules | xargs wc -l | tail -n 1`);
      return parseInt(stdout.trim().split(' ')[0]) || 0;
    } catch (error) {
      return 0;
    }
  }

  async countFiles(repoPath) {
    try {
      const { stdout } = await execAsync(`find "${repoPath}" -type f \\( -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.java" \\) | grep -v node_modules | wc -l`);
      return parseInt(stdout.trim()) || 0;
    } catch (error) {
      return 0;
    }
  }
}

module.exports = new SecurityScanService();

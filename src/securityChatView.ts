import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SecurityScanner } from './securityScanner';
import { IssueSeverity } from './securityIssueTypes';

export class SecurityChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'securityChat';
  private _view?: vscode.WebviewView;
  private _currentScanLocation: string = '';

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _securityScanner: SecurityScanner
  ) {
    // Listen for scan location changes
    this._securityScanner.onScanLocationChanged(location => {
      this._currentScanLocation = location;
      this.updateScanLocation();
    });
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'media'),
        vscode.Uri.joinPath(this._extensionUri, 'dist', 'media')
      ]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (data: any) => {
      switch (data.type) {
        case 'analyze': {
          await this.analyzeCode(data.text);
          break;
        }
        case 'scanFile': {
          const editor = vscode.window.activeTextEditor;
          if (editor) {
            vscode.commands.executeCommand('security-scan-chat.scanFile');
          } else {
            this.postMessage({ type: 'response', message: 'No file is currently open to scan.' });
          }
          break;
        }
        case 'scanProject': {
          vscode.commands.executeCommand('security-scan-chat.scanProject');
          break;
        }
        case 'fixCode': {
          await this.applyCodeFix(data.filePath, data.range, data.newText);
          break;
        }
        case 'userMessage': {
          // Handle user chat messages
          await this.processUserMessage(data.text);
          break;
        }
        case 'analyzeOpenFile': {
          // Analyze the currently open file
          await this.analyzeOpenFile();
          break;
        }
      }
    });
  }

  private async processUserMessage(message: string): Promise<void> {
    try {
      this.postMessage({ type: 'startThinking' });

      // Check if user is asking about specific code pattern
      if (message.includes('how to fix') || 
          message.includes('what is wrong with') || 
          message.includes('security issue')) {
        
        // Get open editor to analyze context
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const document = editor.document;
          const code = document.getText();
          const filePath = document.uri.fsPath;
          
          // Generate response based on user question and open file
          const response = await this.generateChatResponse(message, code, filePath);
          
          this.postMessage({ 
            type: 'chatResponse', 
            message: response
          });
        } else {
          this.postMessage({ 
            type: 'chatResponse', 
            message: "I don't see an open file to analyze. Please open a file with code you'd like me to help with."
          });
        }
      } else {
        // General security advice
        const response = await this.generateSecurityAdvice(message);
        
        this.postMessage({ 
          type: 'chatResponse', 
          message: response
        });
      }
    } catch (error) {
      this.postMessage({ 
        type: 'error', 
        message: `Error processing message: ${error}` 
      });
    }
  }

  private async generateChatResponse(message: string, code: string, filePath: string): Promise<string> {
    // Simulate AI response generation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    let response = "";
    
    // Check for common security issues
    if (code.includes('eval(')) {
      response = `I found a potential code injection vulnerability in your file at ${path.basename(filePath)}. The use of eval() can be dangerous if user input is not properly sanitized.\n\nHere's how you could fix it:\n\n\`\`\`diff\n- eval(userInput)\n+ JSON.parse(userInput)\n\`\`\`\n\nAlways validate and sanitize user input before processing it.`;
    } else if (code.includes('innerHTML')) {
      response = `I found a potential XSS vulnerability in your file at ${path.basename(filePath)}. Using innerHTML with unsanitized input can lead to cross-site scripting attacks.\n\nHere's how you could fix it:\n\n\`\`\`diff\n- element.innerHTML = userInput;\n+ element.textContent = userInput;\n\`\`\`\n\nIf you need HTML rendering, consider using a sanitization library like DOMPurify.`;
    } else if (code.includes('http://')) {
      response = `I noticed you're using non-encrypted HTTP connections in ${path.basename(filePath)}. This could expose data to eavesdropping.\n\nHere's how you could fix it:\n\n\`\`\`diff\n- http://example.com\n+ https://example.com\n\`\`\`\n\nAlways use HTTPS for external connections whenever possible.`;
    } else {
      response = `I've examined the code in ${path.basename(filePath)}, but I don't see any obvious security issues related to your question. Could you provide more specific details about what you're concerned about?`;
    }
    
    return response;
  }

  private async generateSecurityAdvice(message: string): Promise<string> {
    // Simulate AI response generation
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Some predefined responses based on common security questions
    if (message.toLowerCase().includes('sql injection')) {
      return "To prevent SQL injection, always use parameterized queries or prepared statements instead of building SQL strings directly with user input. Most modern frameworks provide safe ways to query databases.";
    } else if (message.toLowerCase().includes('xss') || message.toLowerCase().includes('cross site')) {
      return "To prevent XSS attacks, always sanitize user input before inserting it into the DOM. Use framework-provided escaping mechanisms or libraries like DOMPurify. Avoid using innerHTML with unsanitized content and consider Content-Security-Policy headers.";
    } else if (message.toLowerCase().includes('authentication') || message.toLowerCase().includes('login')) {
      return "For secure authentication, use industry-standard authentication libraries, implement proper password hashing with algorithms like bcrypt or Argon2, enable multi-factor authentication when possible, and use HTTPS for all authentication traffic.";
    } else {
      return "I'm happy to help with your security questions. You can ask about specific vulnerabilities like SQL injection, XSS, CSRF, or about secure coding practices for particular languages or frameworks.";
    }
  }

  private async analyzeOpenFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.postMessage({ 
        type: 'chatResponse', 
        message: "No file is currently open to analyze." 
      });
      return;
    }
    
    try {
      this.postMessage({ type: 'startThinking' });
      
      const document = editor.document;
      const code = document.getText();
      const filePath = document.uri.fsPath;
      
      // Analyze the code
      const analysisResult = await this.analyzeCodeWithModel(code);
      
      // Format the response
      let response = `# Analysis of ${path.basename(filePath)}\n\n`;
      
      if (analysisResult.issues.length === 0) {
        response += "I didn't find any obvious security issues in this file. This doesn't guarantee the code is secure, but there are no common patterns that raise immediate concerns.";
      } else {
        response += `I found ${analysisResult.issues.length} potential security ${analysisResult.issues.length === 1 ? 'issue' : 'issues'}:\n\n`;
        
        analysisResult.issues.forEach((issue: any, index: number) => {
          response += `## Issue ${index + 1}: ${issue.title}\n`;
          response += `**Severity**: ${issue.severity}\n`;
          response += `**Line**: ${issue.line + 1}\n\n`;
          response += `${issue.message}\n\n`;
          response += `**Suggestion**: ${issue.suggestion}\n\n`;
          response += "```diff\n";
          response += `- ${issue.fix.original}\n`;
          response += `+ ${issue.fix.fixed}\n`;
          response += "```\n\n";
        });
      }
      
      this.postMessage({ 
        type: 'chatResponse', 
        message: response
      });
    } catch (error) {
      this.postMessage({ 
        type: 'error', 
        message: `Error analyzing open file: ${error}` 
      });
    }
  }

  private updateScanLocation(): void {
    if (this._view) {
      this.postMessage({ 
        type: 'updateScanLocation', 
        location: this._currentScanLocation 
      });
    }
  }

  private async analyzeCode(code: string): Promise<void> {
    try {
      this.postMessage({ type: 'startAnalysis' });

      // Simulate sending code to the model for analysis
      const analysisResult = await this.analyzeCodeWithModel(code);
      
      this.postMessage({ 
        type: 'analysisResult', 
        result: analysisResult 
      });
    } catch (error) {
      this.postMessage({ 
        type: 'error', 
        message: `Error analyzing code: ${error}` 
      });
    }
  }

  private async analyzeCodeWithModel(code: string): Promise<any> {
    // This is where we would call the actual model
    // For now, we'll simulate a response with dummy data
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const issues = [];
    
    // Look for common security issues
    if (code.includes('eval(')) {
      issues.push({
        type: 'security_vulnerability',
        title: 'Code Injection Risk',
        severity: 'high',
        message: 'Using eval() can lead to code injection vulnerabilities if user input is not properly sanitized',
        line: code.split('\n').findIndex(line => line.includes('eval(')),
        suggestion: 'Consider using safer alternatives like JSON.parse() for data parsing',
        fix: {
          original: 'eval(userInput)',
          fixed: 'JSON.parse(userInput)'
        }
      });
    }
    
    if (code.includes('innerHTML')) {
      issues.push({
        type: 'security_vulnerability',
        title: 'Cross-Site Scripting (XSS) Risk',
        severity: 'high',
        message: 'Using innerHTML with unsanitized input can lead to XSS attacks',
        line: code.split('\n').findIndex(line => line.includes('innerHTML')),
        suggestion: 'Use textContent instead, or sanitize input with a library like DOMPurify',
        fix: {
          original: 'element.innerHTML = userInput',
          fixed: 'element.textContent = userInput'
        }
      });
    }
    
    if (code.includes('http://')) {
      issues.push({
        type: 'security_vulnerability',
        title: 'Insecure HTTP Usage',
        severity: 'medium',
        message: 'Using non-encrypted HTTP connections can expose data to eavesdropping',
        line: code.split('\n').findIndex(line => line.includes('http://')),
        suggestion: 'Use HTTPS instead of HTTP for all external connections',
        fix: {
          original: 'http://',
          fixed: 'https://'
        }
      });
    }

    if (code.toLowerCase().includes('password') && !code.includes('hash')) {
      issues.push({
        type: 'security_vulnerability',
        title: 'Potential Insecure Password Handling',
        severity: 'high',
        message: 'Password handling detected without proper hashing',
        line: code.split('\n').findIndex(line => line.toLowerCase().includes('password')),
        suggestion: 'Use a secure password hashing function like bcrypt or Argon2',
        fix: {
          original: 'password = userPassword',
          fixed: 'password = await bcrypt.hash(userPassword, 10)'
        }
      });
    }

    if (code.includes('sql') && code.includes("'") && (code.includes('SELECT') || code.includes('INSERT'))) {
      issues.push({
        type: 'security_vulnerability',
        title: 'Potential SQL Injection',
        severity: 'high',
        message: 'Building SQL queries with string concatenation can lead to SQL injection vulnerabilities',
        line: code.split('\n').findIndex(line => line.includes('SELECT') || line.includes('INSERT')),
        suggestion: 'Use parameterized queries or an ORM instead of string concatenation',
        fix: {
          original: "const query = \"SELECT * FROM users WHERE username = '\" + username + \"'\"",
          fixed: "const query = \"SELECT * FROM users WHERE username = ?\"\nconst results = await db.query(query, [username])"
        }
      });
    }
    
    return {
      issues,
      summary: issues.length > 0 
        ? `Found ${issues.length} potential security issues in the code` 
        : 'No obvious security issues found in the provided code sample'
    };
  }

  private async applyCodeFix(filePath: string, range: vscode.Range, newText: string): Promise<void> {
    try {
      // Get the document
      const document = await vscode.workspace.openTextDocument(filePath);
      
      // Apply the edit
      const edit = new vscode.WorkspaceEdit();
      edit.replace(document.uri, range, newText);
      
      const success = await vscode.workspace.applyEdit(edit);
      
      if (success) {
        this.postMessage({ 
          type: 'fixApplied', 
          message: 'Code fix applied successfully' 
        });
      } else {
        this.postMessage({ 
          type: 'error', 
          message: 'Failed to apply code fix' 
        });
      }
    } catch (error) {
      this.postMessage({ 
        type: 'error', 
        message: `Error applying code fix: ${error}` 
      });
    }
  }

  private postMessage(message: any) {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get the local path to main script - try both possible locations
    let scriptPathMedia = vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js');
    let scriptPathDist = vscode.Uri.joinPath(this._extensionUri, 'dist', 'media', 'main.js');
    
    let scriptUri;
    if (fs.existsSync(scriptPathMedia.fsPath)) {
      scriptUri = webview.asWebviewUri(scriptPathMedia);
    } else {
      scriptUri = webview.asWebviewUri(scriptPathDist);
    }

    // Get the local path to css - try both possible locations
    let stylePathMedia = vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css');
    let stylePathDist = vscode.Uri.joinPath(this._extensionUri, 'dist', 'media', 'main.css');
    
    let styleMainUri;
    if (fs.existsSync(stylePathMedia.fsPath)) {
      styleMainUri = webview.asWebviewUri(stylePathMedia);
    } else {
      styleMainUri = webview.asWebviewUri(stylePathDist);
    }

    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce();

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleMainUri}" rel="stylesheet">
        <title>Security Chat</title>
      </head>
      <body>
        <div class="chat-container">
          <div class="chat-header">
            <h2>Security Code Scanner</h2>
            <div id="scanLocationBar" class="scan-location-bar">
              <span class="scan-location-label">Current Scan: </span>
              <span id="currentScanLocation" class="scan-location-path">No active scan</span>
            </div>
          </div>
          
          <div class="chat-messages" id="chatMessages">
            <div class="message system">
              <div class="message-content">
                <p>Welcome to Security Code Scanner! I can help you identify security issues in your code.</p>
                <p>You can:</p>
                <ul>
                  <li>Ask me questions about security best practices</li>
                  <li>Paste code for analysis</li>
                  <li>Analyze the current file or project</li>
                  <li>Apply suggested fixes to your code</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div class="action-buttons">
            <button id="scanFileBtn">Scan Current File</button>
            <button id="scanProjectBtn">Scan Project</button>
            <button id="analyzeOpenFileBtn">Analyze Open File</button>
          </div>
          
          <div class="chat-input-container">
            <div class="input-type-toggle">
              <button id="chatToggleBtn" class="active">Chat</button>
              <button id="codeToggleBtn">Code Analysis</button>
            </div>
            <div id="chatInputWrapper" class="chat-textarea-wrapper">
              <textarea id="chatInput" placeholder="Ask about security vulnerabilities..."></textarea>
              <button id="sendChatBtn">Send</button>
            </div>
            <div id="codeInputWrapper" class="code-textarea-wrapper hidden">
              <textarea id="codeInput" placeholder="Paste code here to analyze..."></textarea>
              <button id="analyzeBtn">Analyze</button>
            </div>
          </div>
        </div>
        
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`;
  }
}

// Generate a nonce for Content Security Policy
function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
} 
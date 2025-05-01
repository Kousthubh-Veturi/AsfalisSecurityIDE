import * as vscode from 'vscode';
import { SecurityIssuesProvider, IssueDetailsProvider } from './securityIssuesProvider';
import { SecurityChatViewProvider } from './securityChatView';
import { SecurityScanner } from './securityScanner';
import { ModelService } from './modelService';

export function activate(context: vscode.ExtensionContext) {
  console.log('Security Scan Chat extension is now active');

  // Initialize our services
  const modelService = new ModelService(context);
  const securityScanner = new SecurityScanner();
  
  // Load the model in background
  modelService.loadModel().catch(error => {
    console.error('Failed to load model:', error);
  });
  
  // Register tree data providers
  const securityIssuesProvider = new SecurityIssuesProvider(securityScanner);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('securityIssues', securityIssuesProvider)
  );
  
  // Register issue details webview provider
  const issueDetailsProvider = new IssueDetailsProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(IssueDetailsProvider.viewType, issueDetailsProvider)
  );
  
  // Register security chat webview provider
  const securityChatProvider = new SecurityChatViewProvider(context.extensionUri, securityScanner);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SecurityChatViewProvider.viewType, securityChatProvider)
  );

  // Register diagnostic collection for showing problems in editor
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('security-scan');
  context.subscriptions.push(diagnosticCollection);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('security-scan-chat.openChat', () => {
      vscode.commands.executeCommand('workbench.view.extension.security-scan-sidebar');
    }),
    
    vscode.commands.registerCommand('security-scan-chat.scanFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const document = editor.document;
        vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: `Scanning ${document.fileName}`,
          cancellable: false
        }, async (progress: any) => {
          progress.report({ increment: 0 });
          
          try {
            // Clear previous diagnostics for this file
            diagnosticCollection.delete(document.uri);
            
            // Scan the file
            const issues = await securityScanner.scanFile(document);
            
            // Update the issues view
            securityIssuesProvider.refresh();
            
            // Convert issues to diagnostics
            const diagnostics = issues.map(issue => {
              const range = issue.location.range;
              
              const diagnostic = new vscode.Diagnostic(
                range,
                issue.message,
                convertSeverityToDiagnosticSeverity(issue.severity)
              );
              
              diagnostic.source = issue.source;
              diagnostic.code = issue.code;
              
              return diagnostic;
            });
            
            // Set diagnostics
            diagnosticCollection.set(document.uri, diagnostics);
            
            progress.report({ increment: 100 });
            vscode.window.showInformationMessage(`Security scan completed. Found ${issues.length} issues.`);
          } catch (error) {
            vscode.window.showErrorMessage(`Scan failed: ${error}`);
          }
        });
      } else {
        vscode.window.showInformationMessage('No file is open');
      }
    }),
    
    vscode.commands.registerCommand('security-scan-chat.scanProject', async () => {
      if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        vscode.window.showInformationMessage('No workspace folder is open');
        return;
      }
      
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Scanning project for security issues',
        cancellable: false
      }, async (progress: any) => {
        progress.report({ increment: 0 });
        
        try {
          // Clear all diagnostics
          diagnosticCollection.clear();
          
          // Scan the project
          const issues = await securityScanner.scanProject(vscode.workspace.workspaceFolders[0].uri);
          
          // Update the issues view
          securityIssuesProvider.refresh();
          
          // Group issues by file
          const issuesByFile = new Map<string, vscode.Diagnostic[]>();
          
          issues.forEach(issue => {
            const uri = issue.location.uri.toString();
            if (!issuesByFile.has(uri)) {
              issuesByFile.set(uri, []);
            }
            
            const diagnostic = new vscode.Diagnostic(
              issue.location.range,
              issue.message,
              convertSeverityToDiagnosticSeverity(issue.severity)
            );
            
            diagnostic.source = issue.source;
            diagnostic.code = issue.code;
            
            const diagnostics = issuesByFile.get(uri);
            if (diagnostics) {
              diagnostics.push(diagnostic);
            }
          });
          
          // Set diagnostics for each file
          issuesByFile.forEach((diagnostics, uriString) => {
            const uri = vscode.Uri.parse(uriString);
            diagnosticCollection.set(uri, diagnostics);
          });
          
          progress.report({ increment: 100 });
          vscode.window.showInformationMessage(`Project security scan completed. Found ${issues.length} issues.`);
        } catch (error) {
          vscode.window.showErrorMessage(`Project scan failed: ${error}`);
        }
      });
    }),
    
    vscode.commands.registerCommand('security-scan-chat.showIssueDetails', (issue: any) => {
      issueDetailsProvider.updateContent(issue);
      vscode.commands.executeCommand('securityIssueDetails.focus');
    }),
    
    vscode.commands.registerCommand('security-scan-chat.fixIssue', async (issueId: string) => {
      const issue = securityScanner.issues.find(i => i.id === issueId);
      if (issue && issue.suggestions && issue.suggestions.length > 0) {
        const document = await vscode.workspace.openTextDocument(issue.location.uri);
        const editor = await vscode.window.showTextDocument(document);
        
        // Apply the first suggestion
        const suggestion = issue.suggestions[0];
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, issue.location.range, suggestion.fix);
        
        await vscode.workspace.applyEdit(edit);
      }
    })
  );
  
  // When active editor changes, update diagnostics
  vscode.window.onDidChangeActiveTextEditor(() => {
    // Keep this subscriber for future use, even if we don't do anything now
  });
}

export function deactivate() {
  console.log('Security Scan Chat extension is now deactivated');
}

// Helper function to convert our severity to vscode's diagnostic severity
function convertSeverityToDiagnosticSeverity(severity: number): vscode.DiagnosticSeverity {
  switch (severity) {
    case 3: // Critical
      return vscode.DiagnosticSeverity.Error;
    case 2: // High
      return vscode.DiagnosticSeverity.Error;
    case 1: // Medium
      return vscode.DiagnosticSeverity.Warning;
    case 0: // Low
      return vscode.DiagnosticSeverity.Information;
    default:
      return vscode.DiagnosticSeverity.Information;
  }
} 
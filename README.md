# Asfalis Security Scan IDE

A VS Code extension that provides comprehensive security scanning capabilities for your code. It analyzes your files and projects for common security vulnerabilities and provides recommendations to fix them through an interactive chat interface.

## Features

- **Security Code Scanning**: Detects common security vulnerabilities in your code
- **Interactive Chat Interface**: Get explanations and fixing recommendations through a chat-like interface
- **Multiple Languages Support**: Analyzes JavaScript, TypeScript, Python, Java and more
- **Issue Visualization**: View security issues with severity indicators in a tree view
- **Code Fixes**: Apply recommended fixes directly to your code
- **Real-time Feedback**: Current scan location is displayed for better context

## Security Vulnerabilities Detected

This extension can detect various security issues including:

- Code Injection (eval usage)
- Cross-Site Scripting (XSS) via innerHTML
- Insecure HTTP connections
- Insecure password handling
- SQL Injection vulnerabilities
- And more!

## Installation

1. Download the .vsix file from the releases page
2. Open VS Code and go to Extensions view (Ctrl+Shift+X / Cmd+Shift+X)
3. Click on "..." (More Actions) and select "Install from VSIX..."
4. Choose the downloaded file and follow the prompts

## Usage

After installation, you can:

1. Open the Security Scan sidebar from the activity bar
2. Use the chat interface to ask security-related questions
3. Scan individual files or entire projects
4. Review detected issues and apply suggested fixes

## Development

This extension was built with TypeScript and the VS Code Extension API. It uses a simulated security scanner in demo mode but can be extended to integrate with external security scanning tools.

```
npm install        # Install dependencies
npm run compile    # Compile TypeScript
npm run package    # Create VSIX package
```

## License

MIT

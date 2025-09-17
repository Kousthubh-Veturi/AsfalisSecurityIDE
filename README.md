# Asfalis Security Scanner

A modern, web-based security scanning platform that integrates with GitHub to automatically scan repositories for security vulnerabilities. Built with React, Node.js, and MongoDB, featuring a clean dark mode interface and real-time webhook integration.

## 🚀 Features

- **GitHub OAuth Integration**: Seamless authentication with your GitHub account
- **Automated Security Scanning**: Triggers scans on every push to monitored branches
- **Multiple Security Tools**: Integrates with Semgrep and custom pattern-based scanning
- **Real-time Webhooks**: Automatic scanning via GitHub webhook events  
- **Beautiful Dark UI**: Clean, minimalistic interface optimized for security professionals
- **Comprehensive Dashboard**: Overview of scan statistics and vulnerability trends
- **Repository Management**: Easy setup and configuration of monitored repositories
- **Detailed Scan Results**: In-depth analysis with code snippets and fix suggestions

## 🏗️ Architecture

```
├── server/                 # Node.js/Express API backend
│   ├── models/            # MongoDB data models
│   ├── routes/            # API route handlers
│   ├── services/          # Business logic (scanning, webhooks)
│   └── middleware/        # Authentication & validation
├── client/                # React frontend with TypeScript
│   ├── components/        # Reusable UI components
│   ├── pages/            # Main application pages
│   └── contexts/         # React context providers
└── public/               # Static assets
```

## 🔧 Installation & Setup

### Prerequisites

- Node.js 18+ and npm
- MongoDB (local or Atlas)
- GitHub OAuth Application
- Semgrep CLI (optional, for enhanced scanning)

### 1. Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd AsfalisSecurityIDE
npm install
npm run install:all
```

### 2. GitHub OAuth Setup

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Fill in the details:
   - **Application name**: Asfalis Security Scanner
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/login`
4. Note your Client ID and Client Secret

### 3. Environment Configuration

Create `server/.env` file:

```env
# Server Configuration
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb://localhost:27017/asfalis-security

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# JWT Secret (generate a secure random string)
JWT_SECRET=your-jwt-secret-key

# Webhook Configuration
WEBHOOK_SECRET=your-webhook-secret
SERVER_URL=http://localhost:5000

# Client URL (for CORS)
CLIENT_URL=http://localhost:3000
```

Create `client/.env` file:

```env
REACT_APP_API_URL=http://localhost:5000
```

### 4. Database Setup

Start MongoDB (if running locally):
```bash
mongod
```

The application will automatically create the necessary collections on first run.

### 5. Optional: Install Semgrep

For enhanced security scanning capabilities:

```bash
# Using pip
pip install semgrep

# Or using homebrew (macOS)
brew install semgrep

# Verify installation
semgrep --version
```

### 6. Start the Application

Development mode (runs both frontend and backend):
```bash
npm run dev
```

Or start individually:
```bash
# Backend (from server directory)
cd server && npm run dev

# Frontend (from client directory)  
cd client && npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 🔐 Security Scanning

### Supported Languages & Frameworks

- **JavaScript/TypeScript**: Node.js, React, Angular, Vue.js
- **Python**: Django, Flask, FastAPI
- **Java**: Spring Boot, Maven projects
- **C/C++**: General C/C++ codebases

### Detection Capabilities

- **Code Injection**: `eval()`, `exec()` usage
- **Cross-Site Scripting (XSS)**: `innerHTML` without sanitization
- **SQL Injection**: String concatenation in SQL queries
- **Insecure Communications**: HTTP instead of HTTPS
- **Credential Management**: Hardcoded passwords and secrets
- **Input Validation**: Unsafe user input handling

### Custom Security Patterns

The scanner includes custom pattern-based detection derived from security best practices:

```javascript
// Detected patterns
eval(userInput)                    // Code injection risk
element.innerHTML = userInput      // XSS vulnerability
"SELECT * FROM users WHERE id=" + userId  // SQL injection
password = "hardcoded123"         // Hardcoded credentials
```

## 🎯 Usage Guide

### 1. Authentication
- Visit the application and click "Continue with GitHub"
- Authorize Asfalis to access your repositories
- You'll be redirected to the dashboard

### 2. Repository Setup
- Navigate to "Repositories" page
- Click "Start Monitoring" on desired repositories
- Select branches to monitor
- Configure scan settings (severity threshold, rules)
- Save configuration

### 3. Webhook Configuration
Webhooks are automatically configured when you start monitoring a repository. The webhook will trigger scans on push events to monitored branches.

### 4. Manual Scanning
- Go to the repository card
- Click "Scan Now" to trigger an immediate scan
- Results will appear in the scan results page

### 5. Viewing Results
- Access scan results from the dashboard
- Filter by severity, category, or file
- View detailed code snippets and fix suggestions
- Track security trends over time

## 📊 Dashboard Features

### Security Metrics
- Total scans performed
- Success rate percentage  
- Vulnerability breakdown by severity
- Recent scan activity

### Repository Management
- Monitor multiple repositories
- Configure branch-specific scanning
- Manage webhook integrations
- Customize scan rules and thresholds

### Scan Results
- Detailed vulnerability reports
- Code snippet highlighting
- Fix suggestions and recommendations
- Historical scan comparison

## 🔧 Configuration Options

### Scan Settings
```javascript
{
  severityThreshold: 'medium',     // minimum severity to report
  enabledRules: [                  // rule categories to enable
    'security',
    'best-practices',
    'performance'
  ],
  excludePatterns: [              // files/directories to skip
    'node_modules/**',
    '*.test.js',
    'vendor/**'
  ]
}
```

### User Preferences
- Email notifications for scan results
- Automatic scanning on push events
- Dashboard display preferences

## 🚀 Production Deployment

### Environment Variables
Set appropriate production values for:
- `NODE_ENV=production`
- `MONGODB_URI` (MongoDB Atlas recommended)
- `SERVER_URL` (your production domain)
- `CLIENT_URL` (your frontend domain)

### Security Considerations
- Use HTTPS in production
- Implement rate limiting
- Configure proper CORS policies
- Use environment-specific secrets
- Enable MongoDB authentication

### Docker Deployment
```dockerfile
# Example Dockerfile structure
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 🛠️ API Endpoints

### Authentication
- `GET /api/auth/github` - GitHub OAuth redirect
- `POST /api/auth/callback` - OAuth callback handler
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - User logout

### Repositories
- `GET /api/repositories` - List user repositories
- `GET /api/repositories/:id/branches` - Get repository branches
- `POST /api/repositories/:id/monitor` - Start monitoring
- `DELETE /api/repositories/:id/monitor` - Stop monitoring

### Scans
- `GET /api/scans` - List user scans
- `GET /api/scans/:id` - Get scan details
- `POST /api/scans/trigger` - Manual scan trigger
- `GET /api/scans/stats/dashboard` - Dashboard statistics

### Webhooks
- `POST /api/webhooks/github` - GitHub webhook handler

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Semgrep**: For providing excellent static analysis capabilities
- **GitHub API**: For comprehensive repository and webhook integration
- **Material-UI**: For beautiful React components
- **MongoDB**: For flexible document storage

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/your-org/asfalis-security/issues) page
2. Create a new issue with detailed information
3. Contact support at support@asfalis.com

## 🔒 Security

This tool is designed to enhance security, but please report any security vulnerabilities privately to security@asfalis.com.

---

**Made with ❤️ by the Asfalis Security Team**
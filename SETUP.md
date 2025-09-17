# Quick Setup Guide for Asfalis Security Scanner

## Environment Variables Setup

### Backend (.env file in /server directory)

Create `/server/.env` with the following variables:

```bash
# Server Configuration
NODE_ENV=development
PORT=5000

# Database Connection
MONGODB_URI=mongodb://localhost:27017/asfalis-security

# GitHub OAuth Configuration (Get from https://github.com/settings/developers)
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here

# Security
JWT_SECRET=generate_a_secure_random_string_here
WEBHOOK_SECRET=generate_another_secure_random_string

# URLs
SERVER_URL=http://localhost:5000
CLIENT_URL=http://localhost:3000

# Optional: Semgrep Integration
# SEMGREP_API_KEY=your_semgrep_api_key (if using Semgrep cloud)
```

### Frontend (.env file in /client directory)

Create `/client/.env` with:

```bash
REACT_APP_API_URL=http://localhost:5000
```

## GitHub OAuth Setup Steps

1. **Go to GitHub Settings**:
   - Navigate to https://github.com/settings/developers
   - Click "OAuth Apps" → "New OAuth App"

2. **Configure OAuth Application**:
   ```
   Application name: Asfalis Security Scanner
   Homepage URL: http://localhost:3000
   Authorization callback URL: http://localhost:3000/login
   Description: Security scanner for GitHub repositories
   ```

3. **Get Credentials**:
   - Copy the "Client ID" 
   - Generate and copy the "Client Secret"
   - Add these to your `/server/.env` file

## MongoDB Setup

### Option 1: Local MongoDB
```bash
# Install MongoDB Community Edition
# On macOS with Homebrew:
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB
brew services start mongodb-community

# Verify it's running
mongo --eval "db.adminCommand('ismaster')"
```

### Option 2: MongoDB Atlas (Cloud)
1. Create account at https://www.mongodb.com/atlas
2. Create a free cluster
3. Get the connection string
4. Update `MONGODB_URI` in your .env file

## JWT Secret Generation

Generate secure JWT secrets:

```bash
# Method 1: Using Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Method 2: Using OpenSSL
openssl rand -hex 64

# Method 3: Online generator
# Visit: https://www.grc.com/passwords.htm
```

## Installing Dependencies

```bash
# From the project root
npm install

# Install all dependencies (root, server, client)
npm run install:all

# Or install manually:
cd server && npm install && cd ../client && npm install && cd ..
```

## Semgrep Installation (Optional but Recommended)

```bash
# Using pip (Python package manager)
pip install semgrep

# Using pipx (isolated installation)
pipx install semgrep

# On macOS with Homebrew
brew install semgrep

# Verify installation
semgrep --version
```

## Running the Application

### Development Mode (Recommended)
```bash
# Runs both frontend and backend concurrently
npm run dev
```

### Individual Services
```bash
# Backend only (from /server directory)
cd server && npm run dev

# Frontend only (from /client directory)
cd client && npm start
```

## Verification Steps

1. **Check Backend**: Visit http://localhost:5000/api/health
2. **Check Frontend**: Visit http://localhost:3000
3. **Test GitHub OAuth**: Click "Continue with GitHub" button
4. **Check Database**: Verify MongoDB connection in server logs

## Common Issues & Solutions

### MongoDB Connection Error
```bash
# Check if MongoDB is running
ps aux | grep mongod

# Start MongoDB if not running
brew services start mongodb-community  # macOS
sudo systemctl start mongod            # Linux
```

### GitHub OAuth Callback Error
- Verify callback URL matches exactly: `http://localhost:3000/login`
- Check that CLIENT_ID and CLIENT_SECRET are correct
- Ensure no trailing spaces in environment variables

### Port Already in Use
```bash
# Find process using port 5000
lsof -i :5000

# Kill the process (replace PID with actual process ID)
kill -9 <PID>
```

### CORS Errors
- Verify CLIENT_URL is set correctly in server/.env
- Check that both frontend and backend are running
- Clear browser cache and cookies

## Production Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS URLs for all environment variables
- [ ] Use MongoDB Atlas or secured MongoDB instance
- [ ] Generate new JWT secrets for production
- [ ] Configure GitHub OAuth app with production URLs
- [ ] Set up proper logging and monitoring
- [ ] Configure reverse proxy (nginx) if needed
- [ ] Set up SSL/TLS certificates

## Security Considerations

1. **Never commit .env files** - Add them to .gitignore
2. **Use strong JWT secrets** - At least 64 characters
3. **Rotate secrets regularly** in production
4. **Use HTTPS** in production environments
5. **Implement rate limiting** for production APIs
6. **Monitor webhook endpoints** for abuse

## Getting Help

- Check server logs for detailed error messages
- Verify all environment variables are set
- Test individual components (MongoDB, GitHub OAuth, etc.)
- Refer to the main README.md for detailed documentation

Happy scanning! 🔒

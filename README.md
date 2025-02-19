# Mandolin Balaji - Portfolio Website

A portfolio website built with Astro, showcasing Mandolin Balaji's content and deployed to Firebase Hosting.

## 🚀 Quick Start Guide

### Prerequisites

1. Install Node.js
   - Download and install from [nodejs.org](https://nodejs.org/)
   - Recommended version: 20.x or later

2. Install Git
   - Download and install from [git-scm.com](https://git-scm.com/)

### Initial Setup

1. Clone the repository
   ```sh
   git clone https://github.com/sidkris77/mandolinbalajipwa.git
   cd mandolinbalajipwa
   ```

2. Install dependencies
   ```sh
   npm install
   ```

## 🧞 Available Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :----------------------- | :----------------------------------------------- |
| `npm install`            | Installs dependencies                            |
| `npm run dev`            | Starts local dev server at `localhost:4321`      |
| `npm run build`          | Build your production site to `./dist/`          |
| `npm run preview`        | Preview your build locally, before deploying     |
| `npm run astro ...`      | Run CLI commands like `astro add`, `astro check`|
| `npm run astro -- --help`| Get help using the Astro CLI                    |
| `npm run fetch-videos`   | Get all YouTube Videos into a JSON file         |
| `npm run deploy`         | Build and deploy to Firebase Hosting            |

## 🛠️ Development Workflow

1. Create a new branch for your changes
   ```sh
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and test locally
   ```sh
   npm run dev
   ```

3. Commit your changes
   ```sh
   git add .
   git commit -m "Description of your changes"
   ```

4. Push your changes
   ```sh
   git push origin feature/your-feature-name
   ```

5. Create a Pull Request on GitHub
   - Go to [https://github.com/sidkris77/mandolinbalajipwa/pulls](https://github.com/sidkris77/mandolinbalajipwa/pulls)
   - Click "New pull request"
   - Select your branch and create the PR

## 🚀 Deployment

The project uses GitHub Actions to automatically deploy to Firebase Hosting.

### Setup Firebase (First-time only)

1. Install Firebase CLI globally
   ```sh
   npm install -g firebase-tools
   ```

2. Login to Firebase
   ```sh
   firebase login
   ```

3. Initialize Firebase in your project
   ```sh
   firebase init hosting
   ```

### Deployment Process

1. Merging to `main` branch automatically triggers deployment
2. You can monitor deployments in:
   - [GitHub Actions tab](https://github.com/sidkris77/mandolinbalajipwa/actions)
   - Firebase Console under Hosting

### Manual Deployment

To manually deploy your changes:
```sh
npm run deploy
```

This command will:
1. Build your project (`npm run build`)
2. Deploy to Firebase Hosting (`firebase deploy`)

## 🧰 Project Structure

```
/
├── public/
│   └── assets/
├── src/
│   ├── components/
│   ├── content/
│   ├── layouts/
│   ├── pages/
│   └── styles/
└── package.json
```

## 🔧 Configuration Files

- `.github/workflows/` - GitHub Actions deployment configuration
- `firebase.json` - Firebase configuration
- `astro.config.mjs` - Astro configuration
- `tsconfig.json` - TypeScript configuration

## 📝 Development Notes

- Always run `npm run build` before deploying to check for build errors
- Test all changes locally using `npm run preview`
- Keep dependencies updated regularly
- Follow the existing code style and formatting

## 🤝 Contributing

1. Fork the [repository](https://github.com/sidkris77/mandolinbalajipwa)
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📫 Support

For any questions or issues:
1. Check existing [GitHub issues](https://github.com/sidkris77/mandolinbalajipwa/issues)
2. Create a new issue if needed
3. Contact the project maintainers